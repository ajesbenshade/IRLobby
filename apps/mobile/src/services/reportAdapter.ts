import { api } from './apiClient';
import { reportMember } from './foyerService';

/**
 * Single seam for every "Report" affordance in the app.
 *
 * Content is reported against the CONTENT, not the person, through the target-specific endpoints
 * (all need login; body `{ reason?, description? }` up to 500 chars; 201 `{ id, status: 'pending',
 * target_type, target_id }`, or 200 with the same shape when it was already reported; 400 for your own):
 *   gathering chat message  POST /api/activities/<id>/chat/<message_id>/report/   (403 without chat access)
 *   event photo             POST /api/activities/<id>/photos/<photo_id>/report/
 *   gathering               POST /api/activities/<id>/report/
 *   requester card          POST /api/activities/<id>/requests/<request_id>/report/   (host / staff only)
 * People (profiles, attendees, 1:1 chat) still go through the user-report / direct-chat endpoints.
 *
 * If a content endpoint answers 404 (backend not deployed yet) the report falls back to the old user-report
 * endpoint, with the context folded into `description`, and ONLY when the person is known.
 */
export type ReportTarget =
  | { type: 'member'; userId: number | string }
  | { type: 'attendee'; userId: number | string }
  | { type: 'join_request'; userId?: number | string | null; requestId?: number | string | null; activityId?: number | string }
  | { type: 'chat_message'; senderId?: number | string | null; messageId?: number | string; activityId?: number | string; excerpt?: string }
  | { type: 'photo'; ownerId?: number | string | null; photoId?: number | string | null; activityId?: number | string }
  | { type: 'gathering'; hostId?: number | string | null; activityId?: number | string };

export type ReportSupport = 'content_report' | 'user_report' | 'gap';

/** The content endpoint for a target, or null when the ids it needs are missing. */
export const contentReportPath = (target: ReportTarget): string | null => {
  switch (target.type) {
    case 'chat_message':
      return target.activityId != null && target.messageId != null
        ? `/api/activities/${target.activityId}/chat/${target.messageId}/report/`
        : null;
    case 'photo':
      return target.activityId != null && target.photoId != null
        ? `/api/activities/${target.activityId}/photos/${target.photoId}/report/`
        : null;
    case 'gathering':
      return target.activityId != null ? `/api/activities/${target.activityId}/report/` : null;
    case 'join_request':
      return target.activityId != null && target.requestId != null
        ? `/api/activities/${target.activityId}/requests/${target.requestId}/report/`
        : null;
    default:
      return null;
  }
};

const personOf = (target: ReportTarget): number | string | null => {
  switch (target.type) {
    case 'member':
    case 'attendee':
      return target.userId ?? null;
    case 'join_request':
      return target.userId ?? null;
    case 'chat_message':
      return target.senderId ?? null;
    case 'photo':
      return target.ownerId ?? null;
    case 'gathering':
      return target.hostId ?? null;
    default:
      return null;
  }
};

/** How a target can be reported. `gap` = nothing identifies it, so no Report affordance is shown. */
export const reportSupportFor = (target: ReportTarget): ReportSupport => {
  if (contentReportPath(target)) {
    return 'content_report';
  }
  return personOf(target) != null ? 'user_report' : 'gap';
};

export const canReport = (target: ReportTarget): boolean => reportSupportFor(target) !== 'gap';

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

const isNotFound = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 404;

/** Sends the report. Throws when nothing identifies the target (callers should hide the button instead). */
export const submitReport = async (
  target: ReportTarget,
  payload: { reason: string; description?: string },
): Promise<void> => {
  const path = contentReportPath(target);
  if (path) {
    const details = payload.description?.trim();
    try {
      await api.post(path, {
        reason: payload.reason,
        ...(details ? { description: details.slice(0, 500) } : {}),
      });
      return;
    } catch (error) {
      // Only "not deployed yet" falls back to the person; 400 / 403 / 5xx surface to the sheet.
      if (!isNotFound(error) || personOf(target) == null) {
        throw error;
      }
    }
  }
  const person = personOf(target);
  if (person == null) {
    throw new Error('This cannot be reported yet.');
  }
  await reportMember(person, { reason: payload.reason, description: reportDescription(target, payload.description) });
};
