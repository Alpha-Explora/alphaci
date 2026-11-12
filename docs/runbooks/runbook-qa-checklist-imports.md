---
type: "Playbook"
title: "Checklist imports and QA history"
description: "Use grouped Feature and test-case imports, the progress tracker, and shared release execution."
tags: [runbook, qa, imports, history]
status: stable
---
# Checklist imports and QA history

## Import a Feature checklist

A Product Owner or administrator opens **Import feature checklist** above the Project checklist. Download the CSV template or choose an XLSX, CSV or TSV file. Select a sheet, map Feature, User story and optional Acceptance criteria, and inspect every mapped row. Blank group cells use the preceding group only when explicitly selected. Fix row errors in the file and upload again. **Import rows** sends one atomic requirement batch; it creates new Features and stories. Existing Feature names are rejected, preserving existing progress and QA results. A second attempt with already-created Feature names cannot duplicate them.

## Import QA test cases

QA and administrators open **Import test cases** alongside the QA run's test-suite controls. Select the exact Feature/story destination, choose a file, and map Category, Test case and optional Expected result. Import creates categories and cases under that story. Exact existing definitions are skipped; conflicting definitions abort the batch. Modify existing definitions through the version-checked editor. Open-run verdicts require review after new definitions arrive; frozen signed-off reports stay unchanged. Imported status columns are ignored and cannot grant a QA pass or Product Owner acceptance.

The first version supports structured `.xlsx`, `.csv`, and `.tsv` files, up to 2 MB, 1000 data rows and 12 columns. It reads one selected sheet per import and does not interpret arbitrary PDFs, images, legacy `.xls`, macro workbooks, formulas, or free-form documents. Use the template for reliable grouping. The preview and commit are separate; selecting a file alone never saves it.

## Import Playwright test cases

The test case import also takes a Playwright spec file or JSON report: each describe block becomes a category and each test a test case.

## Find progress and failure history

**Progress and QA history** appears on Project checklist items and QA run items. **Progress and QA activity tracker** appears in Release history, with older frozen reports still available below it. History loads on opening, supports refresh, and pages older records without replacing the current list. It shows QA transitions, defect notes/severity/reproduction steps, developer fix requests, test-case results, Product Owner acceptance and sign-offs. Earlier failure rounds remain visible after a retest. Developer progress is journaled only from installation of the backend migration onward.

Item refusal notifications still lead developers to the Project's returned-work area. Whole-run rejection notifications now use `qa.run.rejected` and the same developer link, with their rejection summary. They do not automatically fail otherwise-passed stories. Reopening and the existing retest flow continue to apply.

## Merge an approved release

Product Owners, QA, Developers and administrators can execute **Merge to main** when the server gate permits it. Developers can use the readiness card in Overview; Studio actions reuse the same single-repository and project-wide merge dialogs and partial-retry handling. QA approval, current heads, complete iteration coverage and Product Owner acceptance remain prerequisites. Verify Hosting separately to confirm the resulting deployment.

## Dependencies and checks

Deploy the matching backend and apply `20261027000000_qa_progress_history.sql` first. A server without the new import/history routes shows an actionable error instead of simulating a successful import. Scope files and API calls live in `checklists/data`, mapping/history presentation rules in `checklists/model`, and interaction state in the `importing` and `history` view models.

Verify role gates, blocked releases, preview-before-save, invalid mappings, duplicate rows, atomic failures, selected-story scope and older history pages. Local browser fixtures verify rendering and responsive layout only; they do not prove target notification delivery, GitHub permissions, migration installation or deployments. External Playwright repository execution remains deferred.
