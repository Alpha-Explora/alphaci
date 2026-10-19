#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SNAPSHOT = path.join(ROOT, 'docs/capabilities/catalog.snapshot.json');
const {
  loadCatalogPackage,
  packageDriftErrors,
  readSurfaceRegistry,
  resolveProfile,
} = require('./lib/capability-profile.cjs');
const { expectedPackStatus } = require('./check-capabilities.cjs');

const DOMAIN_OWNERS = [
  {
    id: 'admin',
    backendContext: 'identity-access',
    owns: 'platform administration, user review, and feedback',
  },
  {
    id: 'auth',
    backendContext: 'identity-access',
    owns: 'sign-in, callback, and session presentation',
  },
  {
    id: 'capabilities',
    backendContext: 'identity-access',
    owns: 'compatibility capability consumption from /api/v1/capabilities',
  },
  {
    id: 'checklists',
    backendContext: 'projects',
    owns: 'team QA checklists and test suites, the project Checklists tab, QA Studio verification runs and evidence, PO Studio acceptance, iterations, QA reports, and the Overview "Returned by QA" card',
  },
  {
    id: 'groups',
    backendContext: 'identity-access',
    owns: 'hierarchy groups, systems, repositories, members, activity, and delivery projects',
  },
  {
    id: 'guide',
    backendContext: 'platform-ops',
    owns: 'in-product guide',
  },
  {
    id: 'hosts',
    backendContext: 'runtime',
    owns: 'on-prem machine enrollment, inventory, and environment host assignment',
  },
  {
    id: 'home',
    backendContext: 'platform-ops',
    owns: 'authenticated home dashboard',
  },
  {
    id: 'notifications',
    backendContext: 'platform-ops',
    owns: 'inbox, live notifications, and notification preferences',
  },
  {
    id: 'projects',
    backendContext: 'projects',
    owns: 'project detail: code, commits, pull requests, pipeline, environments, hosting, promotion, rollback, drift, previews, and settings',
  },
  {
    id: 'public-site',
    backendContext: 'platform-ops',
    owns: 'SaaS marketing landing at /',
  },
  {
    id: 'runs',
    backendContext: 'pipelines',
    owns: 'CI run history presentation',
  },
  {
    id: 'settings',
    backendContext: 'identity-access',
    owns: 'account, workspace, and notification settings',
  },
  {
    id: 'teams',
    backendContext: 'identity-access',
    owns: 'team pages over hierarchy groups: members, Projects explorer, checklist templates, activity, and team settings',
  },
  {
    id: 'workflows',
    backendContext: 'projects',
    owns: 'Create project wizard and workflow studio',
  },
  {
    id: 'workspace',
    backendContext: 'identity-access',
    owns: 'application shell, navigation, and workspace switching',
  },
];

const PACKS = [
  {
    edition: 'saas',
    profile: 'hosted',
    displayName: 'SaaS',
    file: 'docs/packs/saas/pack.md',
    composition:
      'The same Next.js application exposes the shared capability catalog. Hosted deployment is a deployment-target and configuration concern, not a separate frontend.',
    deployment:
      'SaaS is an edition composition reference. This frontend is one deployable. Provider choice remains a Runtime concern consumed through compatibility flags, not a pack-specific UI tree.',
    entitlements:
      'The narrowing order is `build -> edition manifest -> deployment configuration -> tenant override`. This frontend does not resolve pack entitlements; it renders what `/api/v1/capabilities` returns.',
    nonSupport:
      'Marketing-site behavior is not a frontend capability and is not a registry key. There is no `/subscribe` route. Catalog rows with status `not-implemented` are the current SaaS product gaps.',
  },
  {
    edition: 'edu',
    profile: 'hosted',
    displayName: 'EDU',
    file: 'docs/packs/edu/pack.md',
    composition:
      'The same Next.js application exposes the shared capability catalog. An institution-hosted or shared deployment target remains a separate deployment value.',
    deployment:
      'EDU is an edition composition reference. This frontend is one deployable and does not fork screens by edition.',
    entitlements:
      'The narrowing order is `build -> edition manifest -> deployment configuration -> tenant override`. This frontend does not resolve EDU-specific entitlements at runtime.',
    nonSupport:
      'No additional non-registry product areas. Catalog rows with status `not-implemented` are the current EDU product gaps.',
  },
  {
    edition: 'enterprise',
    profile: 'enterprise',
    displayName: 'Enterprise',
    file: 'docs/packs/enterprise/pack.md',
    composition:
      'The same Next.js application exposes the shared capability catalog under the Enterprise evidence bar. A customer-managed deployment target remains separate from edition identity.',
    deployment:
      'Enterprise is an edition composition reference. `runtime.air-gap-packaging` and `runtime.customer-isolation` are backend catalog keys with no frontend surface in this repository.',
    entitlements:
      'The narrowing order is `build -> edition manifest -> deployment configuration -> tenant override`. The current frontend does not resolve Enterprise-specific entitlements; it records shared current surfaces and their limits.',
    nonSupport:
      'No additional non-registry product areas. Catalog rows with status `not-implemented` are the current Enterprise product gaps.',
  },
];

function posix(value) {
  return value.replace(/\\/g, '/');
}

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      files.push(...filesUnder(full));
      continue;
    }
    files.push(full);
  }
  return files;
}

function relative(file) {
  return posix(path.relative(ROOT, file));
}

function quote(value) {
  return JSON.stringify(value);
}

function concept({ type, title, description, tags, sources = [], body }) {
  const lines = [
    '---',
    `type: ${quote(type)}`,
    `title: ${quote(title)}`,
    `description: ${quote(description)}`,
    `tags: [${tags.join(', ')}]`,
    'status: stable',
  ];
  if (sources.length > 0) {
    lines.push('sources:');
    for (const source of sources) {
      lines.push(`  - id: ${quote(source.id)}`);
      lines.push(`    resource: ${quote(source.resource)}`);
      if (source.title) lines.push(`    title: ${quote(source.title)}`);
    }
  }
  lines.push('---', '', body.trim(), '');
  return lines.join('\n');
}

function loadCatalog() {
  if (!fs.existsSync(SNAPSHOT)) {
    throw new Error('Catalog snapshot is missing; obtain the versioned capability package and refresh the documentation snapshot');
  }
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const catalogPackage = loadCatalogPackage();
  const driftErrors = packageDriftErrors(snapshot, catalogPackage);
  if (driftErrors.length > 0) {
    throw new Error(driftErrors.join('; '));
  }

  const detailsByKey = new Map(snapshot.map((record) => [record.key, record]));
  const capabilities = catalogPackage.catalog.map((record) => {
    const details = detailsByKey.get(record.key);
    if (!details) {
      throw new Error(`Catalog snapshot is missing package key ${record.key}`);
    }
    return { ...details, ...record };
  });

  return {
    capabilities,
    manifests: catalogPackage.manifests,
    packageVersion: catalogPackage.version,
  };
}

function countSourceFiles(directory) {
  return filesUnder(directory).filter((file) => /\.(ts|tsx)$/.test(file)).length;
}

function appRouteFromFile(file) {
  const rel = posix(path.relative(path.join(ROOT, 'src/app'), file));
  const withoutPage = rel.replace(/\/?page\.tsx$/, '');
  const segments = withoutPage
    .split('/')
    .filter((segment) => segment && !/^\([^)]+\)$/.test(segment));
  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

function featureImport(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = /from ["']@\/features\/([^"']+)["']/.exec(text);
  return match ? `@/features/${match[1]}` : 'inline route composition';
}

function generateRouteMap() {
  const pages = filesUnder(path.join(ROOT, 'src/app'))
    .filter((file) => posix(file).endsWith('/page.tsx'))
    .map((file) => ({
      route: appRouteFromFile(file),
      file: relative(file),
      feature: featureImport(file),
    }))
    .sort((left, right) => left.route.localeCompare(right.route));

  const rows = pages.map(
    (page) => `| \`${page.route}\` | \`${page.file}\` | \`${page.feature}\` |`,
  );

  return concept({
    type: 'Route Map',
    title: 'Frontend route map',
    description: 'Generated inventory of App Router pages and the feature barrels they compose.',
    tags: ['architecture', 'routes', 'map'],
    sources: [
      { id: 'app-router', resource: 'src/app', title: 'Next.js App Router pages' },
    ],
    body: `# Frontend route map

The current App Router exposes **${pages.length} pages**. Routes under \`src/app/\` are a routing table. Feature code lives in \`src/features/\`.

| Route | Page module | Feature composition |
|---|---|---|
${rows.join('\n')}

\`/\`, \`/login\`, \`/signup\`, and \`/auth/callback\` may contain small inline composition. Other pages re-export a feature view.

## Verification

Run \`npm run arch:check\` and \`npm run generate:architecture-maps -- --check\`.`,
  });
}

function generateFeatureMap() {
  const rows = DOMAIN_OWNERS.map((domain) => {
    const directory = path.join(ROOT, 'src/features', domain.id);
    const sources = fs.existsSync(directory) ? countSourceFiles(directory) : 0;
    return `| \`${domain.id}\` | \`${domain.backendContext}\` | ${domain.owns} | ${sources} |`;
  });

  return concept({
    type: 'Feature Map',
    title: 'Frontend feature map',
    description: 'Generated inventory of feature domains and the backend contexts they consume.',
    tags: ['architecture', 'features', 'map'],
    sources: [
      { id: 'features', resource: 'src/features', title: 'Feature domain tree' },
      { id: 'surface-registry', resource: 'docs/capabilities/surface-registry.ts', title: 'Generated capability surface view' },
    ],
    body: `# Frontend feature map

Feature domains are UI ownership boundaries. They consume backend bounded contexts through HTTP; they are not a second catalog and they are not pack-specific application copies.

| Feature domain | Backend context | Current responsibility | Source files |
|---|---|---|---:|
${rows.join('\n')}

Cross-feature imports go through a domain or action \`index.ts\`. \`src/shared/\` may not import a feature.

## Verification

Run \`npm run boundaries\` and \`npm run arch:check\`.`,
  });
}

function generateArchitectureChecks() {
  const featureTotal = DOMAIN_OWNERS.reduce(
    (sum, domain) => sum + countSourceFiles(path.join(ROOT, 'src/features', domain.id)),
    0,
  );
  const shared = countSourceFiles(path.join(ROOT, 'src/shared'));
  const app = countSourceFiles(path.join(ROOT, 'src/app'));

  return concept({
    type: 'Architecture Checks',
    title: 'Architecture check map',
    description: 'Generated snapshot of frontend source metrics and the repository architecture gates.',
    tags: ['architecture', 'checks', 'map', 'verification'],
    sources: [
      { id: 'features', resource: 'src/features', title: 'Feature domain tree' },
      { id: 'boundary-source', resource: '.dependency-cruiser.cjs', title: 'Authoritative dependency graph configuration' },
      { id: 'layer-source', resource: 'scripts/check-boundaries.mjs', title: 'Feature MVVM layer checker' },
      { id: 'ci-source', resource: '.github/workflows/boundaries.yml', title: 'Continuous integration gate' },
    ],
    body: `# Architecture check map

This snapshot is generated from the current source tree. It is descriptive evidence; the executable gates remain the commands in the verification table.

## Source metrics

| Area | Source files |
|---|---:|
| Feature domains | ${featureTotal} |
| \`src/shared\` | ${shared} |
| \`src/app\` | ${app} |

## Executable gates

| Gate | Command | Authority |
|---|---|---|
| Type safety | \`npm run typecheck\` | TypeScript compiler |
| Build | \`npm run build\` | Next.js production build |
| Lint | \`npx eslint src --max-warnings=0\` | ESLint |
| CSS | \`npm run lint:css\` | stylelint with the warning ceiling |
| Tests | \`npm test\` | Jest |
| Dependency boundaries | \`npm run boundaries\` | dependency-cruiser |
| Feature architecture | \`npm run arch:check\` | thin routes, view I/O, model purity |
| Capability package and surfaces | \`npm run check:capability-package\` and \`npm run check:capabilities\` | package drift, compatibility fields, and pack catalogs |
| OKF bundle | \`npm run check:okf\` | OKF v0.2 bundle validator |
| Documentation | \`npm run check:documentation\` | naming, stale-claim, generated-map, and documentation policy checker |

## Limits

Static gates do not prove a live backend session, provider API availability, or cross-origin cookie behavior. Those checks are covered by the session and local verification runbooks when the environment is configured.`,
  });
}

function generateCapabilityMatrix(capabilities, surfaces) {
  const byKey = new Map(surfaces.map((surface) => [surface.key, surface]));
  const rows = capabilities.map((capability) => {
    const surface = byKey.get(capability.key) ?? { apiField: null, viewFlag: null, routes: [] };
    const api = surface.apiField ? `\`${surface.apiField}\`` : 'none';
    const flag = surface.viewFlag ? `\`${surface.viewFlag}\`` : 'none';
    const routes = (surface.routes ?? []).length > 0
      ? surface.routes.map((route) => `\`${route}\``).join(', ')
      : 'none';
    return `| \`${capability.key}\` | \`${capability.context}\` | ${capability.maturity} | ${api} | ${flag} | ${routes} |`;
  });

  return concept({
    type: 'Capability Map',
    title: 'Capability matrix',
    description: 'Generated inventory of shared catalog keys and the frontend surfaces that consume them.',
    tags: ['capabilities', 'map', 'packs'],
    sources: [
      { id: 'catalog-package', resource: 'vendor/@alphaci/capability-catalog', title: 'Versioned capability catalog fixture' },
      { id: 'catalog-snapshot', resource: 'docs/capabilities/catalog.snapshot.json', title: 'Shared catalog snapshot' },
      { id: 'surface-registry', resource: 'docs/capabilities/surface-registry.ts', title: 'Frontend surface map' },
      { id: 'capability-endpoint', resource: 'src/features/capabilities/current/data/capabilities-api.ts', title: 'Compatibility capability client' },
    ],
    body: `# Capability matrix

This matrix is generated from the versioned \`@alphaci/capability-catalog\` package and the frontend surface registry. The checked-in snapshot supplies the backend-owned descriptions and configuration notes used for documentation. This frontend does not replace \`/api/v1/capabilities\` and does not implement entitlement resolution.

| Capability key | Context | Maturity | Compatibility field | View flag | Frontend routes |
|---|---|---|---|---|---|
${rows.join('\n')}

## Interpretation

- **stable** and **limited** keys may have a compatibility field and a view flag.
- **not-implemented** keys must remain without a compatibility field until the backend provides the behavior.
- A loaded flag that does not yet hide a route is still recorded. The Teams and group routes currently remain visible to authenticated users even though \`hierarchyEnabled\` is loaded.

Pack profiles list every key in package order. Pack status is derived from maturity and edition applicability.`,
  });
}

function packEvidence(capability, edition, surface) {
  const status = expectedPackStatus(capability, edition);
  if (status === 'not-applicable') return 'Not part of this pack composition.';
  const routes = (surface.routes ?? []).map((route) => `\`${route}\``).join(', ');
  const surfaceText = routes ? `Frontend surface: ${routes}.` : 'No frontend surface.';
  if (status === 'not-implemented') {
    return `${capability.description} ${surfaceText} Not implemented in the backend catalog.`;
  }
  if (capability.key === 'identity.hierarchy') {
    return `${capability.description} ${surfaceText} The hierarchy compatibility flag is loaded; Teams and group routes currently remain visible to authenticated users. Configuration: ${capability.configuration}.`;
  }
  if (capability.key === 'billing.subscription-gate') {
    return `${capability.description} No paywall or \`/subscribe\` route. Access gating is enforced by the backend session. Configuration: ${capability.configuration}.`;
  }
  if (capability.key === 'runtime.gcp-deployments') {
    return `${capability.description} Advertised through \`envProvisioning.providers\` when GCP is registered. Configuration: ${capability.configuration}.`;
  }
  if (capability.key === 'platform.audit-events' || capability.key === 'billing.usage-quotas') {
    return `${capability.description} Compatibility flag is loaded by the capabilities view-model. No dedicated route yet hides or shows a panel from this flag. Configuration: ${capability.configuration}.`;
  }
  return `${capability.description} ${surfaceText} Configuration: ${capability.configuration}.`;
}

function generatePack(pack, capabilities, manifests, surfaces, packageVersion) {
  const byKey = new Map(surfaces.map((surface) => [surface.key, surface]));
  const profile = resolveProfile(pack.profile, {
    catalog: capabilities,
    manifests,
    surfaces,
  });
  const rows = capabilities.map((capability) => {
    const surface = byKey.get(capability.key) ?? { routes: [] };
    const status = expectedPackStatus(capability, pack.edition);
    return `| \`${capability.key}\` | \`${status}\` | ${packEvidence(capability, pack.edition, surface)} |`;
  });

  return concept({
    type: 'Composition Pack',
    title: `${pack.displayName} pack`,
    description: `Current ${pack.displayName} composition reference using the common pack contract.`,
    tags: ['packs', pack.edition, 'composition'],
    sources: [
      { id: 'pack-contract', resource: '/packs/pack-contract.md', title: 'Common pack contract' },
      { id: 'capability-matrix', resource: '/capabilities/capability-matrix.generated.md', title: 'Current capability matrix' },
    ],
    body: `# ${pack.displayName} pack

## Identity

- Pack ID: \`${pack.edition}\`
- Display name: \`${pack.displayName}\`

## Current composition

- Build profile: \`${pack.profile}\` (${profile.packs.map((item) => `\`${item}\``).join(', ')})
- Runtime selection behavior: The build-time profile resolver projects the versioned catalog and aliases excluded feature barrels to fail-closed \`notFound()\` stubs. Runtime capability truth still comes from \`/api/v1/capabilities\`.
- Excluded frontend feature barrels: ${profile.excludedFeatureBarrels.length > 0 ? profile.excludedFeatureBarrels.map((barrel) => `\`${barrel}\``).join(', ') : 'none in the current surface registry'}
- Current frontend applicability: ${pack.composition}

## Capability status

This table lists every current catalog capability in package order. Status is derived from capability maturity and edition applicability. Pack-specific gaps that are not registry keys stay in Explicit non-support.

| Capability key | Status | Evidence or limit |
|---|---|---|
${rows.join('\n')}

## Build and exclusion

- Excluded capability keys: ${profile.excludedCapabilityKeys.length}
- The build resolver aliases any excluded feature barrel to a \`notFound()\` stub. Route names may remain in the build manifest; implementation code is the excluded unit.

## Deployment scope

${pack.deployment}

## Configuration and entitlements

${pack.entitlements}

## Explicit non-support

${pack.nonSupport}

## Ownership and verification

- Feature owners: the domains in the [feature map](/architecture/feature-map.generated.md).
- Source: \`@alphaci/capability-catalog@${packageVersion}\`, \`docs/capabilities/catalog.snapshot.json\`, and \`docs/capabilities/surface-registry.ts\`.
- Verification: \`npm run check:documentation\`.`,
  });
}

function writeOrCheck(relativePath, content, check) {
  const file = path.join(ROOT, relativePath);
  if (check) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current === null || normalizeLineEndings(current) !== normalizeLineEndings(content)) {
      console.error(`Generated output is stale: ${relativePath}`);
      return false;
    }
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, '\n');
}

function main() {
  const check = process.argv.includes('--check');
  const { capabilities, manifests, packageVersion } = loadCatalog();
  const surfaces = readSurfaceRegistry();
  const outputs = [
    ['docs/architecture/route-map.generated.md', generateRouteMap()],
    ['docs/architecture/feature-map.generated.md', generateFeatureMap()],
    ['docs/architecture/architecture-checks.generated.md', generateArchitectureChecks()],
    ['docs/capabilities/capability-matrix.generated.md', generateCapabilityMatrix(capabilities, surfaces)],
    ...PACKS.map((pack) => [
      pack.file,
      generatePack(pack, capabilities, manifests, surfaces, packageVersion),
    ]),
  ];

  let clean = true;
  for (const [relativePath, content] of outputs) {
    clean = writeOrCheck(relativePath, content, check) && clean;
  }

  if (!clean) process.exitCode = 1;
  else {
    console.log(
      `${check ? 'Checked' : 'Generated'} ${outputs.length} architecture, capability, and pack document(s).`,
    );
  }
}

main();
