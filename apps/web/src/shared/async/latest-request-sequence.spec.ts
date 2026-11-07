import { LatestRequestSequence } from './latest-request-sequence';

describe('LatestRequestSequence', () => {
  it('supersedes an older request when a new one begins', () => {
    const requests = new LatestRequestSequence();
    const older = requests.begin();
    const latest = requests.begin();

    expect(older.isCurrent()).toBe(false);
    expect(latest.isCurrent()).toBe(true);
  });

  it('cancels only the lease it owns', () => {
    const requests = new LatestRequestSequence();
    const older = requests.begin();
    const latest = requests.begin();

    older.cancel();
    expect(latest.isCurrent()).toBe(true);

    latest.cancel();
    expect(latest.isCurrent()).toBe(false);
  });

  it('invalidates the current lease when its owner is disposed', () => {
    const requests = new LatestRequestSequence();
    const current = requests.begin();

    requests.invalidate();

    expect(current.isCurrent()).toBe(false);
  });
});
