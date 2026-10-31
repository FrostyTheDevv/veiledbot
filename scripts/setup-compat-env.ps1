$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot '.env.compat.local'
$git = Get-Command git -ErrorAction Stop
$ignored = & $git.Source -C $repoRoot check-ignore -q -- '.env.compat.local'
if ($LASTEXITCODE -ne 0) { throw '.env.compat.local is not ignored by Git; refusing to write credentials.' }

function Read-SecretText([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  if ($secure.Length -eq 0) { throw 'A required test credential was empty.' }
  $pointer = [IntPtr]::Zero
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($plain.Contains("`n") -or $plain.Contains("`r")) { throw 'Credential input cannot contain line breaks.' }
    return $plain
  }
  finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $secure.Dispose()
  }
}

if (Test-Path -LiteralPath $envPath) {
  $replace = Read-Host 'Replace the existing ignored compatibility env file? Type REPLACE to continue'
  if ($replace -cne 'REPLACE') { Write-Output 'No file was changed.'; exit 0 }
}

Write-Output 'Enter credentials for dedicated test bots only. No MongoDB URL is required. Values are masked and will not be printed.'
$discordToken = Read-SecretText 'Discord test bot token'
$veiledToken = Read-SecretText 'Veiled test bot token'

function Format-DotEnv([string]$Value) {
  return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

$contents = @(
  '# Local migration sandbox credentials. This ignored file must never be committed.'
  "DISCORD_TOKEN=$(Format-DotEnv $discordToken)"
  "VEILED_BOT_TOKEN=$(Format-DotEnv $veiledToken)"
  'VEILED_API_URL=https://api.veiled.lol/api/v1'
  'VEILED_GATEWAY_URL='
) -join "`n"
$tempPath = "$envPath.tmp"
try {
  Set-Content -LiteralPath $tempPath -Value $contents -Encoding utf8 -NoNewline
  Move-Item -LiteralPath $tempPath -Destination $envPath -Force
}
finally {
  if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
  $discordToken = $null
  $veiledToken = $null
  $contents = $null
}
Write-Output 'Saved credentials to the ignored local test file. Values were not displayed.'
