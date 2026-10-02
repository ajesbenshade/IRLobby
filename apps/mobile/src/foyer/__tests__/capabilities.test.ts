import {
  isHostCancelEnabled,
  isRequireApprovalEnabled,
  noteActivityPayload,
  payloadSupportsHostCancel,
  payloadSupportsRequireApproval,
  resetDetectedCapabilities,
} from '../capabilities';
import { activityPushTarget } from '@services/pushNotificationNavigation';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
}));

describe('capability detection', () => {
  beforeEach(() => resetDetectedCapabilities());

  it('detects from payload fields only', () => {
    expect(payloadSupportsHostCancel({ is_cancelled: false })).toBe(true);
    expect(payloadSupportsHostCancel({ requires_approval: true })).toBe(false);
    expect(payloadSupportsRequireApproval({ my_request_status: 'none' })).toBe(true);
    expect(payloadSupportsRequireApproval({ requires_approval: true })).toBe(false);
  });

  it('remembers detection across payloads (host form has no activity)', () => {
    expect(isHostCancelEnabled()).toBe(false);
    expect(isRequireApprovalEnabled()).toBe(false);
    noteActivityPayload([{ id: 1, requires_approval: true }]);
    expect(isRequireApprovalEnabled()).toBe(false);
    noteActivityPayload([{ id: 1, my_request_status: 'none', is_cancelled: false }]);
    expect(isRequireApprovalEnabled()).toBe(true);
    expect(isHostCancelEnabled()).toBe(true);
  });
});

describe('push targets', () => {
  it('routes request and cancel pushes', () => {
    expect(activityPushTarget({ type: 'join_request', activityId: 5 } as never)).toEqual({ screen: 'Requests', params: { activityId: 5 } });
    expect(activityPushTarget({ type: 'activity_cancelled', activityId: 5 } as never)).toEqual({ screen: 'GatheringDetail', params: { activityId: 5 } });
    expect(activityPushTarget({ type: 'join_request_approved', activityId: 5 } as never)?.screen).toBe('GatheringDetail');
    expect(activityPushTarget({ type: 'join_request_declined', activityId: 5 } as never)?.screen).toBe('GatheringDetail');
    expect(activityPushTarget({ type: 'join_request' } as never)).toBeNull();
    expect(activityPushTarget({ type: 'new_message', activityId: 5 } as never)).toBeNull();
  });
});
