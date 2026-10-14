package expo.modules.memoezwidget

import android.graphics.Color
import android.util.Log
import org.json.JSONObject

/** 4×2 一覧ウィジェットの表示内容（JS の buildWidgetListSnapshot と同じ形） */
internal data class NoteListSnapshot(
  val items: List<Item>,
  val colors: WidgetColors,
) {
  data class Item(
    val noteId: Int,
    val title: String,
    val preview: String,
    /** メモのカラー（帯）。カラー「デフォルト」なら null */
    val accentLight: Int?,
    val accentDark: Int?,
  )

  companion object {
    private const val TAG = "MemoEZWidget"

    fun parse(json: String?): NoteListSnapshot? {
      if (json == null) return null
      return try {
        val obj = JSONObject(json)
        val array = obj.optJSONArray("items")
        val items = (0 until (array?.length() ?: 0)).map { i ->
          val item = array!!.getJSONObject(i)
          Item(
            noteId = item.getInt("noteId"),
            title = item.optString("title"),
            preview = item.optString("preview"),
            accentLight = optColor(item, "accentLight"),
            accentDark = optColor(item, "accentDark"),
          )
        }
        NoteListSnapshot(
          items = items,
          colors = WidgetColors(
            backgroundLight = optColor(obj, "backgroundLight") ?: WidgetColors.DEFAULT.backgroundLight,
            backgroundDark = optColor(obj, "backgroundDark") ?: WidgetColors.DEFAULT.backgroundDark,
            textLight = optColor(obj, "textLight") ?: WidgetColors.DEFAULT.textLight,
            textDark = optColor(obj, "textDark") ?: WidgetColors.DEFAULT.textDark,
          ),
        )
      } catch (e: Exception) {
        Log.w(TAG, "invalid list widget snapshot", e)
        null
      }
    }

    private fun optColor(obj: JSONObject, key: String): Int? {
      if (obj.isNull(key)) return null
      return try {
        Color.parseColor(obj.getString(key))
      } catch (e: IllegalArgumentException) {
        null
      }
    }
  }
}
