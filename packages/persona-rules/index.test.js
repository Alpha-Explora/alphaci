'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, it } = require('node:test');

const rules = require('./index.js');

const ROLES = ['admin', 'lead', 'qa', 'member'];
const NO_ROLE = [null, undefined, '', 'owner'];

/** Role -> expected answer, written out so a change to a list shows as a diff here. */
const MATRIX = {
  canManageProjectLifecycle: {
    admin: true,
    lead: true,
    qa: false,
    member: false,
  },
  canManageEnvVars: { admin: true, lead: false, qa: false, member: true },
  canManageHosting: { admin: true, lead: false, qa: false, member: true },
  canManageRequirements: { admin: true, lead: true, qa: false, member: false },
  canCreateProjectFolder: { admin: true, lead: true, qa: false, member: false },
  canCreateRepository: { admin: true, lead: false, qa: false, member: true },
  repositoryCreateRequiresProject: {
    admin: false,
    lead: false,
    qa: false,
    member: true,
  },
  isPullRequestRole: { admin: true, lead: true, qa: false, member: true },
};

describe('role rules', () => {
  for (const [name, expected] of Object.entries(MATRIX)) {
    it(`${name} answers each role as listed`, () => {
      for (const role of ROLES) {
        assert.equal(rules[name](role), expected[role], `${name}(${role})`);
      }
    });

    it(`${name} refuses a missing or unknown role`, () => {
      for (const role of NO_ROLE) {
        assert.equal(rules[name](role), false, `${name}(${String(role)})`);
      }
    });
  }
});

describe('isAllowedPullRequestRoute', () => {
  const allowed = rules.isAllowedPullRequestRoute;

  it('lets admin and lead open any route except into production', () => {
    for (const role of ['admin', 'lead']) {
      assert.equal(allowed(role, 'feature/x', 'dev'), true);
      assert.equal(allowed(role, 'feature/x', 'uat'), true);
      assert.equal(allowed(role, 'uat', 'dev'), true);
      assert.equal(allowed(role, 'uat', 'main'), false);
      assert.equal(allowed(role, 'feature/x', 'main'), false);
    }
  });

  it('lets a Developer file feature -> dev and dev -> uat only', () => {
    assert.equal(allowed('member', 'feature/x', 'dev'), true);
    assert.equal(allowed('member', 'dev', 'uat'), true);
    assert.equal(allowed('member', 'feature/x', 'uat'), false);
    assert.equal(allowed('member', 'uat', 'dev'), false);
    assert.equal(allowed('member', 'uat', 'main'), false);
    assert.equal(allowed('member', 'dev', 'main'), false);
  });

  it('refuses a Developer an empty head or a branch into itself', () => {
    assert.equal(allowed('member', '', 'dev'), false);
    assert.equal(allowed('member', 'feature/x', 'feature/x'), false);
    assert.equal(allowed('member', 'dev', 'dev'), false);
  });

  it('refuses qa and a missing role every route', () => {
    for (const role of ['qa', ...NO_ROLE]) {
      assert.equal(allowed(role, 'feature/x', 'dev'), false);
      assert.equal(allowed(role, 'dev', 'uat'), false);
    }
  });
});

describe('special access', () => {
  it('keeps known grants only, in canonical order', () => {
    assert.deepEqual(
      rules.parseSpecialAccess(['deployment_override', 'owner', 'qa_release']),
      ['qa_release', 'deployment_override'],
    );
    assert.deepEqual(rules.parseSpecialAccess('qa_release'), []);
  });

  it('makes only a Developer with qa_release act as QA', () => {
    assert.equal(rules.actingQaRole('member', ['qa_release']), 'qa');
    assert.equal(rules.actingQaRole('member', []), 'member');
    assert.equal(rules.actingQaRole('lead', ['qa_release']), 'lead');
    assert.equal(rules.actingQaRole('member', null), 'member');
    assert.equal(rules.actingQaRole(undefined, ['qa_release']), undefined);
  });

  it('lets admins and deployment_override holders override the gate', () => {
    assert.equal(rules.canOverrideDeployment('admin', []), true);
    assert.equal(
      rules.canOverrideDeployment('member', ['deployment_override']),
      true,
    );
    assert.equal(rules.canOverrideDeployment('lead', ['qa_release']), false);
    assert.equal(rules.canOverrideDeployment(null, null), false);
  });
});

describe('index.d.ts', () => {
  it('declares exactly what index.js exports', () => {
    const declared = [
      ...readFileSync(join(__dirname, 'index.d.ts'), 'utf8').matchAll(
        /^export (?:declare )?(?:function|const) (\w+)/gm,
      ),
    ].map((match) => match[1]);

    assert.deepEqual(declared.sort(), Object.keys(rules).sort());
  });
});
