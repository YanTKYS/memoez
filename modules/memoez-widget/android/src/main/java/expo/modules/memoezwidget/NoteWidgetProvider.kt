package expo.modules.memoezwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.os.Bundle

/**
 * 付箋ウィジェット。描画は WidgetStore のスナップショットだけで行うため、
 * JS（React Native）が起動していなくても、端末再起動直後でも表示できる。
 */
class NoteWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { NoteWidgetRenderer.render(context, appWidgetManager, it) }
  }

  /** サイズ変更に合わせて表示行数を計算し直す */
  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle?,
  ) {
    NoteWidgetRenderer.render(context, appWidgetManager, appWidgetId)
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    WidgetStore.removeWidgets(context, appWidgetIds)
  }

  override fun onRestored(context: Context, oldWidgetIds: IntArray, newWidgetIds: IntArray) {
    WidgetStore.remapWidgets(context, oldWidgetIds, newWidgetIds)
  }

  override fun onDisabled(context: Context) {
    // 最後のウィジェットが削除された
    WidgetStore.clear(context)
  }

  companion object {
    fun widgetIds(context: Context): IntArray =
      AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, NoteWidgetProvider::class.java))

    fun render(context: Context, appWidgetIds: Collection<Int>) {
      if (appWidgetIds.isEmpty()) return
      val manager = AppWidgetManager.getInstance(context)
      appWidgetIds.forEach { NoteWidgetRenderer.render(context, manager, it) }
    }

    /** 指定したメモを表示しているウィジェットを描画し直す */
    fun renderNotes(context: Context, noteIds: Set<Int>) {
      if (noteIds.isEmpty()) return
      val targets = WidgetStore.activeBindings(context, widgetIds(context).toSet())
        .filterValues { it in noteIds }
        .keys
      render(context, targets)
    }
  }
}
