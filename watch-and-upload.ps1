param(
  [int]$DelaySeconds = 8
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SyncScript = Join-Path $Root "sync-to-github.ps1"
$LogFile = Join-Path $Root ".git-upload.log"

if (-not (Test-Path -LiteralPath $SyncScript)) {
  throw "sync-to-github.ps1 was not found."
}

$Watcher = New-Object System.IO.FileSystemWatcher
$Watcher.Path = $Root
$Watcher.IncludeSubdirectories = $true
$Watcher.EnableRaisingEvents = $true
$Watcher.NotifyFilter = [System.IO.NotifyFilters]"FileName, DirectoryName, LastWrite"

$Pending = $false
$LastChange = Get-Date

function Should-Ignore {
  param([string]$Path)
  return $Path -like "*\.github-sync\*" -or
    $Path -like "*\.git\*" -or
    $Path -like "*\.git-upload.log" -or
    $Path -like "*firebase-config.js"
}

function Mark-Changed {
  param($EventArgs)
  if (Should-Ignore $EventArgs.FullPath) { return }
  $script:Pending = $true
  $script:LastChange = Get-Date
}

Register-ObjectEvent $Watcher Changed -Action { Mark-Changed $EventArgs } | Out-Null
Register-ObjectEvent $Watcher Created -Action { Mark-Changed $EventArgs } | Out-Null
Register-ObjectEvent $Watcher Deleted -Action { Mark-Changed $EventArgs } | Out-Null
Register-ObjectEvent $Watcher Renamed -Action { Mark-Changed $EventArgs } | Out-Null

Write-Host "Watching for changes. Press Ctrl+C to stop."

while ($true) {
  Start-Sleep -Seconds 1
  if (-not $Pending) { continue }
  $Age = (Get-Date) - $LastChange
  if ($Age.TotalSeconds -lt $DelaySeconds) { continue }

  $Pending = $false
  $Message = "Auto update Secret Chamber Credits $(Get-Date -Format s)"
  try {
    powershell -ExecutionPolicy Bypass -File $SyncScript -CommitMessage $Message *>> $LogFile
    Write-Host "Uploaded changes."
  } catch {
    "[$(Get-Date -Format s)] $($_.Exception.Message)" | Out-File -FilePath $LogFile -Append
    Write-Host "Upload failed. Check .git-upload.log"
  }
}
