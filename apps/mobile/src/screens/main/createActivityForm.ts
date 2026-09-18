export const CREATE_EVENT_PUBLISH_LABEL = 'Publish';
export const CREATE_EVENT_TICKETED_PUBLISH_LABEL = 'Publish & enable tickets';
export const CREATE_EVENT_PUBLISHING_LABEL = 'Publishing…';

export const createEventPrimaryCtaLabel = (isTicketed: boolean, isPending = false): string => {
  if (isPending) {
    return CREATE_EVENT_PUBLISHING_LABEL;
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
