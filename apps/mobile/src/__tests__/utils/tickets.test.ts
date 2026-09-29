import {
  formatUsd,
  hostFeePreviewCopy,
  hostPayoutPerTicket,
  makeTicketId,
  orderTotal,
  parseTicketPrice,
  platformFeeAmount,
  PLATFORM_FEE_PERCENT,
} from '@constants/tickets';

describe('ticket fee math', () => {
  it('keeps the platform fee at 10%', () => {
    expect(PLATFORM_FEE_PERCENT).toBe(10);
  });

  it('shows host payout as 90% of the ticket price', () => {
    expect(hostPayoutPerTicket(15)).toBe(13.5);
    expect(hostFeePreviewCopy(15)).toBe(
      'The Foyer takes 10% + Stripe fees — you get ~$13.50/ticket',
    );
  });

  it('adds a 10% platform fee to the guest total', () => {
    expect(platformFeeAmount(15, 1)).toBe(1.5);
    expect(orderTotal(15, 1)).toBe(16.5);
    expect(formatUsd(16.5)).toBe('$16.50');
  });

  it('parses currency-prefixed prices and builds a ticket id', () => {
    expect(parseTicketPrice('$15')).toBe(15);
    expect(makeTicketId('rooftop-1')).toMatch(/^IR-[0-9A-F]{6}$/);
  });
});
