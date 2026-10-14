package expo.modules.memoezwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews

/**
 * 4×2 一覧ウィジェット。最近のメモ（ピン留め優先 → 更新日時順、最大 50 件）を縦スクロールで表示する。
 *
 * 行は RemoteViews コレクション（[NoteListWidgetService]）で供給し、内容は WidgetStore の
 * 一覧スナップショットから作るため、JS が起動していなくても・端末再起動後でも表示できる。
 * スナップショットは JS が SQLite から作って渡す（src/lib/widget/widgetSync.ts）。
 */
class NoteListWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { render(context, appWidgetManager, it) }
    if (WidgetStore.listSnapshot(context) == null) {
      // 一覧の内容がまだない（初めての配置など）。アプリが動いていれば作ってもらう
      MemoEZWidgetModule.requestListSync()
    }
  }

  override fun onDisabled(context: Context) {
    // 最後の一覧ウィジェットが削除された。次に配置したとき古い内容を出さない
    WidgetStore.clearList(context)
  }

  companion object {
    fun widgetIds(context: Context): IntArray =
      AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, NoteListWidgetProvider::class.java))

    /**
     * 一覧の内容が変わったときに呼ぶ。行の中身だけを読み直してもらう。
     * 枠（空表示の文言など）は、内容が初めて作られたときだけ描画し直す。
     */
    fun refresh(context: Context, redrawFrame: Boolean) {
      val ids = widgetIds(context)
      if (ids.isEmpty()) return
      val manager = AppWidgetManager.getInstance(context)
      if (redrawFrame) ids.forEach { render(context, manager, it) }
      @Suppress("DEPRECATION")
      manager.notifyAppWidgetViewDataChanged(ids, R.id.memoez_list)
    }

    private fun render(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      val views = RemoteViews(context.packageName, R.layout.memoez_widget_list)
      val snapshot = NoteListSnapshot.parse(WidgetStore.listSnapshot(context))
      val colors = snapshot?.colors ?: WidgetColors.DEFAULT

      // 行の供給元。ウィジェットごとに別の Intent として扱われるよう URI を付ける
      // （Activity を起動する Intent ではないので、Expo Router に届くことはない）
      val serviceIntent = Intent(context, NoteListWidgetService::class.java).apply {
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
      }
      @Suppress("DEPRECATION")
      views.setRemoteAdapter(R.id.memoez_list, serviceIntent)
      views.setEmptyView(R.id.memoez_list, R.id.memoez_list_empty)
      views.setTextViewText(
        R.id.memoez_list_empty,
        context.getString(
          if (snapshot == null) R.string.memoez_list_widget_not_synced else R.string.memoez_list_widget_empty,
        ),
      )

      // 行のタップ: テンプレート + 行ごとの fill-in（メモ ID）でフローティングエディタを開く
      views.setPendingIntentTemplate(R.id.memoez_list, editorTemplate(context, appWidgetId))
      // 空表示のタップ: MemoEZ 本体を通常どおり起動する（一覧の内容もここで作られる）
      launchAppIntent(context)?.let { views.setOnClickPendingIntent(R.id.memoez_list_empty, it) }

      views.setDayNightColor(context, R.id.memoez_list_bg, "setColorFilter", colors.backgroundLight, colors.backgroundDark)
      for (id in intArrayOf(R.id.memoez_list_header, R.id.memoez_list_empty)) {
        views.setDayNightColor(context, id, "setTextColor", colors.textLight, colors.textDark)
      }
      manager.updateAppWidget(appWidgetId, views)
    }

    /**
     * 行のタップで開くフローティングエディタ（2×2 と同じ Activity）。
     * fill-in でメモ ID を受け取るため、Android 12 以降は FLAG_MUTABLE が必須。
     * 明示的な Activity 指定なので Android 14 の「暗黙 Intent の mutable PendingIntent 禁止」にも当たらない。
     * data（URI）は付けない（expo-linking がディープリンクとして Expo Router に渡すのを避けるため）。
     */
    private fun editorTemplate(context: Context, appWidgetId: Int): PendingIntent {
      val intent = Intent().setClassName(context, WidgetContract.EDITOR_ACTIVITY).apply {
        action = WidgetContract.ACTION_OPEN_NOTE_FROM_LIST
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      }
      val mutability = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
      return PendingIntent.getActivity(
        context,
        appWidgetId,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or mutability,
      )
    }

    private fun launchAppIntent(context: Context): PendingIntent? {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
