package expo.modules.memoezwidget

import android.graphics.Color
import android.util.Log
import org.json.JSONObject

/** ウィジェットに描画するメモの内容（JS の buildWidgetSnapshot と同じ形） */
internal data class NoteSnapshot(
  val noteId: Int,
  val deleted: Boolean,
  val title: String,
  val isChecklist: Boolean,
  val body: String,
  val items: List<Item>,
  val itemCount: Int,
  val checkedCount: Int,
  val dueText: String?,
  val colors: WidgetColors,
) {
  data class Item(val text: String, val checked: Boolean)

  companion object {
    private const val TAG = "MemoEZWidget"

    fun parse(json: String): NoteSnapshot? = try {
      val obj = JSONObject(json)
      val itemsJson = obj.optJSONArray("items")
      val items = (0 until (itemsJson?.length() ?: 0)).map { i ->
        val item = itemsJson!!.getJSONObject(i)
        Item(item.optString("text"), item.optBoolean("checked"))
      }
      NoteSnapshot(
        noteId = obj.getInt("noteId"),
        deleted = obj.optString("status") == "deleted",
        title = obj.optString("title"),
        isChecklist = obj.optString("type") == "CHECKLIST",
        body = obj.optString("body"),
        items = items,
        itemCount = obj.optInt("itemCount", items.size),
        checkedCount = obj.optInt("checkedCount", items.count { it.checked }),
        dueText = obj.optString("dueText").takeIf { !obj.isNull("dueText") && it.isNotEmpty() },
        colors = WidgetColors(
          backgroundLight = parseColor(obj.optString("colorLight"), WidgetColors.DEFAULT.backgroundLight),
          backgroundDark = parseColor(obj.optString("colorDark"), WidgetColors.DEFAULT.backgroundDark),
          textLight = parseColor(obj.optString("textLight"), WidgetColors.DEFAULT.textLight),
          textDark = parseColor(obj.optString("textDark"), WidgetColors.DEFAULT.textDark),
        ),
      )
    } catch (e: Exception) {
      Log.w(TAG, "invalid widget snapshot", e)
      null
    }

    private fun parseColor(value: String, fallback: Int): Int = try {
      Color.parseColor(value)
    } catch (e: IllegalArgumentException) {
      fallback
    }
  }
}

/** ライト / ダークそれぞれの背景色と文字色 */
internal data class WidgetColors(
  val backgroundLight: Int,
  val backgroundDark: Int,
  val textLight: Int,
  val textDark: Int,
) {
  companion object {
    /** カラー「デフォルト」（src/ui/theme/colors.ts の NONE）と同じ配色 */
    val DEFAULT = WidgetColors(
      backgroundLight = Color.parseColor("#F5F5F5"),
      backgroundDark = Color.parseColor("#2B2930"),
      textLight = Color.parseColor("#1C1B1F"),
      textDark = Color.parseColor("#E6E1E5"),
    )
  }
}
