package expo.modules.memoezwidget

import android.appwidget.AppWidgetManager
import android.content.res.Configuration
import android.os.Bundle
import kotlin.math.floor

/** ウィジェットの大きさ（dp）から、表示する行数などを決める */
internal object WidgetLayout {
  /** レイアウトの padding（上下 12dp ずつ） */
  private const val VERTICAL_PADDING_DP = 24f
  private const val TITLE_SP = 15f
  private const val BODY_SP = 13f
  private const val FOOTER_SP = 11f
  private const val BODY_LINE_SPACING_DP = 2f
  /** 行の高さ ≒ 文字サイズ × 1.2（includeFontPadding=false） */
  private const val LINE_HEIGHT_RATIO = 1.2f
  private const val MAX_BODY_LINES = 60
  /** これより低いウィジェットではフッター（期限・進捗）を省く */
  private const val FOOTER_MIN_HEIGHT_DP = 100

  /** 既定サイズ（2×2 セル）。ランチャーが大きさを通知しない場合に使う */
  private const val DEFAULT_SIZE_DP = 110

  /** 縦向きでは「最小幅 × 最大高さ」、横向きでは「最大幅 × 最小高さ」が実際の表示サイズ */
  fun heightDp(options: Bundle?, orientation: Int): Int {
    val key = if (orientation == Configuration.ORIENTATION_LANDSCAPE) {
      AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT
    } else {
      AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT
    }
    return options?.getInt(key, 0)?.takeIf { it > 0 } ?: DEFAULT_SIZE_DP
  }

  fun showFooter(heightDp: Int): Boolean = heightDp >= FOOTER_MIN_HEIGHT_DP

  /** 本文（またはチェックリスト）に使える行数。途中で切れた行を出さないよう切り捨てる */
  fun bodyMaxLines(heightDp: Int, hasTitle: Boolean, hasFooter: Boolean, fontScale: Float): Int {
    val title = if (hasTitle) TITLE_SP * fontScale * LINE_HEIGHT_RATIO + 4f else 0f
    val footer = if (hasFooter) FOOTER_SP * fontScale * LINE_HEIGHT_RATIO + 4f else 0f
    val line = BODY_SP * fontScale * LINE_HEIGHT_RATIO + BODY_LINE_SPACING_DP
    val available = heightDp - VERTICAL_PADDING_DP - title - footer
    return floor(available / line).toInt().coerceIn(1, MAX_BODY_LINES)
  }
}
