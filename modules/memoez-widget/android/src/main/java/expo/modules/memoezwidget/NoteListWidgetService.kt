package expo.modules.memoezwidget

import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/** 一覧ウィジェットの行を供給する（RemoteViews コレクション） */
class NoteListWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = NoteListRemoteViewsFactory(applicationContext)
}

internal class NoteListRemoteViewsFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
  private var snapshot: NoteListSnapshot? = null

  override fun onCreate() {}

  /** notifyAppWidgetViewDataChanged のたび（と初回）に呼ばれる。端末内の保存内容を読むだけなので軽い */
  override fun onDataSetChanged() {
    snapshot = NoteListSnapshot.parse(WidgetStore.listSnapshot(context))
  }

  override fun onDestroy() {
    snapshot = null
  }

  override fun getCount(): Int = snapshot?.items?.size ?: 0

  override fun getViewAt(position: Int): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.memoez_widget_list_item)
    val current = snapshot ?: return views
    val item = current.items.getOrNull(position) ?: return views

    views.setTextViewText(R.id.memoez_list_item_title, item.title)
    if (item.preview.isEmpty()) {
      views.setViewVisibility(R.id.memoez_list_item_preview, View.GONE)
    } else {
      views.setViewVisibility(R.id.memoez_list_item_preview, View.VISIBLE)
      views.setTextViewText(R.id.memoez_list_item_preview, item.preview)
    }
    for (id in intArrayOf(R.id.memoez_list_item_title, R.id.memoez_list_item_preview)) {
      views.setDayNightColor(context, id, "setTextColor", current.colors.textLight, current.colors.textDark)
    }

    if (item.accentLight != null && item.accentDark != null) {
      views.setViewVisibility(R.id.memoez_list_item_accent, View.VISIBLE)
      views.setDayNightColor(context, R.id.memoez_list_item_accent, "setColorFilter", item.accentLight, item.accentDark)
    } else {
      // 帯の幅は残して、カラーの有無で文字の位置がずれないようにする
      views.setViewVisibility(R.id.memoez_list_item_accent, View.INVISIBLE)
    }

    // 行全体がタップ領域。テンプレート（NoteListWidgetProvider.editorTemplate）にメモ ID を足す
    views.setOnClickFillInIntent(
      R.id.memoez_list_item,
      Intent().putExtra(WidgetContract.EXTRA_NOTE_ID, item.noteId),
    )
    return views
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount(): Int = 1

  override fun getItemId(position: Int): Long =
    snapshot?.items?.getOrNull(position)?.noteId?.toLong() ?: position.toLong()

  override fun hasStableIds(): Boolean = true
}
