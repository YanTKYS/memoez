package expo.modules.memoezwidget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle

/**
 * ウィジェット配置時（および選び直し時）に、表示するメモを選ぶウィンドウ。
 * 選択が完了したら MemoEZWidgetModule.completeConfiguration から finishConfigured() が呼ばれる。
 */
class WidgetConfigActivity : MemoEZWindowActivity() {
  private val appWidgetId: Int
    get() = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID

  override fun onCreate(savedInstanceState: Bundle?) {
    // 選ばずに閉じた場合はキャンセル（配置途中のウィジェットはランチャーが取り除く）
    setResult(Activity.RESULT_CANCELED, resultIntent())
    super.onCreate(savedInstanceState)
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) finish()
  }

  override fun createLaunchOptions(): Bundle = Bundle().apply {
    putString("mode", WidgetContract.MODE_CONFIGURE)
    putInt("appWidgetId", appWidgetId)
  }

  internal fun finishConfigured(configuredWidgetId: Int) {
    if (configuredWidgetId != appWidgetId) return
    setResult(Activity.RESULT_OK, resultIntent())
    finish()
  }

  private fun resultIntent(): Intent =
    Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
}
