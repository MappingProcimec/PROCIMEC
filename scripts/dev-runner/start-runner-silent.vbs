Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
projectDir = scriptDir & "\..\.."

' 1. Iniciar Bot de WhatsApp en segundo plano (Modo 0 = Invisible)
WshShell.CurrentDirectory = projectDir & "\bot-whatsapp"
WshShell.Run "cmd /c node bot.js", 0, False

' 2. Iniciar Runner Dev Autonomo en segundo plano (Modo 0 = Invisible)
WshShell.CurrentDirectory = projectDir
WshShell.Run "cmd /c npm run worker:dev", 0, False
