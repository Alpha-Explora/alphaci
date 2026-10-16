import type { EnrollmentReceipt, HostPlatform } from "./host-types";
import { bashQuote, psQuote } from "./shell-quote";

export interface EnrollmentInstallFile {
  filename: string;
  contents: string;
  mimeType: string;
}

/** The server issues 43-character base64url codes. Anything else never reaches a file. */
const ENROLLMENT_CODE = /^[A-Za-z0-9_-]{43}$/;

/** The first installer release whose enroll.sh and Install-AlphaCIHost.ps1 read the code from a file. */
export const INSTALL_FILE_MIN_VERSION = "0.2.0";

/**
 * True when an installer version can run an install file. The parts are
 * compared as numbers, so "0.10.0" is newer than "0.2.0". Anything that is not
 * dotted digits counts as too old.
 */
export function installFileSupported(version: string): boolean {
  if (!/^\d+(\.\d+)*$/.test(version)) return false;
  const have = version.split(".").map(Number);
  const need = INSTALL_FILE_MIN_VERSION.split(".").map(Number);
  for (let index = 0; index < Math.max(have.length, need.length); index++) {
    const a = have[index] ?? 0;
    const b = need[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/**
 * A self-contained installer for one enrollment. It downloads and checks the
 * agent archive, then gives the one-time code to the installer by file path.
 * The code lives only in the script body, never on a command line. The machine
 * name is used for the file name alone. Each file deletes itself after a
 * successful run.
 */
export function enrollmentInstallFile(
  receipt: EnrollmentReceipt,
  platform: HostPlatform,
  machineName: string,
): EnrollmentInstallFile {
  const { url, sha256 } = receipt.installer;
  if (!/^[0-9a-f]{64}$/.test(sha256))
    throw new Error("Invalid installer checksum.");
  if (!ENROLLMENT_CODE.test(receipt.code))
    throw new Error("Invalid enrollment code.");
  if (!installFileSupported(receipt.installer.version))
    throw new Error("This installer version has no install file.");
  const install: InstallFacts = {
    url,
    sha256,
    apiUrl: receipt.apiUrl,
    code: receipt.code,
    replace: Boolean(receipt.replacesMachineId),
  };
  const slug = fileSlug(machineName);
  if (platform === "windows")
    return {
      filename: `alphaci-install-${slug}.cmd`,
      contents: windowsScript(install),
      mimeType: "text/plain",
    };
  return {
    filename: `alphaci-install-${slug}.sh`,
    contents: ubuntuScript(install),
    mimeType: "text/x-shellscript",
  };
}

interface InstallFacts {
  url: string;
  sha256: string;
  apiUrl: string;
  code: string;
  replace: boolean;
}

/** Lowercase letters, digits and hyphens only; a name with none falls back to "alphaci". */
function fileSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || "alphaci";
}

function ubuntuScript({ url, sha256, apiUrl, code, replace }: InstallFacts) {
  return [
    "#!/usr/bin/env bash",
    "# AlphaCI installer for this machine. It contains a one-time enrollment code. It deletes itself after a successful install; keep it private until then.",
    "set -euo pipefail",
    "work=$(mktemp -d)",
    `trap 'rm -rf "$work"' EXIT`,
    `curl --fail --location --proto '=https' ${bashQuote(url)} -o "$work/agent.tar.gz"`,
    `printf '%s  %s\\n' ${bashQuote(sha256)} "$work/agent.tar.gz" | sha256sum --check -`,
    `tar -xzf "$work/agent.tar.gz" -C "$work"`,
    // The code is written in a subshell so the private umask does not reach the
    // installer. The heredoc is quoted, so nothing in it expands.
    'code_file="$work/enrollment-code"',
    "(",
    "  umask 077",
    `  cat > "$code_file" <<'CODE'`,
    code,
    "CODE",
    ")",
    `sudo env ALPHACI_ENROLL_CODE_FILE="$code_file" bash "$work/agent/install.sh" --enroll ${bashQuote(apiUrl)}${replace ? " --replace" : ""}`,
    // Reached only when the install succeeded (set -e stops the script first), so a
    // failed run keeps this file for a rerun.
    'rm -f -- "$0"',
    "",
  ].join("\n");
}

function windowsScript({ url, sha256, apiUrl, code, replace }: InstallFacts) {
  return [
    "@echo off",
    "rem AlphaCI installer for this machine. It contains a one-time enrollment code. It deletes itself after a successful install; keep it private until then.",
    "setlocal",
    // The path reaches PowerShell through the environment, never inside a quoted
    // command, so an apostrophe in the folder name (O'Brien) cannot break a command.
    'set "ALPHACI_INSTALL_FILE=%~f0"',
    // fltmc only succeeds in an elevated window, so it is the administrator check.
    "fltmc >nul 2>&1",
    "if not errorlevel 1 goto :run",
    // The relaunched copy carries the marker. If it still lacks rights, stop here
    // instead of relaunching again. Every exit is at top level: a nested exit /b
    // inside a block does not reliably return its code.
    'if "%~1"=="--elevated" goto :no_admin',
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:ALPHACI_INSTALL_FILE -ArgumentList '--elevated' -Verb RunAs"`,
    "if errorlevel 1 (",
    "  echo The administrator prompt was declined or failed. Nothing was changed.",
    "  pause",
    ")",
    "exit /b",
    ":no_admin",
    "echo AlphaCI needs administrator rights, and this window did not get them. Nothing was changed. Run the file again as an administrator.",
    "echo.",
    "pause",
    "exit /b 1",
    ":run",
    // The PowerShell steps below the label are read from this file, so the code and
    // the URLs never appear on a command line.
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:ALPHACI_INSTALL_FILE); & ([scriptblock]::Create($t.Substring($t.LastIndexOf(':__POWERSHELL__')+15)))"`,
    'set "ALPHACI_RESULT=%ERRORLEVEL%"',
    "echo.",
    // 3010: Windows must restart before the installer can finish. Nothing is deleted.
    'if "%ALPHACI_RESULT%"=="3010" echo Windows needs a restart before AlphaCI can finish. Restart this machine, then run this same file again. The file is kept for that.',
    "pause",
    'if not "%ALPHACI_RESULT%"=="0" exit /b %ALPHACI_RESULT%',
    // Success only: (goto) ends the script first, so the file is no longer in use
    // when del runs. A failed run exits above and keeps the file for a rerun.
    "rem Success: remove this file. (goto) ends the script first, so nothing holds it open.",
    '(goto) 2>nul & del "%~f0"',
    ":__POWERSHELL__",
    `$enrollCode = '${code}'`,
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "$enrollCodeFile = Join-Path $env:TEMP ('alphaci-enroll-' + [guid]::NewGuid() + '.txt')",
    "$archive = Join-Path $env:TEMP ('alphaci-agent-' + [guid]::NewGuid() + '.tar.gz')",
    "$directory = Join-Path $env:TEMP ('alphaci-agent-' + [guid]::NewGuid())",
    "$exitCode = 0",
    "try {",
    "  # The installer reads the code file and deletes it. Only this user may touch it.",
    "  # WA is needed: Remove-Item fails with read and delete alone, even though",
    "  # [IO.File]::Delete works. WA does not allow writing the file's data.",
    "  [IO.File]::WriteAllText($enrollCodeFile, $enrollCode)",
    "  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    '  icacls $enrollCodeFile /inheritance:r /grant:r "*${sid}:(R,WA,D)" | Out-Null',
    "  if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the enrollment code file.' }",
    `  Invoke-WebRequest -Uri ${psQuote(url)} -OutFile $archive`,
    `  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne ${psQuote(sha256)}) { throw 'Installer checksum mismatch. Nothing was executed.' }`,
    "  New-Item -ItemType Directory -Path $directory | Out-Null",
    // Full path: a GNU tar earlier on PATH reads "C:" in -C as a host name.
    '  & "$env:SystemRoot\\System32\\tar.exe" -xzf $archive -C $directory',
    "  if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed.' }",
    "  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force",
    // Reset first, so a stale code from an earlier command cannot pass for the result.
    "  $LASTEXITCODE = 0",
    `  & (Join-Path $directory 'windows/Install-AlphaCIHost.ps1') -Distro Ubuntu -ClientSubnets LocalSubnet -ApiUrl ${psQuote(apiUrl)}${replace ? " -ReplaceCredential" : ""} -OnlyWhenSignedIn -EnrollCodeFile $enrollCodeFile`,
    "  $exitCode = $LASTEXITCODE",
    "} finally {",
    // Always removed, 3010 included: a rerun writes a fresh code file from the .cmd.
    "  Remove-Item -LiteralPath $enrollCodeFile -Force -ErrorAction SilentlyContinue",
    "  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue",
    "  Remove-Item -LiteralPath $directory -Recurse -Force -ErrorAction SilentlyContinue",
    "}",
    // Propagate the installer's result: the batch deletes itself only on 0.
    "exit $exitCode",
    "",
  ].join("\r\n");
}
