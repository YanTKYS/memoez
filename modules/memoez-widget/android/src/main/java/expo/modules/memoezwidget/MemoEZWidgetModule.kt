package expo.modules.memoezwidget

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS（src/lib/widget/widgetBridge.ts）から呼ぶウィジェット操作。
 * メモの内容は JS が既存の Repository で SQLite から読み出し、スナップショットとして渡す。
 */
class MemoEZWidgetModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("MemoEZWidget")

    /** ホーム画面に配置されているウィジェットが表示しているメモの ID（重複なし） */
    Function("getBoundNoteIds") {
      WidgetStore.activeBindings(context, NoteWidgetProvider.widgetIds(context).toSet())
        .values
        .distinct()
    }

    /** スナップショット（JSON 配列）を保存し、内容が変わったウィジェットだけ描画し直す */
    AsyncFunction("updateSnapshots") { snapshotsJson: String ->
      val changed = WidgetStore.saveSnapshots(context, snapshotsJson)
      NoteWidgetProvider.renderNotes(context, changed)
    }

    /** 配置時・選び直し時のメモ選択を確定する */
    AsyncFunction("completeConfiguration") { appWidgetId: Int, noteId: Int, snapshotJson: String ->
      WidgetStore.bind(context, appWidgetId, noteId)
      WidgetStore.saveSnapshots(context, "[$snapshotJson]")
      WidgetStore.pruneSnapshots(context)
      NoteWidgetProvider.render(context, listOf(appWidgetId))

      val activity = appContext.currentActivity
      if (activity is WidgetConfigActivity) {
        activity.runOnUiThread { activity.finishConfigured(appWidgetId) }
      }
    }

    /** ウィジェットから開いたウィンドウを閉じる（ホーム画面に戻る） */
    Function("closeWindow") {
      val activity = appContext.currentActivity
      if (activity is MemoEZWindowActivity) {
        activity.runOnUiThread { activity.finish() }
        true
      } else {
        false
      }
    }
  }
}
