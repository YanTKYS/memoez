package expo.modules.memoezwidget

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * ホーム画面の上に重ねて表示する React Native のウィンドウ。
 *
 * - テーマ（Theme.MemoEZ.Floating）が透過なので、背後にホーム画面が見える
 * - MainActivity と同じ ReactNativeHost（＝同じ JS ランタイム）を使うため、
 *   DB 接続・Repository・保存処理は通常画面と共通になる
 * - 表示するコンポーネントは index.ts で登録した "MemoEZWidgetWindow"。
 *   何を表示するか（編集 / メモ選択）は起動オプション（初期 props）で渡す
 */
abstract class MemoEZWindowActivity : ReactActivity() {
  /** React Native 側へ渡す初期 props */
  protected abstract fun createLaunchOptions(): Bundle

  override fun onCreate(savedInstanceState: Bundle?) {
    // MainActivity と同様、画面状態の復元は行わない（react-native-screens の要件）
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = WidgetContract.COMPONENT_NAME

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, WidgetContract.COMPONENT_NAME, fabricEnabled) {
      override fun getLaunchOptions(): Bundle = createLaunchOptions()
    }

  /**
   * ホームボタン・履歴ボタンで離れたらウィンドウを閉じる（入力中の内容は JS 側が
   * バックグラウンド移行・アンマウント時に保存する）。残しておくと、次にアプリ本体を
   * 開いたときに同じメモを 2 か所で編集している状態になる。
   */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    finish()
  }
}
