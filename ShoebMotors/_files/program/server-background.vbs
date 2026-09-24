Option Explicit

Dim fso, sh, base, serverPath, serverDir, portFile, logFile, port, url, urlFallback, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

base       = fso.GetParentFolderName(WScript.ScriptFullName)
serverDir  = fso.BuildPath(base, "server")
serverPath = fso.BuildPath(serverDir, "run-server.cmd")
portFile   = fso.BuildPath(serverDir, "fixed-port.txt")
logFile    = fso.BuildPath(serverDir, "server-log.txt")
port       = ReadPort(portFile, "17832")
url        = "http://127.0.0.1:" & port & "/api/info"
urlFallback = "http://localhost:" & port & "/api/info"

If IsUp(url) Or IsUp(urlFallback) Then WScript.Quit 0
If Not fso.FileExists(serverPath) Then WScript.Quit 2

sh.Environment("PROCESS")("SHOEB_NO_BROWSER") = "1"
sh.Environment("PROCESS")("SHOEB_PORT") = port
cmd = "cmd.exe /d /c call " & Q(serverPath) & " >> " & Q(logFile) & " 2>&1"
sh.Run cmd, 0, False
WScript.Quit 0

Function ReadPort(pf, fallback)
    Dim t, v
    ReadPort = fallback
    On Error Resume Next
    If Not fso.FileExists(pf) Then Exit Function
    Set t = fso.OpenTextFile(pf, 1, False)
    If Err.Number <> 0 Then Err.Clear: Exit Function
    v = Trim(t.ReadAll)
    t.Close
    If IsNumeric(v) Then ReadPort = CStr(CLng(v))
    On Error GoTo 0
End Function

Function IsUp(u)
    Dim x, body
    IsUp = False
    On Error Resume Next
    Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    If Err.Number <> 0 Then Err.Clear: Exit Function
    x.setTimeouts 80, 80, 120, 180
    x.open "GET", u, False
    x.send
    If Err.Number = 0 And x.status = 200 Then
        body = CStr(x.responseText)
        If InStr(1, body, """mode"":""server""", vbTextCompare) > 0 Then IsUp = True
    End If
    On Error GoTo 0
End Function

Function Q(s)
    Q = Chr(34) & s & Chr(34)
End Function
