import { z } from 'zod';

import { getErrorMessage } from '../error';

describe('getErrorMessage', () => {
  it('uses the screen fallback instead of raw schema diagnostics', () => {
    const result = z.object({ capacity: z.number() }).safeParse({ capacity: null });
    if (result.success) throw new Error('Expected invalid fixture');

    expect(getErrorMessage(result.error, 'Unable to load your events.'))
      .toBe('Unable to load your events.');
    expect(getErrorMessage(result.error)).toBe('Something went wrong. Please try again.');
  });

  it('preserves ordinary error messages', () => {
    expect(getErrorMessage(new Error('Please check your connection.')))
      .toBe('Please check your connection.');
  });
});
