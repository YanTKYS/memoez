package expo.modules.memoezwidget

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.widget.RemoteViews

/**
 * ライト / ダークで色を変える RemoteViews の設定。
 * Android 12 以降は両方の色を渡してランチャー側で切り替えてもらい、
 * それより前は描画時点のテーマの色を使う。
 */
internal fun RemoteViews.setDayNightColor(
  context: Context,
  viewId: Int,
  methodName: String,
  light: Int,
  dark: Int,
) {
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    setColorInt(viewId, methodName, light, dark)
  } else {
    val night = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
      Configuration.UI_MODE_NIGHT_YES
    setInt(viewId, methodName, if (night) dark else light)
  }
}
