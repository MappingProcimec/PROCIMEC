Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
projectDir = scriptDir & "\..\.."

' 1. Iniciar Bot de Telegram en segundo plano (Modo 0 = Invisible)
WshShell.CurrentDirectory = projectDir & "\bot-telegram"
WshShell.Run "cmd /c node bot.js", 0, False

' 2. Iniciar Runner Dev Autonomo en segundo plano (Modo 0 = Invisible)
WshShell.CurrentDirectory = projectDir
WshShell.Run "cmd /c npm run worker:dev", 0, False
