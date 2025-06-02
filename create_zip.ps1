param(
  [Parameter(Position=0, Mandatory=$true)] [string]$mode,
  [Parameter(Position=1, Mandatory=$true)] [string[]]$args
)
$ratio = 9
if ($args[-1] -match '^[0-9]+$') { $ratio = $args[-1]; $args = $args[0..($args.Length-2)] }
if ($mode -eq 'files') {
  $zipName = "files_$(Get-Date -Format yyyyMMdd_HHmmss).zip"
  Compress-Archive -Path $args -DestinationPath $zipName -CompressionLevel Optimal
  Write-Host "Created zip: $zipName"
} elseif ($mode -eq 'folder') {
  $folderPath = $args[0]
  if (-not (Test-Path $folderPath -PathType Container)) { Write-Host "Folder does not exist: $folderPath"; exit 1 }
  $folderName = Split-Path $folderPath -Leaf
  $zipName = Join-Path $folderPath ("$folderName.zip")
  Compress-Archive -Path (Join-Path $folderPath '*') -DestinationPath $zipName -CompressionLevel Optimal
  Write-Host "Created zip: $zipName"
} else {
  Write-Host "Usage: create_zip.ps1 files file1 file2 ... [ratio]"
  Write-Host "       create_zip.ps1 folder C:\path\to\folder [ratio]"
  exit 1
}

