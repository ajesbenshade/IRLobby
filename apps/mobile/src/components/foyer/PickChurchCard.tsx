import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ChurchPicker } from '@components/foyer/ChurchPicker';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { InlineError, PillButton, SheetButtons } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { CHURCH_STEP_COPY, PICK_CHURCH_COPY } from '@constants/foyerCopy';
import {
  loadPickChurchDismissed,
  saveChurchChoice,
  savePickChurchDismissed,
  showsPickChurchCard,
  type PickChurchSurface,
} from '@foyer/firstRun';
import { useAuth } from '@hooks/useAuth';
import type { ChurchRecord } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';

/** The church picker in a sheet. Saves like Profile (`PATCH /api/users/profile/ {church_id}`), then refreshes. */
export const ChurchPickerSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { refreshProfile } = useAuth();
  const [selected, setSelected] = useState<ChurchRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setError(null);
      setPending(false);
    }
  }, [visible]);

  const save = async () => {
    if (!selected || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await saveChurchChoice(selected.id);
      await refreshProfile();
      onClose();
    } catch {
      setError(CHURCH_STEP_COPY.saveFailed);
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
          <PillButton
            label={PICK_CHURCH_COPY.save}
            disabled={!selected}
            loading={pending}
            onPress={() => void save()}
            testID="church-sheet-save"
          />
          <PillButton label={PICK_CHURCH_COPY.cancel} variant="outline" disabled={pending} onPress={onClose} testID="church-sheet-cancel" />
        </SheetButtons>
      }
    >
      <Text accessibilityRole="header" style={styles.sheetTitle}>
        {PICK_CHURCH_COPY.sheetTitle}
      </Text>
      <ChurchPicker selected={selected} onSelect={setSelected} notListedMode="inline" />
    </FoyerSheet>
  );
};

/**
 * `Pick your church` for Foyer members with no church. Discover shows it until `Not now` (remembered on the
 * device); Profile always shows it while there is no church (`Not now` there hides it for this visit only).
 */
export const PickChurchCard = ({ surface }: { surface: PickChurchSurface }) => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [hiddenThisVisit, setHiddenThisVisit] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void loadPickChurchDismissed().then((value) => {
      if (active) {
        setDismissed(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const visible =
    // Discover waits for the stored flag so a dismissed card never flashes.
    (surface === 'profile' || dismissed != null) &&
    showsPickChurchCard({ churchId: user?.churchId ?? null, surface, dismissed: Boolean(dismissed), hiddenThisVisit });

  const notNow = () => {
    setHiddenThisVisit(true);
    if (surface === 'discover') {
      setDismissed(true);
      void savePickChurchDismissed();
    }
  };

  return (
    <>
      {visible ? (
        <View style={styles.card} testID={`pick-church-card-${surface}`}>
          <Text accessibilityRole="header" style={styles.title}>
            {PICK_CHURCH_COPY.title}
          </Text>
          <Text style={styles.body}>{PICK_CHURCH_COPY.body}</Text>
          <View style={styles.buttons}>
            <PillButton label={PICK_CHURCH_COPY.choose} onPress={() => setPickerOpen(true)} style={styles.button} testID="pick-church-choose" />
            <PillButton label={PICK_CHURCH_COPY.notNow} variant="outline" onPress={notNow} style={styles.button} testID="pick-church-not-now" />
          </View>
        </View>
      ) : null}
      <ChurchPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
};

export const PICK_CHURCH_BUTTON_HEIGHT = 48;

const styles = StyleSheet.create({
  card: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 16, gap: 8 },
  title: { fontFamily: appTypography.heading, fontSize: 22, lineHeight: 30, color: appColors.ink },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.mutedInk },
  // Frame 245: side by side, Choose church (burgundy) then Not now (outline).
  buttons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  // Frame 245: both buttons are 48pt (PillButton's default minimum is 54).
  button: { flex: 1, minHeight: PICK_CHURCH_BUTTON_HEIGHT, paddingVertical: 8 },
  sheetTitle: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
});
