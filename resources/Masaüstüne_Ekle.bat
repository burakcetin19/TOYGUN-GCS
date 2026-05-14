@echo off
chcp 65001 >nul
echo Toygun GCS masaüstü kısayolu oluşturuluyor...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$uygulama = '%~dp0Toygun GCS.exe';" ^
  "$masaustu = [Environment]::GetFolderPath('Desktop');" ^
  "$kisayol = '$masaustu\Toygun GCS.lnk';" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$k = $ws.CreateShortcut($kisayol);" ^
  "$k.TargetPath = $uygulama;" ^
  "$k.WorkingDirectory = '%~dp0';" ^
  "$k.IconLocation = $uygulama;" ^
  "$k.Description = 'Toygun GCS - Yer Kontrol İstasyonu';" ^
  "$k.Save();" ^
  "Write-Host 'Masaustu kisayolu olusturuldu: ' + $kisayol"

echo.
echo Masaüstünüze "Toygun GCS" kısayolu eklendi.
echo Bu pencereyi kapatabilirsiniz.
pause
