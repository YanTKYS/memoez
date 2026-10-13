package expo.modules.memoezwidget

import android.appwidget.AppWidgetManager
import android.os.Bundle

/** ウィジェットのタップで開く、ホーム画面上のメモ編集ウィンドウ */
class FloatingEditorActivity : MemoEZWindowActivity() {
  override fun createLaunchOptions(): Bundle = Bundle().apply {
    putString("mode", WidgetContract.MODE_EDIT)
    putInt("noteId", intent?.getIntExtra(WidgetContract.EXTRA_NOTE_ID, 0) ?: 0)
    putInt(
      "appWidgetId",
      intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        ?: AppWidgetManager.INVALID_APPWIDGET_ID,
    )
  }
}
