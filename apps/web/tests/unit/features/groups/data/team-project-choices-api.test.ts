import { toTeamProjectChoices } from '../../../../../src/features/groups/data/team-project-choices-api';

describe('toTeamProjectChoices', () => {
  it('keeps each Project id and name, sorted by name', () => {
    expect(
      toTeamProjectChoices({
        groupId: 'group-1',
        folders: [
          { deliveryProjectId: 'dp-2', name: 'payments', repositories: [] },
          { deliveryProjectId: 'dp-1', name: 'Billing', repositories: [] },
        ],
      }),
    ).toEqual([
      { deliveryProjectId: 'dp-1', name: 'Billing' },
      { deliveryProjectId: 'dp-2', name: 'payments' },
    ]);
  });

  it('drops malformed folders and tolerates a malformed reply', () => {
    expect(
      toTeamProjectChoices({
        folders: [null, { name: 'No id' }, { deliveryProjectId: 'dp-3' }],
      }),
    ).toEqual([]);
    expect(toTeamProjectChoices(null)).toEqual([]);
    expect(toTeamProjectChoices({ folders: 'nope' })).toEqual([]);
  });
});
