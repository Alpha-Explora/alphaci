---
type: "Playbook"
title: "Semantic test coverage"
description: "Read the semantic test coverage report: acceptance criteria against QA test cases."
tags: [runbook, qa, coverage]
status: stable
---
# Semantic test coverage

No migration or workflow change is needed.

`GET /api/v1/delivery-projects/{id}/semantic-coverage`, for anyone who can see the Project, assesses the active Iteration's User stories (`domain/semantic-coverage.rules.ts`). Each outcome of a story's acceptance criteria (the Then and following And/But clauses of Given/When/Then, or every line when there are none) is compared with each of the story's QA test cases by the words they share, after dropping stop words and Gherkin keywords and folding simple plurals and tenses. An outcome is `covered` at 60% of its words, `weak` at 30%, otherwise `uncovered`; the response names the closest test case and the missing words. A story is `covered`, `gaps`, `untested` (criteria but no test cases) or `no_criteria`.

It is deterministic and read-only: no model is called, nothing is stored, and it does not block sign-off or promotion. Product owners and QA see it as **Semantic test coverage** in the Project workspace. Treat it as a pointer to criteria nobody tests yet; a word match is not proof that a test checks the behaviour.

## Verification

Focused Jest suites: `semantic-coverage.rules.spec` and `qa-semantic-coverage.service.spec`.
