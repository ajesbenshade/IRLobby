import {
  CREATE_EVENT_PUBLISH_LABEL,
  CREATE_EVENT_TICKETED_PUBLISH_LABEL,
  createEventPrimaryCtaLabel,
  createEventTicketPayload,
} from '../createActivityForm';

describe('create-event ticketed toggle (Frame A)', () => {
  it('uses Publish for non-ticketed events and the ticketed CTA when enabled', () => {
    expect(createEventPrimaryCtaLabel(false)).toBe(CREATE_EVENT_PUBLISH_LABEL);
    expect(createEventPrimaryCtaLabel(true)).toBe(CREATE_EVENT_TICKETED_PUBLISH_LABEL);
    expect(createEventPrimaryCtaLabel(false, true)).toBe('Publishing…');
  });

  it('sends is_ticketed=false without ticket fields when the toggle is off', () => {
    expect(createEventTicketPayload(false, '15', '40')).toEqual({ is_ticketed: false });
  });

  it('includes ticket price and capacity only when the toggle is on', () => {
    expect(createEventTicketPayload(true, '15', '40')).toEqual({
      is_ticketed: true,
      ticket_price: 15,
      max_tickets: 40,
    });
  });
});
