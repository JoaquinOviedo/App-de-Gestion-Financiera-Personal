Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
AppDir = FSO.GetParentFolderName(WScript.ScriptFullName)
ServerPath = FSO.BuildPath(AppDir, "server.js")
WshShell.Run "cmd.exe /d /c node """ & ServerPath & """", 0, False
