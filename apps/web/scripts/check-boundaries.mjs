#!/usr/bin/env node
/**
 * FE boundary check for Next.js feature progressive MVVM.
 *
 *   node check-boundaries.mjs [--cwd <app>] [--src src|auto|.] [--strict-warn]
 *     [--paths features/orders/create,src/app/orders]
 *     [--since origin/main]
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pathsMod = await import(
  pathToFileURL(join(skillRoot, "scripts", "lib", "paths.mjs")).href
);
const {
  resolveSrc,
  rootForSrc,
  rel,
  walkFiles,
  walkDirs,
  stripNoise,
  importSpecs,
  filterByPaths,
  listChangedRelPaths,
  filterByChanged,
} = pathsMod;

function parseArgs(argv) {
  let cwd = process.cwd();
  let src = "src";
  let strictWarn = false;
  let paths = [];
  let since = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--cwd" && argv[i + 1]) cwd = resolve(argv[++i]);
    else if (argv[i] === "--src" && argv[i + 1]) src = argv[++i];
    else if (argv[i] === "--strict-warn") strictWarn = true;
    else if (argv[i] === "--paths" && argv[i + 1]) {
      paths = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (argv[i] === "--since" && argv[i + 1]) since = argv[++i];
    else if (argv[i] === "-h" || argv[i] === "--help") {
      console.log(`Usage: node check-boundaries.mjs [--cwd <app>] [--src src|auto|.]
  [--paths a,b] [--since <git-ref>] [--strict-warn]

Violations: rule:<id>  path: message
`);
      process.exit(0);
    }
  }
  return { cwd, src, strictWarn, paths, since };
}

function push(list, rule, fileRel, message) {
  list.push(`rule:${rule}  ${fileRel}: ${message}`);
}

const { cwd, src: srcArg, strictWarn, paths, since } = parseArgs(process.argv.slice(2));
const src = resolveSrc(cwd, srcArg);
const root = rootForSrc(cwd, src);
let files = walkFiles(root);
if (paths.length) files = filterByPaths(files, cwd, paths);
if (since) {
  const changed = listChangedRelPaths(cwd, since);
  if (changed && changed.length) {
    files = filterByChanged(files, cwd, changed);
    console.error(`since ${since}: scoping to ${files.length} file(s)`);
  } else {
    console.error(`since ${since}: no git changes detected; checking full tree under src=${src}`);
  }
}

const violations = [];
const warnings = [];
const ioImportRe = /\b(expo-secure-store|Server Action)\b/i;
const fetchRe = /\bfetch\s*\(|\baxios\b/;
const legacyRootRe =
  /(?:^|\/)src\/(?:components|hooks)(?:\/|$)|(?:^|\/)src\/lib\/(?:api|auth|hosting|onboarding)(?:\/|$)/;

for (const dir of walkDirs(root)) {
  const fileRel = rel(cwd, dir);
  if (!/features\/[^/]+\/[^/]+\/views\/steps$/.test(fileRel)) continue;
  if (paths.length && !filterByPaths([dir], cwd, paths).length) continue;
  const names = existsSync(dir) ? readdirSync(dir) : [];
  const codeFiles = names.filter((n) => /\.(tsx|jsx|ts|js)$/.test(n));
  if (codeFiles.length === 0) {
    push(violations, "no-empty-steps", fileRel, "steps/ has no step modules");
  }
}

for (const dir of walkDirs(root)) {
  const fileRel = rel(cwd, dir);
  if (!/features\/[^/]+\/[^/]+\/use-cases$/.test(fileRel)) continue;
  if (paths.length && !filterByPaths([dir], cwd, paths).length) continue;
  const names = existsSync(dir) ? readdirSync(dir) : [];
  const codeFiles = names.filter((n) => /\.(tsx|jsx|ts|js)$/.test(n));
  if (codeFiles.length === 0) {
    push(violations, "no-empty-use-cases", fileRel, "use-cases/ is empty — omit until Level 2");
  }
}

for (const file of files) {
  if (file.endsWith(".gitkeep")) continue;
  const text = readFileSync(file, "utf8");
  const code = stripNoise(text);
  const fileRel = rel(cwd, file);
  const specs = importSpecs(text);

  if (legacyRootRe.test(fileRel)) {
    push(
      violations,
      "no-legacy-source-roots",
      fileRel,
      "legacy components/hooks/domain-lib source must be owned by a feature or shared layer",
    );
  }

  const inViews = /features\/[^/]+\/[^/]+\/views\//.test(fileRel);
  const inSharedUi = /shared\/ui\//.test(fileRel) || /components\/ui\//.test(fileRel);
  const inModel = /features\/[^/]+\/[^/]+\/model\//.test(fileRel) || /features\/[^/]+\/model\//.test(fileRel);
  const inVm = /features\/[^/]+\/[^/]+\/view-models\//.test(fileRel);
  const inData = /features\/[^/]+\/[^/]+\/data\//.test(fileRel) || /features\/[^/]+\/data\//.test(fileRel);
  const inAppPage =
    /(^|\/)app\/.*page\.(t|j)sx$/.test(fileRel) || /app\/.*\/page\.(t|j)sx$/.test(fileRel);

  if (inModel) {
    for (const spec of specs) {
      if (spec === "react" || spec.startsWith("react/") || spec === "next" || spec.startsWith("next/")) {
        push(violations, "no-react-in-model", fileRel, "model must not import react/next");
      }
    }
    if (/^["']use client["']\s*;?/m.test(text.trimStart())) {
      push(violations, "no-use-client-in-model", fileRel, "model must not be a client module");
    }
  }

  if (inVm) {
    if (/<\/[A-Za-z]/.test(text) && /<[A-Za-z]/.test(text)) {
      push(violations, "no-jsx-in-vm", fileRel, "view-model must not contain JSX");
    }
    if (fetchRe.test(code)) {
      push(violations, "io-in-data", fileRel, "I/O belongs in data/");
    }
  }

  if (inViews) {
    if (fetchRe.test(code)) {
      push(violations, "no-http-in-views", fileRel, "views must not fetch");
    }
    if (/\buse(Query|Mutation|InfiniteQuery|SWR)\b/.test(text)) {
      push(violations, "no-http-in-views", fileRel, "useQuery belongs in view-models");
    }
    for (const spec of specs) {
      if (/lib\/api|\/services\/|\/data\//.test(spec)) {
        push(violations, "no-http-in-views", fileRel, "views must not import API/data");
      }
    }
  }

  if (inAppPage) {
    if (fetchRe.test(code)) {
      push(violations, "thin-page", fileRel, "page must not fetch — compose feature view");
    }
    for (const spec of specs) {
      if (/lib\/api|\/services\/|@\/services/.test(spec)) {
        push(violations, "thin-page", fileRel, "page must not import API clients — compose feature view");
      }
      if (/features\/[^/]+\/[^/]+\/(data|use-cases|view-models|model)(\/|$)/.test(spec)) {
        push(violations, "thin-page", fileRel, `page must not deep-import (${spec})`);
        push(violations, "barrel-only", fileRel, `import feature barrel only`);
      }
    }
    if (/useEffect\s*\(/.test(text) && /fetch|lib\/api|setItems|setData/.test(text)) {
      push(violations, "thin-page", fileRel, "page client data-fetch pattern — use feature VM");
    }
  }

  const featureFrom = fileRel.match(/features\/([^/]+)\/([^/]+)\//);
  for (const spec of specs) {
    const target = spec.match(
      /features\/([^/]+)\/([^/]+)\/(model|views|view-models|data|use-cases)\//,
    );
    if (!target) continue;
    const [, tDomain, tAction] = target;
    // allow same-domain model/data shared folders: features/orders/model
    if (featureFrom) {
      const [, fDomain, fAction] = featureFrom;
      if (fDomain === tDomain && (tAction === "model" || tAction === "data")) continue;
      if (fDomain !== tDomain || fAction !== tAction) {
        if (!(fDomain === tDomain && (fAction === "model" || fAction === "data"))) {
          push(
            violations,
            "no-cross-feature-deep",
            fileRel,
            `deep import across features: ${spec}`,
          );
        }
      }
    }
  }

  // domain-level model/data are OK to import from same domain actions
  for (const spec of specs) {
    const cross = spec.match(/features\/([^/]+)\/([^/]+)\/(views|view-models)\//);
    if (!cross || !featureFrom) continue;
    const [, tDomain, tAction] = cross;
    const [, fDomain, fAction] = featureFrom;
    if (fDomain !== tDomain || fAction !== tAction) {
      push(violations, "no-cross-feature-deep", fileRel, `deep import across features: ${spec}`);
    }
  }

  if (inSharedUi && specs.some((s) => s.includes("features/"))) {
    push(violations, "shared-ui-domain-free", fileRel, "shared/ui must not import features");
  }

  if (inVm && /export\s+function\s+use\w+ViewModel/.test(text) && !/\bstatus\b/.test(text)) {
    push(warnings, "one-vm-status", fileRel, "interactive VM should expose status");
  }
}

for (const v of violations) console.error(v);
for (const w of warnings) console.warn(`warn  ${w}`);

const fail = violations.length > 0 || (strictWarn && warnings.length > 0);
console.error(
  fail
    ? `check-boundaries: ${violations.length} violation(s), ${warnings.length} warning(s) (src=${src})`
    : `check-boundaries: ok (${warnings.length} warning(s), src=${src})`,
);
process.exit(fail ? 1 : 0);
