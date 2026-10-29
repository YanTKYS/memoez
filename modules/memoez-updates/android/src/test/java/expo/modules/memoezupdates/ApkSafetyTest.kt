package expo.modules.memoezupdates

import java.io.File
import java.security.KeyStore
import java.util.UUID
import org.junit.AfterClass
import org.junit.BeforeClass
import org.junit.Test
import org.junit.Assert.*

/** Real aapt2 APKs and two temporary keys, never production credentials or network. */
class ApkSafetyTest {
  companion object {
    private lateinit var folder: File
    private lateinit var tools: File
    private lateinit var platform: File
    private lateinit var keyA: File
    private lateinit var keyB: File
    private lateinit var certificate: String
    private val password = UUID.randomUUID().toString()
    private val files = mutableMapOf<String, File>()
    private fun command(vararg args: String): String {
      val process = ProcessBuilder(*args).redirectErrorStream(true).also { it.environment()["MEMOEZ_TEST_PASS"] = password }.start()
      val output = process.inputStream.bufferedReader().readText()
      assertEquals("Fixture tool failed: ${args.first()}", 0, process.waitFor())
      return output
    }
    private fun unsigned(name: String, id: String = UpdatePolicy.ID, version: String = "0.6.1", code: Int = 10, debug: Boolean = false): File {
      val manifest = File(folder, "$name.xml")
      manifest.writeText("""<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="$id" android:versionCode="$code" android:versionName="$version"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35"/><application android:hasCode="false" android:debuggable="$debug"/></manifest>""")
      val apk = File(folder, "$name-unsigned.apk")
      command(File(tools, "aapt2").path, "link", "-I", platform.path, "--manifest", manifest.path, "-o", apk.path)
      return apk
    }
    private fun sign(input: File, name: String, key: File = keyA): File {
      val output = File(folder, "$name.apk")
      command(File(tools, "apksigner").path, "sign", "--v4-signing-enabled", "false", "--ks", key.path, "--ks-key-alias", "test-only", "--ks-pass", "env:MEMOEZ_TEST_PASS", "--key-pass", "env:MEMOEZ_TEST_PASS", "--out", output.path, input.path)
      return output
    }
    @JvmStatic @BeforeClass fun fixtures() {
      folder = java.nio.file.Files.createTempDirectory("memoez-apk-test-").toFile()
      val sdk = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT") ?: error("Android SDK required")
      tools = File(sdk, "build-tools/35.0.0")
      platform = File(sdk, "platforms/android-35/android.jar")
      keyA = File(folder, "TEST-ONLY-A.jks"); keyB = File(folder, "TEST-ONLY-B.jks")
      for (key in listOf(keyA, keyB)) command(File(System.getProperty("java.home"), "bin/keytool").path, "-genkeypair", "-noprompt", "-storetype", "JKS", "-keystore", key.path, "-alias", "test-only", "-keyalg", "RSA", "-keysize", "2048", "-validity", "2", "-dname", "CN=MemoEZ Temporary Test Only", "-storepass:env", "MEMOEZ_TEST_PASS", "-keypass:env", "MEMOEZ_TEST_PASS")
      val store = KeyStore.getInstance("JKS")
      keyA.inputStream().use { store.load(it, password.toCharArray()) }
      certificate = ApkSafety.digest(store.getCertificate("test-only").encoded)
      val plain = unsigned("valid")
      files["unsigned"] = plain
      files["valid"] = sign(plain, "valid")
      files["other-key"] = sign(plain, "other-key", keyB)
      val v1 = File(folder, "v1-only.apk")
      command(File(tools, "apksigner").path, "sign", "--v1-signing-enabled", "true", "--v2-signing-enabled", "false", "--v3-signing-enabled", "false", "--v4-signing-enabled", "false", "--ks", keyA.path, "--ks-key-alias", "test-only", "--ks-pass", "env:MEMOEZ_TEST_PASS", "--key-pass", "env:MEMOEZ_TEST_PASS", "--out", v1.path, plain.path)
      files["v1-only"] = v1
      files["other-package"] = sign(unsigned("other-package", id = "example.other"), "other-package")
      files["old"] = sign(unsigned("old", version = "0.6.0", code = 9), "old")
      files["debug"] = sign(unsigned("debug", debug = true), "debug")
      val tampered = File(folder, "tampered.apk")
      val bytes = files.getValue("valid").readBytes()
      // Mutate the signed ZIP entry, not unsigned padding in the APK Signing Block.
      fun u16(offset: Int) = (bytes[offset].toInt() and 255) or ((bytes[offset + 1].toInt() and 255) shl 8)
      val header = (0 until bytes.size - 64).first { i ->
        bytes[i] == 0x50.toByte() && bytes[i + 1] == 0x4b.toByte() && bytes[i + 2] == 3.toByte() && bytes[i + 3] == 4.toByte() &&
          i + 30 + u16(i + 26) < bytes.size && String(bytes, i + 30, u16(i + 26), Charsets.UTF_8) == "AndroidManifest.xml"
      }
      val payload = header + 30 + u16(header + 26) + u16(header + 28)
      bytes[payload] = (bytes[payload].toInt() xor 1).toByte()
      tampered.writeBytes(bytes)
      files["tampered"] = tampered
    }
    @JvmStatic @AfterClass fun cleanup() { if (::folder.isInitialized) folder.deleteRecursively() }
  }
  private fun offer(file: File) = Offer("0.6.1", 10, ApkSafety.fileDigest(file), certificate, Asset("memoez-v0.6.1.apk", UpdatePolicy.url("v0.6.1", "memoez-v0.6.1.apk"), file.length(), null), "Notes")
  private fun installed() = Installed("0.6.0", 9, certificate, false)
  private fun archive(file: File): ArchiveInfo {
    val text = command(File(tools, "aapt2").path, "dump", "badging", file.path)
    val match = Regex("package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'").find(text)!!
    return ArchiveInfo(match.groupValues[1], match.groupValues[3], match.groupValues[2].toLong(), text.contains("application-debuggable"))
  }
  private fun verify(name: String, sdk: Int = 35) {
    val file = files.getValue(name)
    ApkSafety.verify(file, offer(file), installed(), sdk) { archive(file) }
  }
  @Test fun authenticSameKeyOnSupportedSignatureApiLevels() { for (sdk in listOf(24, 26, 28, 35)) verify("valid", sdk) }
  @Test fun unsignedAndOtherKeyAndTamperedRejectEvenWithMatchingFileHash() {
    for (name in listOf("unsigned", "other-key", "tampered")) assertEquals(name, "signature", assertThrows(name, UpdateFailure::class.java) { verify(name) }.reason)
  }
  @Test fun v1OnlySignatureIsNotEnoughEvenOnAndroid24() {
    assertEquals("signature", assertThrows(UpdateFailure::class.java) { verify("v1-only", 24) }.reason)
  }
  @Test fun correctlySignedWrongPackageOldCodeAndDebuggableAreRejected() {
    for ((name, reason) in listOf("other-package" to "package", "old" to "older", "debug" to "debug_build")) assertEquals(reason, assertThrows(name, UpdateFailure::class.java) { verify(name) }.reason)
  }
  @Test fun checksumAndInstalledCodeAndCertificateAreAlsoBound() {
    val file = files.getValue("valid")
    assertEquals("checksum", assertThrows(UpdateFailure::class.java) { ApkSafety.verify(file, offer(file).copy(sha = "0".repeat(64)), installed(), 35) { archive(file) } }.reason)
    assertEquals("older", assertThrows(UpdateFailure::class.java) { ApkSafety.verify(file, offer(file), installed().copy(code = 10), 35) { archive(file) } }.reason)
    assertEquals("signature", assertThrows(UpdateFailure::class.java) { ApkSafety.verify(file, offer(file), installed().copy(certificate = "0".repeat(64)), 35) { archive(file) } }.reason)
  }
}
