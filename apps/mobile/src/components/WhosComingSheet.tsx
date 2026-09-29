import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import {
  WHOS_COMING_NOTE,
  buildRsvpPayload,
  childDisplayName,
  confirmGoingLabel,
  defaultRsvpSelection,
  peopleCount,
  type WhosComingResponse,
} from '@foyer/logic';
import { appColors, appTypography, fontSize, radii } from '@theme/index';

type WhosComingSheetProps = {
  response: WhosComingResponse;
  subtitle?: string;
  pending?: boolean;
  onConfirm: (payload: { include_self: boolean; dependent_ids: number[] }) => void;
};

export const WhosComingSheet = ({ response, subtitle, pending, onConfirm }: WhosComingSheetProps) => {
  const initial = useMemo(() => defaultRsvpSelection(response), [response]);
  const [includeSelf, setIncludeSelf] = useState(initial.includeSelf);
  const [dependentIds, setDependentIds] = useState<number[]>(initial.dependentIds);
  const count = peopleCount(includeSelf, dependentIds);

  const toggleChild = (id: number) => {
    setDependentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.title}>Who's coming?</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: includeSelf, disabled: !response.me.eligible }}
        disabled={!response.me.eligible}
        onPress={() => setIncludeSelf((value) => !value)}
        style={[styles.row, includeSelf ? styles.rowOn : null, !response.me.eligible ? styles.rowOff : null]}
      >
        <View style={[styles.box, includeSelf ? styles.boxOn : null]} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>ME</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.name}>Me</Text>
          <Text style={styles.meta}>{response.me.eligible ? 'Your RSVP' : response.me.reason}</Text>
        </View>
      </Pressable>

      {response.dependents.map((child) => {
        const selected = dependentIds.includes(child.id);
        return (
          <Pressable
            key={child.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled: !child.eligible }}
            accessibilityLabel={childDisplayName(child.name, child.age)}
            disabled={!child.eligible}
            onPress={() => toggleChild(child.id)}
            style={[styles.row, selected ? styles.rowOn : null, !child.eligible ? styles.rowOff : null]}
          >
            <View style={[styles.box, selected ? styles.boxOn : null]} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{child.name.replace(/\s+/g, '').slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.name, !child.eligible ? styles.nameOff : null]}>
                {childDisplayName(child.name, child.age)}
              </Text>
              <Text style={styles.meta}>
                {child.eligible ? 'In your household' : child.reason || 'Outside this event\'s age range'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.note}>{response.note || WHOS_COMING_NOTE}</Text>
      <AppButton
        disabled={pending || count < 1}
        loading={pending}
        onPress={() => onConfirm(buildRsvpPayload(includeSelf, dependentIds))}
      >
        {confirmGoingLabel(count)}
      </AppButton>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: appColors.white,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: appColors.line,
    marginBottom: 4,
  },
  title: {
    fontFamily: appTypography.heading,
    fontSize: 26,
    color: appColors.ink,
  },
  subtitle: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 14,
    color: appColors.mutedInk,
    marginTop: -6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.list,
    backgroundColor: appColors.background,
    padding: 12,
  },
  rowOn: {
    backgroundColor: appColors.primaryWash,
  },
  rowOff: {
    opacity: 0.55,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
  },
  boxOn: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: appColors.primary,
    fontFamily: appTypography.bodySemibold,
    fontSize: 12,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    color: appColors.ink,
  },
  nameOff: {
    color: appColors.softInk,
  },
  meta: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 13,
    color: appColors.mutedInk,
  },
  note: {
    fontFamily: appTypography.bodyRegular,
    fontSize: fontSize.sm,
    color: appColors.mutedInk,
    lineHeight: 18,
  },
});
