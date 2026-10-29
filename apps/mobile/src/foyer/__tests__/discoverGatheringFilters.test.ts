import { foyerGatheringQuery } from '../discoverGatheringFilters';

describe('foyerGatheringQuery', () => {
  it('omits All types, Everyone, and All ages', () => {
    expect(
      foyerGatheringQuery({ gatheringType: '', audience: '', ages: '', dateFrom: undefined, dateTo: undefined }),
    ).toEqual({});
  });

  it('sends church slugs and drops unknown values', () => {
    expect(
      foyerGatheringQuery({
        gatheringType: 'worship_service',
        audience: 'men',
        ages: 'kids_family',
        dateFrom: '2030-05-01T00:00:00Z',
      }),
    ).toEqual({
      type: 'worship_service',
      audience: 'men',
      ages: 'kids_family',
      date_from: '2030-05-01T00:00:00Z',
    });

    expect(
      foyerGatheringQuery({ gatheringType: 'Nightlife', audience: 'everyone', ages: '21+' }),
    ).toEqual({});
  });
});
