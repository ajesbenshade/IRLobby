import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { Radio } from '@components/foyer/Choice';
import { NoticeSheet } from '@components/foyer/NoticeSheet';
import { InfoNotice } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { CHURCH_STEP_COPY } from '@constants/foyerCopy';
import { fetchChurches, type ChurchRecord } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';

type ChurchPickerProps = {
  selected: ChurchRecord | null;
  onSelect: (church: ChurchRecord) => void;
  /**
   * `sheet` opens the `My church isn't listed` note in its own sheet (church step). `inline` shows it as a
   * note under the list, for when the picker is already inside a sheet (no sheet on top of a sheet).
   */
  notListedMode?: 'sheet' | 'inline';
};

/** Search field above a radio list of churches, then `My church isn't listed`. Uses `fetchChurches()`. */
export const ChurchPicker = ({ selected, onSelect, notListedMode = 'sheet' }: ChurchPickerProps) => {
  const [query, setQuery] = useState('');
  const [notListedOpen, setNotListedOpen] = useState(false);
  const churches = useQuery({
    queryKey: ['foyer-churches', query.trim()],
    queryFn: () => fetchChurches(query.trim()),
    retry: false,
  });
  const results = churches.data ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={appColors.mutedInk} />
        <TextInput
          accessibilityLabel={CHURCH_STEP_COPY.searchPlaceholder}
          value={query}
          onChangeText={setQuery}
          placeholder={CHURCH_STEP_COPY.searchPlaceholder}
          placeholderTextColor={appColors.softInk}
          autoCorrect={false}
          style={styles.searchInput}
          testID="church-search"
        />
      </View>
      <View style={styles.list} accessibilityRole="radiogroup">
        {churches.isLoading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
        {churches.isError ? <Text style={styles.empty}>{CHURCH_STEP_COPY.loadFailed}</Text> : null}
        {!churches.isLoading && !churches.isError && results.length === 0 ? (
          <Text style={styles.empty}>{CHURCH_STEP_COPY.noResults}</Text>
        ) : null}
        {results.map((church, index) => {
          const isSelected = selected?.id === church.id;
          return (
            <Pressable
              key={church.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={church.name}
              onPress={() => onSelect(church)}
              style={styles.row}
              testID={`church-option-${church.id}`}
            >
              <Radio selected={isSelected} />
              {/* Frame 242: the divider is inset to start at the label, not under the radio. */}
              <View
                style={[styles.rowLabel, index < results.length - 1 ? styles.rowDivider : null]}
                testID={`church-option-label-${church.id}`}
              >
                <Text style={[styles.rowText, isSelected ? styles.rowTextSelected : null]}>{church.name}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setNotListedOpen((open) => (notListedMode === 'inline' ? !open : true))}
        style={styles.link}
        testID="church-not-listed"
      >
        <Text style={styles.linkText}>{CHURCH_STEP_COPY.notListed}</Text>
      </Pressable>
      {notListedMode === 'inline' && notListedOpen ? (
        <InfoNotice message={CHURCH_STEP_COPY.notListedBody} testID="church-not-listed-note" />
      ) : null}
      {notListedMode === 'sheet' ? (
        <NoticeSheet
          visible={notListedOpen}
          title={CHURCH_STEP_COPY.notListed}
          body={CHURCH_STEP_COPY.notListedBody}
          okLabel={CHURCH_STEP_COPY.ok}
          onClose={() => setNotListedOpen(false)}
          testID="church-not-listed"
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 12 },
  searchRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, minHeight: 48, fontFamily: appTypography.bodyRegular, fontSize: 16, color: appColors.ink },
  list: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  loading: { paddingVertical: 16 },
  empty: { padding: 16, fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.mutedInk },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 },
  rowLabel: { flex: 1, alignSelf: 'stretch', minHeight: 56, justifyContent: 'center', paddingRight: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: appColors.line },
  rowText: { flex: 1, fontFamily: appTypography.bodyMedium, fontSize: 16, color: appColors.ink },
  rowTextSelected: { fontFamily: appTypography.bodySemibold, fontWeight: '700' },
  link: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.primary },
});
