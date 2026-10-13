package expo.modules.memoezwidget

/** JS 側（src/lib/widget, src/ui/widget）と共有する名前 */
internal object WidgetContract {
  /** index.ts で AppRegistry に登録する React Native のコンポーネント名 */
  const val COMPONENT_NAME = "MemoEZWidgetWindow"

  const val MODE_EDIT = "edit"
  const val MODE_CONFIGURE = "configure"

  const val EXTRA_NOTE_ID = "expo.modules.memoezwidget.NOTE_ID"
  const val ACTION_OPEN_NOTE = "expo.modules.memoezwidget.OPEN_NOTE"
  const val ACTION_RECONFIGURE = "expo.modules.memoezwidget.RECONFIGURE"
}
