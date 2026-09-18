import { MAX_EVENT_PHOTOS } from '@constants/activity';

export const CREATE_EVENT_PUBLISH_LABEL = 'Publish';
export const CREATE_EVENT_TICKETED_PUBLISH_LABEL = 'Publish & enable tickets';
export const CREATE_EVENT_PUBLISHING_LABEL = 'Publishing…';
export const CREATE_EVENT_SAVE_LABEL = 'Save';
export const CREATE_EVENT_SAVING_LABEL = 'Saving…';

export const createEventPrimaryCtaLabel = (
  isTicketed: boolean,
  isPending = false,
  isEditing = false,
): string => {
  if (isPending) {
    return isEditing ? CREATE_EVENT_SAVING_LABEL : CREATE_EVENT_PUBLISHING_LABEL;
  }

  if (isEditing) {
    return CREATE_EVENT_SAVE_LABEL;
  }

  return isTicketed ? CREATE_EVENT_TICKETED_PUBLISH_LABEL : CREATE_EVENT_PUBLISH_LABEL;
};

export const createEventTicketPayload = (
  isTicketed: boolean,
  ticketPrice: string,
  maxTickets: string,
): { is_ticketed: boolean; ticket_price?: number; max_tickets?: number } => {
  if (!isTicketed) {
    return { is_ticketed: false };
  }

  return {
    is_ticketed: true,
    ticket_price: Number(ticketPrice),
    max_tickets: Number(maxTickets),
  };
};

export const normalizeEventImages = (images: string[] | null | undefined): string[] =>
  (images ?? []).filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, MAX_EVENT_PHOTOS);

export const createEventImagePayload = (
  images: string[] | null | undefined,
): { images: string[]; imageUrls: string[] } => {
  const normalized = normalizeEventImages(images);
  return {
    images: normalized,
    imageUrls: normalized,
  };
};
