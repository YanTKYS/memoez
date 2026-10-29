package expo.modules.memoezupdates

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class UpdateFileProvider : FileProvider()

class MemoEZUpdatesModule : Module() {
  private lateinit var service: UpdateService
  private val worker = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private val context get() = requireNotNull(appContext.reactContext)
  private fun allowed() = Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()
  private fun run(promise: Promise, work: () -> Any?) {
    if (!busy.compareAndSet(false, true)) { promise.reject("busy", "busy", null); return }
    try { service.begin() } catch (e: Exception) { busy.set(false); val code = service.failure(e); promise.reject(code, code, null); return }
    worker.execute {
      try { promise.resolve(work()) }
      catch (e: Exception) { val code = service.failure(e); promise.reject(code, code, null) }
      finally { busy.set(false) }
    }
  }
  private fun finishInstaller() {
    try {
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", service.apk)
      context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    } catch (_: Exception) { /* OS also scopes the grant to the receiving activity. */ }
    service.installerFinished()
  }
  override fun definition() = ModuleDefinition {
    Name("MemoEZUpdates")
    Events("onUpdateProgress", "onUpdateInstallerResult")
    OnCreate { service = UpdateService(context) { sendEvent("onUpdateProgress", it) } }
    OnDestroy { service.cancel(); worker.shutdown() }
    OnActivityEntersBackground { service.cancel() }
    OnActivityEntersForeground {
      // Some OEM installers omit a result callback. Returning to this app invalidates
      // the hand-off rather than leaving a reusable APK/URI approval behind.
      if (service.awaitingInstaller) {
        finishInstaller()
        sendEvent("onUpdateInstallerResult", mapOf("completed" to false))
      }
    }
    OnActivityResult { _, result ->
      if (result.requestCode == REQUEST_INSTALL) {
        finishInstaller()
        sendEvent("onUpdateInstallerResult", mapOf("completed" to (result.resultCode == Activity.RESULT_OK)))
      }
    }
    Function("getInstalled") { service.infoView() }
    Function("canInstall") { allowed() }
    Function("cancel") { service.cancel() }
    Function("discard") { service.cancel(); worker.execute { service.clear() } }
    AsyncFunction("check") { promise: Promise -> run(promise) { service.check() } }
    AsyncFunction("download") { promise: Promise -> run(promise) { service.download(); true } }
    AsyncFunction("openPermission") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) promise.reject("activity", "activity", null) else activity.runOnUiThread {
        try {
          if (Build.VERSION.SDK_INT >= 26) activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")))
          promise.resolve(true)
        } catch (_: Exception) { promise.reject("permission", "permission", null) }
      }
    }
    AsyncFunction("install") { promise: Promise ->
      if (!busy.compareAndSet(false, true)) promise.reject("busy", "busy", null) else {
        try { service.begin() } catch (e: Exception) { busy.set(false); promise.reject(service.failure(e), service.failure(e), null); return@AsyncFunction }
        worker.execute {
          try {
            ensure(allowed(), "permission")
            service.prepareInstaller()
            val activity = appContext.currentActivity ?: throw UpdateFailure("activity")
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", service.apk)
            @Suppress("DEPRECATION")
            val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(uri, "application/vnd.android.package-archive")
              .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
              .putExtra(Intent.EXTRA_RETURN_RESULT, true)
            intent.clipData = ClipData.newRawUri("MemoEZ update", uri)
            @Suppress("DEPRECATION")
            val handlers = context.packageManager.queryIntentActivities(intent, PackageManager.MATCH_SYSTEM_ONLY)
            ensure(handlers.isNotEmpty(), "installer_unavailable")
            intent.setPackage(handlers.first().activityInfo.packageName)
            activity.runOnUiThread {
              try {
                service.active() // Leaving/cancelling before this hand-off must not open an installer.
                service.awaitingInstaller = true
                activity.startActivityForResult(intent, REQUEST_INSTALL)
                busy.set(false)
                promise.resolve(true)
              } catch (e: Exception) {
                finishInstaller()
                busy.set(false)
                val code = if (e is UpdateFailure) e.reason else "installer_unavailable"
                promise.reject(code, code, null)
              }
            }
          } catch (e: Exception) {
            busy.set(false)
            val code = service.failure(e)
            promise.reject(code, code, null)
          }
        }
      }
    }

  }
  companion object { private const val REQUEST_INSTALL = 7241 }
}
