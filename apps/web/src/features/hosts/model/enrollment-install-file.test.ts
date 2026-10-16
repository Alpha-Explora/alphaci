/** @jest-environment node */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  enrollmentInstallFile,
  installFileSupported,
} from "./enrollment-install-file";
import type { EnrollmentReceipt } from "./host-types";

const bash =
  process.platform === "win32"
    ? "C:\\Program Files\\Git\\bin\\bash.exe"
    : "bash";
const onWindows = process.platform === "win32";
const unix = (path: string) =>
  path
    .replaceAll("\\", "/")
    .replace(/^([A-Z]):/i, (_, drive: string) => "/" + drive.toLowerCase());

// Shaped like a server-issued code: 43 base64url characters.
const code = "Qz9_-".repeat(8) + "Qz9";
const receipt: EnrollmentReceipt = {
  apiUrl: "https://api.example.com",
  id: "e",
  code,
  expiresAt: "later",
  installer: {
    version: "0.2.0",
    url: "https://download.example.com/agent.tar.gz",
    sha256: "a".repeat(64),
  },
};

/** A scratch tree: stub PATH commands, a payload archive, and a private TMPDIR. */
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "alphaci-install-file-"));
  const paths = {
    directory,
    bin: join(directory, "bin"),
    payload: join(directory, "payload"),
    scratch: join(directory, "scratch"),
    archive: join(directory, "fixture.tar.gz"),
    windowsArchive: join(directory, "windows.tar.gz"),
    script: join(directory, "alphaci-install-office.sh"),
    log: join(directory, "installer.log"),
    codeCopy: join(directory, "code-copy"),
    marker: join(directory, "installer-ran"),
    sudoArgs: join(directory, "sudo-args"),
  };
  for (const dir of [paths.bin, join(paths.payload, "agent"), paths.scratch])
    mkdirSync(dir, { recursive: true });
  // Stands in for agent/install.sh: it reads the code file the way enroll.sh
  // does, then deletes it, and records what it received.
  writeFileSync(
    join(paths.payload, "agent/install.sh"),
    String.raw`#!/bin/bash
{
  printf 'mode=%s\n' "$(stat -c %a "$ALPHACI_ENROLL_CODE_FILE")"
  cp "$ALPHACI_ENROLL_CODE_FILE" "$TEST_CODE_COPY"
  printf 'args=%s\n' "$*"
} > "$TEST_LOG"
rm -- "$ALPHACI_ENROLL_CODE_FILE"
touch "$TEST_MARKER"
`,
  );
  // Records its argv (what sudo would show in the process table), then runs it.
  writeFileSync(
    join(paths.bin, "sudo"),
    String.raw`#!/bin/bash
printf '%s\n' "$@" > "$TEST_SUDO_ARGS"
exec "$@"
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(paths.bin, "curl"),
    '#!/bin/bash\ncp "$TEST_ARCHIVE" "${!#}"\n',
    { mode: 0o755 },
  );
  execFileSync(
    bash,
    ["-c", 'tar -czf "$TEST_ARCHIVE" -C "$TEST_PAYLOAD" agent'],
    {
      env: {
        ...process.env,
        TEST_ARCHIVE: unix(paths.archive),
        TEST_PAYLOAD: unix(paths.payload),
      },
    },
  );
  return paths;
}

type Fixture = ReturnType<typeof fixture>;

function archiveSha256(paths: Fixture) {
  return createHash("sha256")
    .update(readFileSync(paths.archive))
    .digest("hex");
}

/** Runs the generated .sh under bash with the stubs first on PATH. */
function runUbuntuFile(paths: Fixture, input: EnrollmentReceipt) {
  writeFileSync(
    paths.script,
    enrollmentInstallFile(input, "ubuntu", "Office").contents,
  );
  execFileSync(
    bash,
    [
      "-c",
      `export PATH='${unix(paths.bin)}':$PATH; bash '${unix(paths.script)}'`,
    ],
    {
      env: {
        ...process.env,
        TMPDIR: unix(paths.scratch),
        TEST_ARCHIVE: unix(paths.archive),
        TEST_LOG: unix(paths.log),
        TEST_CODE_COPY: unix(paths.codeCopy),
        TEST_MARKER: unix(paths.marker),
        TEST_SUDO_ARGS: unix(paths.sudoArgs),
      },
    },
  );
}

const withSha = (sha256: string): EnrollmentReceipt => ({
  ...receipt,
  installer: { ...receipt.installer, sha256 },
});

it("refuses malformed checksums and enrollment codes before building anything", () => {
  expect(() =>
    enrollmentInstallFile(withSha("A".repeat(64)), "ubuntu", "box"),
  ).toThrow("Invalid installer checksum.");
  expect(() =>
    enrollmentInstallFile(withSha("a".repeat(63)), "windows", "box"),
  ).toThrow("Invalid installer checksum.");
  for (const bad of [
    code.slice(1),
    `${code}x`,
    `${code.slice(1)}%`,
    `${code.slice(1)}'`,
    `${code.slice(1)}\n`,
  ])
    expect(() =>
      enrollmentInstallFile({ ...receipt, code: bad }, "ubuntu", "box"),
    ).toThrow("Invalid enrollment code.");
});

it("offers install files only from installer 0.2.0, comparing version parts as numbers", () => {
  expect(installFileSupported("0.2.0")).toBe(true);
  expect(installFileSupported("0.2")).toBe(true);
  expect(installFileSupported("0.10.0")).toBe(true);
  expect(installFileSupported("1.0.0")).toBe(true);
  expect(installFileSupported("0.1.9")).toBe(false);
  expect(installFileSupported("0.1.10")).toBe(false);
  expect(installFileSupported("0.1.0")).toBe(false);
  // Not plain dotted digits: treated as too old rather than guessed at.
  expect(installFileSupported("0.2.0-rc1")).toBe(false);
  expect(installFileSupported("v0.2.0")).toBe(false);
  expect(installFileSupported("")).toBe(false);
});

it("refuses to build a file for an installer that predates install files", () => {
  expect(() =>
    enrollmentInstallFile(
      { ...receipt, installer: { ...receipt.installer, version: "0.1.0" } },
      "ubuntu",
      "box",
    ),
  ).toThrow("This installer version has no install file.");
});

it("uses the machine name only for a sanitized file name", () => {
  const ubuntu = enrollmentInstallFile(receipt, "ubuntu", "Office Server #1!");
  expect(ubuntu.filename).toBe("alphaci-install-office-server-1.sh");
  expect(enrollmentInstallFile(receipt, "windows", "Office Server #1!").filename).toBe(
    "alphaci-install-office-server-1.cmd",
  );
  expect(enrollmentInstallFile(receipt, "ubuntu", "!!!").filename).toBe(
    "alphaci-install-alphaci.sh",
  );
  for (const platform of ["ubuntu", "windows"] as const)
    expect(
      enrollmentInstallFile(receipt, platform, "Zebra Xylophone").contents,
    ).not.toMatch(/zebra|xylophone/i);
});

describe("Ubuntu install file", () => {
  const { contents } = enrollmentInstallFile(receipt, "ubuntu", "Office");

  it("uses LF line endings and checks the archive before extracting it", () => {
    expect(contents).not.toContain("\r");
    const check = contents.indexOf("sha256sum --check");
    expect(check).toBeGreaterThan(contents.indexOf("curl --fail"));
    expect(check).toBeLessThan(contents.indexOf("tar -xzf"));
    expect(check).toBeLessThan(contents.indexOf("sudo env"));
  });

  it("writes the code once, inside a quoted heredoc, with a private umask", () => {
    expect(contents.split(code)).toHaveLength(2);
    expect(contents).toContain(`cat > "$code_file" <<'CODE'\n${code}\nCODE\n`);
    expect(contents.indexOf("umask 077")).toBeLessThan(
      contents.indexOf("cat > \"$code_file\""),
    );
  });

  it("passes the code by file path, never on the sudo command line, and deletes itself after success", () => {
    expect(contents).toContain(
      `sudo env ALPHACI_ENROLL_CODE_FILE="$code_file" bash "$work/agent/install.sh" --enroll 'https://api.example.com'\n`,
    );
    expect(contents.split("\n").filter((line) => line.startsWith("sudo"))).toHaveLength(1);
    // The self-delete is the last command, after the sudo line.
    expect(contents.indexOf('rm -f -- "$0"')).toBeGreaterThan(
      contents.indexOf("sudo env"),
    );
    expect(contents.trimEnd().endsWith('rm -f -- "$0"')).toBe(true);
  });

  it("asks for replacement only for a replacement receipt", () => {
    expect(contents).not.toContain("--replace");
    const replacement = enrollmentInstallFile(
      { ...receipt, replacesMachineId: "machine" },
      "ubuntu",
      "Office",
    ).contents;
    expect(replacement).toMatch(
      /install\.sh" --enroll 'https:\/\/api\.example\.com' --replace\n/,
    );
  });

  it("gates execution on the checksum and gives the installer a private code file", () => {
    const paths = fixture();
    const wrong = withSha("a".repeat(64));
    expect(() => runUbuntuFile(paths, wrong)).toThrow();
    expect(existsSync(paths.marker)).toBe(false);
    expect(existsSync(paths.sudoArgs)).toBe(false);
    expect(readdirSync(paths.scratch)).toEqual([]);
    // A failed run keeps the file, so it can be run again.
    expect(existsSync(paths.script)).toBe(true);

    runUbuntuFile(paths, withSha(archiveSha256(paths)));
    expect(existsSync(paths.marker)).toBe(true);
    // A successful run removes the file itself.
    expect(existsSync(paths.script)).toBe(false);

    const sudoArgs = readFileSync(paths.sudoArgs, "utf8").split("\n");
    const envArg = sudoArgs.find((arg) =>
      arg.startsWith("ALPHACI_ENROLL_CODE_FILE="),
    );
    expect(sudoArgs.slice(0, 2)).toEqual(["env", envArg]);
    expect(sudoArgs.join("\n")).not.toContain(code);
    expect(envArg).toMatch(/\/enrollment-code$/);

    const seen = readFileSync(paths.log, "utf8");
    if (!onWindows) expect(seen).toContain("mode=600");
    expect(readFileSync(paths.codeCopy, "utf8")).toBe(`${code}\n`);
    expect(seen).toContain("args=--enroll https://api.example.com\n");
    expect(seen).not.toContain("--replace");
    expect(readdirSync(paths.scratch)).toEqual([]);
  });
});

describe("Windows install file", () => {
  const { contents } = enrollmentInstallFile(receipt, "windows", "Office");
  const label = "\r\n:__POWERSHELL__\r\n";

  it("uses CRLF line endings throughout", () => {
    expect(contents.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("writes the code once, as the first line of the PowerShell block, and nowhere in the batch part", () => {
    expect(contents.split(code)).toHaveLength(2);
    expect(contents).toContain(`${label}$enrollCode = '${code}'\r\n`);
    expect(contents).not.toContain("ALPHACI_ENROLL_CODE_PATH");
    expect(contents).not.toContain("set /p");
  });

  it("hands the install file path to PowerShell through the environment, never inside quotes", () => {
    const set = contents.indexOf('set "ALPHACI_INSTALL_FILE=%~f0"');
    expect(set).toBeGreaterThan(-1);
    expect(set).toBeLessThan(contents.indexOf("fltmc"));
    // The path appears only in the set line and the self-delete line, never in a
    // PowerShell command.
    expect(contents).not.toMatch(/powershell[^\r\n]*%~f0/);
    expect(contents).not.toContain("'%~f0'");
    expect(contents).toContain(
      'Command "Start-Process -FilePath $env:ALPHACI_INSTALL_FILE -ArgumentList \'--elevated\' -Verb RunAs"',
    );
    expect(contents).toContain("ReadAllText($env:ALPHACI_INSTALL_FILE)");
  });

  it("checks for administrator rights with fltmc and relaunches once with a marker, never with net session", () => {
    expect(contents).toContain("fltmc >nul 2>&1");
    expect(contents).not.toContain("net session");
    const check = contents.indexOf('if "%~1"=="--elevated" goto :no_admin');
    const relaunch = contents.indexOf("-ArgumentList '--elevated' -Verb RunAs");
    const noAdmin = contents.indexOf("\r\n:no_admin\r\n");
    expect(check).toBeGreaterThan(contents.indexOf("fltmc >nul 2>&1"));
    // A relaunched copy that still lacks rights jumps to :no_admin and stops with
    // an error, instead of relaunching again.
    expect(check).toBeLessThan(relaunch);
    expect(relaunch).toBeLessThan(noAdmin);
    expect(contents.indexOf("exit /b 1", noAdmin)).toBeGreaterThan(noAdmin);
    expect(contents.slice(noAdmin, contents.indexOf("\r\n:run\r\n"))).toContain("pause");
  });

  it("locks the code file to the current user's SID before the download, and deletes it in finally", () => {
    expect(contents).toContain(
      "$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    );
    expect(contents).toContain(
      'icacls $enrollCodeFile /inheritance:r /grant:r "*${sid}:(R,WA,D)" | Out-Null',
    );
    expect(contents).toContain(
      "if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the enrollment code file.' }",
    );
    expect(contents).not.toMatch(/Everyone|BUILTIN\\Users|\*S-1-1-0/);
    const acl = contents.indexOf("icacls $enrollCodeFile");
    expect(contents.indexOf("[IO.File]::WriteAllText($enrollCodeFile")).toBeLessThan(acl);
    expect(acl).toBeLessThan(contents.indexOf("Invoke-WebRequest"));
    expect(contents.indexOf("} finally {")).toBeLessThan(
      contents.indexOf("Remove-Item -LiteralPath $enrollCodeFile"),
    );
  });

  it("deletes the install file itself only after a successful run", () => {
    const stop = contents.indexOf(
      'if not "%ALPHACI_RESULT%"=="0" exit /b %ALPHACI_RESULT%',
    );
    const selfDelete = contents.indexOf('(goto) 2>nul & del "%~f0"');
    expect(stop).toBeGreaterThan(-1);
    expect(stop).toBeLessThan(selfDelete);
    expect(selfDelete).toBeLessThan(contents.lastIndexOf(":__POWERSHELL__"));
  });

  it("keeps the install file and asks for a restart when the installer exits 3010", () => {
    const restart = contents.indexOf(
      'if "%ALPHACI_RESULT%"=="3010" echo Windows needs a restart',
    );
    const stop = contents.indexOf(
      'if not "%ALPHACI_RESULT%"=="0" exit /b %ALPHACI_RESULT%',
    );
    expect(restart).toBeGreaterThan(-1);
    expect(restart).toBeLessThan(stop);
    expect(contents).toContain(
      "Restart this machine, then run this same file again. The file is kept for that.",
    );
  });

  it("propagates the installer's exit code and keeps the code file only for 3010", () => {
    const call = contents.indexOf("-EnrollCodeFile $enrollCodeFile");
    const reset = contents.indexOf("$LASTEXITCODE = 0");
    const result = contents.indexOf("$exitCode = $LASTEXITCODE");
    const keep = contents.indexOf("$keepCodeFile = ($exitCode -eq 3010)");
    const finallyAt = contents.indexOf("} finally {");
    expect(reset).toBeGreaterThan(-1);
    expect(reset).toBeLessThan(call);
    expect(call).toBeLessThan(result);
    expect(result).toBeLessThan(keep);
    expect(keep).toBeLessThan(finallyAt);
    expect(contents).toContain(
      "if (-not $keepCodeFile) { Remove-Item -LiteralPath $enrollCodeFile",
    );
    expect(contents).toContain("\r\nexit $exitCode\r\n");
  });

  it("finds its PowerShell steps by the label, not by the text in the batch line", () => {
    expect(contents.split(label)).toHaveLength(2);
    expect(contents.lastIndexOf(":__POWERSHELL__")).toBe(
      contents.indexOf(label) + 2,
    );
  });

  it("checks the archive before the installer is called, and passes the code file", () => {
    const download = contents.indexOf("Invoke-WebRequest");
    const check = contents.indexOf("Get-FileHash");
    const install = contents.indexOf("Install-AlphaCIHost.ps1");
    expect(download).toBeLessThan(check);
    expect(check).toBeLessThan(install);
    expect(contents).toContain(
      "-ApiUrl 'https://api.example.com' -OnlyWhenSignedIn -EnrollCodeFile $enrollCodeFile",
    );
    expect(contents).not.toContain("-ReplaceCredential");
  });

  it("adds -ReplaceCredential only for a replacement receipt", () => {
    const replacement = enrollmentInstallFile(
      { ...receipt, replacesMachineId: "machine" },
      "windows",
      "Office",
    ).contents;
    expect(replacement).toContain(
      "-ApiUrl 'https://api.example.com' -ReplaceCredential -OnlyWhenSignedIn -EnrollCodeFile $enrollCodeFile",
    );
  });

  it("removes the archive and extracted directory whatever happens", () => {
    expect(contents).toContain("} finally {");
    expect(contents).toContain(
      "Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue",
    );
    expect(contents).toContain(
      "Remove-Item -LiteralPath $directory -Recurse -Force -ErrorAction SilentlyContinue",
    );
  });
});

const batchStub = String.raw`const fs = require("node:fs");
fs.writeFileSync(
  process.env.TEST_LOG,
  JSON.stringify({
    argv: process.argv.slice(2),
    installFile: process.env.ALPHACI_INSTALL_FILE ?? null,
  }),
);
process.exitCode = Number(process.env.TEST_POWERSHELL_EXIT ?? 0);
`;

type BatchRun = { batch: string; status: number | null; output: string };

/**
 * Runs the batch for real under cmd.exe, from a folder whose name has an
 * apostrophe. Its bare `fltmc` and `powershell` calls are rerouted to stub .cmd
 * files through `call`: a .cmd started without `call` never returns to the
 * batch. Nothing real is elevated or started; the stubs record what they got.
 */
function runBatch(
  paths: Fixture,
  options: { fltmc: number; powershell: number; args?: string[] },
): BatchRun {
  const stub = join(paths.directory, "powershell-stub.js");
  writeFileSync(stub, batchStub);
  const fltmc = join(paths.bin, "fltmc.cmd");
  const powershell = join(paths.bin, "powershell.cmd");
  writeFileSync(fltmc, `@exit /b ${options.fltmc}\r\n`);
  writeFileSync(powershell, `@"${process.execPath}" "${stub}" %*\r\n`);
  const text = enrollmentInstallFile(receipt, "windows", "Office")
    .contents.replace(
      "fltmc >nul 2>&1",
      `call "${fltmc}" >nul 2>&1`,
    )
    .replace(
      /^( *)powershell /gm,
      (_, indent: string) => `${indent}call "${powershell}" `,
    );
  const folder = join(paths.directory, "O'Brien");
  mkdirSync(folder);
  const batch = join(folder, "alphaci-install-office.cmd");
  writeFileSync(batch, text);
  const result = spawnSync("cmd.exe", ["/d", "/c", batch, ...(options.args ?? [])], {
    env: childEnv({
      TEMP: paths.scratch,
      TMP: paths.scratch,
      TEST_LOG: paths.log,
      TEST_POWERSHELL_EXIT: String(options.powershell),
    }),
    input: "\r\n",
    encoding: "utf8",
  });
  return {
    batch,
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

/** Process env with the given names replaced; Windows names are case-insensitive. */
function childEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const names = Object.keys(overrides).map((name) => name.toUpperCase());
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env))
    if (names.includes(key.toUpperCase())) delete env[key];
  return { ...env, ...overrides };
}

const readLog = (paths: Fixture) =>
  JSON.parse(readFileSync(paths.log, "utf8")) as {
    argv: string[];
    installFile: string | null;
  };

const itOnWindows = onWindows ? it : it.skip;

itOnWindows("relaunches once with the marker, and the elevated call gets the exact path", () => {
  const paths = fixture();
  const run = runBatch(paths, { fltmc: 1, powershell: 0 });
  expect({ status: run.status, output: run.output }).toMatchObject({
    status: 0,
  });
  expect(run.batch).toContain("O'Brien");
  const seen = readLog(paths);
  expect(seen.argv.join(" ")).toContain(
    "-ArgumentList '--elevated' -Verb RunAs",
  );
  expect(seen.argv.join("\n")).not.toContain(code);
  expect(seen.installFile).toBe(run.batch);
  // The relaunching copy hands off and leaves the file for the elevated copy.
  expect(existsSync(run.batch)).toBe(true);
});

itOnWindows("stops with an error instead of relaunching when the elevated copy still lacks rights", () => {
  const paths = fixture();
  const run = runBatch(paths, { fltmc: 1, powershell: 0, args: ["--elevated"] });
  expect(run.status).toBe(1);
  expect(run.output).toContain("needs administrator rights");
  // No PowerShell call at all: nothing was relaunched and nothing ran.
  expect(existsSync(paths.log)).toBe(false);
  expect(existsSync(run.batch)).toBe(true);
});

itOnWindows("runs the PowerShell step with the exact path, and deletes itself after success", () => {
  const paths = fixture();
  const run = runBatch(paths, { fltmc: 0, powershell: 0 });
  expect({ status: run.status, output: run.output }).toMatchObject({
    status: 0,
  });
  const seen = readLog(paths);
  expect(seen.argv.some((arg) => arg.includes("ReadAllText($env:ALPHACI_INSTALL_FILE)"))).toBe(true);
  expect(seen.argv.join("\n")).not.toContain(code);
  expect(seen.installFile).toBe(run.batch);
  expect(existsSync(run.batch)).toBe(false);
});

itOnWindows("keeps itself after a failed run, so it can be run again", () => {
  const paths = fixture();
  const run = runBatch(paths, { fltmc: 0, powershell: 1 });
  expect(run.status).toBe(1);
  expect(existsSync(run.batch)).toBe(true);
});

itOnWindows("keeps itself and asks for a restart when the installer exits 3010", () => {
  const paths = fixture();
  const run = runBatch(paths, { fltmc: 0, powershell: 3010 });
  expect(run.status).toBe(3010);
  expect(run.output).toContain("needs a restart");
  expect(existsSync(run.batch)).toBe(true);
});

const powershellWrapper = String.raw`function Invoke-WebRequest {
  param([string]$Uri, [string]$OutFile)
  Copy-Item -LiteralPath $env:TEST_ARCHIVE -Destination $OutFile
}
`;

// Stands in for the real installer: it records what it was given and the access
// list of the code file, then deletes the file the way the real one does. With
// TEST_INSTALLER_EXIT set, it exits before reading the file, as a restart check
// does.
const installerStub = String.raw`param([string]$Distro, [string]$ClientSubnets, [string]$ApiUrl, [switch]$ReplaceCredential, [switch]$OnlyWhenSignedIn, [string]$EnrollCodeFile)
if ($env:TEST_INSTALLER_EXIT) { exit [int]$env:TEST_INSTALLER_EXIT }
$entries = @(Get-Acl -LiteralPath $EnrollCodeFile).Access
[pscustomobject]@{
  code = [IO.File]::ReadAllText($EnrollCodeFile)
  apiUrl = $ApiUrl
  distro = $Distro
  replace = [bool]$ReplaceCredential
  onlyWhenSignedIn = [bool]$OnlyWhenSignedIn
  aceCount = $entries.Count
  inherited = [bool]@($entries | Where-Object { $_.IsInherited }).Count
  identity = [string]$entries[0].IdentityReference
  rights = [string]$entries[0].FileSystemRights
  currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
} | ConvertTo-Json | Set-Content -LiteralPath $env:TEST_INSTALLER_LOG -Encoding ascii
Remove-Item -LiteralPath $EnrollCodeFile
`;

/** Writes the stub Windows archive and returns its SHA-256. */
function windowsArchive(paths: Fixture) {
  const payload = join(paths.directory, "windows-payload");
  mkdirSync(join(payload, "windows"), { recursive: true });
  writeFileSync(join(payload, "windows", "Install-AlphaCIHost.ps1"), installerStub);
  // Named explicitly: a Git tar earlier on PATH reads "C:" as a host name.
  const systemTar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  execFileSync(systemTar, ["-czf", paths.windowsArchive, "-C", payload, "windows"]);
  return createHash("sha256").update(readFileSync(paths.windowsArchive)).digest("hex");
}

/** Runs the Windows file's PowerShell block for real, with a stub download. */
function runWindowsBlock(
  paths: Fixture,
  sha256: string,
  options: { installerExit?: number } = {},
) {
  const { contents } = enrollmentInstallFile(
    { ...receipt, installer: { ...receipt.installer, sha256 } },
    "windows",
    "Office",
  );
  const script = join(paths.directory, "run-block.ps1");
  writeFileSync(
    script,
    powershellWrapper +
      contents.slice(
        contents.lastIndexOf(":__POWERSHELL__") + ":__POWERSHELL__".length,
      ),
  );
  return spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
    {
      env: childEnv({
        TEMP: paths.scratch,
        TMP: paths.scratch,
        TEST_ARCHIVE: paths.windowsArchive,
        TEST_INSTALLER_LOG: paths.log,
        ...(options.installerExit === undefined
          ? {}
          : { TEST_INSTALLER_EXIT: String(options.installerExit) }),
      }),
      encoding: "utf8",
    },
  );
}

itOnWindows("runs the PowerShell block: the installer gets the code from a user-only file, and nothing is left behind", () => {
  const paths = fixture();
  const sha256 = windowsArchive(paths);
  const run = runWindowsBlock(paths, sha256);
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  const seen = JSON.parse(readFileSync(paths.log, "utf8")) as Record<string, unknown>;
  expect(seen).toMatchObject({
    code,
    apiUrl: "https://api.example.com",
    distro: "Ubuntu",
    replace: false,
    onlyWhenSignedIn: true,
    aceCount: 1,
    inherited: false,
    identity: seen.currentUser,
  });
  // Delete is granted, and writing the file's data is not (WriteAttributes is).
  expect(String(seen.rights)).toContain("Delete");
  expect(String(seen.rights)).not.toMatch(/WriteData|AppendData|Modify|FullControl/);
  expect(readdirSync(paths.scratch)).toEqual([]);
});

itOnWindows("keeps the code file, and returns 3010, when the installer needs a restart", () => {
  const paths = fixture();
  const sha256 = windowsArchive(paths);
  const run = runWindowsBlock(paths, sha256, { installerExit: 3010 });
  expect(run.status).toBe(3010);
  // Only the code file is left: the archive and the extracted directory are removed.
  const left = readdirSync(paths.scratch);
  expect(left).toHaveLength(1);
  expect(left[0]).toMatch(/^alphaci-enroll-.*\.txt$/);
  expect(readFileSync(join(paths.scratch, left[0]), "utf8")).toBe(code);
});

itOnWindows("removes the code file and passes other installer failures through", () => {
  const paths = fixture();
  const sha256 = windowsArchive(paths);
  const run = runWindowsBlock(paths, sha256, { installerExit: 2 });
  expect(run.status).toBe(2);
  expect(readdirSync(paths.scratch)).toEqual([]);
});

itOnWindows("removes the code file and runs no installer when the archive fails its checksum", () => {
  const paths = fixture();
  windowsArchive(paths);
  const run = runWindowsBlock(paths, "a".repeat(64));
  expect(run.status).not.toBe(0);
  expect(existsSync(paths.log)).toBe(false);
  expect(readdirSync(paths.scratch)).toEqual([]);
});
