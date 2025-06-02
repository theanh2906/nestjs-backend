#!bin/sh

# Usage:
#   ./create_zip.sh files file1 file2 ... [ratio]
#   ./create_zip.sh folder /path/to/folder [ratio]

set -e

compress_ratio="9" # Default max compression

# Check if last argument is a number (compression ratio)
last_arg="${@: -1}"
if [[ "$last_arg" =~ ^[0-9]+$ ]]; then
  compress_ratio="$last_arg"
  set -- "${@:1:$(($#-1))}"
fi

if ! command -v zip &> /dev/null; then
  echo "'zip' command not found. If you are on Windows, use the PowerShell script below:"
  echo "----------------------------------------"
  echo "# Save as create_zip.ps1 and run with PowerShell:"
  echo "param("
  echo "  [Parameter(Position=0, Mandatory=$true)] [string]$mode,"
  echo "  [Parameter(Position=1, Mandatory=$true)] [string[]]$args"
  echo ")"
  echo "$ratio = 9"
  echo "if ($args[-1] -match '^[0-9]+$') { $ratio = $args[-1]; $args = $args[0..($args.Length-2)] }"
  echo "if ($mode -eq 'files') {"
  echo "  $zipName = \"files_\$(Get-Date -Format yyyyMMdd_HHmmss).zip\""
  echo "  Compress-Archive -Path $args -DestinationPath $zipName -CompressionLevel Optimal"
  echo "  Write-Host \"Created zip: $zipName\""
  echo "} elseif ($mode -eq 'folder') {"
  echo "  $folderPath = $args[0]"
  echo "  if (-not (Test-Path $folderPath -PathType Container)) { Write-Host \"Folder does not exist: $folderPath\"; exit 1 }"
  echo "  $folderName = Split-Path $folderPath -Leaf"
  echo "  $zipName = Join-Path $folderPath (\"$folderName.zip\")"
  echo "  Compress-Archive -Path (Join-Path $folderPath '*') -DestinationPath $zipName -CompressionLevel Optimal"
  echo "  Write-Host \"Created zip: $zipName\""
  echo "} else {"
  echo "  Write-Host \"Usage: create_zip.ps1 files file1 file2 ... [ratio]\""
  echo "  Write-Host \"       create_zip.ps1 folder C:\\path\\to\\folder [ratio]\""
  echo "  exit 1"
  echo "}"
  echo "----------------------------------------"
  exit 1
fi

if [ "$1" = "files" ]; then
  shift
  if [ $# -lt 1 ]; then
    echo "No files specified."
    exit 1
  fi
  zip_name="files_$(date +%Y%m%d_%H%M%S).zip"
  zip -r -$compress_ratio "$zip_name" "$@"
  echo "Created zip: $zip_name"
elif [ "$1" = "folder" ]; then
  shift
  if [ $# -lt 1 ]; then
    echo "No folder specified."
    exit 1
  fi
  folder_path="$1"
  if [ ! -d "$folder_path" ]; then
    echo "Folder does not exist: $folder_path"
    exit 1
  fi
  folder_name=$(basename "$folder_path")
  zip_name="$folder_path/$folder_name.zip"
  (cd "$folder_path" && zip -r -$compress_ratio "$zip_name" .)
  echo "Created zip: $zip_name"
else
  echo "Usage: $0 files file1 file2 ... [ratio]"
  echo "       $0 folder /path/to/folder [ratio]"
  exit 1
fi
