# Create placeholder icon files (1x1 pixel PNG)
$iconDir = "C:\PaijuApp\PaijuApp\assets\images"
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null

# Minimal 1x1 transparent PNG
$pngBytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")

[System.IO.File]::WriteAllBytes("$iconDir\icon.png", $pngBytes)
[System.IO.File]::WriteAllBytes("$iconDir\adaptive-icon.png", $pngBytes)

Write-Host "Placeholder icons created:"
Write-Host "  - $iconDir\icon.png"
Write-Host "  - $iconDir\adaptive-icon.png"
Write-Host ""
Write-Host "Note: Please replace with actual 512x512 icons for production."
