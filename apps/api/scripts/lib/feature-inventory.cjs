'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../../..');
const FIELDS = new Set([
  'id',
  'title',
  'availability',
  'implementation',
  'permissions',
  'prerequisites',
  'evidence',
  'origin',
]);
const text = (value) => typeof value === 'string' && value.trim() !== '';
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function repositoryFile(value) {
  if (!text(value) || /[\\`\r\n]/.test(value) || path.isAbsolute(value))
    return false;
  const target = path.resolve(REPO, value);
  return (
    target.startsWith(REPO + path.sep) &&
    fs.existsSync(target) &&
    fs.statSync(target).isFile()
  );
}

function validateFeatureInventory(features, capabilities, editions) {
  if (features === undefined) return [];
  if (!Array.isArray(features)) return ['features must be an array'];
  const errors = [];
  const ids = new Set();
  const keys = new Set(capabilities.map((record) => record?.key));
  features.forEach((feature, index) => {
    const at = 'feature ' + (feature?.id ?? index);
    if (!object(feature)) {
      errors.push(at + ': must be an object');
      return;
    }
    for (const field of Object.keys(feature)) {
      if (!FIELDS.has(field)) errors.push(at + ': unsupported field ' + field);
    }
    if (
      !text(feature.id) ||
      !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(feature.id)
    ) {
      errors.push(at + ': id must be a lowercase identifier');
    } else if (ids.has(feature.id))
      errors.push(at + ': duplicate feature identifier');
    ids.add(feature.id);
    if (!text(feature.title)) errors.push(at + ': title is required');
    const availability = feature.availability;
    if (!object(availability))
      errors.push(at + ': availability must be an object');
    else {
      const allowed = new Map([
        ['capability', ['kind', 'key']],
        ['deployment', ['kind', 'mode']],
        ['web-build', ['kind', 'edition']],
      ]).get(availability.kind);
      if (!allowed) errors.push(at + ': unknown availability kind');
      else {
        for (const field of Object.keys(availability)) {
          if (!allowed.includes(field))
            errors.push(at + ': unsupported availability field ' + field);
        }
        if (availability.kind === 'capability' && !keys.has(availability.key))
          errors.push(at + ': unknown capability ' + availability.key);
        if (
          availability.kind === 'deployment' &&
          availability.mode !== 'selfhosted'
        )
          errors.push(at + ': deployment contract must name selfhosted');
        if (
          availability.kind === 'web-build' &&
          !editions.includes(availability.edition)
        )
          errors.push(at + ': unknown web build edition');
      }
    }
    for (const field of ['implementation', 'permissions', 'evidence']) {
      if (
        !Array.isArray(feature[field]) ||
        feature[field].length === 0 ||
        !feature[field].every(repositoryFile)
      ) {
        errors.push(
          at +
            ': ' +
            field +
            ' must reference at least one existing repository file',
        );
      }
    }
    if (
      !Array.isArray(feature.prerequisites) ||
      !feature.prerequisites.every(text)
    )
      errors.push(at + ': prerequisites must be an array of nonempty strings');
    if (
      feature.origin !== undefined &&
      (!object(feature.origin) ||
        Object.keys(feature.origin).some(
          (key) => !['repository', 'commit'].includes(key),
        ) ||
        !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(
          feature.origin.repository ?? '',
        ) ||
        !/^[a-f0-9]{40}$/.test(feature.origin.commit ?? ''))
    ) {
      errors.push(
        at + ': origin must identify a GitHub repository and full commit SHA',
      );
    }
  });
  return errors;
}

const cell = (value) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '&lt;');
const files = (values) =>
  values.map((value) => '`' + cell(value) + '`').join('<br>');

function renderFeatureInventory(document) {
  const records = new Map(
    document.capabilities.map((record) => [record.key, record]),
  );
  const rows = (document.features ?? []).map((feature) => {
    const source = feature.availability;
    let owner, membership, status;
    if (source.kind === 'capability') {
      const capability = records.get(source.key);
      owner = '`' + capability.key + '`';
      membership = capability.editions.join(', ');
      status = capability.maturity + '; ' + capability.configuration;
    } else if (source.kind === 'deployment') {
      owner = 'Deployment contract';
      membership = 'Independent of edition';
      status = '`' + source.mode + '`; no separate capability grant';
    } else {
      owner = 'Web build gate';
      membership = source.edition + ' build';
      status = 'UI implementation; not an API capability availability claim';
    }
    return `| ${cell(feature.title)} (\`${feature.id}\`) | ${owner} | ${membership} | ${cell(status)} |`;
  });
  const details = (document.features ?? []).map((feature) => {
    const origin = feature.origin
      ? `\n- Origin: [${feature.origin.commit.slice(0, 8)}](${feature.origin.repository}/commit/${feature.origin.commit}).`
      : '';
    return `## ${cell(feature.title)}

- Identifier: \`${feature.id}\`.
- Implementation: ${files(feature.implementation)}.
- Authorization references: ${files(feature.permissions)}.
- Prerequisites: ${cell(feature.prerequisites.join('; ')) || 'None declared'}.
- Evidence: ${files(feature.evidence)}.${origin}`;
  });
  return `---
type: "Feature Inventory"
title: "Built feature inventory"
description: "Generated feature-level inventory with inherited capability membership and implementation evidence."
tags: [capabilities, features, composition]
status: stable
sources:
  - id: authoring-source
    resource: "apps/api/src/kernel/composition/catalog.source.json"
    title: "Capability and feature authoring source"
---

# Built feature inventory

Generated from the descriptive \`features\` entries in the capability authoring source. This is a scoped inventory of reconciled behavior, not an exhaustive screen list or proof of live readiness. Capability memberships, maturity and configuration below are inherited; feature entries cannot grant editions or role permissions.

Deployment contracts and web build gates are identified separately. Read the referenced authorization rules and resource checks for allowed actions. Evidence paths identify verification code or operator procedures, not a claim those checks have run in a particular deployment. Historical origin, when supplied, is descriptive and does not determine membership.

| Feature | Composition owner | Declared applicability | Capability status or controlling contract |
|---|---|---|---|
${rows.join('\n')}

${details.join('\n\n')}

The [capability contract](capability-contract.md) defines composition. The [feature assignment runbook](../runbooks/runbook-feature-assignment.md) describes authoring and verification. Regenerate with \`npm run generate:architecture-maps -w @alphaci/api\`.
`;
}

module.exports = { validateFeatureInventory, renderFeatureInventory };
