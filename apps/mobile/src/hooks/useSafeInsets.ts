import { createContext, useContext } from 'react';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

const NONE: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Safe-area insets that never throw. The app root has a SafeAreaProvider, so on device this is the real notch / Dynamic Island
 * (top) and home indicator (bottom). Tests and Storybook-style renders without a provider get zeros.
 *
 * Every full-screen custom header must start below `top`; primary actions sit at `bottom + 12`.
 */
// A test file that mocks react-native-safe-area-context leaves the context undefined; fall back to a private empty context then.
const FALLBACK_CONTEXT = createContext<EdgeInsets | null>(null);

export const useSafeInsets = (): EdgeInsets => useContext(SafeAreaInsetsContext ?? FALLBACK_CONTEXT) ?? NONE;
