package expo.modules.memoezupdates

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.StatFs
import org.json.JSONObject
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class UpdateService(private val context: Context, private val event: (Map<String, Any>) -> Unit) {
  private val cancelled = AtomicBoolean(false)
  private val network = UpdateNetwork({ cancelled.get() })
  private val directory = File(context.cacheDir, "updates")
  private val files = UpdateFiles(directory)
  val apk get() = files.apk
  @Volatile var awaitingInstaller = false
  private var candidate: Offer? = null
  @Volatile var ready = false
    private set

  init { discardFiles() } // Process restart: no durable approval/candidate, no automatic resumption.
  fun begin() { cancelled.set(false); ensure(!awaitingInstaller, "installer_open") }
  fun cancel() { cancelled.set(true); network.cancel() }
  fun active() { ensure(!cancelled.get(), "cancelled") }
  fun discardFiles() {
    if (!awaitingInstaller) { files.discard(); ready = false }
  }
  fun clear() { discardFiles(); if (!awaitingInstaller) candidate = null }

  @Suppress("DEPRECATION")
  fun installed(): Installed {
    val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
    val info = context.packageManager.getPackageInfo(context.packageName, flags)
    ensure(info.packageName == UpdatePolicy.ID, "package")
    val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
    ensure(signatures?.size == 1, "signature")
    val name = info.versionName ?: throw UpdateFailure("installed_version")
    UpdatePolicy.version(name)
    val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
    return Installed(name, code, ApkSafety.digest(signatures!![0].toByteArray()), (info.applicationInfo!!.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0)
  }
  fun infoView(): Map<String, Any> = installed().let { mapOf("versionName" to it.name, "versionCode" to it.code, "debuggable" to it.debug) }

  fun check(): Map<String, Any?> {
    clear()
    val raw = try { network.bytes(UpdatePolicy.LATEST, null, 1024 * 1024) } catch (e: UpdateFailure) {
      if (e.reason == "no_release") return Check("none").view() else throw e
    }
    active()
    val result = UpdatePolicy.parse(JSONObject(raw.toString(Charsets.UTF_8)), installed()) { asset, limit -> network.bytes(asset.url, asset.size, limit) }
    active()
    candidate = result.offer.takeIf { result.status == "available" }
    return result.view()
  }

  private fun verify(offer: Offer) = ApkSafety.verify(apk, offer, installed(), Build.VERSION.SDK_INT) {
    @Suppress("DEPRECATION")
    val info = context.packageManager.getPackageArchiveInfo(apk.absolutePath, 0) ?: throw UpdateFailure("package")
    @Suppress("DEPRECATION")
    ArchiveInfo(info.packageName, info.versionName ?: "", if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong(), (info.applicationInfo!!.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0)
  }

  fun download() {
    val offer = candidate ?: throw UpdateFailure("check_required")
    discardFiles()
    ensure(directory.isDirectory || directory.mkdirs(), "storage")
    ensure(StatFs(directory.absolutePath).availableBytes > offer.apk.size + UpdatePolicy.RESERVE, "storage")
    files.stage({ partial ->
      var sentAt = 0L
      partial.outputStream().use { output ->
        network.transfer(offer.apk.url, offer.apk.size, UpdatePolicy.MAX_APK, output) { count ->
          active()
          val now = System.nanoTime()
          if (now - sentAt > 100_000_000 || count == offer.apk.size) {
            ensure(StatFs(directory.absolutePath).availableBytes > offer.apk.size - count + UpdatePolicy.RESERVE, "storage")
            event(mapOf("phase" to "downloading", "bytes" to count, "total" to offer.apk.size))
            sentAt = now
          }
        }
        output.fd.sync()
      }
      active()
    }, {
      event(mapOf("phase" to "verifying", "bytes" to offer.apk.size, "total" to offer.apk.size))
      verify(offer)
      active()
    })
    ready = true
  }

  /** Recheck installed PackageInfo and signature immediately before any URI grant. */
  fun prepareInstaller() {
    ensure(ready, "check_required")
    try { verify(candidate ?: throw UpdateFailure("check_required")); active() }
    catch (e: Exception) { discardFiles(); throw e }
  }
  fun installerFinished() { awaitingInstaller = false; clear() }
  fun failure(error: Exception): String = when {
    cancelled.get() -> "cancelled"
    error is UpdateFailure -> error.reason
    error is org.json.JSONException -> "invalid_metadata"
    error.message?.contains("ENOSPC") == true -> "storage"
    error is java.net.SocketTimeoutException -> "timeout"
    else -> "network"
  }
}
