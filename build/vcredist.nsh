!include LogicLib.nsh

!macro customInstall
    ReadRegDword $R1 HKLM "SOFTWARE\WOW6432Node\Microsoft\VisualStudio\10.0\VC\VCRedist\x86" "Installed"
    ReadRegDword $R2 HKLM "SOFTWARE\WOW6432Node\Microsoft\VisualStudio\10.0\VC\VCRedist\x64" "Installed"
    ${If} $R1 != "1"
        ${AndIf} $R2 != "1"
            ${If} ${Silent}
                File /oname=$PLUGINSDIR\vcredist_x86.exe "${BUILD_RESOURCES_DIR}\vcredist_x86.exe"
                File /oname=$PLUGINSDIR\elevate.exe "${BUILD_RESOURCES_DIR}\elevate.exe"
                ExecWait '"$PLUGINSDIR\elevate.exe" "$PLUGINSDIR\vcredist_x86.exe" /q /norestart'
            ${Else}
                MessageBox MB_YESNO "For this program to work, the Visual C++ 2010 redistributable must be installed. Do you want to install it now? " IDYES true IDNO false
                true:
                    File /oname=$PLUGINSDIR\vcredist_x86.exe "${BUILD_RESOURCES_DIR}\vcredist_x86.exe"
                    File /oname=$PLUGINSDIR\elevate.exe "${BUILD_RESOURCES_DIR}\elevate.exe"
                    ExecWait '"$PLUGINSDIR\elevate.exe" "$PLUGINSDIR\vcredist_x86.exe" /q /norestart'
                false:
            ${EndIf}
    ${EndIf}
!macroend
