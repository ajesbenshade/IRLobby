import { reportMember } from './foyerService';

/**
 * Single seam for every "Report" affordance in the app.
 *
 * TODAY the backend only has USER reports (POST /api/users/<id>/report/, POST /api/moderation/report/ and
 * POST /api/messages/direct/<conv_id>/report/). Reporting a gathering-chat message, an event photo or a
 * gathering itself will get its own endpoint with a `target_type` / `target_id` shape that is not final.
 * Until then those targets are reported AGAINST THE PERSON (sender / owner) through the user-report endpoint,
 * with the context folded into `description`. When the new endpoints ship, change `submitReport` only.
 */
export type ReportTarget =
  | { type: 'member'; userId: number | string }
  | { type: 'attendee'; userId: number | string }
  | { type: 'join_request'; userId: number | string; activityId?: number | string }
  | { type: 'chat_message'; senderId: number | string; messageId?: number | string; activityId?: number | string; excerpt?: string }
  | { type: 'photo'; ownerId?: number | string | null; photoId?: number | string | null; activityId?: number | string }
  | { type: 'gathering'; hostId?: number | string | null; activityId?: number | string };

export type ReportSupport = 'user_report' | 'gap';

/** What each target maps to today. `gap` = no way to identify the person, so no Report affordance is shown. */
export const reportSupportFor = (target: ReportTarget): ReportSupport => {
  switch (target.type) {
    case 'member':
    case 'attendee':
    case 'join_request':
      return target.userId != null ? 'user_report' : 'gap';
    case 'chat_message':
      return target.senderId != null ? 'user_report' : 'gap';
    case 'photo':
      return target.ownerId != null ? 'user_report' : 'gap';
    case 'gathering':
      return target.hostId != null ? 'user_report' : 'gap';
    default:
      return 'gap';
  }
};

export const canReport = (target: ReportTarget): boolean => reportSupportFor(target) === 'user_report';

const personOf = (target: ReportTarget): number | string | null => {
  switch (target.type) {
    case 'member':
    case 'attendee':
    case 'join_request':
      return target.userId;
    case 'chat_message':
      return target.senderId;
    case 'photo':
      return target.ownerId ?? null;
    case 'gathering':
      return target.hostId ?? null;
    default:
      return null;
  }
};

/** Context line added to the report so moderators can find the content (only for non-profile targets). */
export const reportContext = (target: ReportTarget): string => {
  switch (target.type) {
    case 'chat_message':
      return [
        'Reported from a gathering chat message',
        target.messageId != null ? `(message ${target.messageId})` : '',
        target.activityId != null ? `in gathering ${target.activityId}` : '',
        target.excerpt ? `: "${target.excerpt.slice(0, 200)}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
    case 'photo':
      return `Reported from an event photo${target.photoId != null ? ` (photo ${target.photoId})` : ''}${
        target.activityId != null ? ` in gathering ${target.activityId}` : ''
      }`;
    case 'gathering':
      return `Reported from gathering ${target.activityId ?? ''}`.trim();
    case 'join_request':
      return `Reported from a join request${target.activityId != null ? ` for gathering ${target.activityId}` : ''}`;
    case 'attendee':
      return 'Reported from a gathering guest list';
    default:
      return '';
  }
};

export const reportDescription = (target: ReportTarget, details?: string): string | undefined => {
  const parts = [reportContext(target), details?.trim()].filter(Boolean);
  return parts.length ? parts.join('\n') : undefined;
};

/** Sends the report. Throws when the target cannot be tied to a person (callers should hide the button instead). */
export const submitReport = async (
  target: ReportTarget,
  payload: { reason: string; description?: string },
): Promise<void> => {
  const person = personOf(target);
  if (person == null) {
    throw new Error('This cannot be reported yet.');
  }
  await reportMember(person, { reason: payload.reason, description: reportDescription(target, payload.description) });
};
