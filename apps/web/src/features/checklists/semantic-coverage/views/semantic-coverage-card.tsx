'use client';

import './semantic-coverage.css';

import {
  coverageDetail,
  coverageHeadline,
  criterionHint,
  criterionLabel,
  storiesToShow,
  storyCoverageLabel,
} from '../../model/semantic-coverage-rules';
import type {
  SemanticCoverage,
  StoryCoverage,
} from '../../model/semantic-coverage-types';
import {
  useSemanticCoverageViewModel,
  type SemanticCoverageViewModel,
} from '../view-models/use-semantic-coverage-view-model';

function StoryRow({ story }: Readonly<{ story: StoryCoverage }>) {
  return (
    <li className="semantic-coverage__story" data-status={story.status}>
      <div className="semantic-coverage__story-head">
        <span className="semantic-coverage__story-title">
          <span className="semantic-coverage__feature">
            {story.featureName} ›{' '}
          </span>
          {story.title}
        </span>
        <span className="semantic-coverage__chip" data-status={story.status}>
          {storyCoverageLabel(story.status)}
        </span>
      </div>
      {story.criteria.length > 0 ? (
        <ul className="semantic-coverage__criteria">
          {story.criteria.map((criterion, index) => (
            <li
              key={`${String(index)}-${criterion.text}`}
              data-status={criterion.status}
            >
              <span className="semantic-coverage__criterion-status">
                {criterionLabel(criterion.status)}
              </span>
              <span className="semantic-coverage__criterion-text">
                {criterion.text}
              </span>
              {criterionHint(criterion) ? (
                <span className="semantic-coverage__hint">
                  {criterionHint(criterion)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Report({
  coverage,
  vm,
}: Readonly<{ coverage: SemanticCoverage; vm: SemanticCoverageViewModel }>) {
  const stories = storiesToShow(coverage.stories, vm.showCovered);
  const detail = coverageDetail(coverage.summary);
  return (
    <>
      <p className="semantic-coverage__headline">
        {coverageHeadline(coverage.summary)}
      </p>
      {detail ? <p className="semantic-coverage__detail">{detail}</p> : null}
      <div className="semantic-coverage__tools">
        <label className="semantic-coverage__toggle">
          <input
            type="checkbox"
            checked={vm.showCovered}
            onChange={(event) => vm.setShowCovered(event.target.checked)}
          />{' '}
          Show covered stories
        </label>
        <button
          type="button"
          className="rq-link"
          onClick={() => void vm.reload()}
        >
          Read again
        </button>
      </div>
      {stories.length > 0 ? (
        <ul className="semantic-coverage__stories">
          {stories.map((story) => (
            <StoryRow key={story.itemId} story={story} />
          ))}
        </ul>
      ) : (
        <p className="semantic-coverage__detail">
          Every story with criteria has a matching test case for each outcome.
        </p>
      )}
    </>
  );
}

function Body({ vm }: Readonly<{ vm: SemanticCoverageViewModel }>) {
  if (vm.status === 'loading' || vm.status === 'idle')
    return <p className="semantic-coverage__detail">Checking stories…</p>;
  if (vm.status === 'unavailable')
    return (
      <p className="semantic-coverage__detail">
        This server cannot check coverage yet.
      </p>
    );
  if (vm.status === 'error' || !vm.coverage) {
    return (
      <p className="rq-form-error" role="alert">
        Coverage could not be checked.{' '}
        <button
          type="button"
          className="rq-link"
          onClick={() => void vm.reload()}
        >
          Try again
        </button>
      </p>
    );
  }
  return <Report coverage={vm.coverage} vm={vm} />;
}

/**
 * Semantic test coverage, folded: for every story, whether each outcome of its
 * acceptance criteria has a QA test case that says the same thing, and which
 * words none of them says yet. Matched by shared words, so it points QA and
 * the Product owner at gaps; it does not pass or fail anything.
 */
export function SemanticCoverageCard({
  deliveryProjectId,
}: Readonly<{ deliveryProjectId: string }>) {
  const vm = useSemanticCoverageViewModel(deliveryProjectId);
  return (
    <details
      className="semantic-coverage"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open) vm.open();
      }}
    >
      <summary className="semantic-coverage__summary">
        Semantic test coverage
      </summary>
      <p className="semantic-coverage__detail">
        Each acceptance outcome is compared with the story&apos;s test cases by
        the words they share. It points at gaps; it does not pass or fail a
        story.
      </p>
      <Body vm={vm} />
    </details>
  );
}
