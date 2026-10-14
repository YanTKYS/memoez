package expo.modules.memoezwidget

import android.app.ActivityManager
import android.os.Build
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
  /** 保存失敗で閉じられず、履歴（最近使ったアプリ）から戻れるようにした */
  private var shownInRecents = false

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
   * JS（React Native）が応答しない場合に備え、一定時間内に受領の返事
   * （acknowledgeCloseRequest）がなければ閉じる。受領後は保存に時間がかかっても待ち、
   * 成功なら JS が closeWindow() を、失敗なら keepWindowOpen() を呼ぶ。
   */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (isFinishing || closeFallback != null) return
    if (!MemoEZWidgetModule.requestWindowClose()) {
      finish()
      return
    }
    closeFallback = Runnable { finishWindow() }.also {
      handler.postDelayed(it, CLOSE_TIMEOUT_MS)
    }
  }

  /** JS が閉じる依頼を受け取った。以後は保存の結果（closeWindow / keepWindowOpen）を待つ */
  private fun cancelCloseTimeout() {
    closeFallback?.let(handler::removeCallbacks)
    closeFallback = null
  }

  /**
   * 閉じる前の保存に失敗した。入力内容を持つこのウィンドウを破棄せずに残し、
   * 履歴から戻れるようにする（通常は excludeFromRecents で一覧に出さない）。
   * 次にホームボタン等で離れたとき、または戻る・× で閉じるときに保存を再試行する。
   */
  private fun keepOpenAfterFailedClose() {
    cancelCloseTimeout()
    if (shownInRecents) return
    shownInRecents = true
    try {
      getSystemService(ActivityManager::class.java)?.appTasks
        ?.firstOrNull { taskIdOf(it.taskInfo) == taskId }
        ?.setExcludeFromRecents(false)
    } catch (e: RuntimeException) {
      // タスクが既に無いなど。ウィンドウは残っているので、ウィジェットから開き直せる
    }
  }

  @Suppress("DEPRECATION")
  private fun taskIdOf(info: ActivityManager.RecentTaskInfo): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) info.taskId else info.id

  private fun finishWindow() {
    if (isFinishing) return
    // 履歴に出したウィンドウは、閉じたらタスクごと一覧から消す
    if (shownInRecents) finishAndRemoveTask() else finish()
  }

  override fun onDestroy() {
    closeFallback?.let(handler::removeCallbacks)
    closeFallback = null
    openWindows.remove(this)
    super.onDestroy()
  }

  companion object {
    /** JS が閉じる依頼を受け取るまでの上限（保存そのものの時間は含まない） */
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
      val windows = snapshotWindows()
      windows.forEach { window -> window.runOnUiThread { window.finishWindow() } }
      return windows.isNotEmpty()
    }

    /** JS が閉じる依頼を受け取った（応答なしとみなす時間切れを取り消す） */
    internal fun acknowledgeCloseRequests() {
      snapshotWindows().forEach { window -> window.runOnUiThread { window.cancelCloseTimeout() } }
    }

    /** 閉じる前の保存に失敗したウィンドウを残す（時間切れによる破棄を取り消す） */
    internal fun keepOpenWindows() {
      snapshotWindows().forEach { window -> window.runOnUiThread { window.keepOpenAfterFailedClose() } }
    }

    private fun snapshotWindows(): List<MemoEZWindowActivity> =
      synchronized(openWindows) { openWindows.toList() }
  }
}
