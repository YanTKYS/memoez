import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LayoutMode = 'grid' | 'list';

interface SettingsState {
  layoutMode:   LayoutMode;
  toggleLayout: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      layoutMode:   'grid',
      toggleLayout: () =>
        set((s) => ({ layoutMode: s.layoutMode === 'grid' ? 'list' : 'grid' })),
    }),
    {
      name:    'memoez-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // 永続化する項目を明示 (関数は除外)
      partialize: (state) => ({ layoutMode: state.layoutMode }),
    },
  ),
);
