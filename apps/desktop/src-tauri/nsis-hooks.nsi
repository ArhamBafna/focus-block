; NSIS installer hooks for FocusBlock production setup
; Registers Chrome Native Messaging bridge and background service

!macro NSIS_HOOK_POSTINSTALL
  ; Create ProgramData FocusBlock directory
  CreateDirectory "$COMMONAPPDATA\FocusBlock"

  ; Write com.focusblock.bridge.json manifest pointing to installed native host
  FileOpen $0 "$COMMONAPPDATA\FocusBlock\com.focusblock.bridge.json" w
  FileWrite $0 '{\r$\n'
  FileWrite $0 '  "name": "com.focusblock.bridge",\r$\n'
  FileWrite $0 '  "description": "FocusBlock Chrome policy bridge",\r$\n'
  FileWrite $0 '  "path": "$INSTDIR\\focus-native-host.exe",\r$\n'
  FileWrite $0 '  "type": "stdio",\r$\n'
  FileWrite $0 '  "allowed_origins": [\r$\n'
  FileWrite $0 '    "chrome-extension://gmlbmoeejgjgmeffemfelecnmbiglfld/"\r$\n'
  FileWrite $0 '  ]\r$\n'
  FileWrite $0 '}\r$\n'
  FileClose $0

  ; Register the Native Messaging Host in Windows Registry (HKLM & HKCU)
  WriteRegStr HKLM "Software\Google\Chrome\NativeMessagingHosts\com.focusblock.bridge" "" "$COMMONAPPDATA\FocusBlock\com.focusblock.bridge.json"
  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.focusblock.bridge" "" "$COMMONAPPDATA\FocusBlock\com.focusblock.bridge.json"

  ; Install and start FocusBlockService if present
  IfFileExists "$INSTDIR\focus-service.exe" 0 +3
    ExecWait 'sc.exe create FocusBlockService binPath= "\"$INSTDIR\focus-service.exe\"" start= auto DisplayName= "FocusBlock Service"'
    ExecWait 'sc.exe start FocusBlockService'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Stop and remove FocusBlockService
  ExecWait 'sc.exe stop FocusBlockService'
  ExecWait 'sc.exe delete FocusBlockService'

  ; Remove Chrome Native Messaging Host registry keys
  DeleteRegKey HKLM "Software\Google\Chrome\NativeMessagingHosts\com.focusblock.bridge"
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.focusblock.bridge"

  ; Remove manifest
  Delete "$COMMONAPPDATA\FocusBlock\com.focusblock.bridge.json"
!macroend
