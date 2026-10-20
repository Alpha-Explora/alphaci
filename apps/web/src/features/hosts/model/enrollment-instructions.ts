import type { EnrollmentReceipt } from "./host-types";
import { bashQuote, psQuote } from "./shell-quote";
export function enrollmentInstructions(receipt: EnrollmentReceipt) {
  const { url, sha256 } = receipt.installer;
  if (!/^[0-9a-f]{64}$/.test(sha256))
    throw new Error("Invalid installer checksum.");
  // Without the flag the installer keeps an existing credential and never
  // consumes a replacement code.
  const replace = Boolean(receipt.replacesMachineId);
  return {
    ubuntu: `work=$(mktemp -d) &&
curl --fail --location --proto '=https' ${bashQuote(url)} -o "$work/agent.tar.gz" &&
printf '%s  %s\\n' ${bashQuote(sha256)} "$work/agent.tar.gz" | sha256sum --check - &&
tar -xzf "$work/agent.tar.gz" -C "$work" &&
sudo bash "$work/agent/install.sh" --enroll ${bashQuote(receipt.apiUrl)}${replace ? " --replace" : ""}`,
    windows: `$ErrorActionPreference = 'Stop'
$archive = Join-Path $env:TEMP ('alphaci-agent-' + [guid]::NewGuid() + '.tar.gz')
Invoke-WebRequest -Uri ${psQuote(url)} -OutFile $archive
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne ${psQuote(sha256)}) { throw 'Installer checksum mismatch. Nothing was executed.' }
$directory = Join-Path $env:TEMP ('alphaci-agent-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $directory | Out-Null
tar -xzf $archive -C $directory
if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed.' }
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
& (Join-Path $directory 'windows/Install-AlphaCIHost.ps1') -Distro Ubuntu -ClientSubnets LocalSubnet -ApiUrl ${psQuote(receipt.apiUrl)}${replace ? " -ReplaceCredential" : ""} -OnlyWhenSignedIn`,
  };
}
