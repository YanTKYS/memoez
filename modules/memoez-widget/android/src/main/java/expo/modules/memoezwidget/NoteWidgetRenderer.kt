package expo.modules.memoezwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.StrikethroughSpan
import android.view.View
import android.widget.RemoteViews

/** WidgetStore の内容から付箋ウィジェットの RemoteViews を組み立てる */
internal object NoteWidgetRenderer {
  private val TEXT_VIEW_IDS = intArrayOf(
    R.id.memoez_widget_title,
    R.id.memoez_widget_body,
    R.id.memoez_widget_footer,
  )

  fun render(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, R.layout.memoez_widget_note)
    val noteId = WidgetStore.noteIdFor(context, appWidgetId)
    val snapshot = noteId?.let { WidgetStore.snapshot(context, it) }?.let(NoteSnapshot::parse)

    when {
      noteId == null -> {
        // 配置時の選択がキャンセルされずに残った／設定が失われた
        renderMessage(context, views, null, context.getString(R.string.memoez_widget_not_configured), WidgetColors.DEFAULT)
        views.setOnClickPendingIntent(android.R.id.background, configureIntent(context, appWidgetId))
      }
      snapshot == null -> {
        // 表示内容が未作成。開けばアプリ側の同期でスナップショットが作られる
        renderMessage(context, views, null, context.getString(R.string.memoez_widget_unavailable), WidgetColors.DEFAULT)
        views.setOnClickPendingIntent(android.R.id.background, editorIntent(context, appWidgetId, noteId))
      }
      snapshot.deleted -> {
        renderMessage(
          context,
          views,
          context.getString(R.string.memoez_widget_deleted_title),
          context.getString(R.string.memoez_widget_deleted_body),
          snapshot.colors,
        )
        views.setOnClickPendingIntent(android.R.id.background, configureIntent(context, appWidgetId))
      }
      else -> {
        renderNote(context, views, snapshot, manager, appWidgetId)
        views.setOnClickPendingIntent(android.R.id.background, editorIntent(context, appWidgetId, noteId))
      }
    }

    manager.updateAppWidget(appWidgetId, views)
  }

  private fun renderNote(
    context: Context,
    views: RemoteViews,
    snapshot: NoteSnapshot,
    manager: AppWidgetManager,
    appWidgetId: Int,
  ) {
    val config = context.resources.configuration
    val heightDp = WidgetLayout.heightDp(manager.getAppWidgetOptions(appWidgetId), config.orientation)

    val footer = buildList {
      if (snapshot.isChecklist && snapshot.itemCount > 0) {
        add(context.getString(R.string.memoez_widget_checklist_progress, snapshot.checkedCount, snapshot.itemCount))
      }
      snapshot.dueText?.let { add("⏰ $it") }
    }.joinToString("  ")
    val showFooter = footer.isNotEmpty() && WidgetLayout.showFooter(heightDp)
    val hasTitle = snapshot.title.isNotBlank()

    val body: CharSequence = when {
      snapshot.isChecklist && snapshot.items.isNotEmpty() -> checklistText(snapshot.items)
      !snapshot.isChecklist && snapshot.body.isNotBlank() -> snapshot.body
      hasTitle -> ""
      else -> context.getString(R.string.memoez_widget_empty_note)
    }

    setText(views, R.id.memoez_widget_title, snapshot.title.takeIf { hasTitle })
    setText(views, R.id.memoez_widget_body, body.takeIf { it.isNotEmpty() })
    setText(views, R.id.memoez_widget_footer, footer.takeIf { showFooter })
    views.setInt(
      R.id.memoez_widget_body,
      "setMaxLines",
      WidgetLayout.bodyMaxLines(heightDp, hasTitle, showFooter, config.fontScale),
    )
    applyColors(context, views, snapshot.colors)
  }

  private fun renderMessage(
    context: Context,
    views: RemoteViews,
    title: String?,
    body: String,
    colors: WidgetColors,
  ) {
    setText(views, R.id.memoez_widget_title, title)
    setText(views, R.id.memoez_widget_body, body)
    setText(views, R.id.memoez_widget_footer, null)
    views.setInt(R.id.memoez_widget_body, "setMaxLines", 4)
    applyColors(context, views, colors)
  }

  /** チェック済みの項目は打ち消し線で表示する（アプリの一覧カードと同じ表現） */
  private fun checklistText(items: List<NoteSnapshot.Item>): CharSequence {
    val builder = SpannableStringBuilder()
    items.forEachIndexed { index, item ->
      if (index > 0) builder.append('\n')
      builder.append(if (item.checked) "☑ " else "☐ ")
      val start = builder.length
      builder.append(item.text)
      if (item.checked) {
        builder.setSpan(StrikethroughSpan(), start, builder.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
    }
    return builder
  }

  private fun setText(views: RemoteViews, viewId: Int, text: CharSequence?) {
    if (text == null) {
      views.setViewVisibility(viewId, View.GONE)
    } else {
      views.setViewVisibility(viewId, View.VISIBLE)
      views.setTextViewText(viewId, text)
    }
  }

  /**
   * Android 12 以降はライト / ダーク両方の色を渡し、テーマ切り替え時にランチャー側で
   * 切り替えてもらう。それより前は描画時点のテーマの色で塗る。
   */
  private fun applyColors(context: Context, views: RemoteViews, colors: WidgetColors) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      views.setColorInt(R.id.memoez_widget_bg, "setColorFilter", colors.backgroundLight, colors.backgroundDark)
      TEXT_VIEW_IDS.forEach { views.setColorInt(it, "setTextColor", colors.textLight, colors.textDark) }
    } else {
      val night = isNight(context)
      views.setInt(R.id.memoez_widget_bg, "setColorFilter", if (night) colors.backgroundDark else colors.backgroundLight)
      TEXT_VIEW_IDS.forEach { views.setTextColor(it, if (night) colors.textDark else colors.textLight) }
    }
  }

  private fun isNight(context: Context): Boolean =
    (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

  // ─── タップ時の遷移先 ──────────────────────────────────────────────────

  /** フローティングエディタ。MemoEZ 本体とは別タスクで開き、閉じるとホーム画面に戻る */
  private fun editorIntent(context: Context, appWidgetId: Int, noteId: Int): PendingIntent {
    val intent = Intent(context, FloatingEditorActivity::class.java).apply {
      action = WidgetContract.ACTION_OPEN_NOTE
      // PendingIntent をウィジェットごとに区別するための URI（extras だけでは同一視される）
      data = Uri.parse("memoez-widget://widget/$appWidgetId/note/$noteId")
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      putExtra(WidgetContract.EXTRA_NOTE_ID, noteId)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    }
    return PendingIntent.getActivity(context, appWidgetId, intent, PENDING_FLAGS)
  }

  /** 表示するメモの選び直し（削除済み・未設定のとき） */
  private fun configureIntent(context: Context, appWidgetId: Int): PendingIntent {
    val intent = Intent(context, WidgetConfigActivity::class.java).apply {
      action = WidgetContract.ACTION_RECONFIGURE
      data = Uri.parse("memoez-widget://widget/$appWidgetId/configure")
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    }
    return PendingIntent.getActivity(context, appWidgetId, intent, PENDING_FLAGS)
  }

  private const val PENDING_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
}
