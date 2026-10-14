/**
 * アプリのエントリポイント。
 *
 * 通常の画面（Expo Router の "main"）に加えて、ホーム画面ウィジェットから開く
 * ウィンドウ（ネイティブ側: modules/memoez-widget の MemoEZWindowActivity）用の
 * コンポーネントを同じ JS バンドルに登録する。両者は同じ JS ランタイムで動くため、
 * DB 接続・Repository・保存処理を共有する。
 */
import 'expo-router/entry';
import { AppRegistry } from 'react-native';
import { WIDGET_WINDOW_COMPONENT, WidgetWindowRoot } from '@/ui/widget/WidgetWindowRoot';

AppRegistry.registerComponent(WIDGET_WINDOW_COMPONENT, () => WidgetWindowRoot);
