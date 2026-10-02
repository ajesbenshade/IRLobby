import { useSyncExternalStore } from 'react';

import { FEATURES, type FeatureSwitch } from '@constants/features';

/**
 * Feature detection from the live API's activity payload.
 *
 * IMPORTANT: `requires_approval` is NOT a usable signal. The legacy IRLobby model already
 * sends `requires_approval` (and `requiresApproval`) on every activity, so the live API has it
 * today. The new Require approval backend adds `my_request_status` (always) and
 * `allow_rerequest`; the cancel backend adds `is_cancelled`.
 */
type PayloadLike = Record<string, unknown> | null | undefined;

const has = (payload: PayloadLike, key: string) =>
  Boolean(payload) && typeof payload === 'object' && key in (payload as object);

export const payloadSupportsHostCancel = (payload: PayloadLike) => has(payload, 'is_cancelled');

export const payloadSupportsRequireApproval = (payload: PayloadLike) =>
  has(payload, 'my_request_status') || has(payload, 'allow_rerequest');

export const resolveSwitch = (mode: FeatureSwitch, detected: boolean) =>
  mode === 'on' ? true : mode === 'off' ? false : detected;

// ---- Session-wide detection (so the Host form, which has no activity yet, can decide) ----

type Detected = { hostCancel: boolean; requireApproval: boolean };
let detected: Detected = { hostCancel: false, requireApproval: false };
const listeners = new Set<() => void>();

/** Called by the activity service for every payload it parses. Never un-detects. */
export const noteActivityPayload = (payload: unknown) => {
  const items = Array.isArray(payload) ? payload : [payload];
  let next = detected;
  for (const item of items) {
    const record = item as PayloadLike;
    if (!next.hostCancel && payloadSupportsHostCancel(record)) {
      next = { ...next, hostCancel: true };
    }
    if (!next.requireApproval && payloadSupportsRequireApproval(record)) {
      next = { ...next, requireApproval: true };
    }
  }
  if (next !== detected) {
    detected = next;
    listeners.forEach((listener) => listener());
  }
};

export const resetDetectedCapabilities = () => {
  detected = { hostCancel: false, requireApproval: false };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => detected;

/** Is the feature on, given the switch, the session detection and (optionally) this activity? */
export const isHostCancelEnabled = (activity?: PayloadLike, state: Detected = detected) =>
  resolveSwitch(FEATURES.hostCancel, payloadSupportsHostCancel(activity) || (activity == null && state.hostCancel));

export const isRequireApprovalEnabled = (activity?: PayloadLike, state: Detected = detected) =>
  resolveSwitch(
    FEATURES.requireApproval,
    payloadSupportsRequireApproval(activity) || (activity == null && state.requireApproval),
  );

/** Re-renders when a payload first proves the backend supports a feature. */
export const useDetectedCapabilities = () => useSyncExternalStore(subscribe, snapshot, snapshot);
