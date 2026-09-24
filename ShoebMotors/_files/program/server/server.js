/* =====================================================================
   Shoeb Motors & Tyre House  -  Local Server (Node.js version)
   Zero dependencies. Run:  node server.js

   Data storage:
     - Primary  : SQLite database  (shoeb.db)  via Node's built-in
                  node:sqlite module (Node 22.5+). Nothing to install.
     - Fallback : data.json text file, used automatically when node:sqlite
                  is not available on this machine.
     - A readable copy (data.json + invoices / stocks / customers folders
       + settings.json) is always kept so data is easy to inspect, back up
       and move to another computer.
   ===================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const os = require('os');
const { pathToFileURL } = require('url');

const ROOT = __dirname;
const APP_DIR = path.join(ROOT, '..', 'app');
const DEFAULT_DATA_DIR = path.resolve(ROOT, '..', '..', '..', 'Data');
const DATA_PATH_FILE = path.join(ROOT, 'data-path.txt');
const CLOUD_CONFIG_PATH = path.join(ROOT, 'cloud.private.json');
const PORT_FILE = path.join(ROOT, 'server-port.txt');
const AUTOSTART_REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const AUTOSTART_REG_VALUE = 'Shoeb Motors';

function legacyAutostartLink() {
  return process.env.APPDATA ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Shoeb Motors Auto Start.lnk') : '';
}
function autostartStatus() {
  if (process.platform !== 'win32') return { supported: false, enabled: false, registry: false, legacy: false };
  let registry = false;
  try {
    const q = childProcess.spawnSync('reg.exe', ['query', AUTOSTART_REG_KEY, '/v', AUTOSTART_REG_VALUE], { windowsHide: true, stdio: 'ignore' });
    registry = q.status === 0;
  } catch (e) {}
  const legacyPath = legacyAutostartLink();
  let legacy = false;
  try { legacy = !!legacyPath && fs.existsSync(legacyPath); } catch (e) {}
  return { supported: true, enabled: registry || legacy, registry, legacy };
}
function disableAutostart() {
  if (process.platform !== 'win32') return { ok: false, error: 'Windows only' };
  let registryRemoved = false;
  let legacyRemoved = false;
  try {
    const r = childProcess.spawnSync('reg.exe', ['delete', AUTOSTART_REG_KEY, '/v', AUTOSTART_REG_VALUE, '/f'], { windowsHide: true, stdio: 'ignore' });
    registryRemoved = r.status === 0;
  } catch (e) {}
  const legacyPath = legacyAutostartLink();
  try {
    if (legacyPath && fs.existsSync(legacyPath)) { fs.unlinkSync(legacyPath); legacyRemoved = true; }
  } catch (e) {}
  const st = autostartStatus();
  return { ok: !st.enabled, enabled: st.enabled, registryRemoved, legacyRemoved };
}

/* node:sqlite is built into modern Node — no npm install needed.
   If this machine's Node is older, we quietly fall back to JSON files. */
let sqlite = null;
try { sqlite = require('node:sqlite'); } catch (e) { sqlite = null; }

function log(t) { console.log(t); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function folderWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.write-test-' + Date.now());
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch (e) { return false; }
}

// On Windows ALL business data lives in ONE fixed folder, whatever folder the software
// or the .bat files are kept in. (SETUP / UPDATE copy any older data folder into it.)
const FIXED_DATA_DIR = process.platform === 'win32' ? 'D:\\Private\\Do Not Delete' : '';

function readConfiguredDataDir() {
  // Environment variable is useful for tests.
  const envDir = String(process.env.SHOEB_DATA_DIR || '').trim();
  if (envDir) return envDir;
  if (FIXED_DATA_DIR) return FIXED_DATA_DIR;
  // Non-Windows / development only: data-path.txt written by setup.
  try {
    const saved = fs.readFileSync(DATA_PATH_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
    if (saved) return saved;
  } catch (e) {}
  // Permanent data folder remembered by SETUP for this Windows user (survives app updates / re-extract).
  try {
    const base = process.env.LOCALAPPDATA;
    if (base) {
      const ptr = fs.readFileSync(path.join(base, 'ShoebMotors', 'data-dir.txt'), 'utf8').replace(/^\uFEFF/, '').trim();
      if (ptr) return ptr;
    }
  } catch (e) {}
  return DEFAULT_DATA_DIR;
}

const CONFIGURED_DATA_DIR = readConfiguredDataDir();
const DATA_DIR = (CONFIGURED_DATA_DIR && folderWritable(CONFIGURED_DATA_DIR)) ? CONFIGURED_DATA_DIR : '';
const BACKUP_DIR = DATA_DIR ? path.join(DATA_DIR, 'backups') : '';
const LATEST_GOOD_FILE = DATA_DIR ? path.join(BACKUP_DIR, 'latest-good.json') : '';
const DELETED_DIR = DATA_DIR ? path.join(DATA_DIR, 'deleted') : '';
const DELETED_BACKUP_DIR = DATA_DIR ? path.join(DATA_DIR, 'Deleted Backup') : '';
const STATE_FILE = DATA_DIR ? path.join(DATA_DIR, 'data.json') : '';
const DB_FILE = DATA_DIR ? path.join(DATA_DIR, 'shoeb.db') : '';      /* SQLite database */
const LOGIN_TRUST_FILE = DATA_DIR ? path.join(DATA_DIR, '.login-trusted') : '';
const CLOUD_PENDING_FILE = DATA_DIR ? path.join(DATA_DIR, 'cloud-pending.json') : ''; // legacy only; never auto-uploaded
const ONLINE_BACKUP_META_FILE = DATA_DIR ? path.join(DATA_DIR, 'manual-online-backup.json') : '';

function trustedLogin() {
  try { return !!LOGIN_TRUST_FILE && fs.existsSync(LOGIN_TRUST_FILE); } catch (e) { return false; }
}
function setTrustedLogin(on) {
  if (!LOGIN_TRUST_FILE) return false;
  try {
    if (on) fs.writeFileSync(LOGIN_TRUST_FILE, 'trusted\n', 'utf8');
    else if (fs.existsSync(LOGIN_TRUST_FILE)) fs.unlinkSync(LOGIN_TRUST_FILE);
    return true;
  } catch (e) { return false; }
}

/* ---- ফোল্ডার অনুযায়ী আলাদা কপি ----
   invoices\  → প্রতিটি ইনভয়েসের আলাদা ফাইল (INV-0001.json)
   stocks\    → সব পণ্যের তালিকা
   customers\ → কাস্টমারদের তালিকা
   settings.json → দোকানের নিজের তথ্য (নাম, ঠিকানা, পিন) */
const FOLDERS = ['invoices', 'stocks', 'customers'];
if (DATA_DIR) {
  FOLDERS.forEach(f => { try { fs.mkdirSync(path.join(DATA_DIR, f), { recursive: true }); } catch (e) {} });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(DELETED_DIR, { recursive: true });
  fs.mkdirSync(DELETED_BACKUP_DIR, { recursive: true });
}

function safeName(t) { return String(t == null ? '' : t).replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'file'; }
function writeJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1), 'utf8');
  fs.renameSync(tmp, file);
}

function findPdfBrowser() {
  const c = [];
  if (process.env.SHOEB_PDF_BROWSER) c.push(process.env.SHOEB_PDF_BROWSER);
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || '';
    const pfx = process.env['ProgramFiles(x86)'] || '';
    const la = process.env.LOCALAPPDATA || '';
    c.push(path.join(pfx, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    c.push(path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    c.push(path.join(la, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    c.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    c.push(path.join(pfx, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    c.push(path.join(la, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    for (const cmd of ['msedge.exe','chrome.exe']) {
      try { const w=childProcess.spawnSync('where.exe',[cmd],{windowsHide:true,encoding:'utf8'}); if(w.status===0 && w.stdout) c.push(String(w.stdout).split(/\r?\n/)[0].trim()); } catch(_){}
    }
  } else {
    c.push('/usr/bin/microsoft-edge','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser');
  }
  for (const x of c) { try { if (x && fs.existsSync(x)) return x; } catch(_){} }
  return '';
}
function fileDataUri(file, mime) {
  try { return 'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64'); } catch (_) { return ''; }
}
function selfContainedPdfHtml(inner, layout) {
  const cssFile = path.join(APP_DIR,'css','style.css');
  let css = ''; try { css = fs.readFileSync(cssFile,'utf8'); } catch(_){}
  const reg = fileDataUri(path.join(APP_DIR,'fonts','NotoSansBengali-Regular.woff2'),'font/woff2');
  const bold = fileDataUri(path.join(APP_DIR,'fonts','NotoSansBengali-Bold.woff2'),'font/woff2');
  if (reg) css = css.replace(/url\(["']?\.\.\/fonts\/NotoSansBengali-Regular\.woff2["']?\)/g, 'url("'+reg+'")');
  if (bold) css = css.replace(/url\(["']?\.\.\/fonts\/NotoSansBengali-Bold\.woff2["']?\)/g, 'url("'+bold+'")');
  css = css.replace(/font-display:\s*swap/gi,'font-display:block');
  let h = String(inner || '').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<(?:iframe|object|embed)\b[\s\S]*?<\/(?:iframe|object|embed)>/gi,'');
  const imgs = [['logo-print.jpg','image/jpeg'],['logo-thermal.jpg','image/jpeg'],['logo.png','image/png']];
  for (const it of imgs) {
    const u=fileDataUri(path.join(APP_DIR,'img',it[0]),it[1]);
    if (u) h=h.split('src="img/'+it[0]+'"').join('src="'+u+'"').split("src='img/"+it[0]+"'").join('src="'+u+'"');
  }
  const lay = layout === 'a5' ? 'a5' : (layout === '80' ? '80' : 'a4');
  const page = lay === 'a5' ? 'A5 portrait' : (lay === '80' ? '80mm auto' : 'A4 portrait');
  const margin = lay === '80' ? '2mm' : '4mm';
  return '<!doctype html><html><head><meta charset="utf-8"><style>'+css+'\n@page{size:'+page+';margin:'+margin+'}html,body{margin:0!important;padding:0!important;background:#fff!important}body{color:#111}.print-root{display:block!important}</style></head><body class="print-'+lay+'"><div class="print-root">'+h+'</div></body></html>';
}
function runBrowserPdf(browser, htmlFile, pdfFile, profileDir, legacyHeadless, cb) {
  const args = [legacyHeadless ? '--headless' : '--headless=new','--disable-gpu','--disable-background-networking','--disable-sync','--no-first-run','--no-default-browser-check','--disable-extensions','--virtual-time-budget=1500','--user-data-dir='+profileDir,'--no-pdf-header-footer','--print-to-pdf='+pdfFile];
  if (process.platform !== 'win32') args.push('--no-sandbox','--disable-dev-shm-usage');
  args.push(pathToFileURL(htmlFile).href);
  let done=false;
  let child;
  try { child=childProcess.spawn(browser,args,{windowsHide:true,stdio:'ignore'}); } catch(e){ return cb(e); }
  const finish=(err)=>{ if(done)return; done=true; clearTimeout(timer); cb(err); };
  const timer=setTimeout(()=>{ try{child.kill('SIGKILL')}catch(_){} finish(new Error('PDF generation timed out')); },15000);
  child.on('error',finish);
  child.on('exit',(code)=>{
    try { if (fs.existsSync(pdfFile) && fs.statSync(pdfFile).size > 500) return finish(null); } catch(_){}
    finish(new Error('PDF browser exited with code '+code));
  });
}
function createVectorPdf(inner, filename, layout, cb) {
  const browser=findPdfBrowser();
  if (!browser) return cb(new Error('Microsoft Edge or Google Chrome was not found'));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'shoeb-pdf-'));
  const htmlFile=path.join(tmp,'document.html'); const pdfFile=path.join(tmp,'document.pdf'); const profile=path.join(tmp,'profile');
  try { fs.mkdirSync(profile,{recursive:true}); fs.writeFileSync(htmlFile,selfContainedPdfHtml(inner,layout),'utf8'); } catch(e){ try{fs.rmSync(tmp,{recursive:true,force:true})}catch(_){} return cb(e); }
  const finish=(err)=>{
    if (!err) { try { const b=fs.readFileSync(pdfFile); fs.rmSync(tmp,{recursive:true,force:true}); return cb(null,b); } catch(e){ err=e; } }
    // Older Edge/Chrome versions use --headless rather than --headless=new.
    try { if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile); } catch(_){}
    runBrowserPdf(browser,htmlFile,pdfFile,profile,true,(err2)=>{
      if (!err2) { try { const b=fs.readFileSync(pdfFile); fs.rmSync(tmp,{recursive:true,force:true}); return cb(null,b); } catch(e){ err2=e; } }
      try{fs.rmSync(tmp,{recursive:true,force:true})}catch(_){} cb(err2 || err || new Error('PDF generation failed'));
    });
  };
  runBrowserPdf(browser,htmlFile,pdfFile,profile,false,finish);
}

function copyRecursiveSafe(src, dst) {
  try {
    if (!src || !fs.existsSync(src)) return;
    const st = fs.statSync(src);
    if (st.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      for (const name of fs.readdirSync(src)) copyRecursiveSafe(path.join(src, name), path.join(dst, name));
    } else if (st.isFile()) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  } catch (e) { log('  (!) portable backup copy: ' + e.message); }
}

function createPortableBackupZip() {
  if (!DATA_DIR || !BACKUP_DIR) return { ok:false, error:'Data folder unavailable' };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = 'ShoebMotors-FULL-' + stamp + '.zip';
  const zipPath = path.join(BACKUP_DIR, name);
  const stage = path.join(BACKUP_DIR, '.portable-' + process.pid + '-' + Date.now());
  try {
    fs.mkdirSync(stage, { recursive:true });
    const entries = [
      'shoeb.db', 'data.json', 'settings.json', 'manual-online-backup.json',
      'invoices', 'stocks', 'customers', 'deleted', 'Deleted Backup'
    ];
    for (const rel of entries) copyRecursiveSafe(path.join(DATA_DIR, rel), path.join(stage, rel));
    writeJson(path.join(stage, 'BACKUP-INFO.json'), {
      app:'Shoeb Motors', type:'FULL PORTABLE LOCAL BACKUP', createdAt:new Date().toISOString(),
      restoreNote:'Install Shoeb Motors, close the app, then restore these files into the Data folder if manual recovery is needed.'
    });
    if (process.platform !== 'win32') {
      return { ok:false, error:'Portable ZIP creation is supported on Windows client PCs.' };
    }
    const ps = childProcess.spawnSync('powershell.exe', [
      '-NoProfile','-ExecutionPolicy','Bypass','-Command',
      "Compress-Archive -Path '" + stage.replace(/'/g,"''") + "\\*' -DestinationPath '" + zipPath.replace(/'/g,"''") + "' -Force"
    ], { windowsHide:true, encoding:'utf8' });
    if (ps.status !== 0 || !fs.existsSync(zipPath)) {
      const err = String(ps.stderr || ps.stdout || 'Compress-Archive failed').trim();
      return { ok:false, error:err || 'Compress-Archive failed' };
    }
    // Keep only the newest 14 portable ZIPs.
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => /^ShoebMotors-FULL-.*\.zip$/i.test(f))
        .map(f => ({f,t:fs.statSync(path.join(BACKUP_DIR,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
      for (const x of files.slice(14)) { try { fs.unlinkSync(path.join(BACKUP_DIR,x.f)); } catch (_) {} }
    } catch (_) {}
    return { ok:true, file:name, path:zipPath };
  } catch (e) {
    return { ok:false, error:String(e && e.message || e) };
  } finally {
    try { fs.rmSync(stage, {recursive:true, force:true}); } catch (_) {}
  }
}
function writeStateFileAtomic(text) {
  const tmp = STATE_FILE + '.tmp.' + process.pid + '.' + Date.now();
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeFileSync(fd, text, 'utf8');
    // Flush file contents/metadata before the atomic rename. This materially reduces the
    // chance of losing the most recent sale on a sudden Windows/power failure.
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = null;
    fs.renameSync(tmp, STATE_FILE);
    const check = fs.readFileSync(STATE_FILE, 'utf8');
    if (check !== text) throw new Error('data.json read-back verification failed');
  } catch (e) {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}
function writeLatestGoodBackup(text) {
  if (!LATEST_GOOD_FILE) return;
  const tmp = LATEST_GOOD_FILE + '.tmp.' + process.pid + '.' + Date.now();
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = null;
    fs.renameSync(tmp, LATEST_GOOD_FILE);
  } catch (e) {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    log('  (!) latest-good backup: ' + e.message);
  }
}
/* পুরো তথ্যকে ফোল্ডার অনুযায়ী ভাগ করে সেভ করা হয় (প্রতিবার সেভের সময়) */
function writeFolders(state) {
  if (!DATA_DIR || !state || typeof state !== 'object') return;
  try {
    const sales = Array.isArray(state.sales) ? state.sales : [];
    const wanted = new Set();
    sales.forEach(s => {
      const name = safeName(s.invoiceNo || s.no || s.id) + '.json';
      wanted.add(name);
      writeJson(path.join(DATA_DIR, 'invoices', name), s);
    });
    /* তালিকা থেকে মুছে গেলে পুরনো ফাইলও সরিয়ে ফেলা হয় */
    try {
      fs.readdirSync(path.join(DATA_DIR, 'invoices')).forEach(f => {
        if (/\.json$/.test(f) && !wanted.has(f)) fs.unlinkSync(path.join(DATA_DIR, 'invoices', f));
      });
    } catch (e) {}
    writeJson(path.join(DATA_DIR, 'stocks', 'stocks.json'), state.products || []);
    writeJson(path.join(DATA_DIR, 'customers', 'customers.json'), state.customers || []);
    writeJson(path.join(DATA_DIR, 'settings.json'), state.settings || {});
  } catch (e) { log('  (!) folder copy: ' + e.message); }
}


/* =====================================================================
   SQLite layer
   ===================================================================== */
let db = null;
let canonicalCache = null;
let localMirrorTimer = null;
let localMirrorPending = null;
let readableMirrorChain = Promise.resolve();

function keyedDelta(before, after) {
  before = Array.isArray(before) ? before : []; after = Array.isArray(after) ? after : [];
  const a = new Map(), b = new Map();
  for (const x of before) { if (!x || x.id == null || x.id === '') return { full:true }; a.set(String(x.id), x); }
  for (const x of after) { if (!x || x.id == null || x.id === '') return { full:true }; b.set(String(x.id), x); }
  const changed = [], removed = [];
  for (const [id, x] of b) {
    const old = a.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(x)) changed.push({ before:old || null, after:x });
  }
  for (const [id, x] of a) if (!b.has(id)) removed.push(x);
  return { full:false, changed, removed };
}
function arrayChanged(before, after) {
  const d = keyedDelta(before, after);
  return d.full || d.changed.length > 0 || d.removed.length > 0;
}
async function writeTextAtomicAsync(file, text, verify) {
  const tmp = file + '.tmp.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(16).slice(2);
  let h = null;
  try {
    h = await fs.promises.open(tmp, 'w');
    await h.writeFile(text, 'utf8');
    await h.sync();
    await h.close(); h = null;
    await fs.promises.rename(tmp, file);
    if (verify) {
      const check = await fs.promises.readFile(file, 'utf8');
      if (check !== text) throw new Error(path.basename(file) + ' read-back verification failed');
    }
  } catch (e) {
    if (h) { try { await h.close(); } catch (_) {} }
    try { await fs.promises.unlink(tmp); } catch (_) {}
    throw e;
  }
}
async function writeJsonAtomicAsync(file, data) {
  await writeTextAtomicAsync(file, JSON.stringify(data, null, 1), false);
}
async function writeFoldersDeltaAsync(before, after, forceFull) {
  if (!DATA_DIR || !after || typeof after !== 'object') return;
  before = before && typeof before === 'object' ? before : {};
  const invDir = path.join(DATA_DIR, 'invoices');
  const salesDelta = forceFull ? { full:true } : keyedDelta(before.sales, after.sales);
  if (forceFull || salesDelta.full) {
    const wanted = new Set();
    for (const sale of (after.sales || [])) {
      const name = safeName(sale.invoiceNo || sale.no || sale.id) + '.json';
      wanted.add(name); await writeJsonAtomicAsync(path.join(invDir, name), sale);
    }
    try {
      const files = await fs.promises.readdir(invDir);
      for (const f of files) if (/\.json$/i.test(f) && !wanted.has(f)) { try { await fs.promises.unlink(path.join(invDir, f)); } catch (_) {} }
    } catch (_) {}
  } else {
    for (const pair of salesDelta.changed) {
      if (pair.before) {
        const oldName = safeName(pair.before.invoiceNo || pair.before.no || pair.before.id) + '.json';
        const newName = safeName(pair.after.invoiceNo || pair.after.no || pair.after.id) + '.json';
        if (oldName !== newName) { try { await fs.promises.unlink(path.join(invDir, oldName)); } catch (_) {} }
      }
      const name = safeName(pair.after.invoiceNo || pair.after.no || pair.after.id) + '.json';
      await writeJsonAtomicAsync(path.join(invDir, name), pair.after);
    }
    for (const sale of salesDelta.removed) {
      const name = safeName(sale.invoiceNo || sale.no || sale.id) + '.json';
      try { await fs.promises.unlink(path.join(invDir, name)); } catch (_) {}
    }
  }
  if (forceFull || arrayChanged(before.products, after.products)) await writeJsonAtomicAsync(path.join(DATA_DIR, 'stocks', 'stocks.json'), after.products || []);
  if (forceFull || arrayChanged(before.customers, after.customers)) await writeJsonAtomicAsync(path.join(DATA_DIR, 'customers', 'customers.json'), after.customers || []);
  if (forceFull || JSON.stringify(before.settings || {}) !== JSON.stringify(after.settings || {})) await writeJsonAtomicAsync(path.join(DATA_DIR, 'settings.json'), after.settings || {});
}
function enqueueReadableMirrors(job) {
  readableMirrorChain = readableMirrorChain.then(async () => {
    if (db) await writeTextAtomicAsync(STATE_FILE, job.text, true);
    if (LATEST_GOOD_FILE) await writeTextAtomicAsync(LATEST_GOOD_FILE, job.text, false);
    await writeFoldersDeltaAsync(job.before, job.obj, job.forceFull);
  }).catch(e => log('  (!) readable mirror: ' + e.message));
}

// Normal saves update only changed mirror rows/files after a short quiet period.
// Canonical SQLite remains the immediate durable save and cloud is never touched here.
function scheduleLocalMirrorMaintenance(before, obj, text, forceFull) {
  if (localMirrorPending) {
    localMirrorPending.obj = obj;
    localMirrorPending.text = text;
    localMirrorPending.forceFull = localMirrorPending.forceFull || !!forceFull;
  } else {
    localMirrorPending = { before:before || {}, obj:obj, text:text, forceFull:!!forceFull };
  }
  if (localMirrorTimer) clearTimeout(localMirrorTimer);
  localMirrorTimer = setTimeout(() => {
    localMirrorTimer = null;
    const job = localMirrorPending;
    localMirrorPending = null;
    if (!job || !job.obj) return;
    try { if (db) syncMirrorDelta(job.before, job.obj, job.forceFull); } catch (e) { log('  (!) sqlite incremental mirror: ' + e.message); }
    enqueueReadableMirrors(job);
  }, 1500);
  if (localMirrorTimer && localMirrorTimer.unref) localMirrorTimer.unref();
}


const SCHEMA = `
CREATE TABLE IF NOT EXISTS state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT, brand TEXT, type TEXT, size TEXT,
  position TEXT, qty REAL, buyPrice REAL, sellPrice REAL,
  pricePending INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
  data TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, name TEXT, nameBn TEXT, phone TEXT, address TEXT,
  data TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, invoice_no TEXT, date TEXT, customer_id TEXT,
  customer_name TEXT, vehicle_no TEXT, sub_total REAL, discount REAL,
  total REAL, paid REAL, due REAL, cost REAL, profit REAL,
  data TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id TEXT, product_id TEXT,
  name TEXT, brand TEXT, size TEXT, position TEXT, qty REAL,
  price REAL, total REAL, cost REAL, price_pending INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY, no TEXT, type TEXT, sale_id TEXT, invoice_no TEXT,
  customer_id TEXT, amount REAL, date TEXT, note TEXT, data TEXT
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, date TEXT, amount REAL, data TEXT
);
CREATE TABLE IF NOT EXISTS day_closings (
  id TEXT PRIMARY KEY, date TEXT, expected_cash REAL, actual_cash REAL,
  difference REAL, data TEXT
);
CREATE TABLE IF NOT EXISTS deleted (
  id TEXT PRIMARY KEY, type TEXT, label TEXT, at TEXT, data TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_receipts_sale ON receipts(sale_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
`;

function openDb() {
  if (!DATA_DIR || !sqlite) return null;
  try {
    const d = new sqlite.DatabaseSync(DB_FILE);
    d.exec('PRAGMA journal_mode = WAL;');
    d.exec('PRAGMA synchronous = FULL;');
    d.exec('PRAGMA foreign_keys = ON;');
    d.exec(SCHEMA);
    return d;
  } catch (e) {
    log('  (!) SQLite could not be opened (' + e.message + ') — using data.json instead.');
    return null;
  }
}
db = openDb();

/* প্রতিটা সেভে SQLite-এর ভেতরের আলাদা টেবিলগুলোও হালনাগাদ করা হয়,
   যাতে তথ্য সরাসরি SQL দিয়ে খোঁজা ও দেখা যায়। */
function syncMirror(obj) {
  if (!db) return;
  const now = new Date().toISOString();
  const insSet = db.prepare('INSERT INTO settings (key,value) VALUES (?,?)');
  const insP = db.prepare('INSERT INTO products (id,name,brand,type,size,position,qty,buyPrice,sellPrice,pricePending,active,data,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insC = db.prepare('INSERT INTO customers (id,name,nameBn,phone,address,data,updated_at) VALUES (?,?,?,?,?,?,?)');
  const insS = db.prepare('INSERT INTO sales (id,invoice_no,date,customer_id,customer_name,vehicle_no,sub_total,discount,total,paid,due,cost,profit,data,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insI = db.prepare('INSERT INTO sale_items (sale_id,product_id,name,brand,size,position,qty,price,total,cost,price_pending) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const insR = db.prepare('INSERT INTO receipts (id,no,type,sale_id,invoice_no,customer_id,amount,date,note,data) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const insE = db.prepare('INSERT INTO expenses (id,date,amount,data) VALUES (?,?,?,?)');
  const insD = db.prepare('INSERT INTO day_closings (id,date,expected_cash,actual_cash,difference,data) VALUES (?,?,?,?,?,?)');
  const insX = db.prepare('INSERT INTO deleted (id,type,label,at,data) VALUES (?,?,?,?,?)');
  try {
    db.exec('BEGIN IMMEDIATE');
    ['settings', 'products', 'customers', 'sales', 'sale_items', 'receipts', 'expenses', 'day_closings', 'deleted']
      .forEach(t => db.exec('DELETE FROM ' + t));

    Object.keys(obj.settings || {}).forEach(k => insSet.run(k, JSON.stringify(obj.settings[k])));

    (obj.products || []).forEach(p => insP.run(
      String(p.id || ''), p.name || null, p.brand || null, p.type || null, p.size || null, p.position || null,
      num(p.qty), num(p.buyPrice), num(p.sellPrice), p.pricePending ? 1 : 0, p.active === false ? 0 : 1,
      JSON.stringify(p), p.updatedAt || now));

    (obj.customers || []).forEach(c => insC.run(
      String(c.id || ''), c.name || null, c.nameBn || null, c.phone || null, c.address || c.addressBn || null,
      JSON.stringify(c), c.updatedAt || now));

    (obj.sales || []).forEach(s => {
      insS.run(String(s.id || ''), s.invoiceNo || null, s.date || null, s.customerId || null,
        s.customerName || s.customerNameBn || null, s.vehicleNo || null,
        num(s.subTotal), num(s.discount), num(s.total), num(s.paid), num(s.due), num(s.cost), num(s.profit),
        JSON.stringify(s), s.updatedAt || now);
      (s.items || []).forEach(i => insI.run(
        String(s.id || ''), i.productId || null, i.name || null, i.brand || null, i.size || null, i.position || null,
        num(i.qty), num(i.price), num(i.total), num(i.cost), i.pricePending ? 1 : 0));
    });

    (obj.receipts || []).forEach(r => insR.run(
      String(r.id || ''), r.no || null, r.type || null, r.saleId || null, r.invoiceNo || null,
      r.customerId || null, num(r.amount), r.date || null, r.note || null, JSON.stringify(r)));

    (obj.expenses || []).forEach(e => insE.run(
      String(e.id || ''), e.date || null, num(e.amount), JSON.stringify(e)));

    (obj.dayClosings || []).forEach(dc => insD.run(
      String(dc.id || ''), dc.date || null, num(dc.expectedCash), num(dc.actualCash), num(dc.difference), JSON.stringify(dc)));

    (obj.deleted || []).forEach(d => insX.run(
      String(d.id || ''), d.type || null, d.label || null, d.at || null, JSON.stringify(d)));

    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    log('  (!) sqlite tables: ' + e.message);
  }
}

function syncMirrorDelta(before, after, forceFull) {
  if (!db) return;
  if (forceFull) return syncMirror(after);
  before = before && typeof before === 'object' ? before : {};
  after = after && typeof after === 'object' ? after : {};
  const dp = keyedDelta(before.products, after.products);
  const dc = keyedDelta(before.customers, after.customers);
  const ds = keyedDelta(before.sales, after.sales);
  const dr = keyedDelta(before.receipts, after.receipts);
  const de = keyedDelta(before.expenses, after.expenses);
  const dd = keyedDelta(before.dayClosings, after.dayClosings);
  const dx = keyedDelta(before.deleted, after.deleted);
  if ([dp,dc,ds,dr,de,dd,dx].some(x => x.full)) return syncMirror(after);

  const now = new Date().toISOString();
  const upP = db.prepare('INSERT INTO products (id,name,brand,type,size,position,qty,buyPrice,sellPrice,pricePending,active,data,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,type=excluded.type,size=excluded.size,position=excluded.position,qty=excluded.qty,buyPrice=excluded.buyPrice,sellPrice=excluded.sellPrice,pricePending=excluded.pricePending,active=excluded.active,data=excluded.data,updated_at=excluded.updated_at');
  const upC = db.prepare('INSERT INTO customers (id,name,nameBn,phone,address,data,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,nameBn=excluded.nameBn,phone=excluded.phone,address=excluded.address,data=excluded.data,updated_at=excluded.updated_at');
  const upS = db.prepare('INSERT INTO sales (id,invoice_no,date,customer_id,customer_name,vehicle_no,sub_total,discount,total,paid,due,cost,profit,data,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET invoice_no=excluded.invoice_no,date=excluded.date,customer_id=excluded.customer_id,customer_name=excluded.customer_name,vehicle_no=excluded.vehicle_no,sub_total=excluded.sub_total,discount=excluded.discount,total=excluded.total,paid=excluded.paid,due=excluded.due,cost=excluded.cost,profit=excluded.profit,data=excluded.data,updated_at=excluded.updated_at');
  const insI = db.prepare('INSERT INTO sale_items (sale_id,product_id,name,brand,size,position,qty,price,total,cost,price_pending) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const upR = db.prepare('INSERT INTO receipts (id,no,type,sale_id,invoice_no,customer_id,amount,date,note,data) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET no=excluded.no,type=excluded.type,sale_id=excluded.sale_id,invoice_no=excluded.invoice_no,customer_id=excluded.customer_id,amount=excluded.amount,date=excluded.date,note=excluded.note,data=excluded.data');
  const upE = db.prepare('INSERT INTO expenses (id,date,amount,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,amount=excluded.amount,data=excluded.data');
  const upD = db.prepare('INSERT INTO day_closings (id,date,expected_cash,actual_cash,difference,data) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,expected_cash=excluded.expected_cash,actual_cash=excluded.actual_cash,difference=excluded.difference,data=excluded.data');
  const upX = db.prepare('INSERT INTO deleted (id,type,label,at,data) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,label=excluded.label,at=excluded.at,data=excluded.data');
  try {
    db.exec('BEGIN IMMEDIATE');
    if (JSON.stringify(before.settings || {}) !== JSON.stringify(after.settings || {})) {
      db.exec('DELETE FROM settings');
      const insSet = db.prepare('INSERT INTO settings (key,value) VALUES (?,?)');
      Object.keys(after.settings || {}).forEach(k => insSet.run(k, JSON.stringify(after.settings[k])));
    }
    dp.removed.forEach(x => db.prepare('DELETE FROM products WHERE id=?').run(String(x.id)));
    dp.changed.forEach(({after:p}) => upP.run(String(p.id||''),p.name||null,p.brand||null,p.type||null,p.size||null,p.position||null,num(p.qty),num(p.buyPrice),num(p.sellPrice),p.pricePending?1:0,p.active===false?0:1,JSON.stringify(p),p.updatedAt||now));
    dc.removed.forEach(x => db.prepare('DELETE FROM customers WHERE id=?').run(String(x.id)));
    dc.changed.forEach(({after:c}) => upC.run(String(c.id||''),c.name||null,c.nameBn||null,c.phone||null,c.address||c.addressBn||null,JSON.stringify(c),c.updatedAt||now));
    ds.removed.forEach(x => { db.prepare('DELETE FROM sale_items WHERE sale_id=?').run(String(x.id)); db.prepare('DELETE FROM sales WHERE id=?').run(String(x.id)); });
    ds.changed.forEach(({after:s}) => {
      upS.run(String(s.id||''),s.invoiceNo||null,s.date||null,s.customerId||null,s.customerName||s.customerNameBn||null,s.vehicleNo||null,num(s.subTotal),num(s.discount),num(s.total),num(s.paid),num(s.due),num(s.cost),num(s.profit),JSON.stringify(s),s.updatedAt||now);
      db.prepare('DELETE FROM sale_items WHERE sale_id=?').run(String(s.id||''));
      (s.items||[]).forEach(i => insI.run(String(s.id||''),i.productId||null,i.name||null,i.brand||null,i.size||null,i.position||null,num(i.qty),num(i.price),num(i.total),num(i.cost),i.pricePending?1:0));
    });
    dr.removed.forEach(x => db.prepare('DELETE FROM receipts WHERE id=?').run(String(x.id)));
    dr.changed.forEach(({after:r}) => upR.run(String(r.id||''),r.no||null,r.type||null,r.saleId||null,r.invoiceNo||null,r.customerId||null,num(r.amount),r.date||null,r.note||null,JSON.stringify(r)));
    de.removed.forEach(x => db.prepare('DELETE FROM expenses WHERE id=?').run(String(x.id)));
    de.changed.forEach(({after:e}) => upE.run(String(e.id||''),e.date||null,num(e.amount),JSON.stringify(e)));
    dd.removed.forEach(x => db.prepare('DELETE FROM day_closings WHERE id=?').run(String(x.id)));
    dd.changed.forEach(({after:d}) => upD.run(String(d.id||''),d.date||null,num(d.expectedCash),num(d.actualCash),num(d.difference),JSON.stringify(d)));
    dx.removed.forEach(x => db.prepare('DELETE FROM deleted WHERE id=?').run(String(x.id)));
    dx.changed.forEach(({after:d}) => upX.run(String(d.id||''),d.type||null,d.label||null,d.at||null,JSON.stringify(d)));
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw e;
  }
}

/* SQLite-এ পুরো state থেকে canonical লেখা */
function persistState(obj) {
  if (!DATA_DIR) throw new Error('Configured offline data folder is not writable.');
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Invalid state object.');
  const beforeWrap = readCanonical();
  const before = beforeWrap && beforeWrap.obj && typeof beforeWrap.obj === 'object' ? beforeWrap.obj : {};
  const text = JSON.stringify(obj);
  let forceFullMirror = false;

  // Fast critical path: canonical state is one local SQLite WAL transaction.
  // The readable/normalized mirrors are incremental and deferred.
  if (db) {
    try {
      const hadState = !!db.prepare('SELECT 1 AS x FROM state WHERE id=1').get();
      forceFullMirror = !hadState;
      db.exec('BEGIN IMMEDIATE');
      db.prepare('INSERT INTO state (id,json,updated_at) VALUES (1,?,?) ' +
        'ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at')
        .run(text, (obj.meta && obj.meta.updatedAt) || new Date().toISOString());
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw new Error('SQLite save failed: ' + e.message);
    }
  } else {
    // Older Node fallback: data.json remains the synchronous local canonical copy.
    writeStateFileAtomic(text);
  }

  canonicalCache = { text:text, obj:obj };
  scheduleLocalMirrorMaintenance(before, obj, text, forceFullMirror);
  return text;
}

function readNewestValidBackup() {
  if (!BACKUP_DIR) return null;
  let best = null;
  try {
    const names = fs.readdirSync(BACKUP_DIR)
      .filter(f => f === 'latest-good.json' || f === 'last-version.json' || /^data-.*\.json$/.test(f));
    for (const f of names) {
      try {
        const text = fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8');
        const obj = JSON.parse(text);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Object.keys(obj).length) continue;
        const candidate = { text: JSON.stringify(obj), obj, recoveredFromBackup: f };
        if (!best || newerThan(candidate.obj, best.obj)) best = candidate;
      } catch (_) {}
    }
  } catch (_) {}
  return best;
}

function readCanonical() {
  if (canonicalCache && canonicalCache.obj) return canonicalCache;
  if (!DATA_DIR) return { text: '{}', obj: {} };
  let dbCopy = null, fileCopy = null;
  if (db) {
    try {
      const row = db.prepare('SELECT json FROM state WHERE id = 1').get();
      if (row && row.json) dbCopy = { text: row.json, obj: JSON.parse(row.json) };
    } catch (e) {}
  }
  try {
    if (fs.existsSync(STATE_FILE)) {
      const text = fs.readFileSync(STATE_FILE, 'utf8');
      fileCopy = { text, obj: JSON.parse(text) };
    }
  } catch (e) {}

  let chosen = null;
  if (dbCopy && fileCopy) chosen = newerThan(fileCopy.obj, dbCopy.obj) ? fileCopy : dbCopy;
  else chosen = dbCopy || fileCopy || readNewestValidBackup() || { text: '{}', obj: {} };
  canonicalCache = chosen;
  return chosen;
}

function stampOf(o) {
  const x = o && o.meta && (o.meta.updatedAt || o.meta.createdAt);
  const t = x ? Date.parse(x) : 0; return Number.isFinite(t) ? t : 0;
}
function seqOf(o) {
  const n = o && o.meta ? Number(o.meta.saveSeq || 0) : 0;
  return Number.isFinite(n) ? n : 0;
}
function sameLineage(a, b) {
  const ac = a && a.meta && a.meta.createdAt;
  const bc = b && b.meta && b.meta.createdAt;
  return !!(ac && bc && ac === bc);
}
function newerThan(a, b) {
  if (!b) return !!a;
  if (!a) return false;
  if (sameLineage(a, b) && seqOf(a) !== seqOf(b)) return seqOf(a) > seqOf(b);
  return stampOf(a) > stampOf(b);
}

/* প্রথমবার চালু হলে আগের data.json থেকে তথ্য SQLite-এ তুলে নেওয়া হয়।
   পরে যেটা নতুন (data.json না database) সেটাই রাখা হয়। */
function bootImport() {
  if (!DATA_DIR || !db) return;
  let dbObj = null;
  try { const r = db.prepare('SELECT json FROM state WHERE id = 1').get(); if (r && r.json) dbObj = JSON.parse(r.json); } catch (e) {}
  let fileObj = null;
  try { if (fs.existsSync(STATE_FILE)) fileObj = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
  if (!dbObj && fileObj) {
    persistState(fileObj);
    log('  SQLite  :  existing data.json imported into the database.');
  } else if (dbObj && fileObj && newerThan(fileObj, dbObj)) {
    persistState(fileObj);
    log('  SQLite  :  data.json was newer — database updated.');
  } else if (dbObj) {
    // The mirror tables are already updated on every save. Rebuilding all of them on
    // every launch only delays startup on large shops, so the canonical state row is
    // used immediately here.
  }
}
bootImport();

const TEXTY = /^(text\/|application\/(javascript|json))/;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf'
};

function send(res, status, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function pruneBackups(keep) {
  if (!BACKUP_DIR) return;
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => /^data-.*\.json$/.test(f))
      .map(f => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(keep).forEach(x => { try { fs.unlinkSync(path.join(BACKUP_DIR, x.f)); } catch (e) {} });
  } catch (e) {}
}

function writeConflictSnapshot(obj, reason) {
  if (!DELETED_DIR) return '';
  fs.mkdirSync(DELETED_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(DELETED_DIR, stamp + '__conflict-state.json');
  const text = JSON.stringify({ type:'conflict-state', at:new Date().toISOString(), reason:reason || 'stale-save', data:obj });
  const tmp = file + '.tmp.' + process.pid;
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = null;
    fs.renameSync(tmp, file);
    if (fs.readFileSync(file, 'utf8') !== text) throw new Error('conflict snapshot verification failed');
    return path.basename(file);
  } catch (e) {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    log('  (!) conflict recovery copy: ' + e.message);
    return '';
  }
}

function writeDeletedBackup(obj) {
  if (!DELETED_BACKUP_DIR) throw new Error('Deleted Backup folder is unavailable.');
  fs.mkdirSync(DELETED_BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(DELETED_BACKUP_DIR, 'deleted-backup-' + stamp + '.json');
  // The backup is intentionally outside the live state/database so a full reset cannot erase it.
  writeJson(file, obj || {});
  return file;
}
function clearDirContents(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(name => {
    try { fs.rmSync(path.join(dir, name), { recursive:true, force:true }); } catch (_) {}
  });
}
function cancelQueuedCloudPush(dropDisk) {
  cloudPendingState = null;
  if (cloudRetryTimer) clearTimeout(cloudRetryTimer);
  cloudRetryTimer = null;
  if (dropDisk) clearCloudPendingFile();
}
async function waitForCloudIdle(maxMs) {
  const until = Date.now() + (maxMs || 14000);
  while (cloudSyncBusy && Date.now() < until) await new Promise(r => setTimeout(r, 80));
  return !cloudSyncBusy;
}

/* The shop app is local-only. Remote owner viewing is cloud-based through
   Google Apps Script + Supabase, so the shop server stays local-only. */
const HOST = process.env.SHOEB_HOST || '127.0.0.1';
const FORCED_PORT = parseInt(process.env.SHOEB_PORT || '0', 10) || 0;


function cloudConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CLOUD_CONFIG_PATH, 'utf8'));
    return c && c.enabled && c.appsScriptUrl && c.secret ? c : null;
  } catch (e) { return null; }
}
const BUSINESS_ARRAY_KEYS = ['products','customers','sales','receipts','payments','expenses','heldSales','dayClosings','deleted'];
function businessStateEmpty(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  return BUSINESS_ARRAY_KEYS.every(k => !Array.isArray(state[k]) || state[k].length === 0);
}
function localBusinessMirrorsEmpty() {
  const errors = [];
  try {
    const invoiceDir = path.join(DATA_DIR, 'invoices');
    const invoiceFiles = fs.existsSync(invoiceDir) ? fs.readdirSync(invoiceDir).filter(f => /\.json$/i.test(f)) : [];
    if (invoiceFiles.length) errors.push('invoice folder still has ' + invoiceFiles.length + ' file(s)');
  } catch (e) { errors.push('invoice folder verify failed: ' + e.message); }
  try {
    const stocksFile = path.join(DATA_DIR, 'stocks', 'stocks.json');
    const stocks = fs.existsSync(stocksFile) ? JSON.parse(fs.readFileSync(stocksFile, 'utf8')) : [];
    if (!Array.isArray(stocks) || stocks.length) errors.push('stocks mirror is not empty');
  } catch (e) { errors.push('stocks mirror verify failed: ' + e.message); }
  try {
    const customersFile = path.join(DATA_DIR, 'customers', 'customers.json');
    const customers = fs.existsSync(customersFile) ? JSON.parse(fs.readFileSync(customersFile, 'utf8')) : [];
    if (!Array.isArray(customers) || customers.length) errors.push('customers mirror is not empty');
  } catch (e) { errors.push('customers mirror verify failed: ' + e.message); }
  if (db) {
    for (const table of ['products','customers','sales','sale_items','receipts','expenses','day_closings','deleted']) {
      try {
        const row = db.prepare('SELECT COUNT(*) AS n FROM ' + table).get();
        if (Number(row && row.n || 0) !== 0) errors.push('SQLite ' + table + ' still has rows');
      } catch (e) { errors.push('SQLite ' + table + ' verify failed: ' + e.message); }
    }
  }
  return { ok: errors.length === 0, errors };
}

async function cloudCall(action, state) {
  const c = cloudConfig();
  if (!c || typeof fetch !== 'function') return null;
  try {
    const payload = { action, secret: c.secret };
    if (state !== undefined) payload.state = state;
    const controller = new AbortController();
    // Cloud sync always runs in the background, so it may wait a little longer than
    // startup/setup without slowing the shop UI. This gives the secondary Google
    // destination enough time to confirm a save when Supabase is unavailable.
    const timer = setTimeout(() => controller.abort(), action === 'ping' ? 5000 : (action === 'pull' ? 20000 : 45000));
    const r = await fetch(c.appsScriptUrl, { method:'POST', headers:{'Content-Type':'application/json; charset=utf-8'}, body:JSON.stringify(payload), signal:controller.signal, redirect:'follow' });
    clearTimeout(timer);
    const text = await r.text();
    try { return JSON.parse(text); } catch (_) { return null; }
  } catch (e) { return null; }
}

let cloudPendingState = null;
let cloudRetryTimer = null;
let cloudSyncBusy = false;
let cloudLastAttemptAt = '';
let cloudLastSuccessAt = '';
let cloudLastCompleteAt = '';
let cloudLastResult = null;

function localDayString(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (!d || !Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function readOnlineBackupMeta() {
  try {
    if (!ONLINE_BACKUP_META_FILE || !fs.existsSync(ONLINE_BACKUP_META_FILE)) return {};
    const j = JSON.parse(fs.readFileSync(ONLINE_BACKUP_META_FILE, 'utf8'));
    return j && typeof j === 'object' ? j : {};
  } catch (_) { return {}; }
}
function writeOnlineBackupMeta(at, state) {
  if (!ONLINE_BACKUP_META_FILE) return;
  try {
    writeJson(ONLINE_BACKUP_META_FILE, {
      lastCompleteAt: at || new Date().toISOString(),
      stateUpdatedAt: state && state.meta && state.meta.updatedAt || '',
      saveSeq: seqOf(state)
    });
  } catch (e) { log('  (!) manual online backup metadata: ' + e.message); }
}


function persistCloudPending(state) {
  if (!CLOUD_PENDING_FILE || !state || typeof state !== 'object') return;
  try { writeJson(CLOUD_PENDING_FILE, state); } catch (e) { log('  (!) cloud queue: ' + e.message); }
}
function readCloudPending() {
  if (!CLOUD_PENDING_FILE) return null;
  try {
    if (!fs.existsSync(CLOUD_PENDING_FILE)) return null;
    const j = JSON.parse(fs.readFileSync(CLOUD_PENDING_FILE, 'utf8'));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null;
  } catch (e) { return null; }
}
function clearCloudPendingFile() {
  if (!CLOUD_PENDING_FILE) return;
  try { if (fs.existsSync(CLOUD_PENDING_FILE)) fs.unlinkSync(CLOUD_PENDING_FILE); } catch (e) {}
}
function scheduleCloudRetry() { return; }
function queueCloudPush() { return; }

function cloudStatusPayload() {
  const meta = readOnlineBackupMeta();
  const local = readCanonical().obj || {};
  const localUpdatedAt = local && local.meta && local.meta.updatedAt || '';
  const lastCompleteAt = cloudLastCompleteAt || meta.lastCompleteAt || '';
  const localStamp = localUpdatedAt ? Date.parse(localUpdatedAt) : 0;
  const backupStamp = lastCompleteAt ? Date.parse(lastCompleteAt) : 0;
  const unsynced = Number.isFinite(localStamp) && localStamp > 0 && (!Number.isFinite(backupStamp) || localStamp > backupStamp);
  const localChangeDay = localDayString(localUpdatedAt);
  const needsReminder = !!(unsynced && localChangeDay && localChangeDay < localDayString(new Date()));
  const last = cloudLastResult && typeof cloudLastResult === 'object' ? cloudLastResult : null;
  return {
    ok: true,
    enabled: !!cloudConfig(),
    manualOnly: true,
    pending: unsynced,
    busy: cloudSyncBusy,
    needsReminder: needsReminder,
    localUpdatedAt: localUpdatedAt,
    lastAttemptAt: cloudLastAttemptAt || '',
    lastSuccessAt: cloudLastSuccessAt || lastCompleteAt || '',
    lastCompleteAt: lastCompleteAt,
    lastComplete: !!lastCompleteAt,
    lastError: last && !last.ok ? String(last.error || 'online backup failed') : ''
  };
}

async function runQueuedCloudPush() { return null; }

async function reconcileCloudOnBoot() { return null; }

function writePreReplaceBackup(current) {
  if (!BACKUP_DIR || !current || !current.obj || !Object.keys(current.obj).length) return;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(BACKUP_DIR, 'data-cloud-before-' + stamp + '.json');
    writeJson(file, current.obj);
    pruneBackups(60);
  } catch (e) { log('  (!) pre-cloud backup: ' + e.message); }
}
function saveLocalStateObj(obj) {
  try {
    const before = readCanonical();
    const incoming = obj && typeof obj === 'object' ? JSON.stringify(obj) : '';
    if (before && before.obj && Object.keys(before.obj).length && before.text !== incoming) writePreReplaceBackup(before);
    return persistState(obj);
  } catch (e) { return '{}'; }
}
async function reconciledStateText() { return readCanonical().text; }

const server = http.createServer((req, res) => {
  let pathname = '/';
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) {}
  const port = server.address() ? server.address().port : 8080;

  if (pathname === '/api/info') {
    return send(res, 200, JSON.stringify({ ok: true, mode: 'server', server: 'node', port,
      configured: !!DATA_DIR, backend: DATA_DIR ? (db ? 'sqlite' : 'json') : 'none', dataDir: DATA_DIR || '',
      savedDataDir: CONFIGURED_DATA_DIR || '',
      pathStatus: DATA_DIR ? 'ready' : (CONFIGURED_DATA_DIR ? 'unavailable' : 'not-set'),
      trustedLogin: trustedLogin(),
      lan: false, ips: [] }), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/login-trust/on' && req.method === 'POST') {
    const ok = setTrustedLogin(true);
    return send(res, ok ? 200 : 500, JSON.stringify({ ok, trustedLogin: ok }), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/login-trust/off' && req.method === 'POST') {
    const ok = setTrustedLogin(false);
    return send(res, ok ? 200 : 500, JSON.stringify({ ok, trustedLogin: false }), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/autostart' && req.method === 'GET') {
    return send(res, 200, JSON.stringify(Object.assign({ ok: true }, autostartStatus())), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/autostart/off' && req.method === 'POST') {
    const out = disableAutostart();
    return send(res, out.ok ? 200 : 500, JSON.stringify(out), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/db-info') {
    const info = { ok: true, configured: !!DATA_DIR, backend: DATA_DIR ? (db ? 'sqlite' : 'json') : 'none', database: db ? DB_FILE : null, file: STATE_FILE || null, tables: {} };
    if (db) {
      ['products','customers','sales','sale_items','receipts','expenses','day_closings','deleted']
        .forEach(t => { try { info.tables[t] = db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n; } catch (e) {} });
    }
    return send(res, 200, JSON.stringify(info), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/state' && req.method === 'GET') {
    if (!DATA_DIR) return send(res, 200, '{}', 'application/json; charset=utf-8');
    const current = readCanonical();
    if (current.obj && Object.keys(current.obj).length) {
      if (current.recoveredFromBackup) {
        try { persistState(current.obj); log('  Recovery: restored canonical state from ' + current.recoveredFromBackup); } catch (_) {}
      }
      return send(res, 200, current.text, 'application/json; charset=utf-8');
    }
    // Manual-only build: an empty local folder stays empty. Never pull cloud on boot/load.
    return send(res, 200, '{}', 'application/json; charset=utf-8');
  }
  if (pathname === '/api/cloud/status') {
    return send(res, 200, JSON.stringify(cloudStatusPayload()), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/cloud/push' && req.method === 'POST') {
    const obj = readCanonical().obj;
    if (!cloudConfig()) {
      return send(res, 503, JSON.stringify({ok:false, enabled:false, manualOnly:true, error:'online backup is not configured'}), 'application/json; charset=utf-8');
    }
    if (!obj || !Object.keys(obj).length) {
      return send(res, 200, JSON.stringify({ok:true, complete:true, manualOnly:true, skipped:true}), 'application/json; charset=utf-8');
    }
    if (cloudSyncBusy) {
      return send(res, 409, JSON.stringify(Object.assign(cloudStatusPayload(), {ok:false, complete:false, error:'manual online backup is already running'})), 'application/json; charset=utf-8');
    }

    // EXPLICIT MANUAL ACTION ONLY. No queue, retry timer, boot sync or save hook.
    const portableZip = createPortableBackupZip();
    cloudSyncBusy = true;
    cloudLastAttemptAt = new Date().toISOString();
    cloudCall('push', obj).then(r => {
      cloudLastResult = r || {ok:false, error:'online backup request failed'};
      const complete = !!(r && r.ok && r.complete !== false);
      const recoverySafe = !!(complete || (r && r.supabase === true && r.sheet === true));
      if (recoverySafe) {
        cloudLastSuccessAt = new Date().toISOString();
        cloudLastCompleteAt = cloudLastSuccessAt;
        writeOnlineBackupMeta(cloudLastCompleteAt, obj);
      }
      cloudSyncBusy = false;
      const st = cloudStatusPayload();
      const parts = r && typeof r === 'object' ? {supabase:r.supabase, sheet:r.sheet, cloud:r.cloud} : {};
      if (complete) return send(res, 200, JSON.stringify(Object.assign(st, parts, {ok:true, complete:true, recoverySafe:true, localZip:portableZip && portableZip.ok ? portableZip.file : '', localZipOk:!!(portableZip && portableZip.ok)})), 'application/json; charset=utf-8');
      if (recoverySafe) return send(res, 200, JSON.stringify(Object.assign(st, parts, {ok:true, complete:false, recoverySafe:true, localZip:portableZip && portableZip.ok ? portableZip.file : '', localZipOk:!!(portableZip && portableZip.ok), warning:'Supabase + Sheet backup is safe'})), 'application/json; charset=utf-8');
      return send(res, 502, JSON.stringify(Object.assign(st, parts, {ok:false, complete:false, recoverySafe:false, localZip:portableZip && portableZip.ok ? portableZip.file : '', localZipOk:!!(portableZip && portableZip.ok), error:(r && (r.error || (Array.isArray(r.errors) && r.errors.join(' | ')))) || 'online backup failed — manual retry required'})), 'application/json; charset=utf-8');
    }).catch(e => {
      cloudLastResult = {ok:false, error:String(e && e.message || e)};
      cloudSyncBusy = false;
      send(res, 502, JSON.stringify(Object.assign(cloudStatusPayload(), {ok:false, complete:false, error:'online backup failed — manual retry required'})), 'application/json; charset=utf-8');
    });
    return;
  }
  if (pathname === '/api/cloud/restore' && req.method === 'POST') {
    if (!cloudConfig()) return send(res, 503, JSON.stringify({ok:false, manualOnly:true, error:'online backup is not configured'}), 'application/json; charset=utf-8');
    if (cloudSyncBusy) return send(res, 409, JSON.stringify({ok:false, manualOnly:true, error:'another manual cloud action is running'}), 'application/json; charset=utf-8');
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1024 * 1024) req.destroy(); });
    req.on('end', async () => {
      try {
        const ask = JSON.parse(body || '{}');
        if (ask.confirm !== true) return send(res, 400, JSON.stringify({ok:false, error:'explicit restore confirmation required'}), 'application/json; charset=utf-8');
        cloudSyncBusy = true;
        const r = await cloudCall('pull');
        const remote = r && r.state;
        const looksValid = remote && typeof remote === 'object' && !Array.isArray(remote) &&
          (Array.isArray(remote.products) || Array.isArray(remote.sales) || Array.isArray(remote.customers)) && remote.settings;
        if (!r || r.ok !== true || !looksValid) throw new Error('No valid full online backup was found. Local data was not changed.');
        const before = readCanonical();
        if (before && before.obj && Object.keys(before.obj).length) writePreReplaceBackup(before);
        persistState(remote);
        const at = new Date().toISOString();
        cloudLastSuccessAt = at; cloudLastCompleteAt = at; cloudLastResult = {ok:true, restore:true, source:r.source || 'online'};
        writeOnlineBackupMeta(at, remote);
        cloudSyncBusy = false;
        return send(res, 200, JSON.stringify({
          ok:true, restored:true, manualOnly:true, source:r.source || 'online',
          products:Array.isArray(remote.products)?remote.products.length:0,
          customers:Array.isArray(remote.customers)?remote.customers.length:0,
          sales:Array.isArray(remote.sales)?remote.sales.length:0,
          receipts:Array.isArray(remote.receipts)?remote.receipts.length:0,
          expenses:Array.isArray(remote.expenses)?remote.expenses.length:0,
          dayClosings:Array.isArray(remote.dayClosings)?remote.dayClosings.length:0
        }), 'application/json; charset=utf-8');
      } catch (e) {
        cloudSyncBusy = false;
        return send(res, 502, JSON.stringify({ok:false, manualOnly:true, error:String(e && e.message || e || 'online restore failed')}), 'application/json; charset=utf-8');
      }
    });
    return;
  }
  if (pathname === '/api/cloud/pull' && req.method === 'POST') {
    return send(res, 405, JSON.stringify({ok:false, manualOnly:true, error:'cloud pull is disabled except explicit disaster-recovery restore'}), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/delete-all' && req.method === 'POST') {
    if (!DATA_DIR) return send(res, 409, JSON.stringify({ ok:false, error:'Configured offline data folder is not writable.' }), 'application/json; charset=utf-8');
    let body = '';
    req.on('data', c => { body += c; if (body.length > 30 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      const before = readCanonical().obj;
      let backupFile = '';
      log('  Delete-all: local-only reset started. Online data will NOT be touched.');
      try {
        const j = JSON.parse(body || '{}');
        const next = j && j.state;
        if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('fresh state missing');
        backupFile = writeDeletedBackup(before);

        // Drop old automatic-cloud residue but never send/delete anything online.
        cancelQueuedCloudPush(true);
        persistState(next);
        const check = readCanonical().obj;
        const wantStamp = String(next && next.meta && next.meta.updatedAt || '');
        const gotStamp = String(check && check.meta && check.meta.updatedAt || '');
        if ((wantStamp && gotStamp !== wantStamp) || !businessStateEmpty(check)) {
          try { persistState(before); } catch (_) {}
          throw new Error('Local reset verification failed. Original local data restored.');
        }

        // Explicit destructive action may synchronously clear local mirrors.
        try { writeFolders(next); } catch (_) {}
        try { syncMirror(next); } catch (_) {}
        clearDirContents(BACKUP_DIR);
        clearDirContents(DELETED_DIR);
        if (db) { try { db.exec('VACUUM'); } catch (_) {} }
        log('  Delete-all: local data cleared. Online data unchanged.');
        send(res, 200, JSON.stringify({
          ok:true, deleted:true, cloudCleared:false, onlineUntouched:true,
          localVerifiedEmpty:true, backupFile:backupFile
        }), 'application/json; charset=utf-8');
      } catch (e) {
        const msg = String(e && e.message || e || 'Delete failed');
        log('  (!) Delete-all failed: ' + msg);
        send(res, 500, JSON.stringify({ ok:false, error:msg, backupFile:backupFile || '' }), 'application/json; charset=utf-8');
      }
    });
    return;
  }

  if (pathname === '/api/state' && req.method === 'POST') {
    if (!DATA_DIR) return send(res, 409, JSON.stringify({ ok: false, error: 'Configured offline data folder is not writable.' }), 'application/json; charset=utf-8');
    let body = '';
    req.on('data', c => { body += c; if (body.length > 30 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      if (!body || body.trim().length < 3) return send(res, 400, JSON.stringify({ ok: false, error: 'empty body' }), 'application/json; charset=utf-8');
      try {
        const obj = JSON.parse(body);
        const currentWrap = readCanonical();
        const current = currentWrap && currentWrap.obj && typeof currentWrap.obj === 'object' ? currentWrap.obj : {};
        const hasCurrent = Object.keys(current).length > 0;
        const baseRaw = req.headers['x-shoeb-base-seq'];
        const baseSeq = baseRaw === undefined ? null : Number(baseRaw);
        const allowReplace = String(req.headers['x-shoeb-allow-replace'] || '') === '1';
        if (!allowReplace && hasCurrent && baseSeq !== null && Number.isFinite(baseSeq)) {
          const currentSeq = seqOf(current);
          const incomingLineage = obj && obj.meta && obj.meta.createdAt || '';
          const currentLineage = current && current.meta && current.meta.createdAt || '';
          const exactRetry = sameLineage(obj, current) && seqOf(obj) === currentSeq && JSON.stringify(obj) === JSON.stringify(current);
          const staleSeq = sameLineage(obj, current) && baseSeq !== currentSeq;
          const wrongLineage = !!(currentLineage && incomingLineage && currentLineage !== incomingLineage);
          if (exactRetry) {
            return send(res, 200, JSON.stringify({ ok:true, saved:true, duplicate:true, savedSeq:currentSeq, backend:db ? 'sqlite' : 'json' }), 'application/json; charset=utf-8');
          }
          if (staleSeq || wrongLineage) {
            const recoveryFile = writeConflictSnapshot(obj, staleSeq ? 'stale-save-sequence' : 'state-lineage-mismatch');
            return send(res, 409, JSON.stringify({ ok:false, conflict:true, error:'Newer data already exists. Rejected stale save to prevent overwrite.', currentSeq:currentSeq, recoveryFile:recoveryFile }), 'application/json; charset=utf-8');
          }
        }
        // Fast path: one local canonical save only. No cloud, no rolling backups,
        // no full mirror rebuild before replying to the button click.
        persistState(obj);
        send(res, 200, JSON.stringify({ ok: true, saved: true, savedSeq: seqOf(obj), backend: db ? 'sqlite' : 'json' }), 'application/json; charset=utf-8');
      } catch (e) {
        send(res, 500, JSON.stringify({ ok: false, error: String(e.message || e) }), 'application/json; charset=utf-8');
      }
    });
    return;
  }
  if (pathname === '/api/pdf' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 6 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      let j; try { j = JSON.parse(body || '{}'); } catch (_) { return send(res,400,JSON.stringify({ok:false,error:'invalid JSON'}),'application/json; charset=utf-8'); }
      const html = String(j && j.html || '');
      if (!html || html.length > 5 * 1024 * 1024) return send(res,400,JSON.stringify({ok:false,error:'PDF content missing or too large'}),'application/json; charset=utf-8');
      const layout = j.layout === 'a5' ? 'a5' : (j.layout === '80' ? '80' : 'a4');
      let name = safeName(String(j.filename || 'Shoeb-Motors.pdf')); if (!/\.pdf$/i.test(name)) name += '.pdf';
      createVectorPdf(html,name,layout,(err,pdf)=>{
        if (err || !pdf) return send(res,503,JSON.stringify({ok:false,error:String(err && err.message || 'PDF engine unavailable')}),'application/json; charset=utf-8');
        res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+name.replace(/"/g,'')+'"','Content-Length':pdf.length,'Cache-Control':'no-store','X-Shoeb-PDF-Mode':'vector-browser'});
        res.end(pdf);
      });
    });
    return;
  }
  if (pathname === '/api/backup') {
    if (!DATA_DIR) return send(res, 409, JSON.stringify({ ok: false, error: 'Save folder is not set.' }), 'application/json; charset=utf-8');
    const body = Buffer.from(readCanonical().text || '{}', 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="shoeb-motors-backup.json"', 'Content-Length': body.length });
    return res.end(body);
  }
  /* মুছে ফেলা তথ্য ফাইল আকারে ডেটা ফোল্ডারের deleted\ ফোল্ডারে রাখা হয় */
  if (pathname === '/api/archive' && req.method === 'POST') {
    if (!DATA_DIR) return send(res, 409, JSON.stringify({ ok: false, error: 'Save folder is not set.' }), 'application/json; charset=utf-8');
    let body = '';
    req.on('data', c => { body += c; if (body.length > 5 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      try {
        const j = JSON.parse(body || '{}');
        if (!j || !j.name) return send(res, 400, JSON.stringify({ ok: false, error: 'name missing' }), 'application/json; charset=utf-8');
        const safe = String(j.name).replace(/[^\w.\-]+/g, '_').slice(0, 120);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = path.join(DELETED_DIR, stamp + '__' + safe + '.json');
        fs.writeFileSync(file, JSON.stringify(j.data || {}, null, 2), 'utf8');
        send(res, 200, JSON.stringify({ ok: true, file: path.basename(file) }), 'application/json; charset=utf-8');
      } catch (e) {
        send(res, 500, JSON.stringify({ ok: false, error: String(e.message || e) }), 'application/json; charset=utf-8');
      }
    });
    return;
  }
  if (pathname === '/api/open-folder') {
    if (!DATA_DIR) return send(res, 409, JSON.stringify({ ok: false, error: 'Save folder is not set.' }), 'application/json; charset=utf-8');
    if (process.platform === 'win32') {
      try { require('child_process').spawn('explorer.exe', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref(); } catch (e) {}
    }
    return send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const rel = pathname.replace(/^\/+/, '').split('/').join(path.sep);
  if (rel.includes('..')) return send(res, 400, 'Bad request');
  let file = path.join(APP_DIR, rel);
  try { if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (e) {}
  if (!fs.existsSync(file)) return send(res, 404, 'Not found');
  try {
    const data = fs.readFileSync(file);
    const mt = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': (TEXTY.test(mt) && mt.indexOf('charset') < 0) ? mt + '; charset=utf-8' : mt, 'Content-Length': data.length, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) { send(res, 500, 'Server error'); }
});

const PORTS = FORCED_PORT ? [FORCED_PORT] : [8080, 8081, 8082, 8090, 8181, 8123];
let idx = 0;
function tryListen() {
  if (idx >= PORTS.length) { console.error('(!) No free port found (8080-8123 busy).'); process.exit(1); }
  const p = PORTS[idx++];
  server.once('error', tryListen);
  server.listen(p, HOST, () => {
    try { fs.writeFileSync(PORT_FILE, String(p), 'utf8'); } catch (e) {}
    console.log('');
    console.log('==========================================================');
    console.log('   SHOEB MOTORS & TYRE HOUSE   -   Shop Manager (Local)');
    console.log('==========================================================');
    console.log('');
    if (DATA_DIR) {
      console.log('  Data folder :  ' + DATA_DIR);
      console.log('                 (configured offline path)');
      console.log('  Database    :  ' + (db ? DB_FILE + '  (SQLite)' : STATE_FILE + '  (JSON — node:sqlite not available)'));
      console.log('  Backups     :  ' + BACKUP_DIR);
      console.log('  Folders     :  invoices / stocks / customers');
    } else {
      console.log('  Data folder :  NOT SET');
      console.log('                 Data must be saved in D:\\Private\\Do Not Delete - make sure drive D: is connected.');
      console.log('  No shop data files will be written until the configured folder is writable.');
    }
    console.log('  Address     :  http://127.0.0.1:' + p);
    console.log('');
    console.log('  >>> KEEP THIS WINDOW OPEN WHILE USING THE SHOP <<<');
    console.log('');
    if (process.platform === 'win32' && !process.env.SHOEB_NO_BROWSER) {
      require('child_process').exec('start "" "http://127.0.0.1:' + p + '/"');
    }
  });
}
tryListen();
try { clearCloudPendingFile(); } catch (_) {} // legacy auto-sync queue is intentionally retired
