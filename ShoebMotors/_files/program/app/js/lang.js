/* ================= lang.js — ভাষা বদল (বাংলা ⇄ English) =================
   সেটিংস → ভাষা / Language থেকে এক ক্লিকেই পুরো প্রোগ্রাম ও ইনভয়েস ইংরেজি হয়ে যায়;
   আবার বাংলা করলে সব আগের মতো বাংলাতেই ফিরে আসে। */

var Lang = (function () {
  var D = {
    /* ---------- মেনু ও শিরোনাম ---------- */
    'ড্যাশবোর্ড': 'Dashboard', 'নতুন বিক্রি': 'New sale', 'স্টক': 'Stock',
    'বিক্রি ও ইনভয়েস': 'Sales & invoices', 'ক্যাশ কালেকশন': 'Cash Collection', 'ক্যাশ কালেকশন →': 'Cash Collection →', 'দিনের হিসাব বন্ধ': 'Day Closing', 'কাস্টমার': 'Customers', 'গ্রাহক': 'Customers',
    'খরচ': 'Expenses', 'রিপোর্ট': 'Reports', 'সেটিংস': 'Settings',
    'সেটিংস ও ব্যাকআপ': 'Settings', 'স্টক / টায়ারের তালিকা': 'Stock / tyres', 'প্রশাসন': 'Admin', 'মোট পণ্য': 'Total items', 'মোট পরিমাণ': 'Total items',
    'দোকানের খরচ': 'Shop expenses', 'দোকান পরিচালনা': 'Shop manager',
    'দোকানের কাজের জায়গা': 'SHOP WORKSPACE', 'সোয়েব মটরস এন্ড টায়ার হাউস': 'Shoeb Motors & Tyre House',
    'সতর্কতা': 'Caution', 'নিরাপত্তা': 'Security', 'ভাষা / Language': 'Language',
    'দিনের খরচ (৳)': 'Day expense (৳)', 'হাতে গোনা ক্যাশ': 'Actual Cash', 'সমাপনী নোট': 'Closing note',
    '✓ দিনের হিসাব সেভ করুন': '✓ Save Day Closing', 'দিনের হিসাব বন্ধের ইতিহাস': 'Day Closing history',
    'তথ্য': 'Details', 'কাজ': 'Actions', 'মালিকের অনুমতি': 'Owner permission',
    'ইনভয়েসের তারিখ': 'Invoice date', 'সময়': 'Time', 'কালেকশন': 'Collection', 'কালেকশন হিস্ট্রি': 'Collection history',
    'নির্বাচিত দিনের ইনভয়েস': 'Invoices on selected day', 'সেদিন ক্যাশ কালেকশন': 'Cash collected that day',
    'সেদিনের ইনভয়েসে বর্তমান Due': 'Current Due on that day’s invoices', 'সব ট্র্যাক করা Due': 'All tracked Due',
    'যেসব ইনভয়েসে Due আছে': 'Invoices with Due', 'সব ট্র্যাক করা ইনভয়েস': 'All tracked invoices',
    /* ---------- বোতাম ---------- */
    'খুলুন': 'Open', 'বাতিল': 'Cancel', 'মুছে ফেলুন': 'Clear', 'রেখে দিন': 'Hold',
    'রাখা বিল খুলুন': 'Open held bill', 'পুরোটা': 'Full', 'স্টকে যোগ করুন': 'Add to stock',
    'পরিবর্তন সেভ করুন': 'Save changes', 'সেটিংস সেভ করুন': 'Save settings',
    'ইনভয়েস তৈরি করুন': 'Make invoice',
    'এখনই সেভ করুন': 'Save now', 'এখনই অনলাইনে সেভ করুন': 'Save online now',
    'ব্যাকআপ ফাইল নামান': 'Download backup', 'ব্যাকআপ থেকে ফিরিয়ে আনুন': 'Restore backup',
'অনলাইন থেকে ফিরিয়ে আনুন': 'Restore from online',
    'পরীক্ষা করুন': 'Test', 'সব তথ্য মুছে ফেলুন': 'Delete all data', 'পিন বদলান': 'Change PIN',
    'পিন তৈরি করুন': 'Create PIN',
    'CSV এক্সপোর্ট': 'Export CSV', 'নতুন টায়ার স্টকে যোগ করুন': 'Add new tyre',
    '＋ নতুন টায়ার স্টকে যোগ করুন': '＋ Add new tyre', 'স্টকে নতুন টায়ার যোগ করুন': 'Add new tyre to stock',
    'নতুন কাস্টমার': 'New customer', '＋ নতুন কাস্টমার': '＋ New customer', 'নতুন খরচ': 'New expense',
    'বিস্তারিত': 'Details', 'বদলান': 'Edit', 'তথ্য বদলান': 'Edit', 'গাড়ি যোগ করুন': 'Add vehicle',
    '＋ গাড়ি যোগ করুন': '＋ Add vehicle', 'ফিরে যান': 'Back', 'সব দেখুন →': 'View all',
    'সব কাস্টমার →': 'All customers', 'রিসেট': 'Reset', 'ইনভয়েস': 'Invoice', 'প্রিন্ট': 'Print',
    'মুছুন': 'Clear', 'ওয়াক-ইন': 'Walk-in', 'প্রোফাইল': 'Profile', 'টাকা নিন': 'Take payment',
    'স্টক যোগ': 'Add stock', '＋ স্টক': '＋ Stock', '＋ যোগ': '＋ Add', 'সেভ করুন': 'Save',
    'সব মুছে ফেলুন': 'Delete all', 'বিলে যোগ করুন': 'Add to bill', 'কাস্টমার সেভ করুন': 'Save customer',
    'টাকা জমা সেভ করুন': 'Save payment', 'খরচ সেভ করুন': 'Save expense', 'নিশ্চিত করুন': 'Confirm',
    'হ্যাঁ, লোড করুন': 'Yes, load', 'হ্যাঁ, মুছে ফেলুন': 'Yes, delete', 'হ্যাঁ, ফিরিয়ে আনুন': 'Yes, restore',
    'ডেটা ফোল্ডার খুলুন': '📂 Open data folder', '📂 ডেটা ফোল্ডার খুলুন': '📂 Open data folder',
    '💾 এখনই সেভ করুন': '💾 Save now', '☁ এখনই Online Backup': '☁ Online Backup Now', '⬇ ব্যাকআপ ফাইল নামান': '⬇ Download backup',
    '⬆ ব্যাকআপ থেকে ফিরিয়ে আনুন': '⬆ Restore from backup',
    '🖨 A4 / A5 প্রিন্ট': '🖨 Print A4 / A5', '🖨 80mm থার্মাল প্রিন্ট': '🖨 Print 80mm thermal',
    'ইনভয়েস কোন কাগজে ছাপবেন?': 'Which paper for the invoice?',
    'ইনভয়েস কোন কাগজে ছাপবেন? সাধারণত A4।': 'Which paper for the invoice? Usually A4.',
    '80mm থার্মাল রোলে ছাপুন': 'Print on 80mm thermal roll',
    'A4 (স্বাভাবিক)': 'A4 (normal)', 'A4 (ডিফল্ট)': 'A4 (default)', 'A5 (ডিফল্ট)': 'A5 (default)',
    '🖨 প্রিন্ট': '🖨 Print', '✕ বন্ধ করুন': '✕ Close', 'বন্ধ করুন': 'Close',
    'নতুন জানালায় খুলুন': 'Open in a new window',
    'নতুন জানালা খোলা যায়নি — ইনভয়েসটি এখানেই দেখানো হচ্ছে।': 'Could not open a new window — showing the invoice here.',
    'ব্রাউজারে নতুন জানালা বন্ধ আছে — উপরের ✕ চিহ্নে চাপ দিয়ে অনুমতি দিন।': 'The browser blocked the new window — allow it from the ✕ icon in the address bar.',
    'PDF সেভ (A4)': 'Save PDF (A4)', 'PDF সেভ': 'Save PDF', 'PDF ডাউনলোড': 'Download PDF', 'রিপোর্ট প্রিন্ট': 'Print report', '🖨 রিপোর্ট': '🖨 Report', '80mm থার্মাল': '80mm thermal',
    'A4 কাগজ': 'A4 paper', 'A5 কাগজ': 'A5 paper', 'হোয়াটসঅ্যাপে পাঠান': 'Send on WhatsApp',
    'সেটআপ শেষ করে দোকান খুলুন': 'Finish setup & open shop', 'লক': 'Lock',
    '🔒 লক': '🔒 Lock', '🔓 মালিক': '🔓 Owner', 'ডেটা ফোল্ডার:': 'Data folder:',
    'রিসেট করুন': 'Reset', '＋ নতুন বিক্রি': '＋ New sale', '＋ স্টক যোগ করুন': '＋ Add stock',
    '＋ ক্যাশ': '＋ Cash', '💵 ক্যাশ কালেকশন': '💵 Cash Collection', 'কালেকশন সেভ করুন': 'Save collection', 'এন্ট্রি বাতিল করুন': 'Cancel entry',
    /* ---------- লেবেল / কলাম ---------- */
    'ক্রম': 'SL', 'বিবরণ': 'Description', 'পরিমাণ': 'Qty', 'দর': 'Rate', 'টাকা': 'Amount',
    'দর (৳)': 'Rate (৳)', 'টাকা (৳)': 'Amount (৳)', 'মোট': 'Total', 'লাভ': 'Profit',
    'লাভ/পিস': 'Profit/pc', 'ব্র্যান্ড': 'Brand', 'সাইজ': 'Size', 'মডেল': 'Model',
    'গাড়ি': 'Vehicle', 'গাড়ির নম্বর': 'Vehicle no.', 'গাড়ির নম্বর:': 'Vehicle no.:',
    'বিক্রয়মূল্য': 'Selling price', 'ক্রয়মূল্য': 'Buy price', 'স্টকে আছে': 'In stock',
    'শেষ এসেছেন': 'Last visit', 'মোট কেনা': 'Total bought', 'বিক্রি': 'Sales', 'বিক্রি (পিস)': 'Sales (pcs)',
    'নাম': 'Name', 'নাম (বাংলা)': 'Name (Bangla)', 'মোবাইল': 'Mobile', 'মোবাইল নম্বর': 'Mobile no.',
    'ক্রেতা': 'Customer', 'ক্রেতার নাম': 'Customer name', 'ঠিকানা': 'Address', 'তারিখ': 'Date',
    'তারিখ *': 'Date', 'বাকি': 'Due', 'বাকি আছে': 'Due', 'পরিশোধ': 'Paid', 'অবস্থা': 'Status',
    'পেমেন্ট': 'Payment', 'উপমোট': 'Subtotal', 'সর্বমোট': 'Grand total', 'সর্বমোট (৳)': 'Grand total (৳)',
    'আইটেম': 'Items', 'নোট': 'Note', 'নোট': 'Note', 'কথায়:': 'In words:',
    'ছাড়': 'Discount', 'দর মুছুন': 'Remove price', 'দাম বসান': 'Set price', 'দাম দেওয়া হয়নি': 'Price not set', 'দর বসান (নিশ্চিত হয়নি)': 'Set price (unconfirmed)', 'মূল্য পরিশোধের রসিদ': 'Payment receipt', 'ছাড় দিন (৳)': 'Give discount (৳)', 'ছাড়ের কারণ': 'Discount reason',
    'দেওয়া ছাড়': 'Discount given', 'সর্বমোট ছাড়': 'Total discount', 'মোট লাভ': 'Total profit',
    'নিট লাভ': 'Net profit', 'সম্ভাব্য লাভ': 'Expected profit', 'মোট বিক্রি': 'Total sales',
    'আজকের বিক্রি': "Today's sales", 'আজকের লাভ': "Today's profit", 'আজকের ক্যাশ অবস্থা': "Today's cash status", 'আজ কালেকশন': "Today's collection", 'এই মাসের বিক্রি': "This month's sales", 'এই মাসের লাভ': "This month's profit",
    'এই মাসে': 'This month', 'স্টকের মূল্য': 'Stock value', 'স্টকের মূল্য (ক্রয়মূল্যে)': 'Stock value (at cost)',
    'আদায়যোগ্য বাকি': 'Receivable due', 'স্টক কম আছে': 'Low stock', 'স্টক কমে গেছে': 'Low stock',
    'সাম্প্রতিক ইনভয়েস': 'Recent invoices', 'কালেকশন হিস্ট্রি': 'Collection history', 'সবচেয়ে বেশি বিক্রি হওয়া টায়ার': 'Top selling tyres', 'সবচেয়ে বেশি বিক্রি হওয়া পণ্য': 'Top selling products',
    'বিক্রি — শেষ ১৪ দিন': 'Sales — last 14 days', 'দিন অনুযায়ী বিক্রি': 'Day-wise sales',
    'টায়ার অনুযায়ী বিক্রি': 'Tyre-wise sales', 'পণ্য অনুযায়ী বিক্রি': 'Product-wise sales', 'লাভ-ক্ষতির হিসাব': 'Profit & loss',
    'সবচেয়ে বেশি লাভের টায়ার': 'Most profitable tyres', 'এই সময়ে টাকা আদায়': 'Collections in period',
    'এই সময়ে হাতে আসা টাকা': 'Cash received in period', 'এই সময়ে যত টাকা ধারে গেল': 'Credit given in period',
    'এই সময়ে যত টাকা ধারে গেল তা ফেরত পাওয়া যায়নি।': 'Credit given in this period is still unpaid.',
    'পুরনো বাকির টাকা এসেছে': 'Old dues collected', 'হাতে আসা টাকা': 'Cash in hand',
    'বিক্রি হওয়া মালের ক্রয়মূল্য': 'Cost of goods sold', 'বিক্রি হওয়া টায়ারের ক্রয়মূল্য': 'Cost of tyres sold',
    'বিক্রি হওয়া টায়ারগুলোর ক্রয়মূল্য': 'Cost of tyres sold', 'বিক্রি হওয়া পণ্যের ক্রয়মূল্য': 'Cost of products sold', 'মোট বিক্রি (ছাড় বাদ দিয়ে)': 'Net sales (after discount)',
    'লাভের হার': 'Profit margin', 'বিক্রির উপর লাভের হার': 'Profit margin on sales', 'বিক্রির %': '% of sales',
    'খরচ বাদ দেওয়ার পর': 'After expenses', 'মোট খরচ': 'Total expenses', 'সব মিলিয়ে টাকা': 'Net amount',
    'সব মিলিয়ে লাভ': 'Net profit', 'নগদ পেমেন্ট': 'Cash payment', 'সব মাস': 'All months',
    /* ---------- ফিল্টার / অপশন ---------- */
    'সব সময়': 'All time', 'একদিন': 'Single day', 'আরও তারিখ': 'More dates', 'আজ': 'Today', '৭ দিন': '7 days', 'শেষ ৭ দিন': 'Last 7 days',
    'এই মাস': 'This month', 'এই বছর': 'This year', 'দ্রুত সময়সীমা': 'Quick range', 'প্রয়োগ': 'Apply', 'গতকাল': 'Yesterday', 'সব পেমেন্ট': 'All payments', 'সব Due': 'All Due', 'সব ট্র্যাক করা ইনভয়েস': 'All tracked invoices', 'নির্বাচিত দিনের ইনভয়েস': 'Invoices on selected day', 'যেসব ইনভয়েসে Due আছে': 'Invoices with Due',
    'পরিশোধিত': 'Paid', 'আংশিক পরিশোধিত': 'Partially paid', 'আংশিক / Partial': 'Partially paid',
    'ক্যাশ': 'Cash', 'বিকাশ': 'bKash', 'নগদ': 'Nagad', 'রকেট': 'Rocket', 'কার্ড / ব্যাংক': 'Card / Bank',
    'সম্পূর্ণ বাকি': 'Fully due', 'মাধ্যম': 'Method', 'পরিবহন': 'Transport',
    'শুধু কম স্টক': 'Low stock only', 'শুধু বাকি আছে যাদের': 'Only with dues',
    'সাজান: ব্র্যান্ড': 'Sort: brand', 'সাজান: পরিমাণ': 'Sort: quantity', 'সাজান: বেশি স্টক': 'Sort: high stock', 'সাজান: কম স্টক': 'Sort: low stock', 'সাজান: নতুন যোগ করা': 'Sort: newest',
    'সাজান: মোটা সাইজ আগে': 'Sort: size (thick first)',
    'সাজান: স্টকের মূল্য': 'Sort: stock value', 'সাজান: নাম': 'Sort: name', 'সাজান: বেশি বাকি': 'Sort: highest due',
    'সাজান: বেশি কেনা': 'Sort: highest spend', 'সাজান: নতুন': 'Sort: newest', 'সাজান: তারিখ': 'Sort: date',
    'সব ধরন': 'All types', 'খরচের ধরন': 'Expense type', 'কোন টাকা থেকে': 'Paid from',
    'দোকান ভাড়া': 'Shop rent', 'বিদ্যুৎ বিল': 'Electricity bill', 'বেতন': 'Salary', 'চা': 'Tea',
    'মোবাইল / ইন্টারনেট': 'Mobile / internet', 'ট্যাক্স / লাইসেন্স': 'Tax / licence', 'অন্যান্য': 'Other',
    'ধরন': 'Type', 'টায়ার': 'Tyre', 'টিউব': 'Tube', 'জিনিসের ধরন': 'Item type', 'গাড়ির ধরন': 'Vehicle type',
    'মোটরসাইকেল': 'Motorcycle', 'কার / জিপ': 'Car / Jeep', 'সিএনজি / অটো': 'CNG / Auto',
    'ইজি বাইক': 'Easy bike', 'লাগোনা / পিকআপ': 'Laguna / Pickup', 'বাস': 'Bus', 'ট্রাক': 'Truck',
    'সাইকেল': 'Bicycle', 'পিস': 'pcs', 'কলা': 'pcs',
    /* ---------- স্টক ফর্ম ---------- */
    'ব্র্যান্ড *': 'Brand *', 'সাইজ *': 'Size *', 'মডেল': 'Model',
    'পণ্যের নাম / ব্র্যান্ড *': 'Product name / Brand *', 'সাইজ / স্পেসিফিকেশন': 'Size / specification',
    'স্টকে পরিমাণ': 'Quantity in stock', 'ক্রয়মূল্য — প্রতি পিস': 'Buy price — per pc',
    'ক্রয়মূল্য — প্রতি পিস': 'Buy price — per pc', 'বিক্রয়মূল্য — প্রতি পিস': 'Selling price — per pc',
    'মোট কত টাকা দিলেন': 'Total amount paid', 'সম্ভাব্য বিক্রয় মোট': 'Potential sale total',
    'খালি রাখলে বিক্রির সময় দর লিখবেন': 'Leave blank to set the price during sale', 'না জানলে খালি রাখুন': 'Leave blank if unknown',
    'খালি রাখলেও stock যোগ হবে': 'Stock can be added even if left blank',
    'বিক্রয়মূল্য — প্রতি পিস': 'Selling price — per pc', 'আরও টায়ার যোগ করব': 'Add more tyres', 'আরও পণ্য যোগ করব': 'Add more products',
    'কত পিস পেলেন *': 'Quantity received *', 'বিক্রয়মূল্য — প্রতি পিস *': 'Selling price per pc',
    'সাপ্লায়ার / দোকান': 'Supplier', 'টায়ারের তথ্য': 'Tyre details', 'পণ্যের তথ্য': 'Product details', 'দর ও স্টক': 'Price & stock',
    'কম স্টকের সীমা': 'Low stock limit',
    /* ---------- বিক্রি / কাস্টমার ---------- */
    '১ · কাস্টমার': '1 · Customer', '২ · বিলে টায়ার যোগ করুন': '2 · Add tyres to bill', '৩ · বিল': '3 · Bill',
    'নতুন কাস্টমার সেভ হয়ে যাবে': 'New customer will be saved',
    'এখন কত টাকা নিলেন': 'Amount received now', 'টাকার ধরন': 'Payment method',
    'এই বিক্রির পর বাকি': 'Due after this sale', 'স্টকে:': 'In stock:',
    'ফিটিং ফ্রি': 'Free fitting', 'নিয়মিত কাস্টমার': 'Regular customer', 'নিজের লেখা আইটেম (স্টকে নেই)': 'Custom item (not in stock)',
    'কেনাকাটার হিসাব': 'Purchase history', 'পণ্য নির্বাচন': 'Select product', 'আগের বকেয়া': 'Previous due', '＋ আগের বকেয়া': '+ Previous due', 'পুরোনো হিসাবের বাকি': 'Due from old records', 'আগের বকেয়া যোগ করুন': 'Add previous due', 'আগের বকেয়া বদলান': 'Edit previous due', 'জমা সেভ করুন': 'Save payment', 'আগের বকেয়া যোগ করবেন?': 'Add previous due?', 'হ্যাঁ, যোগ করুন': 'Yes, add', 'ইনভয়েস ▾': 'Invoice ▾', 'ইনভয়েস দেখুন (A4)': 'View invoice (A4)', 'A5 ইনভয়েস': 'A5 invoice', '🧾 থার্মাল প্রিন্ট (80mm)': '🧾 Thermal print (80mm)', '🗑 ইনভয়েস মুছে ফেলুন': '🗑 Delete invoice', '＋ ক্যাশ': '+ Cash', 'জমার তারিখ': 'Payment date', 'আগের বকেয়া (না থাকলে খালি রাখুন)': 'Previous due (leave blank if none)', 'আগের বকেয়ার নোট': 'Previous due note', 'টাকা জমা — আগের বকেয়া': 'Take payment — previous due', 'বেশি বিক্রয়মূল্য': 'Highest sales value', 'বেশি লাভ': 'Highest profit', 'বেশি পরিমাণ': 'Highest quantity', 'মোট ও ইনভয়েস': 'Total & invoice', 'জমা': 'Paid', 'বকেয়া জমা': 'Pay due', 'টায়ারের সাইজ': 'Tyre size', 'ফোন': 'Phone',
    'মোট কেনা টাকা': 'Total purchased', 'বাকি আছে': 'Outstanding',
    'Address': 'Address', 'নাম (ইংরেজি)': 'Name (English)',
    /* ---------- সেটিংস ---------- */
    'দোকানের তথ্য (ইনভয়েসে ছাপা হবে)': 'Shop details (printed on invoice)',
    'দোকানের নাম (ইংরেজি)': 'Shop name (English)', 'দোকানের নাম (বাংলা)': 'Shop name (Bangla)',
    'স্লোগান': 'Tagline', 'মুদ্রা প্রতীক': 'Currency symbol', 'ইনভয়েস নম্বরের শুরু': 'Invoice prefix',
    'ছাড়ের নোট': 'Discount note', 'ইনভয়েসে যে অবস্থা ছাপা হবে': 'Invoice payment wording',
    'বাকি থাকলে ছাপা হবে': 'If due, print', 'পুরো টাকা পরিশোধ হলে ছাপা হবে': 'If fully paid, print',
    'কিছু টাকা দিলে ছাপা হবে': 'If partially paid, print', 'ফেরত সংক্রান্ত নোট': 'Return note',
    'ইনভয়েসের নিচের লেখা': 'Invoice footer text', 'ধন্যবাদ বাক্য': 'Thank-you line',
    'এখনকার পিন': 'Current PIN', 'নতুন পিন': 'New PIN', 'নতুন পিন আবার লিখুন': 'Repeat new PIN',
    'সেভ ও ব্যাকআপ': 'Save & backup', 'সেভের ধরন': 'Save type', 'তথ্য কোথায় আছে': 'Where data is saved',
    'শেষ সেভ': 'Last saved', 'মোট হিসাব': 'Totals', 'প্রতিদিনের ব্যাকআপ': 'Daily backup',
    'অনলাইনে সেভ (হোস্টিং)': 'Save online (hosting)', 'অনলাইনে সেভ করুন': 'Save online',
    'ওয়েবসাইটের ঠিকানা (URL)': 'Website URL', 'গোপন কী (Key)': 'Secret key',
    'ভাষা': 'Language', 'বাংলা': 'Bangla', 'ইংরেজি': 'English',
    'চালু': 'On', 'বন্ধ': 'Off', 'সমস্যা': 'Problem', 'সমস্যা:': 'Problem:',
    /* ---------- সেটআপ উইজার্ড ---------- */
    '১. তথ্য কোথায় সেভ হবে': '1. Where data is saved', '২. দোকানের তথ্য': '2. Shop details',
    '৩. সিকিউরিটি পিন': '3. Security PIN', 'মালিকের পিন (৪–৬ সংখ্যা)': 'Owner PIN (4–6 digits)',
    'আবার পিন লিখুন': 'Repeat PIN', 'সেটআপ একবারই করতে হবে।': 'Setup is done once only.',
    'স্বাগতম — দোকানের তথ্য দিয়ে শুরু করুন': 'Welcome — start with your shop details',
    /* ---------- অতিরিক্ত (এই রাউন্ডে যোগ) ---------- */
    '＋ স্টক যোগ': '＋ Add stock', '＋ নতুন খরচ': '＋ New expense', '← ফিরে যান': '← Back',
    'শুধু মালিক': 'Owner only',
    'নতুন বাকি': 'New due', 'আদায়': 'Collected', 'দেখুন': 'View', 'লাভ %': 'Profit %',
    'পেমেন্ট নং': 'Payment no.', 'কোন ইনভয়েসের': 'For which invoice', 'বিল পাঠান': 'Send bill',
    'ফোল্ডার': 'folder', 'data.json → backups ফোল্ডার': 'folder data.json → backups',
    'English (ইংরেজি)': 'English',
    'ইংরেজি বেছে নিলে পুরো প্রোগ্রাম ইংরেজি হয়ে যাবে; বাংলা করলে সব আবার বাংলায় ফিরে আসবে। কাস্টমারের ইনভয়েস সবসময় বাংলাতেই ছাপা হবে।':
      'Choose English to switch the whole program to English; choose Bangla to switch back. The customer invoice is always printed in Bangla.',
    '"সব তথ্য মুছে ফেলুন" চাপলে মালিকের পিন চাইবে এবং আগে একটি ব্যাকআপ কপি রাখবে।':
      '"Delete all data" asks for the owner PIN, clears active cloud data, and keeps a local safety backup.',
    'মোবাইলের নম্বর বসান': 'Enter mobile number',
    'সব খালি করুন': 'Clear list', 'ফিরিয়ে আনুন': 'Restore', 'সেভ করুন': 'Save',
    'মুছে ফেলা তথ্য': 'Deleted items', 'শুধু মালিক': 'Owner only', 'ধরন': 'Type',
    'বিবরণ': 'Description', 'কিছু মুছে ফেলা হয়নি।': 'Nothing has been deleted.',
    'মুছে ফেলা তালিকা খালি করবেন?': 'Clear the deleted list?',
    'শুধু তালিকাটি খালি হবে (প্রোগ্রামের ভেতরের কপি)। ডেটা ফোল্ডারের deleted ফোল্ডারের ফাইলগুলো মুছে যাবে না — ওগুলো থাকবে।':
      'Only the list inside the program is cleared. The files in the deleted folder on the data folder stay as they are.',
    'হ্যাঁ, খালি করুন': 'Yes, clear', 'ফিরিয়ে আনুন': 'Restore',
    'স্টকে যথেষ্ট নেই:': 'Not enough in stock:',
    'বিক্রিটি আবার বিক্রির তালিকায় ফিরে আসবে এবং স্টক থেকে পরিমাণ কমে যাবে।':
      'The sale returns to the sales list and the quantity is taken out of stock again.',
    'এই ইনভয়েসটি তালিকায় আবার আছে।': 'This invoice is already in the list again.',
    'মুছে ফেলা তালিকা খালি।': 'The deleted list is empty.',
    'সোমবার': 'Monday', 'মঙ্গলবার': 'Tuesday', 'বুধবার': 'Wednesday', 'বৃহস্পতিবার': 'Thursday',
    'শুক্রবার': 'Friday', 'শনিবার': 'Saturday', 'রবিবার': 'Sunday',
    'জানুয়ারি': 'January', 'ফেব্রুয়ারি': 'February', 'মার্চ': 'March', 'এপ্রিল': 'April',
    'মে': 'May', 'জুন': 'June', 'জুলাই': 'July', 'আগস্ট': 'August', 'সেপ্টেম্বর': 'September',
    'অক্টোবর': 'October', 'নভেম্বর': 'November', 'ডিসেম্বর': 'December',
    '“সব তথ্য মুছে ফেলুন” চাপলে মালিকের পিন চাইবে এবং আগে একটি ব্যাকআপ কপি রাখবে।':
      '“Delete all data” asks for the owner PIN, clears active cloud data, and keeps a local safety backup.',
    /* ---------- মেসেজ / অবস্থা ---------- */
    'ব্র্যান্ড লিখুন।': 'Enter brand.', 
    'সাইজ লিখুন।': 'Enter size.', 'পরিমাণ ঠিক লিখুন।': 'Enter a valid quantity.',
    'ক্রয়মূল্য লিখুন।': 'Enter buy price.', 'কত পিস পেয়েছেন লিখুন।': 'Enter quantity received.',
    'আইটেমের নাম লিখুন।': 'Enter item name.', 'কাস্টমারের নাম লিখুন।': 'Enter customer name.',
    'কত টাকা পেলেন লিখুন।': 'Enter the amount received.',
    'খরচের টাকার পরিমাণ লিখুন।': 'Enter expense amount.',
    'বিলে অন্তত একটি টায়ার যোগ করুন।': 'Add at least one tyre to the bill.', 'বিলে অন্তত একটি পণ্য যোগ করুন।': 'Add at least one product to the bill.',
    'কোনো রাখা বিল নেই।': 'No held bills.', 'রাখার মতো কিছু নেই — বিল খালি।': 'Nothing to hold — bill is empty.',
    'কোনো টায়ার মেলেনি।': 'No tyres found.', 'কোনো তথ্য নেই।': 'No data yet.',
    'কোনো কাস্টমার পাওয়া যায়নি।': 'No customer found.', 'কাস্টমার খুঁজে পাওয়া যায়নি।': 'Customer not found.',
    'আজ এখনো বিক্রি হয়নি': 'No sales yet today',
    'পণ্য শেষ হয়ে যাচ্ছে — যোগ করুন': 'Products are running low — restock', 'সব পণ্যের স্টক ঠিক আছে': 'All product stock levels are OK',
    'স্টক দেখুন →': 'View stock →',
    'এখনো কোনো কেনার হিসাব নেই।': 'No purchase history yet.',
    'কোনো কেনার হিসাব নেই।': 'No purchase history.', 'কোনো খরচ লেখা হয়নি।': 'No expenses recorded.',
    'স্টকে এখনো কোনো টায়ার নেই।': 'No tyres in stock yet.', 'স্টক কম নেই।': 'Stock is fine.',
    'কারও কাছে টাকা বাকি নেই। 👍': 'No customer dues. 👍', 'কাস্টমারের কাছে টাকা বাকি': 'Customer dues',
    'এই কাস্টমারের এখন কোনো বাকি নেই।': 'This customer has no dues.',
    'এই ইনভয়েসের সব দর ঠিক আছে।': 'All prices in this invoice are confirmed.',
    'এই ফিল্টারে কোনো ইনভয়েস নেই।': 'No invoices match this filter.',
    'এই সময়ে কোনো টাকা আসেনি।': 'No cash received in this period.',
    'এখনো কিছু নেই — উপরে টায়ার খুঁজুন।': 'Nothing here yet — search a tyre above.',
    'কোনো টায়ার পাওয়া যায়নি। নিচে নিজের লেখা আইটেম হিসেবে বিক্রি করতে পারেন।': 'No tyres found. You can also sell a custom item below.',
    'কোনো পণ্য পাওয়া যায়নি। নিচে নিজের লেখা আইটেম হিসেবে বিক্রি করতে পারেন।': 'No products found. You can also sell a custom item below.',
    'কোনো পণ্য পাওয়া যায়নি। নতুন পণ্য তৈরি করুন।': 'No products found. Create a new product.',
    'দর নিশ্চিত হয়নি': 'Price not confirmed', 'দর ঠিক হয়নি': 'Price not confirmed',
    'দর বাকি': 'Price pending', 'দর বসান': 'Set price', 'দর বসান — ইনভয়েস': 'Set price — invoice',
    'দর বসানো হয়েছে': 'Price set', 'স্টক নেই': 'Out of stock',
    'মোট': 'Total', 'কালেকশন': 'Collection', 'Due': 'Due', 'মোট:': 'Total:', 'বাকি:': 'Due:', 'লাভ:': 'Profit:', 'ক্রয়:': 'Cost:',
    'পরিশোধ:': 'Paid:', 'ইনভয়েস:': 'Invoice:', 'তারিখ:': 'Date:', 'নম্বর:': 'No.:',
    'স্টকে ছিল': 'Was in stock', 'স্টকে থাকবে': 'Will be in stock',
    'সম্পূর্ণ পরিশোধিত': 'Fully paid', '(সম্পূর্ণ পরিশোধিত)': '(fully paid)',
    'নগদ বাক্স': 'Cash box', 'ব্যাংক': 'Bank', 'সব মিলিয়ে': 'Net',
    'অনলাইনে সেভ চালু আছে': 'Online save is on', 'অনলাইনে সেভ বন্ধ আছে': 'Online save is off',
    'অনলাইনে সেভ হয়েছে।': 'Saved online.', 'অনলাইনে সেভ হয়নি:': 'Online save failed:',
    'সংযোগ ঠিক আছে।': 'Connection OK.', 'সংযোগ ব্যর্থ:': 'Connection failed:',
    'হোস্টিংয়ে সেভ আছে:': 'Saved on hosting:',
    'লোকাল সার্ভার (Installed App) — সবচেয়ে ভালো': 'Local server (Installed App) — best',
    'শুধু এই ব্রাউজারের ভেতরে': 'Browser only',
    'তথ্য নিজে থেকেই সেভ হয় · পাশে backups ফোল্ডারে প্রতিদিনের কপি থাকে।':
      'Data is saved automatically · daily copies kept in the backups folder.',
    'তথ্য এখন শুধু এই ব্রাউজারে আছে।': 'Data is currently only in this browser.',
    'মালামাল আপনার সামনে গুনে ও পরীক্ষা করে নিন। বিক্রিত মালামাল ফেরত নেওয়া হয় না।':
      'Please check the goods in front of you. Sold items are not returnable.',
    'বিক্রিত মালামাল ফেরত নেওয়া হয় না।': 'Sold items are not returnable.',
    'আমাদের দোকানে আসার জন্য ধন্যবাদ! আবার আসবেন।': 'Thank you for visiting us! Please come again.',
    'সোয়েব মটরস ও টায়ার হাউস': 'Shoeb Motors & Tyre House', 'সোয়েব মটরস': 'Shoeb Motors',
    'মেসার্স সোয়েব মটরস এন্ড টায়ার হাউজ': 'MS Shoeb Motors & Tyre House', 'সোয়েব মটরস': 'Shoeb Motors',
    'কালীগঞ্জ, ঝিনাইদহ': 'Kaliganj, Jhenaidah',
    'টায়ার · টিউব · মোটর পার্টস': 'Tyres · Tubes · Motor parts',
    'অনুমোদিত স্বাক্ষর': 'Authorised signature',

    /* ---------- simplified sales + appearance refresh ---------- */
    'দিন শেষে টাকার হিসাব': 'End-of-day cash reconciliation',
    'হিসাবের দিন': 'Closing date', 'দিনের সারাংশ': 'Day summary', 'নির্বাচিত দিনের হিসাব': 'Selected day summary',
    'ক্যাশ মিলান': 'Reconcile cash', 'হাতে গুনে যা আছে লিখুন': 'Enter the cash you physically counted',
    'হাতে গোনা ক্যাশ': 'Actual cash counted',
    'Closing note': 'Closing note', '✓ Day Closing সেভ করুন': '✓ Save Day Closing', '✓ Day Closing আপডেট করুন': '✓ Update Day Closing',
    'Day Closing হিস্ট্রি': 'Day Closing history', 'সর্বশেষ ৩০টি রেকর্ড': 'Latest 30 records',
    'Expected Cash': 'Expected Cash', 'Actual Cash': 'Actual Cash', 'Difference': 'Difference',
    'আজ Close করুন': 'Close today', 'হাতে গোনা ক্যাশ মিলিয়ে দিন শেষ করুন': 'reconcile counted cash and finish the day',
    'মোট ইনভয়েস': 'Total invoices', 'নতুন ইনভয়েস থেকে ক্যাশ': 'Cash from today’s invoices', 'পুরোনো invoice থেকে ক্যাশ': 'Cash from older invoices',
    'দিনের মোট বিক্রি': 'Total sales for the day', 'Invoice সংখ্যা': 'Invoice count', 'Cash Collection entry': 'Cash Collection entries',
    'আজ Cash Collection': 'Cash collected that day', 'আজকের invoice-এ দিন শেষে Due': 'End-of-day Due on that day’s invoices',
    'System Expected Cash': 'System Expected Cash', 'এই দিন এখনো Close করা হয়নি': 'This day has not been closed yet',
    'Closing-এর পর হিসাব পরিবর্তন হয়েছে': 'Records changed after closing', 'আবার সেভ করলে snapshot আপডেট হবে': 'save again to update the snapshot',
    'Day Closed': 'Day Closed', 'Actual Cash লিখলে Difference দেখা যাবে': 'Enter Actual Cash to see the difference',
    'হাতে গোনা Actual Cash লিখুন।': 'Enter the Actual Cash you counted.', 'Actual Cash শূন্যের কম হতে পারে না।': 'Actual Cash cannot be below zero.',
    'ক্যাশ মিলেছে': 'Cash matched', 'ক্যাশ বেশি': 'Cash over', 'ক্যাশ কম': 'Cash short', 'হিসাব পরিবর্তিত': 'Changed',
    'শেষ সেভ:': 'Last saved:', 'খুলুন': 'Open',
    'Expected Cash = ওই দিনে Cash Collection-এ সেভ করা মোট টাকা। Opening cash বা খরচ এতে ধরা হয় না।': 'Expected Cash is the total saved in Cash Collection for that day. Opening cash and expenses are not included.',
    'Day expense': 'Day expense', 'খরচ বাদে হাতে থাকার কথা': 'Cash expected after expense',
    'আজ ক্যাশ থেকে খরচ হলে লিখুন': 'Enter any cash expense for the day',
    'খরচ বা হিসাব না মিললে কারণ লিখুন': 'Explain any expense or cash mismatch',
    'Day expense Expected Cash-এর চেয়ে বেশি হতে পারে না': 'Day expense cannot exceed Expected Cash',
    'Day expense Expected Cash-এর চেয়ে বেশি হতে পারে না।': 'Day expense cannot exceed Expected Cash.',
    'খরচ বা হিসাব না মিললে Closing note লিখুন।': 'Add a closing note for an expense or cash mismatch.',
    'খরচ বাদে': 'After expense',
    'ম্যানেজার গুনে পাওয়া মোট ক্যাশ': 'Total cash counted by the manager',
    'Short / Extra': 'Short / Extra', 'নোট': 'Note',
    'প্রয়োজনে হাতে বদলানো যাবে': 'can be edited manually if needed', '(প্রয়োজনে হাতে বদলানো যাবে)': '(editable if needed)',
    'দেখতে কেমন হবে / Appearance': 'Appearance', 'থিম': 'Theme',
    'System ডিফল্ট। কম্পিউটারের light/dark সেটিং বদলালে প্রোগ্রাম নিজে বদলাবে।':
      'System is the default. The app follows computer light/dark changes automatically.',
    'প্রোগ্রামের ভাষা': 'Program language', 'বিস্তারিত হিসাব': 'Detailed analysis',
    'রেফারেন্স নাই': 'No Reference', 'রেফারেন্স': 'Reference',
    'গাড়ি / মেশিন': 'Vehicle / Machine', 'ব্যবহার': 'Usage', 'সাইজ / ব্যবহার': 'Size / Usage',
    'এখন পর্যন্ত জমা দিয়েছেন': 'Paid so far', 'মোট পাওনা (বর্তমান)': 'Total due (current)',
    'পুরো টাকা এখনই পেয়েছি (নগদ)': 'Received full amount now (cash)',
    'পুরো টাকা জমা হয়ে গেছে, কোনো বাকি নেই।': 'Full amount collected, no due.',
    'পুরো টাকা জমা রাখা যায়নি — পরে Cash Collection থেকে যোগ করুন।': 'Could not record the payment — add it later from Cash Collection.',
    'বিস্তারিত হিসাব দেখতে চান?': 'Want to see detailed analysis?',
    'যে হিসাব দরকার, সেটি বেছে নিন': 'Choose the section you want to review',
    'এই মাসের হিসাব': 'This month overview', 'এই মাসের ইনভয়েস': "This month's invoices",
    /* ---------- বাকি তালিকা (Due list) ---------- */
    'বাকি তালিকা': 'Due list', 'মোট পাওনা': 'Total due', 'মোট বাকি': 'Total due',
    'বাকি ইনভয়েস': 'Due invoices', 'রিমাইন্ডার': 'Reminder', 'সর্বশেষ ইনভয়েস': 'Latest invoice',
    'সর্বশেষ': 'Latest', 'কোনো বাকি হিসাব নেই।': 'No dues.',
    'সাজান: বেশি বাকি আগে': 'Sort: highest due first', 'সাজান: পুরনো বাকি আগে': 'Sort: oldest due first',
    'সাজান: সর্বশেষ ইনভয়েস': 'Sort: latest invoice', 'সাজান: নাম': 'Sort: name',
    'টাকা জমা': 'Deposit', 'Paid — বকেয়া পরিশোধ': 'Paid — Settle due',
    'পেমেন্টের তারিখ': 'Payment date', 'জমার পরিমাণ': 'Deposit amount', 'টাকার পরিমাণ': 'Amount',
    'পুরো বকেয়া': 'Full due', 'পেমেন্ট সেভ করুন': 'Save payment',
    'টাকা প্রথমে আগের বকেয়া, এরপর পুরোনো ইনভয়েসের বাকি থেকে কমবে।': 'Money is deducted first from the old due, then from older invoice dues.',
    'দর অপেক্ষমাণ ইনভয়েস এই টাকার হিসাবে নেই।': 'Invoices with pending prices are not included in this amount.',
    'এই হিসাবে নির্ধারিত বকেয়া নেই।': 'There is no due set on this account.',
    'পেমেন্ট সেভ হয়েছে। বকেয়া কমেছে।': 'Payment saved. The due has decreased.',
    'পেমেন্ট সেভ হয়েছে — রসিদ খুলবেন?': 'Payment saved — open the receipt?',
    'বন্ধ করুন': 'Close', 'রসিদ খুলুন': 'Open receipt',
    'স্টক মূল্য': 'Stock value', 'স্টক পাতায় যান →': 'Go to stock →', '← ড্যাশবোর্ড': '← Dashboard',
    'ইনভয়েস সেটিংস (ইনভয়েসে যা যা ছাপা হবে)': 'Invoice settings (what will be printed)',
    'ইনভয়েসের উপরের লেখা': 'Invoice heading text', 'ইনভয়েস সাধারণত কোন কাগজে': 'Default invoice paper',
    'মোবাইল নম্বর (একাধিক হলে কমা দিয়ে লিখুন)': 'Mobile numbers (separate multiple numbers with commas)',
    'মোবাইল নম্বর (একাধিক হলে কমা দিয়ে)': 'Mobile numbers (separate with commas)',
    '🖼️ লোগো বদলান': '🖼️ Change logo', 'আগের লোগো': 'Previous logo', 'সব তথ্য সেভ হবে': 'All data will be saved',
    'সেভ: —': 'Save: —', 'সোয়েব মটরস — দোকান পরিচালনা': 'Shoeb Motors — Shop Management',
    'A5 (ছোট)': 'A5 (small)', 'ফোল্ডারে।': 'in the folder.',
    '＋ গাড়ির নম্বর যোগ করুন': '＋ Add vehicle number', 'নাম লিখে এই মোবাইল নম্বরটি সেভ করুন': 'Enter a name to save this mobile number',
    'আইটেমের নাম': 'Item name', '(প্রতি পিস)': '(per pc)', 'আমার ক্রয়মূল্য (শুধু মালিক)': 'My cost price (owner only)',
    'নিজের লেখা আইটেম স্টক থেকে কমে না। ফিটিং, ব্যালান্সিং, বাতাস, সার্ভিস বা তালিকায় না থাকা সাইজের জন্য এটি ব্যবহার করুন।':
      'Custom items do not reduce stock. Use this for fitting, balancing, air, service, or sizes not listed in stock.',
    'রাখা হয়েছে': 'Held at', 'নিচে': 'below', 'প্রতি পিস': 'Per pc', 'ক্রয়মূল্য (মালিক)': 'Cost price (owner)',
    'দর (প্রতি পিস)': 'Rate (per pc)', '· সর্বমোট': '· Grand total', 'সাপ্লায়ার / কোথা থেকে': 'Supplier / source',
    'কত পিস নিলেন *': 'Quantity received *', 'প্রতি পিস দর *': 'Rate per pc *',
    'কত পিস আর কত টাকা — লিখলে নিচে হিসাব দেখা যাবে।': 'Enter quantity and total amount to see the calculation below.',
    'বিক্রি হয়েছে': 'Sold', 'কেনার হিসাব (স্টক যোগ)': 'Purchase history (stock added)', 'সাপ্লায়ার': 'Supplier',
'ব্যবহৃত টায়ারের সাইজ': 'Tyre size used',
    'নাম *': 'Name *', 'মোবাইল নম্বর *': 'Mobile number *', '(এই নম্বর দিয়েই খুঁজে পাবেন)': '(use this number to find the customer)',
    'এই কাস্টমারের গাড়ি': "This customer's vehicles", 'গাড়ির নম্বর কাস্টমারের সাথে সেভ থাকে এবং ইনভয়েসে ছাপা হয়।':
      'The vehicle number is saved with the customer and printed on the invoice.',
    'টায়ার বিক্রি': 'Sell tyre', 'খুলুন →': 'Open →', 'সব কিছু': 'everything',
    'মুছে ফেলবে — স্টক, কাস্টমার ও বিক্রি। নিশ্চিত করতে আপনার পিন লিখতে হবে।':
      'will be deleted — stock, customers, and sales. Enter your PIN to confirm.',
    'মালিকের পিন': 'Owner PIN',
    'বিল রেখে দেওয়া হয়েছে। “রাখা বিল খুলুন” চেপে ফিরিয়ে আনুন।': 'Bill held. Use “Open held bill” to restore it.',
    'টায়ারটি মুছে ফেলবেন?': 'Delete this tyre?', 'কাস্টমারের তথ্য বদলান': 'Edit customer details',
    'মোবাইল নম্বর লিখুন — এই নম্বর দিয়েই পরে কাস্টমার খুঁজে পাবেন।': 'Enter a mobile number — use this number to find the customer later.',
    'এখনো কোনো গাড়ির নম্বর সেভ করা হয়নি। “＋ গাড়ি যোগ করুন” চাপুন।': 'No vehicle number saved yet. Click “＋ Add vehicle”.',
    'গাড়িটি মুছে ফেলবেন?': 'Delete this vehicle?', 'এই কাস্টমারের তালিকা থেকে গাড়ির নম্বরটি মুছে যাবে।': 'The vehicle number will be removed from this customer.',
    'ছবি ফাইল বেছে নিন (PNG বা JPG)।': 'Choose an image file (PNG or JPG).',
    'ছবিটি খোলা গেল না — অন্য ছবি দিয়ে দেখুন।': 'Could not open the image — try another file.',
    'এখনকার পিন ভুল হয়েছে।': 'Current PIN is incorrect.', 'নতুন পিন ৪ থেকে ৬ সংখ্যার হতে হবে।': 'New PIN must be 4 to 6 digits.',
    'পিন বদলানো হয়েছে। মনে রাখুন!': 'PIN changed. Please remember it.',
    'ফাইলটি সঠিক ব্যাকআপ ফাইল নয়।': 'This is not a valid backup file.', 'এই ফাইলটি দোকানের ব্যাকআপ বলে মনে হচ্ছে না।': 'This file does not appear to be a shop backup.',
    'ব্যাকআপ থেকে তথ্য ফিরিয়ে আনা হয়েছে।': 'Data restored from backup.', 'পিন ভুল — কিছুই মুছে ফেলা হয়নি।': 'Incorrect PIN — nothing was deleted.',
    'ভাষা: বাংলা': 'Language: Bangla', 'কোড': 'Code', 'বারকোড': 'Barcode', 'নিজে বদলানো': 'Changed manually',
    'কাস্টমার হয়েছেন': 'Customer since', 'কার জন্য / কেন': 'For whom / why',
    'কাস্টমার আগে থেকেই আছে': 'Customer already available', '✓ কাস্টমার আগে থেকেই আছে': '✓ Customer already available',
    'নতুন বিক্রি করুন': 'Make new sale',
    'এই নম্বরটি ডাটাবেসে আগে থেকেই আছে। নতুন কাস্টমার না বানিয়ে এই কাস্টমারের নামে নতুন বিক্রি করুন।':
      'This mobile number is already in the database. Use the existing customer to make a new sale.',
    'Enter চাপুন বা এখানে ক্লিক করে নতুন বিক্রি করুন': 'Press Enter or click here to make a new sale',
    'দর অপেক্ষমাণ': 'Price pending', 'সম্পূর্ণ': 'Complete',
    'দর নিশ্চিত হয়নি — পরে ঠিক হবে': 'Price not confirmed — set it later',
    'বিক্রি ও লাভের হিসাব': 'Sales & profit analysis', 'স্টক ও মূল্য': 'Stock & value',
    'টায়ার শেষ হয়ে যাচ্ছে — যোগ করুন': 'Tyres are running low — restock', 'সব টায়ারের স্টক ঠিক আছে': 'All tyre stock levels are OK',
    'কাস্টমার, মোবাইল ও গাড়ির তথ্য এক জায়গায়': 'Customer, mobile and vehicle details in one place',
    'এই মাসের ইনভয়েস — যেকোনো বিল খুলে আবার ছাপতে পারবেন': "This month's invoices — open and reprint any bill",
    'এই মাসে ছাড়': 'Discount this month',
    'মোট কাস্টমার': 'Total customers', 'সেভ করা কাস্টমার': 'Saved customers',
    'বিক্রয়মূল্য থেকে ক্রয়মূল্য বাদ দিয়ে': 'Selling price minus cost price',
    'দর সেভ করুন': 'Save price', 'ইনভয়েস পাওয়া যায়নি।': 'Invoice not found.', 'কোনো দর লেখা হয়নি।': 'No price was entered.',
    'ওয়াক-ইন কাস্টমার': 'Walk-in customer', 'নিজের': 'Custom', 'সামনে': 'Front', 'পিছনে': 'Rear', 'সামনে-পিছনে': 'Front & rear', 'স্পেয়ার': 'Spare',
    'বন্ধ করুন': 'Close', 'দর লিখুন, অথবা “দর এখনো ঠিক হয়নি” টিক দিন।': 'Enter a price, or tick “price not confirmed yet”.',
    'কাস্টমার ঘরে মোবাইল নম্বর বা নাম লিখুন।': 'Enter a mobile number or name in the customer field.',
    'বিল মুছে ফেলবেন?': 'Clear this bill?', 'এই বিলের সব আইটেম মুছে যাবে।': 'All items in this bill will be removed.',
    'তবুও বিক্রি করুন': 'Sell anyway', 'রাখা বিলগুলো': 'Held bills', 'রাখা বিল খোলা হয়েছে।': 'Held bill opened.',
    'বিল মুছে ফেলা হয়েছে।': 'Bill cleared.', 'নাম নেই': 'No name', 'কখনো আসেননি': 'No visits yet',
    'পুরোনো তথ্য': 'Legacy data', 'সব তথ্য মুছে ফেলুন?': 'Delete all data?',
    'সেভ হয়েছে।': 'Saved.', 'লোগো বদলানো হয়েছে।': 'Logo updated.', 'আগের লোগোতে ফিরে গেছে।': 'Previous logo restored.',
    'ভুল এন্ট্রি হলে এখান থেকে বাতিল করা যাবে': 'Incorrect entries can be cancelled here',
    'কালেকশন এন্ট্রি বাতিল করবেন?': 'Cancel this collection entry?',
    'নির্বাচিত দিনে কোনো ক্যাশ কালেকশন এন্ট্রি নেই।': 'No cash collection entries on the selected day.',
    'এই ফিল্টারে কোনো ট্র্যাক করা ইনভয়েস নেই।': 'No tracked invoices match this filter.',
    'সময়কাল': 'Period', 'মোট পণ্য বিক্রি': 'Total products sold', 'ইনভয়েসে বিক্রিত মোট পণ্য': 'Total products sold in invoices',
    'নগদ পাওয়া': 'Cash received', 'আনুমানিক লাভ': 'Estimated profit', 'সব বিক্রির লাভ': 'Profit from all sales',
    'ফুল পেইড': 'Full paid', 'দাম বাকি': 'Price pending',
    'শুরু': 'Start', 'শেষ': 'End', 'তারিখ পরিসীমা': 'Date range',
    'ইনভয়েস / ক্রেতা খুঁজুন...': 'Search invoice / customer...',
    'আজ কত টাকা পেলেন': 'Cash received', 'কালেকশনের তারিখ': 'Collection date',
    'হিসাব মিলেছে': 'Reconciled', 'কালেকশনের টাকা লিখুন।': 'Enter the collection amount.',
    'Due-এর চেয়ে বেশি টাকা যোগ করা যাবে না।': 'Collection cannot exceed the Due amount.',
    'হোম': 'Home', 'ইনভয়েস': 'Invoices', 'আরও': 'More', 'স্টক যোগ': 'Add Stock',
    'ক্যাশ যোগ করুন →': 'Add cash →', 'আংশিক / খোলা': 'Partial / Open',
    'পণ্য বাছুন, মোট দিন, ইনভয়েস তৈরি করুন': 'Choose products, enter the total, create the invoice',
    'পুরোনো পণ্যে দ্রুত নতুন পরিমাণ যোগ করুন': 'Quickly add quantity to an existing product',
    'পুরো বা আংশিক পাওয়া টাকা invoice অনুযায়ী যোগ করুন': 'Add full or partial payments by invoice',
    'দোকান প্রস্তুত': 'Shop ready', 'নতুন বিক্রি': 'New Sale', 'ইনভয়েস দেখুন': 'View Invoices',
    'টায়ার বাছুন, মোট দিন, ইনভয়েস তৈরি করুন': 'Choose tyres, total the bill, create the invoice',
    'পুরোনো টায়ারে দ্রুত নতুন পরিমাণ যোগ করুন': 'Quickly add quantity to an existing tyre',
    'দিন, সপ্তাহ বা মাস অনুযায়ী invoice খুঁজুন': 'Find invoices by day, week or month',
    'আজকের বিক্রি': "Today's sales", 'আজকের লাভ': "Today's profit", 'এই মাসের ইনভয়েস': "This month's invoices",
    'কম স্টক': 'Low stock', 'এই মাসের সংক্ষিপ্ত হিসাব': 'This month at a glance', 'বিস্তারিত →': 'Details →',
'কাস্টমার → টায়ার → মোট → ইনভয়েস': 'Customer → Tyre → Total → Invoice',
    '২ · টায়ার নির্বাচন': '2 · Select tyre', 'স্টক থেকে বাছুন': 'Choose from stock',
    '৩ · মোট ও ইনভয়েস': '3 · Total & invoice',
    'টাইপ করুন → টায়ার নির্বাচন করুন → নির্বাচিত টায়ার নিচের তালিকার প্রথমে দেখা যাবে।': 'Type → select a tyre → the selected tyre appears first in the list below.',
    'টায়ারের পরিমাণ দেখুন, দ্রুত stock যোগ করুন বা নতুন tyre তৈরি করুন।': 'Review tyre quantities, quickly add stock, or create a new tyre.',
    '＋ স্টক যোগ': '＋ Add Stock', '＋ নতুন টায়ার': '＋ New Tyre',
    'টায়ার খুঁজুন': 'Find tyre', 'নতুন tyre হলে আগে তৈরি করুন': 'Create it first if this is a new tyre',
    'কোনো টায়ার পাওয়া যায়নি। নতুন টায়ার তৈরি করুন।': 'No tyre found. Create a new tyre.',
    'পিস': 'pcs', 'দর নেই': 'No price',
    'রসিদ প্রিন্ট / PDF': 'Print / PDF receipt',
    'বিক্রয় চালান': 'Sale invoice',

    /* English-mode gaps used by Stock / Sales / Cash Collection */
    'বিক্রি ও ইনভয়েস': 'Sales & invoices',
    '＋ নতুন পণ্য': '＋ New Product',
    'স্টকে এখনো কোনো পণ্য নেই।': 'No products in stock yet.',
    'কোনো পণ্য মেলেনি।': 'No products matched.',
    'পুরো টাকা পাওয়া': 'Fully paid',
    'আংশিক টাকা': 'Partial payment',
    'আবার টাকা যোগ করা যাবে': 'More payment can be added',
    'এখনও টাকা যোগ হয়নি': 'No payment added yet',
    'পণ্য': 'Product',
    'বিক্রয়মূল্যে': 'At selling price',
    'আংশিক': 'Partial',
    'পুরো': 'Full',
    'রসিদ': 'Receipt',
    'পুরো বাকি টাকা': 'Full due amount',
    'পুরো টাকা যোগ করুন': 'Add full payment',
    'সম্পূর্ণ কালেকশন': 'Full collection',
    'কালেকশন সেভ করা যায়নি।': 'Could not save the collection.',
    'এই ইনভয়েসের হিসাব ইতিমধ্যে মিলেছে।': 'This invoice is already fully reconciled.'
  };

  /* সংখ্যা/অঙ্ক সহ যেসব লেখা নিজে থেকে বানানো হয় — সেগুলোর নিয়ম */
  var RULES = [
    /* এই এন্ট্রিগুলো নিচের সাধারণ "মোট" নিয়মের আগে থাকতে হবে, নাহলে "মোট বকেয়া:"-এর
       "মোট" অংশটুকু আগেই বদলে গিয়ে বাকি অংশ বাংলায় রয়ে যায়। */
    [/মোট বকেয়া:\s*/g, 'Total due: '],
    [/^([০-৯0-9]+)\s*টি$/g, '$1'],
    [/Day Closing সেভ হয়েছে/g, 'Day Closing saved'],
    [/শেষ সেভ:\s*/g, 'Last saved: '],
    [/ক্যাশ কম\s*/g, 'Cash short '],
    [/ক্যাশ বেশি\s*/g, 'Cash over '],
    [/Short\s*/g, 'Short '],
    [/Extra\s*/g, 'Extra '],
    [/([০-৯0-9]+)\s*টি Cash Collection/g, '$1 Cash Collection entries'],
    [/Enter চাপুন বা এখানে ক্লিক করে নতুন বিক্রি করুন/g, 'Press Enter or click here to make a new sale'],
    [/সব সময়ের ইনভয়েস/g, 'All-time invoices'],
    [/ · আরও\s+([০-৯0-9]+)\s*টি(?=\s*$)/g, ' · $1 more'],
    [/([০-৯0-9]+)\s*টি(?=\s*$)/g, '$1'],
    [/([০-৯0-9]+)\s*টি collection entry/g, '$1 collection entries'],
    [/1 collection entries/g, '1 collection entry'],
    [/([০-৯0-9]+)\s*পণ্য/g, '$1 products'],
    [/দাম বাকি/g, 'Price pending'],
    [/বিক্রয়মূল্যে/g, 'At selling price'],
    [/শেষ ৭ দিন/g, 'Last 7 days'],
    [/এই মাসের লাভ/g, "This month's profit"],
    [/এই মাসের/g, "This month's"],
    [/এই মাসে লাভ/g, 'Profit this month'],
    [/এই মাসে/g, 'This month'],
    [/এই মাস(?=\s|$)/g, 'This month'],
    [/([০-৯0-9]+)\s*জন/g, '$1 customers'],
    [/⚠\s*কম স্টক:/g, '⚠ Low stock:'],
    [/ · আরও\s+([০-৯0-9]+)\s*টি/g, ' · $1 more'],
    [/([০-৯0-9.]+)%\s*—\s*বিক্রির উপর লাভের হার/g, '$1% — profit margin on sales'],
    [/([০-৯0-9.]+)%\s*বিক্রির উপর/g, '$1% of sales'],
    [/ — বিক্রি\s*/g, ' — Sales '],
    [/,\s*লাভ\s*/g, ', Profit '],
    [/\(([০-৯0-9]+)\s*ইনভয়েস\)/g, '($1 invoices)'],
    [/টি এন্ট্রি/g, ' entries'],
    [/কালেকশন যোগ হলে নিজে থেকে কমবে/g, 'decreases automatically when collection is added'],
    [/সব দিনের বাকি যোগফল/g, 'sum of outstanding amounts across all days'],
    [/ইনভয়েস মোট:/g, 'Invoice total:'], [/আগে কালেকশন:/g, 'Collected before:'],
    [/Cash Collection সেভ হয়েছে/g, 'Cash Collection saved'],
    [/কাস্টমার আগে থেকেই আছে/g, 'Customer already available'],
    [/এই মাসে লাভ/g, 'Profit this month'],
    [/দিনভিত্তিক, টায়ারভিত্তিক সব হিসাব/g, 'day-wise and tyre-wise analysis'],
    [/দিনভিত্তিক, পণ্যভিত্তিক সব হিসাব/g, 'day-wise and product-wise analysis'],
    [/পিস বিক্রি/g, 'pcs sold'],
    [/জন কাস্টমার/g, 'customers'],
    [/ধরনের টায়ার/g, 'tyre types'],
    [/কম ([০-৯0-9]+) টি/g, 'low $1'],
    [/দর অপেক্ষমাণ/g, 'Price pending'],
    [/দর নিশ্চিত হয়নি — পরে ঠিক হবে/g, 'Price not confirmed — set it later'],
    [/সেভ করা কাস্টমার/g, 'Saved customers'],
    [/বিক্রয়মূল্য থেকে ক্রয়মূল্য বাদ দিয়ে/g, 'Selling price minus cost price'],
    [/স্টকে:\s*([^\s·<]+)/g, 'In stock: $1'],
    [/স্টকে যথেষ্ট নেই/g, 'Not enough in stock'],
    [/স্টকে আছে, বিক্রি করা হচ্ছে/g, 'In stock · to be sold'],
    [/স্টকে ছিল/g, 'Was in stock'],
    [/স্টকে আছে/g, 'In stock'],
    [/স্টকের ক্রয়মূল্য/g, 'Stock value at cost'],
    [/স্টকে যোগ হয়েছে।/g, 'added to stock.'],
    [/স্টকে যোগ করুন/g, 'Add to stock'],
    [/স্টকে/g, 'in stock'],
    [/স্টক কমে গেছে/g, 'Low stock'],
    [/স্টক কম নেই।/g, 'Stock is fine.'],
    [/([০-৯0-9,]+)\s*পিস/g, '$1 pcs'],
    [/পিস স্টকে/g, 'pcs in stock'],
    [/পিস বিক্রি/g, 'pcs sold'],
    [/([০-৯0-9]+)\s*টি ইনভয়েস/g, '$1 invoices'],
    [/([০-৯0-9]+)\s*টি বিক্রি/g, '$1 sales'],
    [/([০-৯0-9]+)\s*টি খরচ/g, '$1 expenses'],
    [/([০-৯0-9]+)\s*খরচ/g, '$1 expenses'],
    [/([০-৯0-9]+)\s*টি ইনভয়েস/g, '$1 invoices'],
    [/টি খরচ/g, 'expenses'],
    [/জন কাস্টমার/g, 'customers'],
    [/ধরনের টায়ার/g, 'tyre types'],
    [/ধরনের পণ্য/g, 'product types'],
    [/টি আইটেম/g, 'items'],
    [/টি বিক্রি/g, 'sales'],
    [/টি টায়ার/g, 'tyres'],
    [/টি পণ্য/g, 'products'],
    [/বাকি:\s*([০-৯0-9,৳\s.]+)/g, 'Due: $1'],
    [/মোট:\s*([০-৯0-9,৳\s.]+)/g, 'Total: $1'],
    [/লাভ:\s*([০-৯0-9,৳\s.]+)/g, 'Profit: $1'],
    [/ক্রয়:\s*([০-৯0-9,৳\s.]+)/g, 'Cost: $1'],
    [/আদায়:\s*([০-৯0-9,৳\s.]+)/g, 'Collected: $1'],
    [/বিক্রয়:\s*([০-৯0-9,৳\s.]+)/g, 'Sales: $1'],
    [/মোট লাভ/g, 'Total profit'],
    [/মোট বিক্রি/g, 'Total sales'],
    [/আদায়যোগ্য বাকি/g, 'Receivable due'],
    [/দেওয়া ছাড়/g, 'Discount given'],
    [/এই মাসে/g, 'This month'],
    [/সব সময়/g, 'All time'],
    [/সব মাস/g, 'All months'],
    [/সব কাস্টমার/g, 'All customers'],
    [/এখনই সেভ করুন/g, 'Save now'],
    [/দর নিশ্চিত হয়নি/g, 'Price not confirmed'],
    [/দর ঠিক হয়নি/g, 'Price not confirmed'],
    [/^ছাড়\b/g, 'Discount'],
    [/ সেভ হয়েছে/g, ' saved'],
    [/^স্টক কম/g, 'Low stock'],
    [/নতুন কাস্টমার/g, 'New customer'],
    [/যোগ হয়েছে।/g, 'added.'],
    [/বদল হয়েছে।/g, 'updated.'],
    [/মুছে ফেলা হয়েছে।/g, 'deleted.'],
    [/সেভ হয়েছে।/g, 'saved.'],
    [/পাওয়া যায়নি।/g, 'not found.'],
    [/মিলছে না।/g, 'does not match.'],
    [/লিখুন।/g, 'required.'],
    [/দিন।/g, 'required.'],
    [/^মেসার্স সোয়েব মটরস এন্ড টায়ার হাউজ$/g, 'MS Shoeb Motors & Tyre House'],
    [/মেসার্স সোয়েব মটরস এন্ড টায়ার হাউজ/g, 'MS Shoeb Motors & Tyre House'],
    [/^সোয়েব মটরস$/g, 'Shoeb Motors'], [/^সোয়েব মটরস$/g, 'Shoeb Motors'],
    /* সংখ্যা-সহ বাক্য (নিজে থেকে বানানো লেখা) */
    [/মোবাইল:\s*/g, 'Mobile: '],
    [/^সেভ:\s*/g, 'Saved: '],
    [/^Saved:\s*(.*)/g, 'Saved: $1'],
    [/([০-৯0-9]+)\s*পিস বিক্রি/g, '$1 pcs sold'],
    [/([০-৯0-9]+)\s*কাস্টমারের কাছে টাকা বাকি/g, '$1 customers with dues'],
    [/([০-৯0-9]+)\s*কাস্টমার/g, '$1 customers'],
    [/([০-৯0-9]+)\s*টায়ার/g, '$1 tyres'],
    [/টি বিক্রি/g, 'sales'],
    [/([০-৯0-9][০-৯0-9.,]*)\s*বিক্রির উপর লাভের হার/g, '$1% profit margin'],
    [/([০-৯0-9][০-৯0-9.,]*)\s*বিক্রির %/g, '$1% of sales'],
    [/([০-৯0-9][০-৯0-9.,]*)\s*ছাড়/g, '$1 discount'],
    [/খরচ বাদ দেওয়ার পর/g, 'after expenses'],
    [/সবার কাছে মোট বাকি/g, 'total due'],
    [/নগদ পেমেন্ট/g, 'Cash payment'],
    [/বাকি আদায়/g, 'dues collected'],
    [/আদায়\s*(?=[০-৯0-9৳])/g, 'Collected '],
    [/([০-৯0-9,]+)\s*pcs বিক্রি/g, '$1 pcs sold'],
    [/সবার কাছে মোট Due:/g, 'total due:'],
    [/সবার কাছে মোট বাকি/g, 'total due'],
    [/(\s)মোট(\s)/g, '$1total$2'],
    [/1 customers/g, '1 customer'], [/1 tyres/g, '1 tyre'], [/1 invoices/g, '1 invoice'],
    [/1 sales/g, '1 sale'], [/1 expenses/g, '1 expense'], [/1 pcs/g, '1 pc'],
    [/সম্ভাব্য লাভ/g, 'expected profit'],
    [/^মোট\s/g, 'Total '],
    [/^আদায়\s/g, 'Collected '],
    [/^বাকি\s/g, 'Due '],
    [/^লাভ\s/g, 'Profit '],
    [/^ছাড়\s/g, 'Discount '],
    [/ফোল্ডারে/g, 'folder'],
    [/ফোল্ডার/g, 'folder'],
    [/^রাখা বিলগুলো/g, 'Held bills'],
    [/([০-৯0-9]+) বার কেনা · মোট/g, '$1 purchases · total'],
    [/^স্টক\s+([০-৯0-9.]+)/g, 'Stock $1'],
    [/^স্টকে মাত্র\s+([০-৯0-9.]+)/g, 'Only $1 in stock'],
    [/^＋ নতুন কাস্টমার যোগ করুন/g, '＋ Add new customer'],
    [/নিজের লেখা আইটেম হিসেবে যোগ করুন/g, 'add as a custom item'],
    [/^এই ইনভয়েসে\s*/g, 'This invoice has '],
    [/টি আইটেমের দর নিশ্চিত হয়নি/g, ' items with unconfirmed prices'],
    [/^বিক্রি সেভ হয়েছে · ইনভয়েস\s*/g, 'Sale saved · Invoice '],
    [/তৈরি হয়েছে।/g, 'created.'],
    [/^এই মোবাইল নম্বর আগে থেকেই আছে/g, 'This mobile number already exists'],
    [/কাস্টমার হিসেবেই সেভ হবে।/g, 'will be used as the existing customer.'],
    [/^নতুন কাস্টমার\s*/g, 'New customer '],
    [/কাস্টমার লিস্টে যোগ হয়েছে।/g, 'added to the customer list.'],
    [/^ইনভয়েস:\s*/g, 'Invoice: '], [/^তারিখ:\s*/g, 'Date: '], [/^ক্রেতা:\s*/g, 'Customer: '],
    [/^গাড়ির নম্বর:\s*/g, 'Vehicle no.: '], [/^ছাড়:\s*/g, 'Discount: '],
    [/দর অপেক্ষমাণ\s*([০-৯0-9]+)\s*টি/g, '$1 pending price(s)'],
    [/^রেফারেন্স:\s*/g, 'Reference: '], [/^আগের বকেয়া:\s*/g, 'Previous due: '],
    [/^জমা:\s*/g, 'Deposit: '],
    [/অবশিষ্ট বকেয়া:\s*/g, 'Remaining due: '],
    [/^শেষ অনলাইন সেভ:\s*/g, 'Last online save: '], [/^সমস্যা:\s*/g, 'Problem: '],
    [/^ইনভয়েস (INV-[\w-]+) ফিরিয়ে আনবেন\?/g, 'Restore invoice $1?'],
    [/ফিরিয়ে আনবেন\?/g, 'Restore?'],
    [/(সোমবার|মঙ্গলবার|বুধবার|বৃহস্পতিবার|শুক্রবার|শনিবার|রবিবার)\s*,\s*([০-৯0-9]+)\s*(জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)\s*([০-৯0-9]+)/g,
      function (m, dw, dd, mo, yy) { return D[dw] + ', ' + dd + ' ' + D[mo] + ' ' + yy; }],
    [/([০-৯0-9]+)\s*(জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)\s*([০-৯0-9]+)/g,
      function (m, dd, mo, yy) { return dd + ' ' + D[mo] + ' ' + yy; }]
  ];

  var TITLE = {
    'তথ্য এখানে সেভ হয়': 'Data is saved here',
    'তথ্য এখানে সেভ হচ্ছে': 'Data is saved here',
    'তথ্য কোথায় সেভ হয়': 'Where data is saved',
    'Lock app — অ্যাপ লক করুন': 'Lock app',
    'কাস্টমারকে হোয়াটসঅ্যাপে বিলের হিসাব পাঠান': 'Send the bill on WhatsApp',
    'ইনভয়েস মুছে ফেলুন': 'Delete invoice', 'দিন / সপ্তাহ / মাস অনুযায়ী দেখুন': 'View by day / week / month'
  };

  /* বাংলা "য়" ইউনিকোডে দুইভাবে লেখা যায় (একক অক্ষর U+09DF, বা "য"+নুক্তা যুক্ত হয়ে) —
     উৎস ফাইল আর এই ডিকশনারির লেখার ধরন আলাদা হলেও যেন মিল ঠিকমতো হয়, তাই
     ডিকশনারির চাবিগুলো সবসময় NFC ফর্মে রাখা হয়। */
  if (typeof ''.normalize === 'function') {
    var normalizedD = {};
    Object.keys(D).forEach(function (k) { normalizedD[k.normalize('NFC')] = D[k]; });
    D = normalizedD;
    var normalizedTitle = {};
    Object.keys(TITLE).forEach(function (k) { normalizedTitle[k.normalize('NFC')] = TITLE[k]; });
    TITLE = normalizedTitle;
  }

  /* যেসব জায়গায় হাত দেওয়া যাবে না (ইনভয়েস নিজেই bilingual — ui.js MAP দিয়ে) */
  var SKIP = '.inv-wrap,.thermal-wrap,.print-root,#invPreviewBox,#printRoot';

  function lang() {
    try { return (DB.state.settings.lang === 'en') ? 'en' : 'bn'; } catch (e) { return 'bn'; }
  }
  function isEn() { return lang() === 'en'; }
  function hasBn(t) { return /[\u0980-\u09FF]/.test(t || ''); }
  function ascii(t) { return String(t).replace(/[০-৯]/g, function (d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); }); }

  function translate(raw) {
    if (raw && typeof raw.normalize === 'function') raw = raw.normalize('NFC');
    if (D[raw]) return D[raw];
    /* খাঁটি বাংলা অঙ্ক (যেমন ধাপ-নম্বর বাবল "১", "২") — কোনো বাংলা অক্ষর নেই, তাই
       নিচের hasBn() চেক-এ আটকে না গিয়ে সবসময় নিরাপদে ইংরেজি অঙ্কে বদলানো যায়। */
    if (/^[০-৯]+$/.test(raw)) return ascii(raw);
    var out = raw, changed = false;
    for (var i = 0; i < RULES.length; i++) {
      var before = out;
      out = out.replace(RULES[i][0], RULES[i][1]);
      if (out !== before) changed = true;
    }
    if (changed) return ascii(out);
    if (hasBn(raw)) return null;            /* জানা নেই → বাংলাই থাকবে */
    return ascii(out);                      /* শুধু অঙ্ক — বাংলা সংখ্যা থেকে ইংরেজি */
  }

  var orig = new WeakMap();                 /* element/node → আগের বাংলা লেখা */

  function skip(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (n.matches && n.matches(SKIP)) return true;
    }
    return false;
  }

  function walk(root, fn) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(fn);
    var els = root.querySelectorAll ? root.querySelectorAll('[title],[placeholder]') : [];
    for (var i = 0; i < els.length; i++) fn(els[i]);
  }

  function applyNode(node) {
    if (node.nodeType === 1) { applyEl(node); return; }
    if (!node.parentNode || skip(node.parentNode)) return;
    var t = node.nodeValue || '';
    var raw = t.trim();
    if (!raw) return;
    if (isEn()) {
      if (!hasBn(raw)) return;
      var en = translate(raw);
      if (!en || en === raw) return;
      if (!orig.has(node)) orig.set(node, t);
      node.nodeValue = t.replace(raw, en);
    } else if (orig.has(node)) {
      node.nodeValue = orig.get(node);
      orig.delete(node);
    }
  }

  function applyEl(el) {
    if (skip(el)) return;
    var ti = el.getAttribute('title');
    if (ti && hasBn(ti)) {
      if (isEn()) {
        var tiKey = (typeof ti.normalize === 'function') ? ti.normalize('NFC') : ti;
        var en2 = TITLE[tiKey] || D[tiKey];
        if (en2) { if (!el.__bnTi) el.__bnTi = ti; el.setAttribute('title', en2); }
      } else if (el.__bnTi) { el.setAttribute('title', el.__bnTi); el.__bnTi = ''; }
    }
    var ph = el.getAttribute('placeholder');
    if (ph && hasBn(ph)) {
      if (isEn()) {
        var enPh = translate(ph.trim());
        if (enPh && enPh !== ph) { if (!el.__bnPh) el.__bnPh = ph; el.setAttribute('placeholder', enPh); }
      } else if (el.__bnPh) { el.setAttribute('placeholder', el.__bnPh); el.__bnPh = ''; }
    }
  }

  var translatedActive = false;

  function apply(root) {
    root = root || document.body;
    // Bengali is the source language. Once an English pass has been restored,
    // repeated Bengali renders need no DOM walk at all.
    if (!isEn() && !translatedActive) {
      document.documentElement.setAttribute('lang', 'bn');
      return;
    }
    walk(root, applyNode);
    document.documentElement.setAttribute('lang', isEn() ? 'en' : 'bn');
    if (isEn()) translatedActive = true;
    else if (root === document.body) translatedActive = false;
  }

  /* ভাষা বদল */
  function set(l) {
    DB.state.settings.lang = (l === 'en') ? 'en' : 'bn';
    DB.save();
    apply(document.body);
    if (window.App) App.refreshAll();            /* নতুন করে লেখা হলে observer শুধু নতুন অংশ অনুবাদ করবে */
    if (window.Settings) Settings.fill();
    if (window.Sale) Sale.onShow();
    setTimeout(function () { paintSwitch(); }, 120);
  }

  function paintSwitch() {
    var b = document.getElementById('langBtn');
    if (b) {
      b.textContent = isEn() ? 'বাংলা' : 'English';
      b.title = isEn() ? 'ভাষা: বাংলা করুন' : 'Language: switch to English';
    }
  }

  var t = null;
  function refresh(soon, root) {
    clearTimeout(t);
    t = setTimeout(function () { apply(root || document.body); paintSwitch(); }, soon === undefined ? 60 : soon);
  }

  var mo = null;
  var pendingRoots = new Set();
  function flushAddedRoots() {
    t = null;
    if (!isEn()) { pendingRoots.clear(); return; }
    var roots = Array.from(pendingRoots);
    pendingRoots.clear();
    roots.forEach(function (n) {
      if (!n) return;
      if (n.nodeType === 3) applyNode(n);
      else if (n.nodeType === 1 && !skip(n)) apply(n);
    });
    paintSwitch();
  }
  function bind() {
    mo = new MutationObserver(function (records) {
      // Bengali is already the source DOM, so mutations require zero translation work.
      if (!isEn()) return;
      records.forEach(function (rec) {
        Array.prototype.forEach.call(rec.addedNodes || [], function (n) {
          if (n.nodeType === 3) pendingRoots.add(n);
          else if (n.nodeType === 1 && !skip(n)) pendingRoots.add(n);
        });
      });
      if (!pendingRoots.size) return;
      clearTimeout(t);
      t = setTimeout(flushAddedRoots, 35);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    var b = document.getElementById('langBtn');
    if (b) b.onclick = function () { set(isEn() ? 'bn' : 'en'); };
    refresh(200);
  }

  /* ইংরেজি মোডে কাস্টমারের ইংরেজি নামটা দেখানো হয় (থাকলে) */
  function showName(bnName, enName) {
    if (isEn() && enName && String(enName).trim()) return String(enName).trim();
    return bnName || enName || '';
  }

  return { apply: apply, refresh: refresh, bind: bind, set: set, lang: lang, isEn: isEn, translate: translate, showName: showName, dict: D };
})();
