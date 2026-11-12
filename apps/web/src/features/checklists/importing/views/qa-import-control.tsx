'use client';
import { Dialog } from '@/features/groups/workspace';
import { importFileAccept } from '../../model/qa-import-rules';
import type {
  ImportMapping,
  ImportMode,
  ImportStory,
} from '../../model/qa-import-types';
import { useQaImportViewModel } from '../view-models/use-qa-import-view-model';
import './qa-import.css';

type Vm = ReturnType<typeof useQaImportViewModel>;
const NO_STORIES: ImportStory[] = [];
function Mapping({ vm, mode }: Readonly<{ vm: Vm; mode: ImportMode }>) {
  const sheet = vm.sheets[vm.sheetIndex];
  if (!sheet) return null;
  const fields: { key: keyof ImportMapping; label: string }[] = [
    { key: 'group', label: mode === 'requirements' ? 'Feature' : 'Category' },
    {
      key: 'title',
      label: mode === 'requirements' ? 'User story' : 'Test case',
    },
    {
      key: 'details',
      label:
        mode === 'requirements'
          ? 'Acceptance criteria (optional)'
          : 'Expected result (optional)',
    },
  ];
  return (
    <>
      <label className="hier-field">
        Sheet
        <select
          className="hier-select"
          value={vm.sheetIndex}
          disabled={vm.busy}
          onChange={(event) => vm.chooseSheet(Number(event.target.value))}
        >
          {vm.sheets.map((entry, i) => (
            <option key={i} value={i}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <div className="qa-import__mapping">
        {fields.map(({ key, label }) => (
          <label className="hier-field" key={key}>
            {label}
            <select
              className="hier-select"
              value={vm.mapping[key]}
              disabled={vm.busy}
              onChange={(event) =>
                vm.setMapping({
                  ...vm.mapping,
                  [key]: Number(event.target.value),
                })
              }
            >
              <option value={-1}>
                {key === 'details' ? 'Not included' : 'Choose a column'}
              </option>
              {sheet.headers.map((header, i) => (
                <option key={i} value={i}>
                  {String(i + 1)}: {header || '(blank header)'}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="qa-import__carry">
        <input
          type="checkbox"
          checked={vm.carryGroup}
          disabled={vm.busy}
          onChange={(event) => vm.setCarryGroup(event.target.checked)}
        />{' '}
        Use the previous group when a group cell is blank
      </label>
      {vm.preview.errors.length ? (
        <ul role="alert">
          {vm.preview.errors.slice(0, 20).map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <p>
        Rows: {vm.preview.rows.length} - Groups:{' '}
        {new Set(vm.preview.rows.map((row) => row.group.toLowerCase())).size} -
        Errors: {vm.preview.errors.length}
      </p>
      <div className="qa-import__table">
        <table>
          <caption>
            Import preview — only these mapped values will be saved
          </caption>
          <thead>
            <tr>
              <th>Row</th>
              <th>Group</th>
              <th>Title</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {vm.preview.rows.map((row) => (
              <tr key={row.row}>
                <td>{row.row}</td>
                <td>{row.group}</td>
                <td>{row.title}</td>
                <td>{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const COPY = {
  requirements: {
    title: 'Import feature checklist',
    fileName: 'feature-checklist-template.csv',
    template:
      'Feature,User story,Acceptance criteria\nAccount,Sign in,The profile is displayed\n',
    description:
      'Creates new Features and stories. Existing Feature names are rejected; existing progress and results are preserved.',
  },
  'test-cases': {
    title: 'Import test cases',
    fileName: 'test-cases-template.csv',
    template:
      'Category,Test case,Expected result\nHappy path,Sign in with a saved password,The profile is displayed\n',
    description:
      'Adds cases to the selected story. Identical cases are skipped. Conflicting definitions stop the entire import. Open QA results require review after additions; signed-off reports stay frozen.',
  },
};
function StoryTarget({
  vm,
  stories,
}: Readonly<{ vm: Vm; stories: ImportStory[] }>) {
  return (
    <label className="hier-field">
      Import into user story
      <select
        className="hier-select"
        value={vm.story?.itemId ?? ''}
        disabled={vm.busy}
        onChange={(event) => vm.setStoryId(event.target.value)}
      >
        {stories.map((story) => (
          <option key={story.itemId} value={story.itemId}>
            {story.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function ImportFile({ vm, mode }: Readonly<{ vm: Vm; mode: ImportMode }>) {
  return (
    <label className="hier-field">
      {mode === 'test-cases' ? 'File or Playwright tests' : 'File'}
      <input
        type="file"
        accept={importFileAccept(mode)}
        disabled={vm.busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void vm.upload(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}
function Feedback({ vm }: Readonly<{ vm: Vm }>) {
  return (
    <>
      {vm.error ? <p role="alert">{vm.error}</p> : null}
      {vm.success ? <p role="status">{vm.success}</p> : null}
      {vm.busy ? <p role="status">Processing...</p> : null}
    </>
  );
}
export function QaImportControl({
  projectId,
  mode,
  stories = NO_STORIES,
  onImported,
}: Readonly<{
  projectId: string;
  mode: ImportMode;
  stories?: ImportStory[];
  onImported: () => void;
}>) {
  const vm = useQaImportViewModel(projectId, mode, stories, onImported);
  const copy = COPY[mode];
  return (
    <>
      <button type="button" className="ghost-button" onClick={vm.show}>
        {copy.title}
      </button>
      <Dialog open={vm.open} onClose={vm.close} title={copy.title} size="wide">
        <div className="hier-dialog-form qa-import">
          <div className="hier-dialog-body">
            <p>
              Upload an Excel (XLSX), CSV or TSV file (2 MB, 1000 rows, 12
              columns maximum). Choose one sheet and map its columns. Formulas
              are unsupported.
              {mode === 'test-cases'
                ? ' Playwright spec files and JSON reports import each describe block as a category and each test as a test case.'
                : null}
            </p>
            <p>
              {copy.description} Imported rows never set progress, QA verdicts
              or Product Owner acceptance.
            </p>
            <a
              className="qa-text-button"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(copy.template)}`}
              download={copy.fileName}
            >
              Download CSV template
            </a>
            {mode === 'test-cases' ? (
              <StoryTarget vm={vm} stories={stories} />
            ) : null}
            <ImportFile vm={vm} mode={mode} />
            {vm.fileName ? <p>Selected file: {vm.fileName}</p> : null}
            <Feedback vm={vm} />
            <Mapping vm={vm} mode={mode} />
          </div>
          <div className="hier-dialog-footer">
            <div className="hier-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={vm.busy}
                onClick={vm.close}
              >
                Close
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!vm.canSave}
                onClick={() => void vm.save()}
              >
                Import {vm.preview.rows.length} rows
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
