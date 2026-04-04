import type { NoteColor } from '@/domain/entities/Note';

/** メモカード背景色 (ライトモード) */
export const NOTE_COLOR_LIGHT: Record<NoteColor, string> = {
  NONE:   '#F5F5F5',
  RED:    '#FFCDD2',
  ORANGE: '#FFE0B2',
  YELLOW: '#FFF9C4',
  GREEN:  '#DCEDC8',
  TEAL:   '#B2DFDB',
  BLUE:   '#BBDEFB',
  PURPLE: '#E1BEE7',
};

/** メモカード背景色 (ダークモード) */
export const NOTE_COLOR_DARK: Record<NoteColor, string> = {
  NONE:   '#2B2930',
  RED:    '#93000A',
  ORANGE: '#7A3700',
  YELLOW: '#5C4300',
  GREEN:  '#1E4620',
  TEAL:   '#00363A',
  BLUE:   '#003062',
  PURPLE: '#38006B',
};

/** カラーパレット順序 (PickerUI用) */
export const NOTE_COLOR_ORDER: NoteColor[] = [
  'NONE', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'TEAL', 'BLUE', 'PURPLE',
];

/** 表示ラベル */
export const NOTE_COLOR_LABEL: Record<NoteColor, string> = {
  NONE:   'デフォルト',
  RED:    '赤',
  ORANGE: 'オレンジ',
  YELLOW: '黄色',
  GREEN:  '緑',
  TEAL:   '青緑',
  BLUE:   '青',
  PURPLE: '紫',
};
