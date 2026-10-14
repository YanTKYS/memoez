package expo.modules.memoezwidget

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.util.Collections
import java.util.WeakHashMap

/**
 * ホーム画面の上に重ねて表示する React Native のウィンドウ（共通部分）。
 *
 * - テーマ（Theme.MemoEZ.Floating）が透過なので、背後にホーム画面が見える
 * - MainActivity と同じ ReactNativeHost（＝同じ JS ランタイム）を使うため、
 *   DB 接続・Repository・保存処理は通常画面と共通になる
 * - 表示するコンポーネントは index.ts で登録した "MemoEZWidgetWindow"。
 *   何を表示するか（編集 / メモ選択）は起動オプション（初期 props）で渡す
 *
 * 実際にマニフェストへ登録する Activity は、config plugin（plugin/withMemoEZWidget.js）が
 * アプリ側に生成するサブクラス（[WidgetContract.EDITOR_ACTIVITY] など）。
 * Expo SDK 52 の標準構成（MainActivity）と同じく、デリゲートを
 * `expo.modules.ReactActivityDelegateWrapper` で包んで Expo Modules にライフサイクルを通知する。
 * このラッパーは `expo` パッケージ（全 Expo モジュールに依存する）にあるため、
 * 依存が循環するこのライブラリからは参照できず、アプリ側で包む。
 */
abstract class MemoEZWindowActivity : ReactActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private var closeFallback: Runnable? = null

  /** React Native 側へ渡す初期 props */
  protected abstract fun createLaunchOptions(): Bundle

  /** アプリ側のサブクラスで `ReactActivityDelegateWrapper(this, isNewArch, createWindowDelegate())` を返す */
  abstract override fun createReactActivityDelegate(): ReactActivityDelegate

  /** 起動オプション（初期 props）付きの React Native デリゲート */
  protected fun createWindowDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, WidgetContract.COMPONENT_NAME, fabricEnabled) {
      override fun getLaunchOptions(): Bundle = createLaunchOptions()
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    // MainActivity と同様、画面状態の復元は行わない（react-native-screens の要件）
    super.onCreate(null)
    openWindows.add(this)
  }

  override fun getMainComponentName(): String = WidgetContract.COMPONENT_NAME

  /**
   * ホームボタン・履歴ボタンで離れたらウィンドウを閉じる。残しておくと、次にアプリ本体を
   * 開いたときに同じメモを 2 か所で編集している状態になる。
   *
   * 編集中なら、戻るボタン・× と同じく JS 側で「保存 → ウィジェット更新」が終わってから
   * closeWindow() で閉じる（ここで即座に finish すると、保存の完了を待たずに画面が破棄される）。
   * JS が応答しない場合に備え、一定時間後には閉じる。
   */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (isFinishing || closeFallback != null) return
    if (!MemoEZWidgetModule.requestWindowClose()) {
      finish()
      return
    }
    closeFallback = Runnable { if (!isFinishing) finish() }.also {
      handler.postDelayed(it, CLOSE_TIMEOUT_MS)
    }
  }

  override fun onDestroy() {
    closeFallback?.let(handler::removeCallbacks)
    closeFallback = null
    openWindows.remove(this)
    super.onDestroy()
  }

  companion object {
    /** 保存（端末内 SQLite）を待つ上限 */
    private const val CLOSE_TIMEOUT_MS = 5_000L

    private val openWindows: MutableSet<MemoEZWindowActivity> =
      Collections.synchronizedSet(Collections.newSetFromMap(WeakHashMap()))

    /**
     * 開いているウィンドウをすべて閉じる。閉じる対象があれば true。
     * ホームボタン後の保存待ちの間に MemoEZ 本体が前面に来ると React Native の
     * currentActivity は MainActivity に替わるため、currentActivity ではなく
     * ウィンドウ自身を記録して閉じる（本体の画面を閉じてしまわないように）。
     */
    internal fun finishOpenWindows(): Boolean {
      val windows = synchronized(openWindows) { openWindows.toList() }
      windows.forEach { window -> window.runOnUiThread { if (!window.isFinishing) window.finish() } }
      return windows.isNotEmpty()
    }
  }
}
