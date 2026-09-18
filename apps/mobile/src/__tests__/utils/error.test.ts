import { AxiosError } from 'axios';

import { getErrorMessage } from '@utils/error';

const makeAxiosError = (status: number, data: unknown) => {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    data,
    statusText: 'Error',
    headers: {},
    config: { headers: {} },
  } as AxiosError['response'];
  return error;
};

describe('getErrorMessage', () => {
  it('maps missing auth credentials to a session message', () => {
    const error = makeAxiosError(401, {
      detail: 'Authentication credentials were not provided.',
    });
    expect(getErrorMessage(error, 'Unable to load activities.')).toBe(
      'Your session expired. Sign in again to continue.',
    );
  });

  it('never renders HTML 404 bodies', () => {
    const error = makeAxiosError(
      404,
      '<!doctype html><html lang="en"><head><title>Not Found</title></head><body><h1>Not Found</h1></body></html>',
    );
    expect(getErrorMessage(error, 'Unable to load payout status.')).toBe(
      'This isn’t available yet. Try again later.',
    );
  });

  it('keeps field validation messages', () => {
    const error = makeAxiosError(400, { password: ['This field is required.'] });
    expect(getErrorMessage(error, 'Unable to sign in.')).toBe('This field is required.');
  });

  it('uses a friendly message for 503', () => {
    const error = makeAxiosError(503, 'upstream');
    expect(getErrorMessage(error)).toBe('Unable to reach API right now. Please try again.');
  });

  it('surfaces JSON 503 configuration errors', () => {
    const error = makeAxiosError(503, { error: 'Google OAuth is not configured.' });
    expect(getErrorMessage(error)).toBe('Google OAuth is not configured.');
  });
});
