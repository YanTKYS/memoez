import { create } from 'zustand';

type LayoutMode = 'grid' | 'list';

interface SettingsState {
  layoutMode: LayoutMode;
  toggleLayout: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  layoutMode: 'grid',
  toggleLayout: () =>
    set((s) => ({ layoutMode: s.layoutMode === 'grid' ? 'list' : 'grid' })),
}));
