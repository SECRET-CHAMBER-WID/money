param(
  [string]$CommitMessage = "Update Secret Chamber Credits"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Git = "C:\Program Files\Git\cmd\git.exe"
$Owner = "SECRET-CHAMBER-WID"
$Repo = "money"
$Branch = "main"
$RepoUrl = "https://github.com/$Owner/$Repo.git"
$SyncDir = Join-Path $Root ".github-sync"

if (-not (Test-Path -LiteralPath $Git)) {
  $GitCommand = Get-Command git -ErrorAction SilentlyContinue
  if (-not $GitCommand) {
    throw "Git was not found. Install Git for Windows first."
  }
  $Git = $GitCommand.Source
}

function Run-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  & $Git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArgs -join ' ') failed."
  }
}

if (-not (Test-Path -LiteralPath $SyncDir)) {
  Run-Git "clone" "--branch" $Branch $RepoUrl $SyncDir
} else {
  Run-Git "-C" $SyncDir "fetch" "origin" $Branch
  Run-Git "-C" $SyncDir "checkout" $Branch
  Run-Git "-C" $SyncDir "pull" "--ff-only" "origin" $Branch
}

$Files = @(
  "index.html",
  "app.js",
  "styles.css",
  "sw.js",
  "manifest.json",
  "icon.svg",
  "README.md",
  "firebase-config.example.js",
  ".gitignore",
  "sync-to-github.ps1",
  "watch-and-upload.ps1"
)

foreach ($File in $Files) {
  $Source = Join-Path $Root $File
  $Target = Join-Path $SyncDir $File
  if (Test-Path -LiteralPath $Source) {
    Copy-Item -LiteralPath $Source -Destination $Target -Force
  }
}

$SourceData = Join-Path $Root "data"
$TargetData = Join-Path $SyncDir "data"
if (Test-Path -LiteralPath $SourceData) {
  if (Test-Path -LiteralPath $TargetData) {
    Remove-Item -LiteralPath $TargetData -Recurse -Force
  }
  Copy-Item -LiteralPath $SourceData -Destination $TargetData -Recurse -Force
}

Run-Git "-C" $SyncDir "add" "-A"

& $Git -C $SyncDir diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No changes to upload."
  exit 0
}

Run-Git "-C" $SyncDir "commit" "-m" $CommitMessage
Run-Git "-C" $SyncDir "push" "origin" $Branch

Write-Host "Uploaded to https://github.com/$Owner/$Repo"
