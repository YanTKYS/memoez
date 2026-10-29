import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SettingsScreen } from '../SettingsScreen';
import type { useAppUpdate } from '@/ui/hooks/useAppUpdate';

jest.mock('expo-font', () => ({ isLoaded: () => true, loadAsync: async () => {} }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  SafeAreaProvider: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => {
  const mockRouter = { push: jest.fn(), back: jest.fn() };
  return { useRouter: () => mockRouter, mockRouter };
});
jest.mock('@/ui/hooks/useAppUpdate', () => {
  const mockState = {
    installed: { versionName: '7.8.9', versionCode: 543, debuggable: false },
    result: null, busy: null, progress: null, ready: false, installerOpen: false, permission: false, message: '',
    check: jest.fn(async () => {}), download: jest.fn(async () => {}), install: jest.fn(async () => {}), openPermission: jest.fn(async () => {}), cancel: jest.fn(), discard: jest.fn(),
  };
  return { useAppUpdate: () => mockState, mockState };
});
/* eslint-disable @typescript-eslint/no-require-imports */
const { mockState: state } = require('@/ui/hooks/useAppUpdate') as { mockState: ReturnType<typeof useAppUpdate> };
const { mockRouter: router } = require('expo-router') as { mockRouter: { push: jest.Mock; back: jest.Mock } };
/* eslint-enable @typescript-eslint/no-require-imports */
beforeEach(() => {
  state.result = null; state.ready = false; state.busy = null; state.message = ''; state.installerOpen = false; state.permission = false;
  state.check = jest.fn(async () => {}); state.download = jest.fn(async () => {}); state.install = jest.fn(async () => {}); state.openPermission = jest.fn(async () => {}); state.discard = jest.fn();
  router.push = jest.fn();
});
const offer = { versionName: '7.8.10', versionCode: 544, page: 'https://github.com/YanTKYS/memoez/releases/tag/v7.8.10', notes: 'Release notes', size: 1024 };
describe('settings and backup entry', () => {
  it('displays installed PackageInfo, preserves backup navigation, and does not automatically check', () => {
    const screen = render(<SettingsScreen />);
    expect(screen.getByText('インストール済み: 7.8.9（543）')).not.toBeNull();
    expect(state.check).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('バックアップ'));
    expect(state.discard).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/backup');
    fireEvent.press(screen.getByText('最新版を確認'));
    expect(state.check).toHaveBeenCalledTimes(1);
    expect(state.download).not.toHaveBeenCalled();
  });
  it('shows update only when a validated update is available', () => {
    state.result = { status: 'older', release: offer, reason: null, versionName: offer.versionName, page: offer.page };
    const screen = render(<SettingsScreen />);
    expect(screen.queryByText(/更新する（/)).toBeNull();
    state.result.status = 'available';
    screen.rerender(<SettingsScreen />);
    fireEvent.press(screen.getByText(/更新する（/));
    expect(state.download).toHaveBeenCalledTimes(1);
    expect(state.install).not.toHaveBeenCalled();
  });
  it('requires an explicit permission setting action and keeps installer disabled while unpermitted', () => {
    state.ready = true;
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Android の確認画面を開く'));
    expect(state.install).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('この提供元からのインストール設定'));
    expect(state.openPermission).toHaveBeenCalledTimes(1);
    expect(state.install).not.toHaveBeenCalled();
    state.permission = true;
    screen.rerender(<SettingsScreen />);
    fireEvent.press(screen.getByText('Android の確認画面を開く'));
    expect(state.install).toHaveBeenCalledTimes(1);
  });
});
