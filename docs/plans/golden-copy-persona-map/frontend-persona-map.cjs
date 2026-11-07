'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const roles = ['lead', 'qa', 'member', 'admin'];
const roleLabels = { lead: 'Product owner', qa: 'QA', member: 'Developer', admin: 'Admin' };
const files = {
  tabs: 'apps/web/src/features/projects/detail/model/project-detail-tab-rules.ts',
  persona: 'apps/api/src/kernel/rules/persona-access.rules.ts',
  qa: 'apps/api/src/modules/projects/domain/qa-run-access.rules.ts',
  hosts: 'apps/web/src/features/hosts/model/host-types.ts',
  release: 'apps/api/src/modules/runtime/domain/release-access.rules.ts',
  nav: 'apps/web/src/features/workspace/selection/model/workspace-types.ts',
};

// Execute the existing pure policy functions, rather than maintaining role lists.
const cache = new Map();
function policy(relative) {
  const file = path.resolve(root, relative);
  assert.ok(file.startsWith(root + path.sep), 'Policy must stay in repository');
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const localRequire = specifier => {
    let target;
    if (specifier.startsWith('.')) target = path.resolve(path.dirname(file), specifier);
    else if (specifier.startsWith('@/')) target = path.join(root, 'apps/web/src', specifier.slice(2));
    else if (specifier.startsWith('#kernel/')) target = path.join(root, 'apps/api/src/kernel', specifier.slice(8));
    else throw new Error('Unexpected dependency in pure policy: ' + specifier);
    target = target.replace(/\.js$/, '');
    return policy(path.relative(root, target + '.ts'));
  };
  vm.runInNewContext('(function(exports,require){' + outputText + '\n})', {}, { filename: file })(exports, localRequire);
  return exports;
}
const tabRules = policy(files.tabs);
const persona = policy(files.persona);
const qa = policy(files.qa);
const hostRules = policy(files.hosts);
const release = policy(files.release);
const note = 'Pack availability, authentication, resource membership and server-returned action permissions still apply.';
const allRead = Object.fromEntries(roles.map(r => [r, 'Visible: read permitted resources.']));
const front = [];
function add(id, title, routes, owners, contains, actions, conditions, evidence, backend = note) {
  front.push({ id, title, routes, owners, contains, actions, conditions, evidence, backend });
}
const routeDoc = fs.readFileSync(path.join(root, 'docs/architecture/web/route-map.generated.md'), 'utf8');
const routeRows = routeDoc.split(/\r?\n/).filter(l => /^\| `\//.test(l)).map(l => {
  const c = l.split('|').slice(1, -1).map(s => s.trim().replaceAll('`', ''));
  return { route: c[0], page: 'apps/web/' + c[1] };
});
function pages(routes, title, owner, contains, actions = allRead, conditions = note, evidence = [], backend) {
  for (const route of routes) {
    const row = routeRows.find(r => r.route === route);
    assert.ok(row, route);
    const publicRoute = ['/', '/guide', '/login', '/signup', '/auth/callback'].includes(route);
    const pageConditions = publicRoute && conditions === note
      ? 'Public route or authentication handshake; protected operations still require a valid session and authorization.'
      : conditions;
    add('page:' + route, title, [route], [owner], contains, actions, pageConditions, [row.page, ...evidence], backend ?? (publicRoute ? 'No persona is required to reach this entry route. It grants no privileged access to protected APIs.' : note));
  }
}
pages(['/'], 'Public landing', 'platform.public-landing', 'SaaS marketing landing; other editions redirect to login.', Object.fromEntries(roles.map(r => [r, 'Public: no persona required.'])), 'SaaS web build only; not the unimplemented public-site API capability.');
pages(['/login', '/auth/callback'], 'Sign-in and callback', 'core.auth', 'Authentication entry, callback and session handoff.', Object.fromEntries(roles.map(r => [r, 'Authentication flow; resulting session determines persona.'])));
pages(['/signup'], 'Sign-up redirect', 'core.auth', 'Redirects to /login; no self-serve account creation form.', Object.fromEntries(roles.map(r => [r, 'Redirect to login.'])));
pages(['/guide'], 'Product guide', 'core.guide', 'Guide and product help.', Object.fromEntries(roles.map(r => [r, 'Public guide; no privileged action grant.'])));
pages(['/home'], 'Home dashboard', 'core.home', 'Role-aware summaries, projects and work navigation.');
pages(['/inbox'], 'Notification inbox', 'platform.notifications', 'Read own notifications and change own notification state/preferences.', Object.fromEntries(roles.map(r => [r, 'Visible: own recipient-scoped inbox.'])), 'Notifications capability; never another user’s inbox.');
pages(['/runs'], 'CI runs', 'pipelines.ci-run-tracking', 'CI run list, status and run detail links.');
pages(['/runs/report'], 'CI run report', 'pipelines.ci-run-tracking', 'Read the CI run report from /ci/runs/report; distinct from a QA verification report.', allRead, 'CI run tracking and permitted run/repository access; this is not gated by the QA-checklist report contract.');
pages(['/projects/[projectId]/qa/report/[runId]', '/qa/project-report/[deliveryProjectId]/[runId]'], 'QA report', 'projects.qa-checklists', 'Read permitted QA report; report availability and server authorization apply.', allRead, 'QA capability and run/project visibility. A report URL is not permission to edit a run.');
pages(['/projects/[projectId]'], 'Project detail', 'core.projects', 'Overview, repository work, requirements, QA/PO studios, hosting, audit, history and settings; tabs differ by persona.', Object.fromEntries(roles.map(r => [r, 'Visible tabs: ' + tabRules.visibleProjectDetailTabs(r, { qaChecklistsEnabled: true }).join(', ') + '.'])), 'Tab availability below assumes QA enabled; disabling it removes Checklists, QA, PO and History.', [files.tabs]);
pages(['/workflows'], 'Create repository / workflow studio', 'core.workflow-studio', 'Create or onboard repositories and configure workflows.', Object.fromEntries(roles.map(r => [r, persona.canCreateRepository(r) ? 'Create/onboard repository; Developer requires an existing Project with an active Feature.' : 'Repository creation denied; route presence does not grant it.'])), 'Capabilities, provider setup and repository permissions apply; admin is exempt from the existing Project/Feature requirement.', [files.persona]);
pages(['/teams', '/groups/[groupId]'], 'Team / group', 'identity.hierarchy', 'Projects explorer, member links, checklist templates, activity and settings.', Object.fromEntries(roles.map(r => [r, r === 'lead' || r === 'admin' ? 'View team; manage where group response grants manager rights; create Project as permitted.' : 'View permitted team; management follows returned group rights.'])), 'Workspace/group membership and manager permissions. Global persona alone does not establish group manager rights.', [files.persona]);
pages(['/groups/[groupId]/members'], 'Team members', 'identity.hierarchy', 'Member list; add/remove controls for group managers.', Object.fromEntries(roles.map(r => [r, 'View permitted members; add/remove only if returned group role is a manager.'])), 'UI uses isGroupManagerRole(group.role); server enforces group management.', ['apps/web/src/features/groups/members/view-models/use-group-members-view-model.ts']);
pages(['/groups/[groupId]/systems', '/groups/[groupId]/systems/[systemId]'], 'Systems', 'identity.hierarchy', 'Group systems, their projects and repository organization.', allRead, 'Group scope; mutation controls depend on returned management permissions.');
pages(['/groups/[groupId]/delivery-projects/[deliveryProjectId]'], 'Project requirements workspace', 'core.projects', 'Project repositories, requirements, QA and create-repository entry.', Object.fromEntries(roles.map(r => [r, persona.canCreateRepository(r) ? 'View; add repository when project/Feature conditions pass; role-specific QA actions below.' : persona.canManageRequirements(r) ? 'View; manage requirements; no create-repository control.' : 'View; QA/test actions as permitted; no repository creation.'])), note, ['apps/web/src/features/groups/delivery-project/view-models/use-delivery-project-view-model.ts']);
pages(['/groups/[groupId]/repositories/[repositoryId]'], 'Group repository', 'core.repositories', 'Repository details within the group scope.', allRead, 'Group/repository access; project work uses the detailed tab rules.');
pages(['/activity', '/groups/[groupId]/activity'], 'Team activity', 'identity.hierarchy', 'Team activity feed; sidebar and Home activity entry are currently hidden.', { lead: 'Direct route: team member Product owner may read.', qa: 'Hidden in sidebar; feed denied for QA.', member: 'Hidden in sidebar; feed denied for Developer.', admin: 'Direct route: platform admin may read permitted team feed.' }, 'SIDEBAR_SHOWS_ACTIVITY=false. A hidden navigation entry does not remove the route.', [files.nav]);
pages(['/checklists'], 'Legacy team checklists', 'projects.qa-checklists', 'Earlier team checklist templates; project requirements live on the Project.', allRead, 'SIDEBAR_SHOWS_CHECKLISTS=false; route remains. Editing follows returned checklist/team permissions.', [files.nav]);
pages(['/hosts'], 'Managed host inventory', 'runtime.managed-host-delivery', 'Machines, enrollment code/installer, connection status and host controls.', Object.fromEntries(roles.map(r => [r, hostRules.canManageHosts(r, 'member') ? 'View; add/manage only with non-viewer workspace membership.' : 'View hosts; add/manage controls hidden.'])), 'Requires managed-host capability, provider availability and workspace access; disabled composition shows unavailable state.', [files.hosts, 'apps/web/src/features/hosts/views/hosts-page.tsx']);
pages(['/settings'], 'Account and workspace settings', 'core.settings', 'Account/preferences and read-only workspace member list; Enterprise policy summary where enabled.', Object.fromEntries(roles.map(r => [r, 'Own settings; workspace member list is read-only. Team membership edits live on Teams.'])), 'Client policy card is Enterprise-only and read-only; ordinary account settings are shared.', ['apps/web/src/features/settings/account/view-models/use-workspace-members-view-model.ts']);
pages(['/admin', '/admin/users/[id]', '/admin/feedback'], 'Platform administration', 'core.admin', 'User review, user detail and feedback administration.', { lead: 'Privileged admin surface; Product owner role alone is insufficient.', qa: 'Privileged admin surface; QA role alone is insufficient.', member: 'Privileged admin surface; Developer role alone is insufficient.', admin: 'Admin controls require platform-admin authorization, not just a client-selected role.' }, 'Platform-admin authorization is independent of pack and workspace role.');

const tabContent = {
  overview: ['Overview', 'core.projects', 'Project summary, returned QA work and Developer read-only production readiness.'],
  code: ['Code', 'core.repositories', 'File browser and branches; branch creation for allowed roles.'],
  commits: ['Commits', 'core.repositories', 'Read commits and branches; listing visibility differs by role.'],
  pulls: ['Pull requests', 'core.repositories', 'Compare branches, open and merge permitted routes; generic production merge forbidden.'],
  checklists: ['Requirements / Checklists', 'projects.qa-checklists', 'Features, stories, system requirements, Progress, test cases and QA workspace.'],
  pipeline: ['Pipeline', 'pipelines.ci-run-tracking', 'Runs and Configuration views; preview/validate settings and request workflow PR where permitted.'],
  hosting: ['Hosting', 'runtime.env-provisioning', 'Environment cards, provider targets, variables, domains, promotion and host assignments.'],
  qa: ['QA Studio', 'projects.qa-checklists', 'UAT preview, test results, defects, evidence, automation and sign-off.'],
  po: ['PO Studio', 'projects.qa-checklists', 'UAT acceptance, production readiness and governed merge controls.'],
  audit: ['Audit', 'platform.audit-events', 'Read project audit trail.'],
  history: ['History', 'projects.qa-checklists', 'Iteration and release history; read-only history does not grant delivery actions.'],
  settings: ['Project settings', 'core.projects', 'Project settings and lifecycle controls, subject to individual action permissions.'],
};
for (const tab of tabRules.PROJECT_DETAIL_TABS) {
  const [title, owner, contains] = tabContent[tab];
  const actions = Object.fromEntries(roles.map(r => [r, tabRules.visibleProjectDetailTabs(r, { qaChecklistsEnabled: true }).includes(tab) ? 'Visible. ' + (tab === 'hosting' ? 'Developer/admin manage hosting and variables; other release actions remain separately checked.' : tab === 'settings' ? (persona.canManageProjectLifecycle(r) ? 'Lifecycle controls allowed subject to checks.' : 'Lifecycle controls hidden.') : tab === 'code' ? (persona.canCreateWorkspaceBranch(r) ? 'Create branch from dev when server permits.' : 'Read-only.') : tab === 'qa' ? 'QA controls follow returned run permissions and workflow state.' : tab === 'po' ? 'Acceptance/merge actions require governance and server permission.' : 'Actions follow the separate action rows.') : 'Hidden tab; a deep link resolves to a permitted tab.']));
  add('tab:' + tab, title + ' tab', ['/projects/[projectId]#' + tab], [owner], contains, actions, ['checklists', 'qa', 'po', 'history'].includes(tab) ? 'Tab requires QA checklists enabled. Governance gates acceptance/merge writes separately, not the whole PO tab.' : note, [files.tabs]);
}
function action(id, title, route, owner, rule, allowed, denied, condition, evidence, backend) {
  add('action:' + id, title, [route], [owner], title, Object.fromEntries(roles.map(r => [r, rule(r) ? allowed : denied])), condition, evidence, backend);
}
const project = '/projects/[projectId]';
action('requirements', 'Create/edit requirements', project + '#checklists', 'projects.qa-checklists', persona.canManageRequirements, 'Editable: create/edit Features, User stories and system requirements.', 'Read-only requirements; authoring controls unavailable.', 'Current iteration and project rights; server returned permissions remain authoritative.', [files.persona]);
action('progress', 'Developer Progress / request retest', project + '#checklists', 'projects.qa-checklists', qa.canRequestRetest, 'Set Progress / request retest when item permits.', 'No Progress write; QA verifies instead.', 'Item ownership/scope, row version and workflow state.', [files.qa]);
action('test-cases', 'Author test cases and record test results', project + '#checklists', 'projects.qa-checklists', qa.canManageTestCases, 'Editable test cases/results in the permitted QA surface.', 'Read-only test cases/results.', 'QA/admin; current run and test-case permissions.', [files.qa]);
action('qa-verification', 'Verification, evidence, automation and sign-off', project + '#qa', 'projects.qa-checklists', r => tabRules.canOpenQaStudio(r), 'QA Studio visible; controls enabled only when run permits.', 'QA Studio hidden; see backend distinction in details.', 'UAT head freshness, active run, evidence, version checks and sign-off preconditions.', [files.tabs, files.qa], 'Backend allows qa/lead/admin for create run, verification, automation, evidence and sign-off. Frontend QA Studio is qa/admin only; these are distinct rules.');
action('acceptance', 'Accept QA items / merge to production', project + '#po', 'projects.release-governance', qa.canAcceptRunItems, 'PO acceptance and governed merge offered; disabled/blocked until checks pass.', 'Acceptance and governed production merge unavailable.', 'Governance and QA enabled; latest approved QA run, accepted items and unchanged UAT heads; generic PR merge to main is forbidden for every role.', [files.qa, 'apps/web/src/features/checklists/studio/view-models/use-po-acceptance-view-model.ts', 'apps/web/src/features/checklists/studio/view-models/use-qa-promotion-view-model.ts']);
action('next-iteration', 'Start next iteration', project + '#checklists', 'projects.release-governance', r => r === 'lead' || r === 'admin', 'Start next iteration offered when prior iteration delivered.', 'Start control unavailable; waiting/read-only state.', 'Governance enabled, prior iteration delivered and current server preconditions.', ['apps/web/src/features/checklists/iteration/view-models/use-start-iteration-view-model.ts', files.qa]);
action('hosting-config', 'Manage hosting, variables, domains and CI secrets', project + '#hosting', 'runtime.env-provisioning', persona.canManageHosting, 'Hosting controls and Variables column available when provider/config permits.', 'Hosting mutation controls hidden; Hosting tab itself is hidden for Product owner/QA.', 'Provisioning enabled; provider credentials, resource access and separate host-delivery capability where relevant.', [files.persona, files.tabs]);
action('release-promotion', 'Promote an environment release', project + '#hosting', 'runtime.env-provisioning', r => r === 'member' || r === 'admin', 'Hosting surface visible; Developer can promote non-production only; admin may promote production subject to checks.', 'Hosting tab hidden; API rights do not automatically create a frontend control.', 'Ordered environments, pinned signed release, destination readiness; managed-host capability for host delivery.', [files.tabs, files.release], 'Backend canPromoteRelease: lead/admin may promote production or non-production; member only non-production; QA neither. Frontend Hosting tab is member/admin only. This is separate from governed uat-to-main code merge.');
action('pull-request', 'Create/merge repository pull requests', project + '#pulls', 'core.repositories', r => tabRules.projectDetailTabsForRole(r).has('pulls'), 'Developer: feature→dev or dev→uat. Admin: any permitted non-main route.', 'Pull requests tab hidden for Product owner/QA.', 'No role may create/merge main through generic endpoints; production uses governed promotion.', [files.persona, files.tabs], 'Backend also allows lead on non-production PR routes, although the Product owner frontend hides this tab. QA is denied.');
add('card:client-policy', 'Enterprise client-policy summary', ['/settings'], ['runtime.client-composition'], 'Deployment client, edition and excluded capability list; read-only summary.', Object.fromEntries(roles.map(r => [r, 'Read-only where capability response supplies the card; no policy editor.'])), 'Enterprise + active client composition. Changing policy requires deployment configuration and restart.', ['apps/web/src/features/settings/client-composition/views/enterprise-client-composition-settings-view.tsx']);

assert.deepEqual([...new Set(front.filter(r => r.id.startsWith('page:')).flatMap(r => r.routes))].sort(), routeRows.map(r => r.route).sort(), 'Every current page must be mapped');
assert.equal(front.filter(r => r.id.startsWith('tab:')).length, tabRules.PROJECT_DETAIL_TABS.length);
for (const row of front) {
  assert.deepEqual(Object.keys(row.actions).sort(), [...roles].sort(), row.id);
  for (const evidence of row.evidence) assert.ok(fs.existsSync(path.join(root, evidence)), evidence);
}
module.exports = { frontend: front, roleLabels, routeCount: routeRows.length, tabCount: tabRules.PROJECT_DETAIL_TABS.length };
