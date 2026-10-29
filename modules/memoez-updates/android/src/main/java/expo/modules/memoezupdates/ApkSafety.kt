package expo.modules.memoezupdates

import com.android.apksig.ApkVerifier
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest

object ApkSafety {
  fun digest(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
  fun fileDigest(file: File): String = file.inputStream().use { input ->
    val md = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(8192)
    while (true) { val count = input.read(buffer); if (count < 0) break; md.update(buffer, 0, count) }
    md.digest().joinToString("") { "%02x".format(it) }
  }
  /** Fixed-size buffer, bounded stream, no full-APK byte array. Callback enforces cancellation/deadline/storage. */
  fun copy(input: InputStream, output: OutputStream, size: Long, tick: (Long) -> Unit) {
    ensure(size in 1..UpdatePolicy.MAX_APK, "size_limit")
    var count = 0L
    val buffer = ByteArray(8192)
    tick(count)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      count += read
      ensure(count <= size, "size_limit")
      tick(count)
      output.write(buffer, 0, read)
    }
    ensure(count == size, "incomplete")
    tick(count)
  }
  fun verify(file: File, offer: Offer, installed: Installed, sdk: Int, archive: () -> ArchiveInfo) {
    ensure(!installed.debug, "debug_build")
    ensure(offer.code > installed.code && UpdatePolicy.compare(offer.name, installed.name) > 0, "older")
    ensure(file.length() == offer.apk.size && fileDigest(file) == offer.sha, "checksum")
    val result = try { ApkVerifier.Builder(file).setMinCheckedPlatformVersion(sdk).setMaxCheckedPlatformVersion(sdk).build().verify() }
    catch (_: Exception) { throw UpdateFailure("signature") }
    ensure(result.isVerified && (result.isVerifiedUsingV2Scheme || result.isVerifiedUsingV3Scheme || result.isVerifiedUsingV31Scheme) && result.signerCertificates.size == 1, "signature")
    val cert = digest(result.signerCertificates.single().encoded)
    // Rotation is intentionally unsupported: release policy fixes the certificate as well.
    ensure(cert == installed.certificate && cert == offer.certificate, "signature")
    val info = archive()
    ensure(info.id == UpdatePolicy.ID, "package")
    ensure(info.name == offer.name && info.code == offer.code && info.code > installed.code, "older")
    ensure(!info.debug, "debug_build")
  }
}
