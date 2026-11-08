# Starts the local sketch and voice relay, waits until they respond, then opens
# the app. A second launch reuses the stage and checks the running relay against its source.
# NoBrowser lets us check startup without opening another browser tab.
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$appUrl = 'http://127.0.0.1:8816/'
$relayUrl = 'http://127.0.0.1:8817/health'

# A missing response means the service needs to start. A different application
# on the same port is reported instead of being silently used or terminated.
function Test-ServiceReady([string]$Url, [string]$Kind) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    } catch {
        if ($_.Exception.Response) { throw "Another service responded at $Url. Close it and try again." }
        return $false
    }
    if ($Kind -eq 'app') {
        if ($response.Content -notmatch '<title>Puppet Theatre</title>') {
            throw "Port 8816 is serving a different application."
        }
    } else {
        $health = $response.Content | ConvertFrom-Json
        if ($null -eq $health.configured) { throw 'Port 8817 is serving a different application.' }
        if (!$health.configured) { throw 'The voice relay is running but its API key is not configured.' }
    }
    return $true
}

# Give a new process time to bind its port. Logs stay in the Windows temp folder.
function Wait-Service([string]$Url, [string]$Kind, $Process, [string]$ErrorLog) {
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Test-ServiceReady $Url $Kind) { return }
        if ($Process.HasExited) { throw "The $Kind server stopped during startup. See $ErrorLog" }
        Start-Sleep -Milliseconds 250
    }
    throw "The $Kind server did not become ready. See $ErrorLog"
}

try {
    if (!(Test-ServiceReady $appUrl 'app')) {
        $python = (Get-Command python -ErrorAction Stop).Source
        $appLog = Join-Path $env:TEMP 'puppet-theatre-live-app-error.log'
        $appProcess = Start-Process -FilePath $python -ArgumentList '-m http.server 8816 --bind 127.0.0.1' -WorkingDirectory (Join-Path $projectDirectory 'public') -WindowStyle Hidden -PassThru -RedirectStandardError $appLog
        Wait-Service $appUrl 'app' $appProcess $appLog
    }
    Write-Host 'Application server ready.'
    # Node loads these modules once. Put their content hashes in the process
    # arguments so the next launch can recognise exactly which code is in memory.
    $relayEntry = Join-Path $projectDirectory 'relay\local.mjs'
    $relayModules = Get-ChildItem -LiteralPath (Split-Path $relayEntry) -Filter '*.mjs' -File | Sort-Object Name
    $revision = ($relayModules | Get-FileHash -Algorithm SHA256 | ForEach-Object Hash) -join '-'
    $relayArgs = '--use-env-proxy "' + $relayEntry + '" --relay-revision=2-' + $revision
    $relayReady = Test-ServiceReady $relayUrl 'relay'
    if ($relayReady) {
        $listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 8817 -State Listen
        $running = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        $commandLine = ([string]$running.CommandLine).TrimEnd()
        $entryArgs = '--use-env-proxy "' + $relayEntry + '" --relay-revision='
        # The original launcher used this exact relative command before revisions existed.
        $legacy = $commandLine -match '\s--use-env-proxy relay/local\.mjs$'
        if ($running.Name -ne 'node.exe' -or (!$legacy -and !$commandLine.Contains($entryArgs))) {
            throw 'Port 8817 is occupied by a different process. Close it before launching this show.'
        }
        if (!$commandLine.EndsWith($relayArgs)) {
            Write-Host 'Updating the voice relay...'
            $oldRelay = Get-Process -Id $running.ProcessId
            $oldRelay.Kill()
            if (!$oldRelay.WaitForExit(5000)) { throw 'The previous relay did not stop.' }
            $relayReady = $false
        }
    }
    if (!$relayReady) {
        $node = (Get-Command node -ErrorAction Stop).Source
        $relayLog = Join-Path $env:TEMP 'puppet-theatre-live-relay-error.log'
        # The launcher exits before the show. Give timing logs their own file so a closed console pipe cannot stop Node.
        $relayOutput = Join-Path $env:TEMP 'puppet-theatre-live-relay-output.log'
        $relayProcess = Start-Process -FilePath $node -ArgumentList $relayArgs -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru -RedirectStandardError $relayLog -RedirectStandardOutput $relayOutput
        Wait-Service $relayUrl 'relay' $relayProcess $relayLog
    }
    Write-Host 'Voice relay ready. No paid session has been started.'
    if (!$NoBrowser) { Start-Process $appUrl }
} catch {
    Write-Host ("Could not start Puppet Theatre: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
