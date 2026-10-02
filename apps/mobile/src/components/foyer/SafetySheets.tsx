import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { ConfirmSheet } from '@components/foyer/ConfirmSheet';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, MEMBER_COPY } from '@constants/foyerCopy';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type BlockProps = {
  visible: boolean;
  name: string;
  onClose: () => void;
  /** Resolves when the server accepted the block. */
  onConfirm: () => Promise<void>;
  onDone: () => void;
};

/** Block confirm sheet: four bullets, `Block` (primary) and `Cancel`. */
export const BlockSheet = ({ visible, name, onClose, onConfirm, onDone }: BlockProps) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bullets = MEMBER_COPY.blockBullets(name);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onDone();
    } catch (blockError) {
      setError(getErrorMessage(blockError, COMMON_COPY.genericError));
    } finally {
      setPending(false);
    }
  };

  return (
    <FoyerSheet
      visible={visible}
      onDismiss={onClose}
      footer={
        <SheetButtons>
          <InlineError message={error} />
          <PillButton label={MEMBER_COPY.block} loading={pending} onPress={() => void confirm()} />
          <PillButton label={COMMON_COPY.cancel} variant="outline" disabled={pending} onPress={onClose} />
        </SheetButtons>
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        {MEMBER_COPY.blockTitle(name)}
      </Text>
      <Text style={styles.body}>{MEMBER_COPY.blockLead(name)}</Text>
      {bullets.map((bullet) => (
        <View key={bullet} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={[styles.body, styles.bulletText]}>{bullet}</Text>
        </View>
      ))}
    </FoyerSheet>
  );
};

type ReportProps = {
  visible: boolean;
  name: string;
  onClose: () => void;
  onSubmit: (payload: { reason: string; description?: string }) => Promise<void>;
  /** Replaces the default lead line (photo reports say the person who added it won't be told). */
  lead?: string;
  title?: string;
  onSent: () => void;
};

/** Report sheet: five reasons (radio, one required), optional details, `Submit report` disabled until a reason is chosen. */
export const ReportSheet = ({ visible, name, onClose, onSubmit, onSent, lead, title }: ReportProps) => {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSent(false);
    setReason(null);
    setDetails('');
    setError(null);
  };

  const submit = async () => {
    if (!reason) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({ reason, description: details.trim() || undefined });
      setSent(true);
    } catch (reportError) {
      setError(getErrorMessage(reportError, COMMON_COPY.genericError));
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    // Confirmation sheet (report-sent.png).
    return (
      <FoyerSheet
        visible={visible}
        onDismiss={() => {
          reset();
          onSent();
        }}
        footer={
          <SheetButtons>
            <PillButton
              label={COMMON_COPY.done}
              onPress={() => {
                reset();
                onSent();
              }}
              testID="report-sent-done"
            />
          </SheetButtons>
        }
      >
        <Text accessibilityRole="header" style={styles.title}>
          {MEMBER_COPY.reportSentTitle}
        </Text>
        <Text style={styles.body}>{MEMBER_COPY.reportSentBody}</Text>
      </FoyerSheet>
    );
  }

  return (
    <FoyerSheet
      visible={visible}
      onDismiss={() => {
        reset();
        onClose();
      }}
      footer={
        <SheetButtons>
          <InlineError message={error} />
          <PillButton label={MEMBER_COPY.submitReport} disabled={!reason} loading={pending} onPress={() => void submit()} />
          <PillButton
            label={COMMON_COPY.cancel}
            variant="outline"
            disabled={pending}
            onPress={() => {
              reset();
              onClose();
            }}
          />
        </SheetButtons>
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        {title ?? MEMBER_COPY.reportTitle(name)}
      </Text>
      <Text style={styles.body}>{lead ?? MEMBER_COPY.reportLead(name)}</Text>
      <View accessibilityRole="radiogroup" style={styles.reasons}>
        {MEMBER_COPY.reportReasons.map((option) => {
          const selected = reason === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => setReason(option.value)}
              style={styles.reasonRow}
            >
              <View style={[styles.radio, selected ? styles.radioOn : null]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.body, styles.bulletText]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        accessibilityLabel={MEMBER_COPY.reportDetails}
        value={details}
        onChangeText={setDetails}
        placeholder={MEMBER_COPY.reportDetails}
        placeholderTextColor={appColors.softInk}
        multiline
        style={styles.details}
      />
    </FoyerSheet>
  );
};

type ActionRow = { label: string; sub?: string; onPress: () => void; testID?: string };

/** `…` menu as a sheet of rows (Report, Block, etc.) with Cancel. */
export const ActionSheet = ({
  visible,
  rows,
  onClose,
}: {
  visible: boolean;
  rows: ActionRow[];
  onClose: () => void;
}) => (
  <FoyerSheet
    visible={visible}
    onDismiss={onClose}
    footer={
      <SheetButtons>
        <PillButton label={COMMON_COPY.cancel} variant="outline" onPress={onClose} />
      </SheetButtons>
    }
  >
    {rows.map((row) => (
      <Pressable
        key={row.label}
        accessibilityRole="button"
        accessibilityLabel={row.label}
        testID={row.testID}
        onPress={row.onPress}
        style={styles.actionRow}
      >
        <Text style={styles.actionLabel}>{row.label}</Text>
        {row.sub ? <Text style={styles.actionSub}>{row.sub}</Text> : null}
      </Pressable>
    ))}
  </FoyerSheet>
);

export { ConfirmSheet };

const styles = StyleSheet.create({
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: appColors.primary, fontSize: 15, lineHeight: 22 },
  bulletText: { flex: 1, flexShrink: 1 },
  reasons: { gap: 2 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cec8c4', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: appColors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: appColors.primary },
  details: {
    minHeight: 84,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
    fontSize: 15,
  },
  actionRow: { minHeight: 56, justifyContent: 'center', paddingVertical: 8 },
  actionLabel: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  actionSub: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
});
