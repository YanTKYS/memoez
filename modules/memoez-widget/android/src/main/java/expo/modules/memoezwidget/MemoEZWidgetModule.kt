package expo.modules.memoezwidget

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

/**
 * JS（src/lib/widget/widgetBridge.ts）から呼ぶウィジェット操作。
 * メモの内容は JS が既存の Repository で SQLite から読み出し、スナップショットとして渡す。
 */
class MemoEZWidgetModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("MemoEZWidget")

    /** ホームボタン等でウィンドウを離れたとき、保存してから閉じるよう JS に依頼する */
    Events(EVENT_CLOSE_REQUESTED, EVENT_LIST_SYNC_REQUESTED)

    OnCreate { current = WeakReference(this@MemoEZWidgetModule) }

    OnDestroy {
      if (current?.get() === this@MemoEZWidgetModule) current = null
      closeHandlerActive = false
    }

    /** 編集ウィンドウ（JS）が表示中で、閉じる前の保存を引き受けられるか */
    Function("setCloseHandlerActive") { active: Boolean ->
      closeHandlerActive = active
    }

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

    /** 4×2 一覧ウィジェットがホーム画面にあるか（なければ JS は一覧の内容を作らない） */
    Function("hasListWidgets") {
      NoteListWidgetProvider.widgetIds(context).isNotEmpty()
    }

    /** 一覧ウィジェットの内容を保存し、変わったときだけ行を読み直してもらう */
    AsyncFunction("updateListSnapshot") { snapshotJson: String ->
      val firstTime = WidgetStore.listSnapshot(context) == null
      if (WidgetStore.saveListSnapshot(context, snapshotJson)) {
        NoteListWidgetProvider.refresh(context, redrawFrame = firstTime)
      }
    }

    /** 配置時・選び直し時のメモ選択を確定する */
    AsyncFunction("completeConfiguration") { appWidgetId: Int, noteId: Int, snapshotJson: String ->
      WidgetStore.bind(context, appWidgetId, noteId)
      WidgetStore.saveSnapshots(context, "[$snapshotJson]")
      WidgetStore.pruneSnapshots(context)
      NoteWidgetProvider.render(context, listOf(appWidgetId))

      val activity = appContext.currentActivity
      if (activity is WidgetConfigActivityBase) {
        activity.runOnUiThread { activity.finishConfigured(appWidgetId) }
      }
    }

    /** 閉じる依頼を受け取った（保存を始める）。応答なしとみなす時間切れを取り消す */
    Function("acknowledgeCloseRequest") {
      MemoEZWindowActivity.acknowledgeCloseRequests()
    }

    /** 閉じる依頼に対し、保存に失敗したため閉じられないことを伝える（ウィンドウを残す） */
    Function("keepWindowOpen") {
      MemoEZWindowActivity.keepOpenWindows()
    }

    /** ウィジェットから開いたウィンドウを閉じる（ホーム画面に戻る） */
    Function("closeWindow") {
      MemoEZWindowActivity.finishOpenWindows()
    }
  }

  companion object {
    private const val EVENT_CLOSE_REQUESTED = "onCloseRequested"
    private const val EVENT_LIST_SYNC_REQUESTED = "onListSyncRequested"

    @Volatile
    private var current: WeakReference<MemoEZWidgetModule>? = null

    @Volatile
    private var closeHandlerActive = false

    /**
     * JS に「保存して閉じる」を依頼する。引き受け手（編集ウィンドウ）がいなければ false を返し、
     * 呼び出し側（MemoEZWindowActivity）がそのまま閉じる。
     */
    /** 一覧ウィジェットの内容を作るよう JS に依頼する（アプリが動いていなければ何もしない） */
    internal fun requestListSync() {
      current?.get()?.sendEvent(EVENT_LIST_SYNC_REQUESTED, emptyMap<String, Any?>())
    }

    internal fun requestWindowClose(): Boolean {
      val module = current?.get() ?: return false
      if (!closeHandlerActive) return false
      module.sendEvent(EVENT_CLOSE_REQUESTED, emptyMap<String, Any?>())
      return true
    }
  }
}
