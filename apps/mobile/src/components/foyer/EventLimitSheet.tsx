import { NoticeSheet } from '@components/foyer/NoticeSheet';
import { HOST_LIMIT_COPY } from '@constants/foyerCopy';
import { eventLimitSheetBody } from '@foyer/hostLimit';

/** `One gathering a week` (frame 247): Gatherings + while blocked, or a 429 `event_limit_reached` on create. */
export const EventLimitSheet = ({
  visible,
  nextAllowedAt,
  onClose,
}: {
  visible: boolean;
  nextAllowedAt: Date | null;
  onClose: () => void;
}) => (
  <NoticeSheet
    visible={visible}
    title={HOST_LIMIT_COPY.sheetTitle}
    body={eventLimitSheetBody(nextAllowedAt)}
    okLabel={HOST_LIMIT_COPY.ok}
    onClose={onClose}
    testID="event-limit"
  />
);
