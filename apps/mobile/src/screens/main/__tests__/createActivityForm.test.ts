import {
  CREATE_EVENT_PUBLISH_LABEL,
  CREATE_EVENT_SAVE_LABEL,
  CREATE_EVENT_TICKETED_PUBLISH_LABEL,
  createEventImagePayload,
  createEventPrimaryCtaLabel,
  createEventTicketPayload,
  normalizeEventImages,
} from '../createActivityForm';

describe('create-event ticketed toggle (Frame A)', () => {
  it('uses Publish for non-ticketed events and the ticketed CTA when enabled', () => {
    expect(createEventPrimaryCtaLabel(false)).toBe(CREATE_EVENT_PUBLISH_LABEL);
    expect(createEventPrimaryCtaLabel(true)).toBe(CREATE_EVENT_TICKETED_PUBLISH_LABEL);
    expect(createEventPrimaryCtaLabel(false, true)).toBe('Publishing…');
    expect(createEventPrimaryCtaLabel(false, false, true)).toBe(CREATE_EVENT_SAVE_LABEL);
    expect(createEventPrimaryCtaLabel(true, true, true)).toBe('Saving…');
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

describe('create-event photos (Frame A2)', () => {
  it('sends images and the imageUrls alias, capped at 50', () => {
    const images = ['https://cdn.example/1.jpg', 'data:image/png;base64,abc', '', 'https://cdn.example/3.webp'];
    expect(createEventImagePayload(images)).toEqual({
      images: ['https://cdn.example/1.jpg', 'data:image/png;base64,abc', 'https://cdn.example/3.webp'],
      imageUrls: ['https://cdn.example/1.jpg', 'data:image/png;base64,abc', 'https://cdn.example/3.webp'],
    });
    expect(normalizeEventImages(Array.from({ length: 60 }, (_, index) => `https://cdn.example/${index}.jpg`))).toHaveLength(50);
  });

  it('allows an empty photo list', () => {
    expect(createEventImagePayload([])).toEqual({ images: [], imageUrls: [] });
  });
});
