#Requires -Version 5.1
param(
    [string]$InstanceName = "anistream",
    [string]$Region = "us-east-1",
    [string]$BundleId = "small_3_0",
    [string]$KeyPairName = "anistream-key"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$KeyPath = Join-Path $ProjectRoot "deploy\$KeyPairName.pem"
$ArchivePath = Join-Path $env:TEMP "anistream-deploy.tar.gz"

Write-Host "=== AniStream AWS Lightsail Deploy ===" -ForegroundColor Cyan

aws sts get-caller-identity | Out-Null
Write-Host "AWS authenticated." -ForegroundColor Green

$keys = aws lightsail get-key-pairs --region $Region --query "keyPairs[?name=='$KeyPairName']" --output json | ConvertFrom-Json
if ($keys.Count -eq 0) {
    Write-Host "Creating key pair: $KeyPairName"
    aws lightsail create-key-pair --key-pair-name $KeyPairName --region $Region --query "privateKeyBase64" --output text | Out-File -Encoding ascii $KeyPath
    icacls $KeyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
}

$existing = $null
try {
    $null = aws lightsail get-instance --instance-name $InstanceName --region $Region 2>$null
    if ($LASTEXITCODE -eq 0) { $existing = $true }
} catch {
    $existing = $null
}

if (-not $existing) {
    Write-Host "Creating Lightsail instance: $InstanceName..."
    aws lightsail create-instances `
        --instance-names $InstanceName `
        --availability-zone "${Region}a" `
        --blueprint-id ubuntu_22_04 `
        --bundle-id $BundleId `
        --key-pair-name $KeyPairName `
        --region $Region | Out-Null

    do {
        Start-Sleep -Seconds 10
        $state = aws lightsail get-instance --instance-name $InstanceName --region $Region --query "instance.state.name" --output text
        Write-Host "  State: $state"
    } while ($state -ne "running")
}

$publicIp = aws lightsail get-instance --instance-name $InstanceName --region $Region --query "instance.publicIpAddress" --output text
Write-Host "Instance IP: $publicIp" -ForegroundColor Green

foreach ($port in @(80, 22)) {
    aws lightsail open-instance-public-ports `
        --instance-name $InstanceName `
        --region $Region `
        --port-info fromPort=$port,toPort=$port,protocol=TCP 2>$null | Out-Null
}

Write-Host "Packaging project..."
if (Test-Path $ArchivePath) { Remove-Item $ArchivePath -Force }
tar -czf $ArchivePath `
    --exclude=node_modules `
    --exclude=.git `
    --exclude=dist `
    --exclude=deploy/*.pem `
    -C $ProjectRoot `
    docker-compose.yml .env.example gateway web services deploy

Write-Host "Waiting for SSH..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $sshOut = ssh -i $KeyPath -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@$publicIp "echo ok" 2>&1
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 10
}
if (-not $ready) { throw "SSH not ready on $publicIp" }

Write-Host "Uploading and installing..."
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
scp -i $KeyPath -o StrictHostKeyChecking=no $ArchivePath "ubuntu@${publicIp}:/tmp/anistream.tar.gz" 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { $ErrorActionPreference = $prevEap; throw "SCP upload failed" }

$remoteCmd = "mkdir -p ~/anistream && tar -xzf /tmp/anistream.tar.gz -C ~/anistream && cd ~/anistream && sed -i 's/\r$//' deploy/server-setup.sh && bash deploy/server-setup.sh"
ssh -i $KeyPath -o StrictHostKeyChecking=no ubuntu@$publicIp $remoteCmd 2>&1 | Out-Host
$sshCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($sshCode -ne 0) { throw "Remote setup failed (exit $sshCode)" }

Write-Host ""
Write-Host "Deployed! Open http://$publicIp" -ForegroundColor Green
