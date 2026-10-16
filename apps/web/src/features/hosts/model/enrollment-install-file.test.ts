/** @jest-environment node */
import { execFileSync } from "node:child_process";
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
import { enrollmentInstallFile } from "./enrollment-install-file";
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
    version: "0.1.0",
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

function archiveSha256(paths: ReturnType<typeof fixture>) {
  return createHash("sha256")
    .update(readFileSync(paths.archive))
    .digest("hex");
}

/** Runs the generated .sh under bash with the stubs first on PATH. */
function runUbuntuFile(
  paths: ReturnType<typeof fixture>,
  input: EnrollmentReceipt,
) {
  const script = join(paths.directory, "alphaci-install-office.sh");
  writeFileSync(script, enrollmentInstallFile(input, "ubuntu", "Office").contents);
  execFileSync(
    bash,
    [
      "-c",
      `export PATH='${unix(paths.bin)}':$PATH; bash '${unix(script)}'`,
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

  it("passes the code by file path and never on the sudo command line", () => {
    expect(contents).toContain(
      `sudo env ALPHACI_ENROLL_CODE_FILE="$code_file" bash "$work/agent/install.sh" --enroll 'https://api.example.com'\n`,
    );
    expect(contents.split("\n").filter((line) => line.startsWith("sudo"))).toHaveLength(1);
  });

  it("asks for replacement only for a replacement receipt", () => {
    expect(contents).not.toContain("--replace");
    const replacement = enrollmentInstallFile(
      { ...receipt, replacesMachineId: "machine" },
      "ubuntu",
      "Office",
    ).contents;
    expect(replacement).toMatch(
      /install\.sh" --enroll 'https:\/\/api\.example\.com' --replace\n$/,
    );
  });

  it("gates execution on the checksum and gives the installer a private code file", () => {
    const paths = fixture();
    const wrong = withSha("a".repeat(64));
    expect(() => runUbuntuFile(paths, wrong)).toThrow();
    expect(existsSync(paths.marker)).toBe(false);
    expect(existsSync(paths.sudoArgs)).toBe(false);
    expect(readdirSync(paths.scratch)).toEqual([]);

    runUbuntuFile(
      paths,
      withSha(archiveSha256(paths)),
    );
    expect(existsSync(paths.marker)).toBe(true);

    const sudoArgs = readFileSync(paths.sudoArgs, "utf8").split("\n");
    const envArg = sudoArgs.find((arg) =>
      arg.startsWith("ALPHACI_ENROLL_CODE_FILE="),
    );
    expect(sudoArgs.slice(0, 2)).toEqual([
      "env",
      envArg,
    ]);
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

  it("uses CRLF line endings throughout", () => {
    expect(contents.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("writes the code from one set /p line and nowhere else", () => {
    const lines = contents.split("\r\n").filter((line) => line.includes(code));
    expect(lines).toEqual([`<nul set /p "=${code}">"%ALPHACI_ENROLL_CODE_PATH%"`]);
  });

  it("finds its PowerShell steps by the label, not by the text in the batch line", () => {
    const label = "\r\n:__POWERSHELL__\r\n";
    expect(contents.split(label)).toHaveLength(2);
    expect(contents.lastIndexOf(":__POWERSHELL__")).toBe(
      contents.indexOf(label) + 2,
    );
    expect(contents.indexOf("exit /b %ALPHACI_RESULT%")).toBeLessThan(
      contents.indexOf(label),
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
const codePath = process.env.ALPHACI_ENROLL_CODE_PATH;
const present = codePath !== undefined && fs.existsSync(codePath);
fs.writeFileSync(
  process.env.TEST_LOG,
  JSON.stringify({
    argv: process.argv.slice(2),
    codeFile: present ? fs.readFileSync(codePath, "utf8") : null,
  }),
);
`;

/**
 * Runs the batch for real under cmd.exe. Its bare `net` and `powershell` calls
 * are rerouted to stub .cmd files through `call`: a .cmd started without `call`
 * never returns to the batch, so a stub would end the run at its first call.
 * Nothing real is elevated or started; the stub records what it was given.
 */
function runBatch(paths: ReturnType<typeof fixture>, netExitCode: number) {
  const stub = join(paths.directory, "powershell-stub.js");
  writeFileSync(stub, batchStub);
  const net = join(paths.bin, "net.cmd");
  const powershell = join(paths.bin, "powershell.cmd");
  writeFileSync(net, `@exit /b ${netExitCode}\r\n`);
  writeFileSync(powershell, `@"${process.execPath}" "${stub}" %*\r\n`);
  const text = enrollmentInstallFile(receipt, "windows", "Office")
    .contents.replace(
      "net session >nul 2>&1",
      `call "${net}" session >nul 2>&1`,
    )
    .replace(
      /^( *)powershell /gm,
      (_, indent: string) => `${indent}call "${powershell}" `,
    );
  const batch = join(paths.directory, "alphaci-install-office.cmd");
  writeFileSync(batch, text);
  return execFileSync("cmd.exe", ["/d", "/c", batch], {
    env: childEnv({
      TEMP: paths.scratch,
      TMP: paths.scratch,
      TEST_LOG: paths.log,
    }),
    input: "\r\n",
  });
}

/** Process env with the given names replaced; Windows names are case-insensitive. */
function childEnv(overrides: Record<string, string>) {
  const names = Object.keys(overrides).map((name) => name.toUpperCase());
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !names.includes(key.toUpperCase()),
      ),
    ),
    ...overrides,
  };
}

const itOnWindows = onWindows ? it : it.skip;

itOnWindows("writes the code file for the PowerShell step and removes it afterwards", () => {
  const paths = fixture();
  runBatch(paths, 0);
  const seen = JSON.parse(readFileSync(paths.log, "utf8")) as {
    argv: string[];
    codeFile: string | null;
  };
  expect(seen.codeFile).toBe(code);
  expect(seen.argv.join("\n")).not.toContain(code);
  expect(seen.argv.some((arg) => arg.includes("ReadAllText"))).toBe(true);
  expect(readdirSync(paths.scratch)).toEqual([]);
});

itOnWindows("relaunches elevated without writing the code when not an administrator", () => {
  const paths = fixture();
  runBatch(paths, 1);
  const seen = JSON.parse(readFileSync(paths.log, "utf8")) as {
    argv: string[];
    codeFile: string | null;
  };
  expect(seen.argv.join(" ")).toContain("-Verb RunAs");
  expect(seen.codeFile).toBeNull();
  expect(readdirSync(paths.scratch)).toEqual([]);
});
