// このファイルは modules/memoez-widget/plugin/withMemoEZWidget.js が expo prebuild 時に生成する。
// 直接編集せず、modules/memoez-widget/plugin/templates/WidgetConfigActivity.kt を編集すること。
package expo.modules.memoezwidget.host

import com.facebook.react.ReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.memoezwidget.WidgetConfigActivityBase
import {{APP_PACKAGE}}.BuildConfig

/**
 * ウィジェット配置時・選び直し時のメモ選択ウィンドウ。
 * MainActivity（Expo SDK 52 の標準構成）と同じく ReactActivityDelegateWrapper で包み、
 * Expo Modules へ Activity のライフサイクルを通知する。処理の本体は WidgetConfigActivityBase。
 */
class WidgetConfigActivity : WidgetConfigActivityBase() {
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, createWindowDelegate())
}
