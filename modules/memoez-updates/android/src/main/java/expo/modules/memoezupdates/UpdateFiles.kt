package expo.modules.memoezupdates

import java.io.File

/** Only two fixed, app-owned cache files. Interrupted and unverified work never becomes reusable. */
class UpdateFiles(val directory: File) {
  val partial = File(directory, "update.part")
  val apk = File(directory, "update.apk")
  init { discard() }
  fun discard() { partial.delete(); apk.delete() }
  fun stage(write: (File) -> Unit, verify: () -> Unit) {
    discard()
    ensure(directory.isDirectory || directory.mkdirs(), "storage")
    var accepted = false
    try {
      write(partial)
      ensure(partial.renameTo(apk), "storage")
      verify()
      accepted = true
    } finally {
      partial.delete()
      if (!accepted) apk.delete()
    }
  }
}
