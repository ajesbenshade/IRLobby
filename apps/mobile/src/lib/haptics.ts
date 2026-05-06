import * as Haptics from 'expo-haptics';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationStyle = 'success' | 'warning' | 'error';

const impactStyleMap: Record<
  ImpactStyle,
  Haptics.ImpactFeedbackStyle | undefined
> = {
  light: Haptics.ImpactFeedbackStyle?.Light,
  medium: Haptics.ImpactFeedbackStyle?.Medium,
  heavy: Haptics.ImpactFeedbackStyle?.Heavy,
  rigid: Haptics.ImpactFeedbackStyle?.Rigid,
  soft: Haptics.ImpactFeedbackStyle?.Soft,
};

const notificationStyleMap: Record<
  NotificationStyle,
  Haptics.NotificationFeedbackType | undefined
> = {
  success: Haptics.NotificationFeedbackType?.Success,
  warning: Haptics.NotificationFeedbackType?.Warning,
  error: Haptics.NotificationFeedbackType?.Error,
};

async function swallowHapticsError(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch {
    // Haptics should never be able to take down core navigation flows.
  }
}

export function safeSelectionHaptic(): Promise<void> {
  if (typeof Haptics.selectionAsync !== 'function') {
    return Promise.resolve();
  }

  return swallowHapticsError(() => Haptics.selectionAsync());
}

export function safeImpactHaptic(style: ImpactStyle): Promise<void> {
  const resolvedStyle = impactStyleMap[style];
  if (!resolvedStyle || typeof Haptics.impactAsync !== 'function') {
    return Promise.resolve();
  }

  return swallowHapticsError(() => Haptics.impactAsync(resolvedStyle));
}

export function safeNotificationHaptic(type: NotificationStyle): Promise<void> {
  const resolvedType = notificationStyleMap[type];
  if (!resolvedType || typeof Haptics.notificationAsync !== 'function') {
    return Promise.resolve();
  }

  return swallowHapticsError(() => Haptics.notificationAsync(resolvedType));
}
