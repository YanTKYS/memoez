import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const palette = {
  primary:      '#FFA000',
  primaryLight: '#FFC107',
  onPrimary:    '#1C1B1F',
};

export const memoEZTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:          palette.primary,
    onPrimary:        palette.onPrimary,
    primaryContainer: palette.primaryLight,
  },
};

export const memoEZDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary:          palette.primaryLight,
    onPrimary:        palette.onPrimary,
    primaryContainer: palette.primary,
  },
};
