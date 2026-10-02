import { isRequireApprovalEnabled } from '@foyer/capabilities';
import type { AudienceGender, HostKind } from '@foyer/logic';
import { fromIsoDateTime, type DayValue } from '@foyer/dates';

export type ApprovalFormState = {
  requireApproval: boolean;
  allowRerequest: boolean;
};

/**
 * The Require approval card is hidden when the gathering is posted to the church website calendar
 * (public listing) and for church-hosted gatherings, and entirely when the backend lacks the feature.
 */
export const approvalCardVisible = (input: {
  enabled?: boolean;
  listOnCalendar: boolean;
  hostAsChurch: boolean;
}): boolean => (input.enabled ?? isRequireApprovalEnabled()) && !input.listOnCalendar && !input.hostAsChurch;

/**
 * Approval fields for create/update. Nothing is sent when the feature is off, so the legacy `requires_approval`
 * flag is never written by the Foyer form against an older backend. When the card is hidden the fields are sent
 * as `false` so a previously approval-gated event cannot stay gated while listed publicly.
 */
export const approvalPayload = (input: {
  enabled?: boolean;
  listOnCalendar: boolean;
  hostAsChurch: boolean;
  state: ApprovalFormState;
}): { requires_approval?: boolean; allow_rerequest?: boolean } => {
  const enabled = input.enabled ?? isRequireApprovalEnabled();
  if (!enabled) {
    return {};
  }
  if (!approvalCardVisible({ enabled, listOnCalendar: input.listOnCalendar, hostAsChurch: input.hostAsChurch })) {
    return { requires_approval: false, allow_rerequest: false };
  }
  return {
    requires_approval: input.state.requireApproval,
    // "Allow asking again" only exists while Require approval is on.
    allow_rerequest: input.state.requireApproval ? input.state.allowRerequest : false,
  };
};

type EditableActivity = {
  title?: string | null;
  description?: string | null;
  location?: string | null;
  time?: string | null;
  end_time?: string | null;
  capacity?: number | null;
  audience_gender?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  list_on_church_calendar?: boolean | null;
  host_kind?: string | null;
  requires_approval?: boolean | null;
  allow_rerequest?: boolean | null;
};

export type HostFormValues = {
  title: string;
  description: string;
  place: string;
  day: DayValue | null;
  startMinutes: number | null;
  endMinutes: number | null;
  capacity: string;
  audience: AudienceGender;
  ageMin: string;
  ageMax: string;
  listOnCalendar: boolean;
  hostAsChurch: boolean;
  requireApproval: boolean;
  allowRerequest: boolean;
};

/** Edit opens with what was posted; without this the form would send blanks over the gathering. */
export const hostFormValuesFromActivity = (activity: EditableActivity, approvalEnabled = isRequireApprovalEnabled(activity as never)): HostFormValues => {
  const start = fromIsoDateTime(activity.time);
  const end = fromIsoDateTime(activity.end_time);
  const audience = activity.audience_gender === 'men' || activity.audience_gender === 'women' ? activity.audience_gender : 'everyone';
  return {
    title: activity.title ?? '',
    description: activity.description ?? '',
    place: activity.location ?? '',
    day: start?.day ?? null,
    startMinutes: start?.minutes ?? null,
    endMinutes: end?.minutes ?? null,
    capacity: activity.capacity ? String(activity.capacity) : '',
    audience,
    ageMin: activity.age_min != null ? String(activity.age_min) : '',
    ageMax: activity.age_max != null ? String(activity.age_max) : '',
    listOnCalendar: Boolean(activity.list_on_church_calendar),
    hostAsChurch: (activity.host_kind as HostKind | undefined) === 'church',
    requireApproval: approvalEnabled && activity.requires_approval === true,
    allowRerequest: approvalEnabled && activity.allow_rerequest === true,
  };
};

/** Turning Require approval off with waiting requests is blocked client-side first. */
export const shouldBlockTurnOff = (input: { wasOn: boolean; turningOff: boolean; pendingCount: number | null | undefined }) =>
  input.wasOn && input.turningOff && Number(input.pendingCount ?? 0) > 0;

/** Post button state from the design: disabled grey until title and date are set. */
export const canPostGathering = (input: { title: string; day: DayValue | null; busy?: boolean }) =>
  Boolean(input.title.trim()) && input.day != null && !input.busy;
