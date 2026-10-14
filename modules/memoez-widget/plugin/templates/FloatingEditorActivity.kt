// このファイルは modules/memoez-widget/plugin/withMemoEZWidget.js が expo prebuild 時に生成する。
// 直接編集せず、modules/memoez-widget/plugin/templates/FloatingEditorActivity.kt を編集すること。
package expo.modules.memoezwidget.host

import com.facebook.react.ReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.memoezwidget.FloatingEditorActivityBase
import {{APP_PACKAGE}}.BuildConfig

/**
 * ウィジェットのタップで開く、ホーム画面上のメモ編集ウィンドウ。
 * MainActivity（Expo SDK 52 の標準構成）と同じく ReactActivityDelegateWrapper で包み、
 * Expo Modules へ Activity のライフサイクルを通知する。処理の本体は FloatingEditorActivityBase。
 */
class FloatingEditorActivity : FloatingEditorActivityBase() {
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, createWindowDelegate())
}
