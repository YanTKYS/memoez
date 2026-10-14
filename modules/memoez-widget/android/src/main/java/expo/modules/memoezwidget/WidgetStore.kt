package expo.modules.memoezwidget

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/**
 * ウィジェットの設定と表示用スナップショットの保存先。
 *
 * - `widget.<appWidgetId>` → 表示するメモの ID
 * - `note.<noteId>`        → 表示内容のスナップショット（JSON）
 *
 * メモ本体の正はアプリの SQLite（expo-sqlite）で、ここにはウィジェットに描画する内容の
 * コピーだけを置く。スナップショットはアプリ（JS）が SQLite から読み出して書き込む。
 * ネイティブから SQLite を直接開かないのは、Android 標準の SQLite と expo-sqlite が
 * 同梱する SQLite が同じプロセスで同じファイルを開くと、POSIX ロックが互いに解除されて
 * DB が壊れうるため（https://www.sqlite.org/howtocorrupt.html 2.2.1）。
 * プロセス終了・端末再起動後も、ランチャーの再描画要求にはここから応答できる。
 */
internal object WidgetStore {
  private const val PREFS_NAME = "memoez_widget"
  private const val WIDGET_PREFIX = "widget."
  private const val NOTE_PREFIX = "note."
  /** 4×2 一覧ウィジェットの表示内容（全ウィジェット共通。JSON） */
  private const val LIST_KEY = "list.snapshot"

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  // ─── ウィジェット → メモ の対応 ────────────────────────────────────────

  @Synchronized
  fun bind(context: Context, appWidgetId: Int, noteId: Int) {
    prefs(context).edit().putInt(WIDGET_PREFIX + appWidgetId, noteId).commit()
  }

  fun noteIdFor(context: Context, appWidgetId: Int): Int? {
    val p = prefs(context)
    val key = WIDGET_PREFIX + appWidgetId
    return if (p.contains(key)) p.getInt(key, 0) else null
  }

  /** 保存されている対応（appWidgetId → noteId）すべて */
  fun bindings(context: Context): Map<Int, Int> =
    prefs(context).all.entries.mapNotNull { (key, value) ->
      if (!key.startsWith(WIDGET_PREFIX) || value !is Int) return@mapNotNull null
      key.removePrefix(WIDGET_PREFIX).toIntOrNull()?.let { it to value }
    }.toMap()

  /** ホーム画面に実在するウィジェットの対応だけを返し、残骸は掃除する */
  fun activeBindings(context: Context, existingWidgetIds: Set<Int>): Map<Int, Int> {
    val all = bindings(context)
    val stale = all.keys - existingWidgetIds
    if (stale.isNotEmpty()) removeWidgets(context, stale.toIntArray())
    return all.filterKeys { it in existingWidgetIds }
  }

  @Synchronized
  fun removeWidgets(context: Context, appWidgetIds: IntArray) {
    val editor = prefs(context).edit()
    appWidgetIds.forEach { editor.remove(WIDGET_PREFIX + it) }
    editor.commit()
    pruneSnapshots(context)
  }

  /** バックアップ復元でウィジェット ID が振り直されたときに対応を引き継ぐ */
  @Synchronized
  fun remapWidgets(context: Context, oldIds: IntArray, newIds: IntArray) {
    val current = bindings(context)
    val editor = prefs(context).edit()
    oldIds.forEachIndexed { index, oldId ->
      val noteId = current[oldId] ?: return@forEachIndexed
      val newId = newIds.getOrNull(index) ?: return@forEachIndexed
      editor.remove(WIDGET_PREFIX + oldId)
      editor.putInt(WIDGET_PREFIX + newId, noteId)
    }
    editor.commit()
  }

  // ─── 表示用スナップショット ────────────────────────────────────────────

  fun snapshot(context: Context, noteId: Int): String? =
    prefs(context).getString(NOTE_PREFIX + noteId, null)

  /**
   * JS から受け取ったスナップショット（JSON 配列）を保存し、内容が変わったメモの ID を返す。
   * 変わっていないメモのウィジェットは描画し直さない（自動保存のたびのちらつき防止）。
   */
  @Synchronized
  fun saveSnapshots(context: Context, snapshotsJson: String): Set<Int> {
    val array = JSONArray(snapshotsJson)
    val p = prefs(context)
    val editor = p.edit()
    val changed = mutableSetOf<Int>()
    for (i in 0 until array.length()) {
      val obj = array.getJSONObject(i)
      val noteId = obj.getInt("noteId")
      val json = obj.toString()
      if (p.getString(NOTE_PREFIX + noteId, null) != json) {
        editor.putString(NOTE_PREFIX + noteId, json)
        changed.add(noteId)
      }
    }
    if (changed.isNotEmpty()) editor.commit()
    return changed
  }

  /** どのウィジェットからも参照されなくなったスナップショットを消す */
  @Synchronized
  fun pruneSnapshots(context: Context) {
    val bound = bindings(context).values.toSet()
    val p = prefs(context)
    val stale = p.all.keys.filter { key ->
      key.startsWith(NOTE_PREFIX) && key.removePrefix(NOTE_PREFIX).toIntOrNull() !in bound
    }
    if (stale.isEmpty()) return
    val editor = p.edit()
    stale.forEach { editor.remove(it) }
    editor.commit()
  }

  /** 2×2 付箋ウィジェットの設定・表示内容だけを消す（一覧ウィジェットの内容は残す） */
  @Synchronized
  fun clearNoteWidgets(context: Context) {
    val p = prefs(context)
    val editor = p.edit()
    p.all.keys
      .filter { it.startsWith(WIDGET_PREFIX) || it.startsWith(NOTE_PREFIX) }
      .forEach { editor.remove(it) }
    editor.commit()
  }

  // ─── 一覧ウィジェット ──────────────────────────────────────────────────

  fun listSnapshot(context: Context): String? = prefs(context).getString(LIST_KEY, null)

  /** 一覧の表示内容を保存し、変わったら true（変わらなければ描画し直さない） */
  @Synchronized
  fun saveListSnapshot(context: Context, json: String): Boolean {
    val p = prefs(context)
    if (p.getString(LIST_KEY, null) == json) return false
    p.edit().putString(LIST_KEY, json).commit()
    return true
  }

  @Synchronized
  fun clearList(context: Context) {
    prefs(context).edit().remove(LIST_KEY).commit()
  }
}
