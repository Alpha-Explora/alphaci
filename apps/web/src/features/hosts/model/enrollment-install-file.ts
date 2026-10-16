import type { EnrollmentReceipt, HostPlatform } from "./host-types";
import { bashQuote, psQuote } from "./shell-quote";

export interface EnrollmentInstallFile {
  filename: string;
  contents: string;
  mimeType: string;
}

/** The server issues 43-character base64url codes. Anything else never reaches a file. */
const ENROLLMENT_CODE = /^[A-Za-z0-9_-]{43}$/;

/**
 * A self-contained installer for one enrollment. It downloads and checks the
 * agent archive, then gives the one-time code to the installer by file path.
 * The code lives only in the script body, never on a command line. The machine
 * name is used for the file name alone.
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
    "# AlphaCI installer for this machine. It contains a one-time enrollment code: keep it private and delete it after the install succeeds.",
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
    "",
  ].join("\n");
}

function windowsScript({ url, sha256, apiUrl, code, replace }: InstallFacts) {
  return [
    "@echo off",
    "rem AlphaCI installer for this machine. It contains a one-time enrollment code: keep it private and delete it after the install succeeds.",
    "setlocal",
    // The path reaches PowerShell through the environment, never inside a quoted
    // command, so an apostrophe in the folder name (O'Brien) cannot break a command.
    'set "ALPHACI_INSTALL_FILE=%~f0"',
    "rem Installing needs administrator rights. Relaunch this same file elevated.",
    "net session >nul 2>&1",
    "if errorlevel 1 (",
    `  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:ALPHACI_INSTALL_FILE -Verb RunAs"`,
    "  exit /b",
    ")",
    // The code is written without a line break, so the file holds exactly the code.
    'set "ALPHACI_ENROLL_CODE_PATH=%TEMP%\\alphaci-enroll-%RANDOM%%RANDOM%.txt"',
    `<nul set /p "=${code}">"%ALPHACI_ENROLL_CODE_PATH%"`,
    // The PowerShell steps below the label are read from this file, so the code
    // and the URLs never appear on a command line.
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:ALPHACI_INSTALL_FILE); & ([scriptblock]::Create($t.Substring($t.LastIndexOf(':__POWERSHELL__')+15)))"`,
    'set "ALPHACI_RESULT=%ERRORLEVEL%"',
    'del /q "%ALPHACI_ENROLL_CODE_PATH%" 2>nul',
    "echo.",
    "pause",
    "exit /b %ALPHACI_RESULT%",
    ":__POWERSHELL__",
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "$enrollCodeFile = $env:ALPHACI_ENROLL_CODE_PATH",
    "$archive = Join-Path $env:TEMP ('alphaci-agent-' + [guid]::NewGuid() + '.tar.gz')",
    "$directory = Join-Path $env:TEMP ('alphaci-agent-' + [guid]::NewGuid())",
    "try {",
    `  Invoke-WebRequest -Uri ${psQuote(url)} -OutFile $archive`,
    `  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne ${psQuote(sha256)}) { throw 'Installer checksum mismatch. Nothing was executed.' }`,
    "  New-Item -ItemType Directory -Path $directory | Out-Null",
    "  tar -xzf $archive -C $directory",
    "  if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed.' }",
    "  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force",
    `  & (Join-Path $directory 'windows/Install-AlphaCIHost.ps1') -Distro Ubuntu -ClientSubnets LocalSubnet -ApiUrl ${psQuote(apiUrl)}${replace ? " -ReplaceCredential" : ""} -OnlyWhenSignedIn -EnrollCodeFile $enrollCodeFile`,
    "} finally {",
    "  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue",
    "  Remove-Item -LiteralPath $directory -Recurse -Force -ErrorAction SilentlyContinue",
    "}",
    "",
  ].join("\r\n");
}
