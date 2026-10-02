import { useCallback, useState, type ComponentType } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';

import { PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { LEGAL_VIEW_COPY } from '@constants/foyerCopy';
import { useSafeInsets } from '@hooks/useSafeInsets';
import { appColors, appTypography } from '@theme/index';
import { parseHttpsUrl } from '@utils/safeUrl';

const CompatWebView = WebView as unknown as ComponentType<WebViewProps>;

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};

type Props = { visible: boolean; title: string; url: string | null; onClose: () => void };

/**
 * Hosted Terms / Privacy page in a full-height sheet (title, host line, Done), with loading and failed states.
 * No legal text ships in the binary. Only https pages on the same host as the opened link are loaded.
 */
export const LegalWebViewSheet = ({ visible, title, url, onClose }: Props) => {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const safe = url && parseHttpsUrl(url) ? url : null;
  const host = safe ? hostOf(safe) : '';

  // iOS draws a page sheet below the status bar already. Where the sheet is full screen (Android, some tablets) the header must
  // clear the status bar itself.
  const insets = useSafeInsets();
  const headerTopInset = Platform.OS === 'ios' ? 14 : insets.top + 14;

  const retry = useCallback(() => {
    setState('loading');
    setAttempt((value) => value + 1);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onShow={() => setState('loading')}>
      <View style={styles.sheet} testID="legal-sheet">
        <View style={[styles.header, { paddingTop: headerTopInset }]} testID="legal-header">
          <View style={styles.titles}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {host ? <Text style={styles.host}>{host}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={LEGAL_VIEW_COPY.done} onPress={onClose} style={styles.done} testID="legal-done">
            <Text style={styles.doneText}>{LEGAL_VIEW_COPY.done}</Text>
          </Pressable>
        </View>
        {safe && state !== 'failed' ? (
          <CompatWebView
            key={attempt}
            source={{ uri: safe }}
            style={styles.web}
            javaScriptEnabled
            allowFileAccess={false}
            setSupportMultipleWindows={false}
            onLoadEnd={() => setState((current) => (current === 'failed' ? current : 'ready'))}
            onError={() => setState('failed')}
            onHttpError={() => setState('failed')}
            onShouldStartLoadWithRequest={(request) => !request.url || request.url === 'about:blank' || (!!parseHttpsUrl(request.url) && hostOf(request.url) === host)}
          />
        ) : null}
        {safe && state === 'loading' ? (
          <View style={[styles.overlay, { top: headerTopInset + 66 }]} pointerEvents="none" testID="legal-loading">
            <ActivityIndicator color={appColors.primary} />
            <Text style={styles.message}>{LEGAL_VIEW_COPY.loading}</Text>
          </View>
        ) : null}
        {!safe || state === 'failed' ? (
          <View style={[styles.overlay, { top: headerTopInset + 66 }]} testID="legal-failed">
            <Text style={styles.failedTitle}>{LEGAL_VIEW_COPY.failedTitle}</Text>
            <Text style={styles.message}>{LEGAL_VIEW_COPY.failedBody}</Text>
            <PillButton label={LEGAL_VIEW_COPY.tryAgain} onPress={retry} disabled={!safe} />
            <PillButton label={LEGAL_VIEW_COPY.close} variant="outline" onPress={onClose} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

/** Small helper: `const legal = useLegalSheet(); legal.open(url, title); {legal.element}` */
export const useLegalSheet = () => {
  const [current, setCurrent] = useState<{ url: string; title: string } | null>(null);
  const element = (
    <LegalWebViewSheet visible={current != null} title={current?.title ?? ''} url={current?.url ?? null} onClose={() => setCurrent(null)} />
  );
  return { open: (url: string, title: string) => setCurrent({ url, title }), element };
};

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: appColors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e1dbd7' },
  titles: { flex: 1 },
  title: { fontFamily: appTypography.heading, fontSize: 20, color: appColors.ink },
  host: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  done: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.primary },
  web: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, top: 0, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: appColors.white },
  message: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.mutedInk, textAlign: 'center' },
  failedTitle: { fontFamily: appTypography.heading, fontSize: 20, color: appColors.ink, textAlign: 'center' },
});
