import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { LEGAL_CONSENT_COPY, LEGAL_VIEW_COPY } from '@constants/foyerCopy';

type Props = {
  /** `checkbox` reads "I agree to the ...", `footer` reads "By continuing you agree to the ...". */
  variant?: 'checkbox' | 'footer';
  termsUrl: string | null;
  privacyUrl: string | null;
  onOpen: (url: string, title: string) => void;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
};

/** Burgundy, underlined link text (spec: sign-up links are #a2033f underlined). */
export const LEGAL_LINK_COLOR = '#a2033f';

/**
 * "I agree to the Terms of Use and Privacy Policy." with each name drawn as an underlined burgundy link
 * that opens the in-app web view. A name whose URL is null (config) is drawn as plain text.
 */
export const LegalConsentText = ({ variant = 'checkbox', termsUrl, privacyUrl, onOpen, style, linkStyle }: Props) => {
  const prefix = variant === 'checkbox' ? LEGAL_CONSENT_COPY.checkboxPrefix : LEGAL_CONSENT_COPY.loginPrefix;
  return (
    <Text style={style}>
      {prefix}
      {termsUrl ? (
        <Text accessibilityRole="link" style={[styles.link, linkStyle]} onPress={() => onOpen(termsUrl, LEGAL_VIEW_COPY.termsTitle)}>
          {LEGAL_CONSENT_COPY.terms}
        </Text>
      ) : (
        LEGAL_CONSENT_COPY.terms
      )}
      {LEGAL_CONSENT_COPY.and}
      {privacyUrl ? (
        <Text accessibilityRole="link" style={[styles.link, linkStyle]} onPress={() => onOpen(privacyUrl, LEGAL_VIEW_COPY.privacyTitle)}>
          {LEGAL_CONSENT_COPY.privacy}
        </Text>
      ) : (
        LEGAL_CONSENT_COPY.privacy
      )}
      {LEGAL_CONSENT_COPY.suffix}
    </Text>
  );
};

const styles = StyleSheet.create({
  link: { color: LEGAL_LINK_COLOR, textDecorationLine: 'underline', fontWeight: '600' },
});
