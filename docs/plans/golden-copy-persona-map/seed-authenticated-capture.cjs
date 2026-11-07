'use strict';

const { Client } = require('pg');

const QUICK_LOGIN_GITHUB_ID = 'alphaci-local-dev-quick-login';
const WORKSPACE_ID = '91000000-0000-4000-8000-000000000001';
const SYSTEM_ID = '98000000-0000-4000-8000-000000000001';
const DELIVERY_PROJECT_ID = '98100000-0000-4000-8000-000000000001';
const REPOSITORY_ID = '98200000-0000-4000-8000-000000000001';
const ITERATION_ID = '97700000-0000-4000-8000-000000000001';
const CHECKLIST_ID = '96000000-0000-4000-8000-000000000001';
const CHECKLIST_ITEM_IDS = [
  '96100000-0000-4000-8000-000000000001',
  '96100000-0000-4000-8000-000000000002',
  '96100000-0000-4000-8000-000000000003',
];
const TEST_CATEGORY_IDS = [
  '96200000-0000-4000-8000-000000000001',
  '96200000-0000-4000-8000-000000000002',
  '96200000-0000-4000-8000-000000000003',
];
const TEST_CASE_IDS = Array.from({ length: 6 }, (_, index) =>
  `96300000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const QA_RUN_ID = '97000000-0000-4000-8000-000000000001';
const PROJECT_QA_RUN_ID = '97600000-0000-4000-8000-000000000001';
const PROJECT_QA_RUN_ITEM_ID = '97600000-0000-4000-8000-000000000002';
const REQUIREMENT_ID = '97400000-0000-4000-8000-000000000001';
const REQUIREMENT_ITEM_ID = '97500000-0000-4000-8000-000000000001';
const QA_RUN_ITEM_IDS = [
  '97100000-0000-4000-8000-000000000001',
  '97100000-0000-4000-8000-000000000002',
  '97100000-0000-4000-8000-000000000003',
];
const QA_RUN_TEST_CASE_IDS = Array.from({ length: 6 }, (_, index) =>
  `97200000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const PROJECTS = [
  {
    id: '92000000-0000-4000-8000-000000000001',
    repo: 'alphaci-demo/platform-console',
    name: 'Platform Console',
    service: 'console-api',
    template: 'nestjs',
  },
  {
    id: '92000000-0000-4000-8000-000000000002',
    repo: 'alphaci-demo/workflow-automation',
    name: 'Workflow Automation',
    service: 'workflow-api',
    template: 'nestjs',
  },
  {
    id: '92000000-0000-4000-8000-000000000003',
    repo: 'alphaci-demo/learning-portal',
    name: 'Learning Portal',
    service: 'portal-api',
    template: 'nextjs',
  },
];

const SAMPLE_MEMBERS = [
  {
    id: '93000000-0000-4000-8000-000000000001',
    githubUserId: 'alphaci-screenshot-lead',
    login: 'avery-lead',
    name: 'Avery Chen',
    email: 'avery-lead@example.invalid',
    appRole: 'lead',
    workspaceRole: 'admin',
  },
  {
    id: '93000000-0000-4000-8000-000000000002',
    githubUserId: 'alphaci-screenshot-qa',
    login: 'riley-qa',
    name: 'Riley Santos',
    email: 'riley-qa@example.invalid',
    appRole: 'qa',
    workspaceRole: 'member',
  },
  {
    id: '93000000-0000-4000-8000-000000000003',
    githubUserId: 'alphaci-screenshot-developer',
    login: 'jordan-dev',
    name: 'Jordan Lee',
    email: 'jordan-dev@example.invalid',
    appRole: 'member',
    workspaceRole: 'member',
  },
  {
    id: '93000000-0000-4000-8000-000000000004',
    githubUserId: 'alphaci-screenshot-viewer',
    login: 'casey-viewer',
    name: 'Casey Morgan',
    email: 'casey-viewer@example.invalid',
    appRole: 'member',
    workspaceRole: 'viewer',
  },
];

function assertDisposableDatabase(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL is required for seeding.');
  const url = new URL(connectionString);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('Screenshot seeding only permits a loopback database.');
  }
  if (url.port !== '55432' || url.pathname !== '/alphaci_migration_test') {
    throw new Error('Screenshot seeding requires the disposable port 55432 fixture database.');
  }
}

async function seedAuthenticatedCapture(connectionString) {
  assertDisposableDatabase(connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT id FROM identity.app_users WHERE github_user_id = $1',
      [QUICK_LOGIN_GITHUB_ID],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      throw new Error('Run local dev quick login before seeding screenshot data.');
    }

    await client.query(
      `UPDATE identity.app_users
          SET app_role = 'admin', display_name = 'Morgan Rivera',
              email = 'morgan-admin@example.invalid', updated_at = now()
        WHERE id = $1`,
      [userId],
    );
    await client.query(
      `INSERT INTO identity.platform_admins (user_id, role)
       VALUES ($1, 'admin')
       ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`,
      [userId],
    );

    const memberIds = [];
    for (const member of SAMPLE_MEMBERS) {
      const result = await client.query(
        `INSERT INTO identity.app_users
           (id, github_user_id, login, display_name, email, provider, app_role)
         VALUES ($1, $2, $3, $4, $5, 'github', $6)
         ON CONFLICT (github_user_id) DO UPDATE SET
           login = EXCLUDED.login,
           display_name = EXCLUDED.display_name,
           email = EXCLUDED.email,
           app_role = EXCLUDED.app_role,
           updated_at = now()
         RETURNING id`,
        [member.id, member.githubUserId, member.login, member.name, member.email, member.appRole],
      );
      memberIds.push({ ...member, id: result.rows[0].id });
    }

    await client.query(
      `INSERT INTO orgs.workspaces (id, owner_user_id, name, kind)
       VALUES ($1, $2, 'AlphaCI Demo Workspace', 'team')
       ON CONFLICT (id) DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         name = EXCLUDED.name,
         kind = EXCLUDED.kind,
         updated_at = now()`,
      [WORKSPACE_ID, userId],
    );

    const memberships = [
      { id: userId, role: 'admin' },
      ...memberIds.map(({ id, workspaceRole }) => ({ id, role: workspaceRole })),
    ];
    for (const member of memberships) {
      await client.query(
        `INSERT INTO orgs.workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [WORKSPACE_ID, member.id, member.role],
      );
    }

    for (const [index, project] of PROJECTS.entries()) {
      await client.query(
        `INSERT INTO projects.provisioned_projects
           (id, user_id, workspace_id, repo_full_name, template_id,
            service_name, workflow_path, status, provisioned_at,
            owner_login, repo_name, github_repository_url, visibility,
            repo_shape, project_type_id, workflow_template_id, project_options)
         VALUES ($1, $2, $3, $4, $5, $6, '.github/workflows/ci.yml',
                 'provisioned', now() - ($7 * interval '1 day'),
                 'alphaci-demo', $8, $9, 'private', 'single', $5, $5, '{}'::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           workspace_id = EXCLUDED.workspace_id,
           repo_full_name = EXCLUDED.repo_full_name,
           template_id = EXCLUDED.template_id,
           service_name = EXCLUDED.service_name,
           workflow_path = EXCLUDED.workflow_path,
           status = EXCLUDED.status,
           provisioned_at = EXCLUDED.provisioned_at,
           owner_login = EXCLUDED.owner_login,
           repo_name = EXCLUDED.repo_name,
           github_repository_url = EXCLUDED.github_repository_url,
           visibility = EXCLUDED.visibility,
           repo_shape = EXCLUDED.repo_shape,
           project_type_id = EXCLUDED.project_type_id,
           workflow_template_id = EXCLUDED.workflow_template_id,
           project_options = EXCLUDED.project_options,
           updated_at = now()`,
        [
          project.id,
          userId,
          WORKSPACE_ID,
          project.repo,
          project.template,
          project.service,
          index + 1,
          project.repo.split('/')[1],
          `https://github.com/${project.repo}`,
        ],
      );

      await client.query(
        `INSERT INTO projects.project_environments
           (project_id, slug, display_name, position, source_branch, role, auto_deploy)
         VALUES ($1, 'development', 'Development', 0, 'develop', 'non_production', true),
                ($1, 'production', 'Production', 1, 'main', 'production', false)
         ON CONFLICT (project_id, slug) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           position = EXCLUDED.position,
           source_branch = EXCLUDED.source_branch,
           role = EXCLUDED.role,
           auto_deploy = EXCLUDED.auto_deploy,
           updated_at = now()`,
        [project.id],
      );
    }

    await client.query(
      `INSERT INTO hierarchy.systems (id, group_id, name, description, owner_id, status)
       VALUES ($1, $2, 'AlphaCI Platform', 'Product delivery systems for the demo workspace.', $3, 'active')
       ON CONFLICT (id) DO UPDATE SET
         group_id = EXCLUDED.group_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         owner_id = EXCLUDED.owner_id,
         status = EXCLUDED.status,
         updated_at = now()`,
      [SYSTEM_ID, WORKSPACE_ID, userId],
    );
    await client.query(
      `INSERT INTO hierarchy.delivery_projects
         (id, system_id, group_id, name, description, manager_id, status)
       VALUES ($1, $2, $3, 'Platform Console', 'Workspace for the sample product and delivery workflow.', $4, 'active')
       ON CONFLICT (id) DO UPDATE SET
         system_id = EXCLUDED.system_id,
         group_id = EXCLUDED.group_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         manager_id = EXCLUDED.manager_id,
         status = EXCLUDED.status,
         updated_at = now()`,
      [DELIVERY_PROJECT_ID, SYSTEM_ID, WORKSPACE_ID, userId],
    );
    const iterationResult = await client.query(
      `INSERT INTO projects.project_iterations
         (id, delivery_project_id, number, goal, status, started_by, started_by_login)
       VALUES ($1, $2, 1, 'Verify the sample project before release.', 'active', $3, 'alphaci-local-dev')
       ON CONFLICT (delivery_project_id, number) DO UPDATE SET
         goal = EXCLUDED.goal,
         status = EXCLUDED.status,
         started_by = EXCLUDED.started_by,
         started_by_login = EXCLUDED.started_by_login
       RETURNING id`,
      [ITERATION_ID, DELIVERY_PROJECT_ID, userId],
    );
    const iterationId = iterationResult.rows[0].id;
    await client.query(
      `INSERT INTO hierarchy.repositories
         (id, delivery_project_id, group_id, name, repo_full_name,
          visibility, created_by, status, provisioned_project_id)
       VALUES ($1, $2, $3, 'platform-console', $4, 'private', $5, 'active', $6)
       ON CONFLICT (id) DO UPDATE SET
         delivery_project_id = EXCLUDED.delivery_project_id,
         group_id = EXCLUDED.group_id,
         name = EXCLUDED.name,
         repo_full_name = EXCLUDED.repo_full_name,
         visibility = EXCLUDED.visibility,
         created_by = EXCLUDED.created_by,
         status = EXCLUDED.status,
         provisioned_project_id = EXCLUDED.provisioned_project_id,
         updated_at = now()`,
      [REPOSITORY_ID, DELIVERY_PROJECT_ID, WORKSPACE_ID, PROJECTS[0].repo, userId, PROJECTS[0].id],
    );

    await client.query(
      `INSERT INTO projects.qa_checklists
         (id, workspace_id, name, description, version, created_by, updated_by)
       VALUES ($1, $2, 'Platform Readiness Checklist', 'Release and user acceptance checks for the sample application.', 1, $3, $3)
       ON CONFLICT (id) DO UPDATE SET
         workspace_id = EXCLUDED.workspace_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         version = EXCLUDED.version,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [CHECKLIST_ID, WORKSPACE_ID, userId],
    );
    const checklistItems = [
      { title: 'Verify workspace sign-in and role access', target: 'all', type: 'manual' },
      { title: 'Confirm project summary and repository details', target: 'developer', type: 'playwright' },
      { title: 'Review quality checks before production', target: 'qa', type: 'manual' },
    ];
    for (const [index, item] of checklistItems.entries()) {
      await client.query(
        `INSERT INTO projects.qa_checklist_items
           (id, checklist_id, "position", title, description, target_persona, verification_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           checklist_id = EXCLUDED.checklist_id,
           "position" = EXCLUDED."position",
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           target_persona = EXCLUDED.target_persona,
           verification_type = EXCLUDED.verification_type`,
        [CHECKLIST_ITEM_IDS[index], CHECKLIST_ID, index, item.title, `Sample evidence for ${item.title.toLowerCase()}.`, item.target, item.type],
      );
    }
    await client.query(
      `INSERT INTO projects.qa_checklist_projects (checklist_id, project_id, shared_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (checklist_id, project_id) DO UPDATE SET shared_by = EXCLUDED.shared_by`,
      [CHECKLIST_ID, PROJECTS[0].id, userId],
    );
    await client.query(
      `INSERT INTO projects.qa_checklists
         (id, workspace_id, name, description, version, created_by, updated_by,
          kind, delivery_project_id, iteration_id)
       VALUES ($1, $2, 'Platform Console Release Requirement',
               'Project-owned acceptance requirement for the screenshot fixture.',
               1, $3, $3, 'functional', $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         workspace_id = EXCLUDED.workspace_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         kind = EXCLUDED.kind,
         delivery_project_id = EXCLUDED.delivery_project_id,
         iteration_id = EXCLUDED.iteration_id,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()` ,
      [REQUIREMENT_ID, WORKSPACE_ID, userId, DELIVERY_PROJECT_ID, iterationId],
    );
    await client.query(
      `INSERT INTO projects.qa_checklist_items
         (id, checklist_id, "position", title, description, target_persona,
          verification_type, acceptance_criteria, progress, progress_by,
          progress_by_login, progress_at)
       VALUES ($1, $2, 0, 'Workspace members can review release readiness',
               'The release page shows project health and QA evidence.', 'all',
               'manual', 'A workspace member can open the project and review its QA report.',
               'done', $3, 'alphaci-local-dev', now() - interval '15 minutes')
       ON CONFLICT (id) DO UPDATE SET
         checklist_id = EXCLUDED.checklist_id,
         "position" = EXCLUDED."position",
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         target_persona = EXCLUDED.target_persona,
         verification_type = EXCLUDED.verification_type,
         acceptance_criteria = EXCLUDED.acceptance_criteria,
         progress = EXCLUDED.progress,
         progress_by = EXCLUDED.progress_by,
         progress_by_login = EXCLUDED.progress_by_login,
         progress_at = EXCLUDED.progress_at` ,
      [REQUIREMENT_ITEM_ID, REQUIREMENT_ID, userId],
    );
    await client.query(
      `INSERT INTO projects.qa_verification_runs
         (id, project_id, checklist_id, checklist_version, checklist_name,
          branch, commit_sha, commit_source, status, created_by, created_by_login)
       VALUES ($1, $2, $3, 1, 'Platform Readiness Checklist', 'main', $4,
               'branch_head', 'open', $5, 'alphaci-local-dev')
       ON CONFLICT (id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         checklist_id = EXCLUDED.checklist_id,
         checklist_version = EXCLUDED.checklist_version,
         checklist_name = EXCLUDED.checklist_name,
         branch = EXCLUDED.branch,
         commit_sha = EXCLUDED.commit_sha,
         commit_source = EXCLUDED.commit_source,
         status = EXCLUDED.status,
         created_by = EXCLUDED.created_by,
         created_by_login = EXCLUDED.created_by_login,
         updated_at = now()`,
      [QA_RUN_ID, PROJECTS[0].id, CHECKLIST_ID, 'b'.repeat(40), userId],
    );
    await client.query(
      `INSERT INTO projects.qa_verification_runs
         (id, scope, delivery_project_id, iteration_id, heads_fingerprint,
          project_id, checklist_id, checklist_version, checklist_name,
          branch, commit_sha, commit_source, status, created_by, created_by_login)
       VALUES ($1, 'project', $2, $3, $4, NULL, NULL, 0,
               'Platform Console Requirement Verification', 'uat', NULL,
               'branch_head', 'open', $5, 'alphaci-local-dev')
       ON CONFLICT (id) DO UPDATE SET
         delivery_project_id = EXCLUDED.delivery_project_id,
         iteration_id = EXCLUDED.iteration_id,
         heads_fingerprint = EXCLUDED.heads_fingerprint,
         checklist_name = EXCLUDED.checklist_name,
         branch = EXCLUDED.branch,
         status = EXCLUDED.status,
         created_by = EXCLUDED.created_by,
         created_by_login = EXCLUDED.created_by_login,
         updated_at = now()` ,
      [PROJECT_QA_RUN_ID, DELIVERY_PROJECT_ID, iterationId, 'd'.repeat(64), userId],
    );
    await client.query(
      `INSERT INTO projects.qa_run_repositories (run_id, project_id, repo_full_name, head_sha)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (run_id, project_id) DO UPDATE SET
         repo_full_name = EXCLUDED.repo_full_name,
         head_sha = EXCLUDED.head_sha` ,
      [PROJECT_QA_RUN_ID, PROJECTS[0].id, PROJECTS[0].repo, 'c'.repeat(40)],
    );
    await client.query(
      `INSERT INTO projects.qa_run_items
         (id, run_id, source_item_id, prior_run_item_id, "position", title,
          description, target_persona, verification_type, test_identifier,
          requirement_id, requirement_name, requirement_kind, acceptance_criteria,
          status, notes, defect_severity, reproduction_steps, verified_by,
          verified_by_login, verified_at)
       VALUES ($1, $2, $3, NULL, 0,
               'Workspace members can review release readiness',
               'The release page shows project health and QA evidence.', 'all',
               'manual', NULL, $4, 'Platform Console Release Requirement',
               'functional', 'A workspace member can open the project and review its QA report.',
               'failed', 'The fixture includes a returned quality issue for the report view.',
               'major', 'Open the release page, then compare the displayed QA evidence.',
               $5, 'alphaci-local-dev', now() - interval '10 minutes')
       ON CONFLICT (id) DO UPDATE SET
         run_id = EXCLUDED.run_id,
         source_item_id = EXCLUDED.source_item_id,
         "position" = EXCLUDED."position",
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         requirement_id = EXCLUDED.requirement_id,
         requirement_name = EXCLUDED.requirement_name,
         requirement_kind = EXCLUDED.requirement_kind,
         acceptance_criteria = EXCLUDED.acceptance_criteria,
         status = EXCLUDED.status,
         notes = EXCLUDED.notes,
         defect_severity = EXCLUDED.defect_severity,
         reproduction_steps = EXCLUDED.reproduction_steps,
         verified_by = EXCLUDED.verified_by,
         verified_by_login = EXCLUDED.verified_by_login,
         verified_at = EXCLUDED.verified_at,
         updated_at = now()` ,
      [PROJECT_QA_RUN_ITEM_ID, PROJECT_QA_RUN_ID, REQUIREMENT_ITEM_ID, REQUIREMENT_ID, memberIds[1].id],
    );
    const qaStates = [
      { status: 'passed', verifier: memberIds[1], severity: null, fix: null },
      { status: 'in_progress', verifier: null, severity: null, fix: null },
      { status: 'failed', verifier: memberIds[1], severity: 'major', fix: 'Update the production checklist after the quality gate is repaired.' },
    ];
    for (const [index, state] of qaStates.entries()) {
      await client.query(
        `INSERT INTO projects.qa_run_items
           (id, run_id, source_item_id, "position", title, description,
            target_persona, verification_type, status, defect_severity,
            reproduction_steps, fix_note, verified_by, verified_by_login, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 CASE WHEN $13::uuid IS NULL THEN NULL ELSE now() - interval '20 minutes' END)
         ON CONFLICT (id) DO UPDATE SET
           run_id = EXCLUDED.run_id,
           source_item_id = EXCLUDED.source_item_id,
           "position" = EXCLUDED."position",
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           target_persona = EXCLUDED.target_persona,
           verification_type = EXCLUDED.verification_type,
           status = EXCLUDED.status,
           defect_severity = EXCLUDED.defect_severity,
           reproduction_steps = EXCLUDED.reproduction_steps,
           fix_note = EXCLUDED.fix_note,
           verified_by = EXCLUDED.verified_by,
           verified_by_login = EXCLUDED.verified_by_login,
           verified_at = EXCLUDED.verified_at,
           updated_at = now()`,
        [
          QA_RUN_ITEM_IDS[index], QA_RUN_ID, CHECKLIST_ITEM_IDS[index], index,
          checklistItems[index].title, `Sample evidence for ${checklistItems[index].title.toLowerCase()}.`,
          checklistItems[index].target, checklistItems[index].type, state.status,
          state.severity, state.severity ? 'Run the sample flow, then inspect the failing quality check.' : null,
          state.fix, state.verifier?.id ?? null, state.verifier?.login ?? null,
        ],
      );
    }
    const testCaseRows = [
      { category: 0, title: 'Member reaches the project overview', result: 'Project overview loads for a workspace member.', status: 'passed' },
      { category: 0, title: 'Unauthorized action remains unavailable', result: 'Restricted actions stay hidden or denied.', status: 'passed' },
      { category: 1, title: 'Repository details match the workspace', result: 'Repository name and link are correct.', status: 'passed' },
      { category: 1, title: 'Branch history is visible', result: 'Recent branch history renders for the project.', status: 'pending' },
      { category: 2, title: 'Quality gate passes on main', result: 'All configured checks complete successfully.', status: 'failed' },
      { category: 2, title: 'Production release follows approval', result: 'Release action is available after required approval.', status: 'pending' },
    ];
    const runCaseSnapshots = [];
    for (const [index, testCase] of testCaseRows.entries()) {
      const categoryIndex = testCase.category;
      if (index === categoryIndex * 2) {
        await client.query(
          `INSERT INTO projects.qa_test_case_categories
             (id, item_id, "position", name, created_by)
           VALUES ($1, $2, 0, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             item_id = EXCLUDED.item_id,
             name = EXCLUDED.name,
             updated_at = now()`,
          [TEST_CATEGORY_IDS[categoryIndex], CHECKLIST_ITEM_IDS[categoryIndex], ['Access', 'Repository', 'Quality'][categoryIndex], userId],
        );
      }
      await client.query(
        `INSERT INTO projects.qa_test_cases
           (id, category_id, "position", title, expected_result, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           "position" = EXCLUDED."position",
           title = EXCLUDED.title,
           expected_result = EXCLUDED.expected_result,
           updated_at = now()`,
        [TEST_CASE_IDS[index], TEST_CATEGORY_IDS[categoryIndex], index % 2, testCase.title, testCase.result, userId],
      );
      runCaseSnapshots.push({ ...testCase, id: TEST_CASE_IDS[index], categoryId: TEST_CATEGORY_IDS[categoryIndex], categoryName: ['Access', 'Repository', 'Quality'][categoryIndex] });
    }
    for (const [index, snapshot] of runCaseSnapshots.entries()) {
      const runItemIndex = Math.floor(index / 2);
      const verified = snapshot.status !== 'pending';
      await client.query(
        `INSERT INTO projects.qa_run_test_cases
           (id, run_id, run_item_id, source_test_case_id, source_category_id,
            category_name, category_position, "position", title, expected_result,
            status, notes, verified_by, verified_by_login, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, CASE WHEN $13::uuid IS NULL THEN NULL ELSE now() - interval '15 minutes' END)
         ON CONFLICT (id) DO UPDATE SET
           run_id = EXCLUDED.run_id,
           run_item_id = EXCLUDED.run_item_id,
           source_test_case_id = EXCLUDED.source_test_case_id,
           source_category_id = EXCLUDED.source_category_id,
           category_name = EXCLUDED.category_name,
           category_position = EXCLUDED.category_position,
           "position" = EXCLUDED."position",
           title = EXCLUDED.title,
           expected_result = EXCLUDED.expected_result,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           verified_by = EXCLUDED.verified_by,
           verified_by_login = EXCLUDED.verified_by_login,
           verified_at = EXCLUDED.verified_at,
           updated_at = now()`,
        [
          QA_RUN_TEST_CASE_IDS[index], QA_RUN_ID, QA_RUN_ITEM_IDS[runItemIndex],
          snapshot.id, snapshot.categoryId, snapshot.categoryName, snapshot.category,
          index % 2, snapshot.title, snapshot.result, snapshot.status,
          snapshot.status === 'failed' ? 'The fixture demonstrates a returned quality failure.' : null,
          verified ? memberIds[1].id : null,
          verified ? memberIds[1].login : null,
        ],
      );
    }

    const primaryProject = PROJECTS[0];
    const runs = [
      { id: 7821, branch: 'main', day: 0, statuses: ['success', 'success', 'success'] },
      { id: 7814, branch: 'develop', day: 1, statuses: ['success', 'running', 'running'] },
      { id: 7798, branch: 'main', day: 3, statuses: ['success', 'failure', 'cancelled'] },
    ];
    const stages = ['access', 'quality', 'package'];
    for (const run of runs) {
      for (const [index, stage] of stages.entries()) {
        const stageStatus = run.statuses[index];
        const friendlyMessage = {
          severity: stageStatus === 'success' ? 'success' : stageStatus === 'failure' ? 'error' : 'info',
          title: `${stage[0].toUpperCase()}${stage.slice(1)} checks ${stageStatus}`,
          detail: `${stageStatus === 'success' ? 12 : 9} of 12 sample checks reported for ${stage}.`,
          hint: stageStatus === 'success' ? 'No action is needed.' : 'Open the CI run details to review the checks.',
        };
        await client.query(
          `INSERT INTO workflow.ci_run_reports
             (user_id, repo_full_name, branch, commit_sha, run_id, stage,
              status, results, friendly_messages, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb,
                   now() - ($10 * interval '1 day'), now() - ($10 * interval '1 day'))
           ON CONFLICT (repo_full_name, run_id, stage) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             branch = EXCLUDED.branch,
             commit_sha = EXCLUDED.commit_sha,
             status = EXCLUDED.status,
             results = EXCLUDED.results,
             friendly_messages = EXCLUDED.friendly_messages,
             updated_at = EXCLUDED.updated_at`,
          [
            userId,
            primaryProject.repo,
            run.branch,
            (Number(run.id) * 13 + index).toString(16).padStart(40, 'a'),
            run.id,
            stage,
            run.statuses[index],
            JSON.stringify({ passed: run.statuses[index] === 'success' ? 12 : 9, total: 12 }),
            JSON.stringify([friendlyMessage]),
            run.day,
          ],
        );
      }
    }

    const activity = [
      ['project.created', 'Created the Platform Console project.'],
      ['pipeline.completed', 'Production pipeline completed successfully.'],
      ['workspace.member_added', 'Added Riley Santos to the QA team.'],
    ];
    for (const [index, [eventCode, message]] of activity.entries()) {
      await client.query(
        `INSERT INTO audit.audit_events
           (id, workspace_id, project_id, actor_user_id, event_code, message, metadata_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now() - ($8 * interval '1 hour'))
         ON CONFLICT (id) DO UPDATE SET
           event_code = EXCLUDED.event_code,
           message = EXCLUDED.message,
           metadata_json = EXCLUDED.metadata_json,
           created_at = EXCLUDED.created_at`,
        [
          `94000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          WORKSPACE_ID,
          primaryProject.id,
          userId,
          eventCode,
          message,
          JSON.stringify({ source: 'local screenshot fixture' }),
          index * 3,
        ],
      );
    }

    const notifications = [
      ['Project activity', 'Platform Console has a new successful production run.', 1],
      ['Workspace update', 'Riley Santos joined AlphaCI Demo Workspace.', 8],
      ['QA attention', 'A failed quality check needs review in Platform Console.', 26],
    ];
    for (const [index, [title, body, hoursAgo]] of notifications.entries()) {
      await client.query(
        `INSERT INTO notifications.notifications
           (id, user_id, project_id, event_code, title, body, read_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() - ($8 * interval '1 hour'))
         ON CONFLICT (id) DO UPDATE SET
           event_code = EXCLUDED.event_code,
           title = EXCLUDED.title,
           body = EXCLUDED.body,
           read_at = EXCLUDED.read_at,
           created_at = EXCLUDED.created_at`,
        [
          `95000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          userId,
          primaryProject.id,
          'screenshot.sample',
          title,
          body,
          index === 0 ? null : new Date(Date.now() - hoursAgo * 3_600_000),
          hoursAgo,
        ],
      );
    }

    await client.query('COMMIT');
    return {
      login: 'alphaci-local-dev',
      role: 'admin',
      platformRole: 'admin',
      workspace: { id: WORKSPACE_ID, name: 'AlphaCI Demo Workspace' },
      system: { id: SYSTEM_ID, name: 'AlphaCI Platform' },
      deliveryProject: { id: DELIVERY_PROJECT_ID, name: 'Platform Console' },
      repository: { id: REPOSITORY_ID, name: 'platform-console', repoFullName: PROJECTS[0].repo },
      members: memberIds.map(({ id, login, appRole, workspaceRole }) => ({ id, login, appRole, workspaceRole })),
      projects: PROJECTS,
      runs: runs.map(({ id, branch }) => ({ id, branch })),
      qaRun: { id: QA_RUN_ID, checklistId: CHECKLIST_ID, status: 'open', testCases: runCaseSnapshots.length },
      projectQaRun: { id: PROJECT_QA_RUN_ID, requirementId: REQUIREMENT_ID, iterationId, status: 'open', items: 1 },
      dataset: 'Local screenshot fixture; synthetic project records and catalog, no customer data or provider calls.',
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

module.exports = { seedAuthenticatedCapture };
