'use strict';

// Review artifact only. Membership and maturity always come from the catalog.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/src/kernel/composition/catalog.source.json'), 'utf8'));
const errors = require(path.join(root, 'apps/api/scripts/lib/composition-source.cjs')).validateSource(source);
assert.deepEqual(errors, []);
const editions = ['saas', 'edu', 'enterprise'];
const frontendMap = require('./frontend-persona-map.cjs');
const labels = { saas: 'SaaS', edu: 'EDU', enterprise: 'Enterprise' };
const titles = {
  'identity.workspaces': 'Workspaces and membership',
  'identity.hierarchy': 'Teams, groups, systems and repository assignments',
  'identity.sso-scim': 'Enterprise SSO and user provisioning',
  'identity.lms-lti': 'LMS / LTI integration',
  'identity.cohort-policy': 'Education cohort policies',
  'identity.edu-provisioning': 'Education identity provisioning',
  'identity.ferpa-workflows': 'FERPA-oriented workflows',
  'identity.edition-entitlements': 'Runtime pack entitlements',
  'platform.audit-events': 'Audit trail',
  'platform.notifications': 'Notifications and inbox',
  'platform.data-residency': 'Data residency controls',
  'platform.public-site': 'Public-site API capability',
  'billing.subscription-gate': 'Contract subscription access',
  'billing.usage-quotas': 'Usage and quotas',
  'billing.checkout': 'Self-serve checkout',
  'runtime.env-provisioning': 'Hosting and environment provisioning',
  'runtime.managed-host-delivery': 'Managed machines and signed delivery',
  'runtime.gcp-deployments': 'Google Cloud deployments',
  'runtime.deployment-history': 'Deployment history',
  'runtime.preview-deployments': 'Branch deployment previews',
  'runtime.drift-detection': 'Configuration drift detection',
  'runtime.drift-repair': 'Configuration drift repair',
  'runtime.managed-secrets': 'Managed secrets / Vault',
  'runtime.air-gap-packaging': 'Air-gap packaging',
  'runtime.customer-isolation': 'Customer operational isolation',
  'runtime.client-composition': 'Client-specific feature restrictions',
  'projects.sync-snapshots': 'Project synchronization snapshots',
  'projects.workflow-settings-preview': 'Workflow settings preview',
  'projects.workflow-update-pr': 'Workflow update pull requests',
  'projects.target-management': 'Deployment target management',
  'projects.qa-checklists': 'Requirements, checklists and QA',
  'projects.release-governance': 'Product acceptance and release governance',
  'pipelines.ci-run-tracking': 'CI runs and reports',
  'pipelines.github-enterprise-server': 'GitHub Enterprise Server integration',
};
const includes = {
  'identity.workspaces': ['Workspace selection, membership and scoped access.'],
  'identity.hierarchy': ['Groups and systems, team members, repository assignments and delivery-project organization.'],
  'platform.audit-events': ['Project audit records delivered through the application outbox; project Audit view.'],
  'platform.notifications': ['Notification inbox and preferences; recipient-scoped workspace membership updates; live stream with fetch fallback.'],
  'billing.subscription-gate': ['Contract subscription checks for authenticated access and CI validation. Internal billing exceptions are separate.'],
  'billing.usage-quotas': ['Usage tracking and quota checks; does not provide payment checkout.'],
  'runtime.env-provisioning': ['Provider-backed project environments, hosting operations, shared release registration, promotion and rollback.', 'Managed machines additionally require the managed-host capability; live provider support and credentials vary.'],
  'runtime.managed-host-delivery': ['Host inventory, enrollment codes and installers, machine credentials, environment assignments and readiness.', 'Signed releases, agent polling and status, host-delivered promotion and rollback; port, health and ingress configuration.', 'Requires environment provisioning, operator configuration, signing and registry setup. This is not school lab scheduling.'],
  'runtime.gcp-deployments': ['GCP provider integration; optional dedicated customer projects; requires provider configuration.'],
  'runtime.deployment-history': ['Deployment records, status and historical reads through Runtime.'],
  'runtime.preview-deployments': ['Branch-scoped deployment grouping and preview links when the provider supports them; depends on deployment history.'],
  'runtime.drift-detection': ['Snapshot-based configuration comparison and findings; behavior depends on configured local/provider mode.'],
  'runtime.drift-repair': ['Repair requests using the configured safe repair mode; not an unrestricted infrastructure editor.'],
  'runtime.client-composition': ['Read-only Enterprise settings summary of a declared or mounted client policy that can remove capabilities; policy changes require deployment configuration and restart.', 'Does not grant new capabilities or assign different editions to tenants in one API.'],
  'projects.sync-snapshots': ['Read synchronization snapshots and findings for a project.'],
  'projects.workflow-settings-preview': ['Preview and validate proposed workflow settings before applying them.'],
  'projects.workflow-update-pr': ['Request a pull request containing workflow updates.'],
  'projects.target-management': ['Connect project targets to Runtime deployment providers and environments.'],
  'projects.qa-checklists': ['Requirements: Features, User stories, system requirements and developer Progress.', 'Team checklist templates and sharing; story test cases and test suites.', 'QA Studio: project runs, UAT build verification, Passed/Failed/Pending results, severity, defects, screenshot evidence and sign-off.', 'Returned-by-QA / My QA items, retest workflow and QA reports.', 'PO acceptance, controlled merge and starting the next iteration use a separate governance control.'],
  'projects.release-governance': ['PO Studio item acceptance after QA sign-off; controlled production merge / merge-all.', 'Iteration delivery and starting the next iteration; requires QA checklists and existing workflow safety rules.'],
  'pipelines.ci-run-tracking': ['CI report ingestion, run history, project Pipeline presentation and run details.'],
};
const rows = source.capabilities.map(c => ({
  id: c.key, title: titles[c.key] || c.key, group: c.context,
  status: c.maturity, kind: 'catalog', editions: c.editions,
  includes: includes[c.key] || [c.description],
  conditions: c.configuration + (c.requires.length ? '; requires ' + c.requires.join(', ') : ''),
  evidence: ['apps/api/src/kernel/composition/catalog.source.json', ...source.features.filter(f => f.availability.kind === 'capability' && f.availability.key === c.key).flatMap(f => f.implementation)],
  related: source.features.filter(f => f.availability.kind === 'capability' && f.availability.key === c.key).map(f => f.title),
}));
// Shared application areas have no independent commercial membership declaration.
// Keep them visible without inventing capability keys or entitlement grants.
const core = [
  ['core.auth', 'Authentication and sessions', 'Sign-in, callback and session UI; current identity integration. Separate self-serve email/OAuth branch is not integrated.', 'auth'],
  ['core.home', 'Home dashboard and navigation', 'Authenticated dashboard, workspace switching, application navigation and access-aware summaries.', 'home'],
  ['core.repositories', 'Code and repository collaboration', 'Repository browsing, file tree, commits, branches, pull request views and creation/routing subject to persona and GitHub access.', 'projects'],
  ['core.projects', 'Project workspace and lifecycle', 'Project folders and repository switching; Overview, settings and lifecycle controls. Creation and management depend on persona and resource scope.', 'projects'],
  ['core.workflow-studio', 'Create-project wizard and workflow studio', 'Repository/stack setup and workflow configuration. Hosting targets and optional operations require their own capabilities and providers.', 'workflows'],
  ['core.admin', 'Administration and feedback', 'Platform user review, user details and feedback administration; privileged access is required in every pack.', 'admin'],
  ['core.settings', 'Account and workspace settings', 'Account/workspace settings and notification preferences. Enterprise client policy has a separate catalog key.', 'settings'],
  ['core.guide', 'In-product guide', 'Application help/guide surface; distinct from the SaaS public landing page.', 'guide'],
];
for (const [id, title, description, domain] of core) rows.push({ id, title, group: 'shared application', status: 'shared-core', kind: 'core', editions, includes: [description], conditions: 'Shared application code; no independent pack entitlement key. Role, resource, subscription and related capability checks still apply.', evidence: ['docs/architecture/web/feature-map.generated.md', 'docs/design/persona-workflow.md', 'apps/web/src/features/' + domain], related: [] });
for (const f of source.features.filter(f => f.availability.kind !== 'capability')) rows.push({ id: f.id, title: f.title, group: 'other composition', status: f.availability.kind === 'web-build' ? 'web-only' : 'deployment', kind: 'other', editions: f.availability.kind === 'web-build' ? [f.availability.edition] : [], includes: f.availability.kind === 'web-build' ? ['Public SaaS marketing landing page. Pricing and guide capability scope does not establish a checkout implementation.', ...f.prerequisites] : ['One-server appliance: Caddy, API, web, migrator and PostgreSQL; local operator commands, persistent configuration and upgrades.', ...f.prerequisites], conditions: f.availability.kind === 'web-build' ? 'SaaS web build only. The API public-site capability remains unimplemented.' : 'Deployment option independent of edition; supplied appliance images use Enterprise. Not an air-gap claim.', evidence: f.implementation, related: [] });
const legacyText = fs.readFileSync(path.join(__dirname, 'legacy-reconciliation.md'), 'utf8');
const legacy = legacyText.split(/\r?\n/).filter(line => /^\| (EDU|SAAS)-\d+ \|/.test(line)).map(line => {
  const cells = line.split('|').slice(1, -1).map(s => s.trim());
  return { id: cells[0], title: cells[1], group: cells[0].startsWith('EDU') ? 'legacy EDU' : 'legacy SaaS', status: 'historical', kind: 'legacy', editions: [], includes: [cells[2], cells[4], cells[5]], conditions: 'No current pack grant. Historical origin is ' + (cells[0].startsWith('EDU') ? 'EDU' : 'SaaS') + '; see cited refs before any port or assignment.', evidence: ['docs/plans/golden-copy-persona-map/legacy-reconciliation.md'], related: [] };
});
rows.push(...legacy);
const frontend = frontendMap.frontend.map(f => {
  const owners = f.owners.map(id => { const owner = rows.find(r => r.id === id); assert.ok(owner, id); return owner; });
  return { ...f, relatedCapabilities: source.capabilities.filter(c => f.id.startsWith('page:') && c.surface.routes.some(route => f.routes.includes(route))).map(c => c.key), editions: editions.filter(e => owners.every(o => o.editions.includes(e))) };
}).sort((a, b) => {
  const priority = { tab: 0, action: 1, page: 2, card: 3 };
  return priority[a.id.split(':')[0]] - priority[b.id.split(':')[0]];
});
assert.equal(new Set(rows.map(r => r.id)).size, rows.length);
assert.equal(rows.filter(r => r.kind === 'catalog').length, source.capabilities.length);
for (const r of rows) for (const file of r.evidence) assert.ok(fs.existsSync(path.join(root, file)), file);
const counts = Object.fromEntries(editions.map(e => [e, {
  stable: source.capabilities.filter(c => c.editions.includes(e) && c.maturity === 'stable').length,
  limited: source.capabilities.filter(c => c.editions.includes(e) && c.maturity === 'limited').length,
  planned: source.capabilities.filter(c => c.editions.includes(e) && c.maturity === 'not-implemented').length,
}]));
const statusLabels = { stable: 'Stable', limited: 'Limited / configured', 'not-implemented': 'Not built', 'shared-core': 'Shared application', 'web-only': 'Web only', deployment: 'Deployment option', historical: 'Historical / not integrated' };
function pack(r, e) {
  if (r.kind === 'legacy') return 'Not integrated';
  if (r.status === 'deployment') return 'Edition-independent';
  if (!r.editions.includes(e)) return '—';
  if (r.status === 'shared-core') return 'Shared code';
  if (r.status === 'not-implemented') return 'Planned';
  if (r.status === 'limited') return 'Included*';
  return 'Included';
}
const md = ['# AlphaCI product features and current packs', '', 'Investigation snapshot: November 5, 2026. This map covers every current catalog capability, eight additional shared application areas, the web/deployment exceptions, and the reconciled historical journeys. It is a feature-area map, not an enumeration of every endpoint or button.', '', 'Membership and maturity come from the catalog. Shared code has no independent pack grant. Included does not bypass configuration, providers, subscriptions, personas or resource access. Planned means declared but not built.', '', '**Internal is not a fourth pack.** It inherits the configured SaaS, EDU or Enterprise edition; organization/billing policy and user roles remain separate.', '', '| Pack | Stable catalog records | Limited / configured | Planned, not built |', '|---|---:|---:|---:|', ...editions.map(e => `| ${labels[e]} | ${counts[e].stable} | ${counts[e].limited} | ${counts[e].planned} |`), '', 'Counts refer only to catalog records. Shared application areas, appliance deployment and the web landing page are not extra catalog entitlements.', ''];
for (const [heading, subset] of [['Current catalog', rows.filter(r => r.kind === 'catalog')], ['Shared application and other composition', rows.filter(r => ['core', 'other'].includes(r.kind))], ['Historical journeys outside current packs', legacy]]) {
  md.push('## ' + heading, '', '| Feature | What it includes | SaaS | EDU | Enterprise | Status |', '|---|---|---|---|---|---|');
  for (const r of subset) md.push(`| ${r.title} (${r.id}) | ${r.includes.join('<br>').replaceAll('|', '/')} | ${pack(r, 'saas')} | ${pack(r, 'edu')} | ${pack(r, 'enterprise')} | ${statusLabels[r.status]} |`);
  md.push('');
}
md.push('## Frontend and personas', '', 'The [frontend/persona matrix](frontend-persona-map.md) maps all ' + frontendMap.routeCount + ' current pages, all ' + frontendMap.tabCount + ' project tabs, action controls and the client-policy card. It shows what each persona sees, permitted actions, hidden or blocked controls, backend differences and conditions. Pack membership is inherited from each linked feature owner.', '');
const frontendMd = ['# Frontend screens, personas and actions', '', 'Investigation snapshot: November 5, 2026. Generated from the route inventory and executed pure UI/backend policy functions, with reviewed screen descriptions. This is a source map, not a claim of live browser verification.', '', 'All personas still require pack availability, authentication, resource access and workflow preconditions. Internal inherits its base pack and normal persona. Global app role, group manager rights and platform-admin authorization are separate.', '', 'Covers ' + frontendMap.routeCount + ' pages, ' + frontendMap.tabCount + ' project tabs, nine action groups and one read-only Enterprise card.', ''];
for (const f of frontend) {
 frontendMd.push('## ' + f.title, '', '- Surface: ' + f.routes.map(r => '\x60' + r + '\x60').join(', '), '- Feature owner: ' + f.owners.join(', '), ...(f.relatedCapabilities.length ? ['- Related capability controls on this page: ' + f.relatedCapabilities.join(', ') + '. Individual controls can be narrower than page access.'] : []), '- Packs: ' + f.editions.map(e => labels[e]).join(', '), '- Contains: ' + f.contains, '', '| Persona | Frontend visibility and actions |', '|---|---|', ...Object.entries(f.actions).map(([role,action]) => '| ' + frontendMap.roleLabels[role] + ' | ' + action + ' |'), '', '- Conditions / hidden or disabled behavior: ' + f.conditions, '- Backend authorization: ' + f.backend, '- Evidence: ' + f.evidence.map(p => '\x60' + p + '\x60').join(', '), '');
}
frontendMd.push('Refresh with \x60node docs/plans/golden-copy-persona-map/build-product-map.cjs\x60. [Full feature contents and packs](product-feature-map.md).', '');
fs.writeFileSync(path.join(__dirname, 'frontend-persona-map.md'), frontendMd.join('\n'));
md.push('## Per-feature controls and evidence', '');
for (const r of rows) md.push('### ' + r.title, '', '- Identifier: `' + r.id + '`.', '- Conditions: ' + r.conditions, ...(frontend.some(f => (f.owners.includes(r.id) || f.relatedCapabilities.includes(r.id))) ? ['- Frontend surfaces: ' + frontend.filter(f => (f.owners.includes(r.id) || f.relatedCapabilities.includes(r.id))).map(f => f.title + ' (' + f.routes.join(', ') + ')').join('; ') + '. See the frontend/persona matrix for actions.'] : ['- Frontend: no separately mapped screen/action for this record; this does not imply that backend behavior is absent.']), ...(r.related.length ? ['- Reconciled subfeatures: ' + r.related.join('; ') + '.'] : []), '- Evidence: ' + r.evidence.map(f => '`' + f + '`').join(', ') + '.', '');
md.push('## Refresh', '', 'Run `node docs/plans/golden-copy-persona-map/build-product-map.cjs`. The script validates catalog coverage and evidence paths, then rebuilds this snapshot and its HTML from the same data. Narrative shared-area descriptions require review when journeys change.', '', 'Current contracts remain in [capabilities](../../capabilities/index.md) and [packs](../../packs/pack-contract.md). Historical refs are in [legacy reconciliation](legacy-reconciliation.md). Proposed commercial assignments are separate in the [proposal](../2026-11-05-feature-composition-improvements.md).', '');
fs.writeFileSync(path.join(__dirname, 'product-feature-map.md'), md.join('\n'));
const data = JSON.stringify({ rows, counts, statusLabels, frontend, roleLabels: frontendMap.roleLabels, routeCount: frontendMap.routeCount, tabCount: frontendMap.tabCount }).replaceAll('<', '\\u003c');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AlphaCI product feature map</title><style>
html,body{margin:0;background:transparent;color:var(--foreground);font-family:var(--font-sans);font-size:14px;line-height:1.5}*{box-sizing:border-box}main{display:grid;gap:14px;min-width:0}p{margin:0}small,.muted{color:var(--muted-foreground);font-size:12px}.controls{display:flex;flex-wrap:wrap;gap:8px}input,select,button{font:inherit;color:var(--foreground);background:var(--secondary);padding:8px;border:1px solid var(--border);border-radius:var(--radius);max-width:100%}input{flex:1;min-width:150px}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--ring)}.scroll{max-height:520px;overflow:auto;border-bottom:1px solid var(--border)}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:9px 6px;vertical-align:top;border-bottom:1px solid var(--border)}th{font-weight:500;position:sticky;top:0;background:var(--background);z-index:1}td:nth-child(n+3){white-space:nowrap}.map{min-width:640px}.map td:first-child{width:28%}.map td:nth-child(2){width:39%}summary{cursor:pointer;font-size:13px;font-weight:500}ul{padding-left:18px;margin:8px 0}code{font-family:var(--font-mono);font-size:11px;overflow-wrap:anywhere}.bar{display:flex;height:9px;overflow:hidden;border-radius:var(--radius);margin-top:5px}.s{background:var(--chart-1)}.l{background:var(--chart-2)}.p{background:var(--chart-3)}.packgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.packgrid button{text-align:left;background:transparent;border:0;padding:0}.tag{display:block;color:var(--muted-foreground);margin:3px 0}#count{font-size:12px;color:var(--muted-foreground)}@media(max-width:450px){.packgrid{gap:8px}.packgrid button{font-size:12px}}
</style></head><body><main>
<p>Feature contents, packs, frontend screens and persona actions. Expand a row for conditions, backend differences and source evidence.</p>
<div class="packgrid" id="packs"></div><p class="muted">Catalog records only. Bars: stable · limited/configured · planned. Included features still require their flags, providers and user permissions.</p>
<p class="muted">Personas: Product owner / Team lead (lead), QA (qa), Developer (member), Admin (admin). Persona does not replace workspace or platform-admin permissions.</p><p><strong>Internal inherits its base pack.</strong> It adds organization and billing rules; it does not automatically grant all features or admin access.</p>
<div class="controls"><select id="view" aria-label="Map view"><option value="frontend">Frontend and personas</option><option value="features">Features and packs</option></select><select id="persona" aria-label="Persona"><option value="member">Developer</option><option value="lead">Product owner</option><option value="qa">QA</option><option value="admin">Admin</option><option value="all">Compare all personas</option></select><input id="search" aria-label="Search features and contents" placeholder="Search features or what they include"><select id="scope" aria-label="Feature group"><option value="all">All feature areas</option><option value="built">Implemented catalog</option><option value="core">Shared application</option><option value="planned">Planned catalog</option><option value="other">Web / deployment</option><option value="legacy">Historical journeys</option></select><select id="edition" aria-label="Pack"><option value="all">All packs</option><option value="saas">SaaS</option><option value="edu">EDU</option><option value="enterprise">Enterprise</option></select></div>
<p id="count" aria-live="polite"></p><div class="scroll" tabindex="0" aria-label="Feature map, scroll for all features"><table class="map"><thead id="head"><tr><th>Feature / status</th><th>What it includes</th><th>SaaS</th><th>EDU</th><th>Enterprise</th></tr></thead><tbody id="rows"></tbody></table></div>
<p class="muted">Included* = limited or configuration-gated. Planned = pack declaration exists, functionality is not built. Shared code = no independent pack key. Historical rows have no current pack grant. SaaS landing UI and self-hosted deployment are separate from API catalog maturity.</p>
</main><script id="map-data" type="application/json">${data}</script><script>
(()=>{'use strict';const data=JSON.parse(document.getElementById('map-data').textContent),q=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pack=${pack.toString()};
q('packs').innerHTML=Object.entries(data.counts).map(([e,c])=>'<button data-pack="'+e+'" aria-label="Filter '+e+' pack">'+esc(e==='saas'?'SaaS':e==='edu'?'EDU':'Enterprise')+'<span class="tag">'+c.stable+' stable · '+c.limited+' limited · '+c.planned+' planned</span><span class="bar">'+[['s',c.stable],['l',c.limited],['p',c.planned]].map(([cl,n])=>'<span class="'+cl+'" style="width:'+n/${source.capabilities.length}*100+'%"></span>').join('')+'</span></button>').join('');
function render(){if(q('view').value==='frontend'){renderFrontend();return;}q('head').innerHTML='<tr><th>Feature / status</th><th>What it includes</th><th>SaaS</th><th>EDU</th><th>Enterprise</th></tr>';const term=q('search').value.trim().toLowerCase(),scope=q('scope').value,edition=q('edition').value;const visible=data.rows.filter(r=>(!term||JSON.stringify(r).toLowerCase().includes(term))&&(edition==='all'||r.editions.includes(edition)||r.status==='deployment')&&(scope==='all'||(scope==='built'?r.kind==='catalog'&&r.status!=='not-implemented':scope==='planned'?r.status==='not-implemented':r.kind===scope)));q('count').textContent=visible.length+' of '+data.rows.length+' feature areas · '+data.rows.filter(r=>r.kind==='catalog').length+' catalog records + shared areas, exceptions and history';q('rows').innerHTML=visible.map(r=>'<tr><td><details><summary>'+esc(r.title)+'</summary><p><code>'+esc(r.id)+'</code></p><p>'+esc(r.conditions)+'</p>'+r.evidence.map(f=>'<p><code>'+esc(f)+'</code></p>').join('')+'</details><span class="tag">'+esc(data.statusLabels[r.status])+'</span></td><td>'+r.includes.map(x=>'<p>'+esc(x)+'</p>').join('<br>')+'</td>'+['saas','edu','enterprise'].map(e=>'<td>'+esc(pack(r,e))+'</td>').join('')+'</tr>').join('');}
function renderFrontend(){const term=q('search').value.trim().toLowerCase(),edition=q('edition').value,chosen=q('persona').value;const roles=chosen==='all'?Object.keys(data.roleLabels):[chosen];const visible=data.frontend.filter(f=>(!term||JSON.stringify(f).toLowerCase().includes(term))&&(edition==='all'||f.editions.includes(edition)));q('head').innerHTML='<tr><th>Screen / control</th><th>Contains / packs</th>'+roles.map(r=>'<th>'+esc(data.roleLabels[r])+'</th>').join('')+'</tr>';q('count').textContent=visible.length+' of '+data.frontend.length+' frontend entries · '+data.routeCount+' pages · '+data.tabCount+' project tabs · 9 action groups · 1 policy card';q('rows').innerHTML=visible.map(f=>'<tr><td><details><summary>'+esc(f.title)+'</summary><p>'+esc(f.conditions)+'</p><p><strong>Backend:</strong> '+esc(f.backend)+'</p>'+ (f.relatedCapabilities.length?'<p>Related capability controls: '+f.relatedCapabilities.map(esc).join(', ')+'</p>':'')+f.evidence.map(p=>'<p><code>'+esc(p)+'</code></p>').join('')+'</details><small>'+f.routes.map(esc).join('<br>')+'</small></td><td><p>'+esc(f.contains)+'</p><small>'+f.editions.map(e=>esc(e==='saas'?'SaaS':e==='edu'?'EDU':'Enterprise')).join(' · ')+'<br>'+f.owners.map(esc).join(', ')+'</small></td>'+roles.map(r=>'<td style="white-space:normal;min-width:150px">'+esc(f.actions[r])+'</td>').join('')+'</tr>').join('');}
function switchView(){const isFrontend=q('view').value==='frontend';q('scope').hidden=isFrontend;q('persona').hidden=!isFrontend;render();}
q('view').addEventListener('change',switchView);q('persona').addEventListener('change',render);
q('search').addEventListener('input',render);q('scope').addEventListener('change',render);q('edition').addEventListener('change',render);q('packs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{q('edition').value=b.dataset.pack;render();}));q('view').value='features';render();
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};check(q('rows').children.length===data.rows.length,'Missing feature rows');q('scope').value='planned';render();check(q('rows').children.length===data.rows.filter(r=>r.status==='not-implemented').length,'Planned filter');q('scope').value='all';q('edition').value='edu';q('search').value='client-specific feature';render();check(q('rows').children.length===0,'Enterprise membership leaked into EDU');q('search').value='';q('edition').value='all';render();q('rows').querySelector('details').open=true;check(q('rows').querySelector('details').open,'Details');q('rows').querySelector('details').open=false;q('view').value='frontend';switchView();check(q('rows').children.length===data.frontend.length,'Frontend rows');q('search').value='tab:qa';q('persona').value='lead';render();check(q('rows').textContent.includes('Hidden tab'),'QA tab hidden from owner');q('search').value='';q('persona').value='member';render();q('persona').value='all';render();check(q('head').querySelectorAll('th').length===6,'Compare all personas');q('search').value='card:client-policy';q('edition').value='saas';render();check(q('rows').children.length===0,'Frontend SaaS exclusion');q('edition').value='enterprise';render();check(q('rows').children.length===1,'Frontend Enterprise card');q('search').value='';q('edition').value='all';q('persona').value='member';render();console.info('Frontend map verified: '+data.routeCount+' pages, '+data.tabCount+' tabs; persona visibility passed.');console.info('Product map verified: '+data.rows.length+' rows; catalog coverage, planned filter, pack filter and expansion passed.');
})();</script></body></html>`;
fs.writeFileSync(path.join(__dirname, 'product-feature-map.html'), html);
console.log(JSON.stringify({ rows: rows.length, catalog: source.capabilities.length, sharedAreas: core.length, history: legacy.length, frontend: frontend.length, pages: frontendMap.routeCount, tabs: frontendMap.tabCount, counts }));
