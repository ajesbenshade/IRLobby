import { StyleSheet } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors } from '@theme/index';

const MODULES = 21;

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const buildModules = (value: string) => {
  const seed = hashSeed(value || 'IRLobby');
  const cells: boolean[][] = [];

  for (let row = 0; row < MODULES; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < MODULES; col += 1) {
      const finder =
        (row < 7 && col < 7) ||
        (row < 7 && col >= MODULES - 7) ||
        (row >= MODULES - 7 && col < 7);
      if (finder) {
        const inset = row < 7 ? row : row - (MODULES - 7);
        const insetCol = col < 7 ? col : col - (MODULES - 7);
        const onBorder = inset === 0 || inset === 6 || insetCol === 0 || insetCol === 6;
        const inCenter = inset >= 2 && inset <= 4 && insetCol >= 2 && insetCol <= 4;
        line.push(onBorder || inCenter);
        continue;
      }

      const bit = (seed >> ((row * 3 + col) % 31)) & 1;
      const mix = (row * 17 + col * 13 + seed) % 5 !== 0;
      line.push(Boolean(bit) && mix);
    }
    cells.push(line);
  }

  return cells;
};

type TicketQrMarkProps = {
  value: string;
  size?: number;
};

export const TicketQrMark = ({ value, size = 112 }: TicketQrMarkProps) => {
  const modules = buildModules(value);
  const cell = size / MODULES;

  return (
    <View
      accessibilityLabel={`Ticket QR ${value}`}
      style={[
        styles.board,
        {
          width: size,
          height: size,
        },
      ]}
    >
      {modules.map((row, rowIndex) =>
        row.map((on, colIndex) =>
          on ? (
            <View
              key={`${rowIndex}-${colIndex}`}
              style={{
                position: 'absolute',
                left: colIndex * cell,
                top: rowIndex * cell,
                width: cell,
                height: cell,
                backgroundColor: appColors.ink,
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  board: {
    backgroundColor: appColors.white,
    overflow: 'hidden',
  },
});
