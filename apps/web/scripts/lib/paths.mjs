/**
 * Path helpers for next-feature-architecture (vendored in this skill).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export function resolveSrc(cwd, src) {
  if (src !== "auto") return src;
  if (existsSync(join(cwd, "src", "app")) || existsSync(join(cwd, "src", "features")))
    return "src";
  if (existsSync(join(cwd, "app")) || existsSync(join(cwd, "features"))) return ".";
  return "src";
}

export function rootForSrc(cwd, src) {
  return src === "." ? cwd : join(cwd, src);
}

export function rel(cwd, p) {
  return relative(cwd, p).replace(/\\/g, "/");
}

export function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  const skipNames = new Set([
    "node_modules",
    ".next",
    ".expo",
    "dist",
    "ios",
    "android",
    ".git",
  ]);
  for (const name of readdirSync(dir)) {
    if (skipNames.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) || name === ".gitkeep") out.push(p);
  }
  return out;
}

export function walkDirs(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".expo" || name === "dist")
      continue;
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory()) {
        out.push(p);
        walkDirs(p, out);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function stripNoise(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

const importRe =
  /from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

export function importSpecs(src) {
  const specs = [];
  const re = new RegExp(importRe.source, "g");
  let m;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1] || m[2];
    if (spec) specs.push(spec);
  }
  return specs;
}

/** Normalize --paths prefixes to filter file list (posix rel paths). */
export function filterByPaths(files, cwd, pathPrefixes) {
  if (!pathPrefixes || pathPrefixes.length === 0) return files;
  const norms = pathPrefixes.map((p) =>
    p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, ""),
  );
  return files.filter((f) => {
    const r = rel(cwd, f);
    return norms.some((n) => r === n || r.startsWith(n + "/") || r.includes("/" + n + "/"));
  });
}

export function listChangedRelPaths(cwd, gitRef) {
  const r = spawnSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", gitRef, "--"],
    { cwd, encoding: "utf8" },
  );
  if (r.status !== 0) return null;
  return (r.stdout || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\\/g, "/"));
}

export function filterByChanged(files, cwd, changedRelPaths) {
  if (!changedRelPaths || changedRelPaths.length === 0) return files;
  const set = new Set(changedRelPaths);
  const slicePrefixes = [];
  for (const c of changedRelPaths) {
    const m = c.match(/^(.*features\/[^/]+\/[^/]+)/);
    if (m) slicePrefixes.push(m[1]);
    const d = c.match(/^(.*features\/[^/]+\/(?:model|data))/);
    if (d) slicePrefixes.push(d[1]);
  }
  return files.filter((f) => {
    const r = rel(cwd, f);
    if (set.has(r)) return true;
    return slicePrefixes.some((p) => r === p || r.startsWith(p + "/"));
  });
}

export function readJsonSafe(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
