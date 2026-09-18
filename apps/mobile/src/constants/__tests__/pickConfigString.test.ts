import { pickConfigString } from '../config';

describe('pickConfigString', () => {
  it('returns the first non-empty trimmed string', () => {
    expect(pickConfigString('  ', undefined, ' web-id ', 'ignored')).toBe('web-id');
  });

  it('returns undefined when every value is blank', () => {
    expect(pickConfigString(undefined, '', '   ', null)).toBeUndefined();
  });
});
