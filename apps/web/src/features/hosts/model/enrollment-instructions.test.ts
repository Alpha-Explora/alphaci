/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enrollmentInstructions } from "./enrollment-instructions";

const bash =
  process.platform === "win32"
    ? "C:\\Program Files\\Git\\bin\\bash.exe"
    : "bash";
const unix = (path: string) =>
  path
    .replaceAll("\\", "/")
    .replace(/^([A-Z]):/i, (_, drive: string) => "/" + drive.toLowerCase());
it("checks the downloaded bytes before either extracting or executing the installer", () => {
  const directory = mkdtempSync(join(tmpdir(), "alphaci-checksum-"));
  const bin = join(directory, "bin"),
    payload = join(directory, "payload");
  mkdirSync(bin);
  mkdirSync(payload);
  mkdirSync(join(payload, "agent"));
  writeFileSync(join(payload, "agent/install.sh"), 'touch "$TEST_MARKER"\n');
  writeFileSync(
    join(bin, "curl"),
    '#!/bin/bash\ncp "$TEST_ARCHIVE" "${!#}"\n',
    { mode: 0o755 },
  );
  writeFileSync(join(bin, "sudo"), '#!/bin/bash\nexec "$@"\n', { mode: 0o755 });
  const archive = join(directory, "fixture.tar.gz"),
    marker = join(directory, "executed");
  execFileSync(
    bash,
    ["-c", 'tar -czf "$TEST_ARCHIVE" -C "$TEST_PAYLOAD" agent'],
    {
      env: {
        ...process.env,
        TEST_ARCHIVE: unix(archive),
        TEST_PAYLOAD: unix(payload),
      },
    },
  );
  const receipt = {
    id: "e",
    code: "do-not-put-this-in-a-command",
    expiresAt: "later",
    apiUrl: "https://api.example.com",
    installer: {
      version: "0.1.0",
      url: "https://download.example.com/agent.tar.gz",
      sha256: "a".repeat(64),
    },
  };
  const run = (sha256: string) =>
    execFileSync(
      bash,
      [
        "-c",
        `export PATH='${unix(bin)}':$PATH; ${enrollmentInstructions({ ...receipt, installer: { ...receipt.installer, sha256 } }).ubuntu}`,
      ],
      {
        env: {
          ...process.env,
          TEST_ARCHIVE: unix(archive),
          TEST_MARKER: unix(marker),
        },
      },
    );
  expect(() => run("a".repeat(64))).toThrow();
  expect(existsSync(marker)).toBe(false);
  run(createHash("sha256").update(readFileSync(archive)).digest("hex"));
  expect(existsSync(marker)).toBe(true);
  expect(enrollmentInstructions(receipt).ubuntu).not.toContain(receipt.code);
  expect(enrollmentInstructions(receipt).windows).not.toContain(receipt.code);
});
it("runs the Windows installer in-process so -Ports binds as an int array", () => {
  const { windows } = enrollmentInstructions({
    apiUrl: "https://api.example.com",
    id: "e",
    code: "c",
    expiresAt: "2026-10-15T00:00:00Z",
    installer: { version: "0.1.0", url: "https://x/i", sha256: "a".repeat(64) },
  });
  expect(windows).toContain(
    "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force",
  );
  expect(windows).toContain(
    "& (Join-Path $directory 'windows/Install-AlphaCIHost.ps1')",
  );
  expect(windows).not.toContain("powershell.exe");
});
