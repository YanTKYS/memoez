import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/ui/theme/spacing';

/** スマートフォンで扱いやすく、背後のホーム画面も見える大きさ */
const MAX_CARD_WIDTH  = 560;
const MAX_CARD_HEIGHT = 680;
const CARD_HEIGHT_RATIO = 0.8;

interface Props {
  /** カードの外側（背後のホーム画面が見えている部分）をタップしたとき */
  onRequestClose: () => void;
  children: React.ReactNode;
}

/**
 * ホーム画面の上に浮かぶカード。Activity のウィンドウ自体は透過・全画面で、
 * ここで余白を取ってカードを中央に置く。ソフトウェアキーボード表示時は
 * ウィンドウが縮む（adjustResize）ので、カードもそれに合わせて縮む。
 */
export function FloatingWindow({ onRequestClose, children }: Props) {
  const theme  = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel="閉じる"
      />
      <View
        pointerEvents="box-none"
        style={[
          styles.frame,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              maxHeight: Math.min(MAX_CARD_HEIGHT, height * CARD_HEIGHT_RATIO),
            },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: 'transparent' },
  frame: {
    ...StyleSheet.absoluteFillObject,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    flex:         1,
    width:        '100%',
    maxWidth:     MAX_CARD_WIDTH,
    borderRadius: 20,
    overflow:     'hidden',
    elevation:    12,
  },
});
