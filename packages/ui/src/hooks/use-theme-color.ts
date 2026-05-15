import { Colors } from '../theme';
import { useColorScheme } from '../hooks/use-color-scheme';

type ThemeName = 'light' | 'dark';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme: ThemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colorFromProps = props[theme];

  return colorFromProps ?? Colors[theme][colorName];
}
