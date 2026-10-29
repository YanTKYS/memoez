package expo.modules.memoezupdates

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class UpdatePolicyTest {
  private val cert = "a".repeat(64)
  private val installed = Installed("0.6.0", 9, cert, false)
  private data class Fixture(val release: JSONObject, val data: Map<String, ByteArray>)
  private fun fixture(name: String = "0.6.1", code: Long = 10, certificate: String = cert, metaChange: (JSONObject) -> Unit = {}): Fixture {
    val tag = "v$name"
    val stem = "memoez-$tag"
    val meta = JSONObject().put("schemaVersion", 1).put("applicationId", UpdatePolicy.ID).put("versionName", name)
      .put("versionCode", code).put("certificateSha256", certificate).put("apkSha256", cert).put("apkAsset", "$stem.apk").put("commit", "b".repeat(40))
    metaChange(meta)
    val data = mapOf("$stem.json" to meta.toString().toByteArray(), "$stem.apk.sha256" to "$cert  $stem.apk\n".toByteArray())
    val assets = JSONArray()
    for (file in listOf("$stem.apk", "$stem.apk.sha256", "$stem.json")) {
      assets.put(JSONObject().put("name", file).put("browser_download_url", UpdatePolicy.url(tag, file)).put("state", "uploaded")
        .put("size", data[file]?.size ?: 1024).put("digest", "sha256:" + (data[file]?.let { ApkSafety.digest(it) } ?: cert)))
    }
    return Fixture(JSONObject().put("tag_name", tag).put("html_url", "${UpdatePolicy.REPO}/releases/tag/$tag").put("draft", false).put("prerelease", false).put("published_at", "2026-10-29T00:00:00Z").put("body", "Release notes").put("assets", assets), data)
  }
  private fun parse(f: Fixture, current: Installed = installed) = UpdatePolicy.parse(f.release, current) { a, _ -> f.data.getValue(a.name) }
  private fun fails(reason: String = "invalid_metadata", body: () -> Unit) { assertEquals(reason, assertThrows(UpdateFailure::class.java, body).reason) }
  @Test fun statesCompareInstalledPackageCode() {
    assertEquals("available", parse(fixture()).status)
    assertEquals("current", parse(fixture("0.6.0", 9)).status)
    assertEquals("older", parse(fixture("0.5.9", 8)).status)
    assertEquals("blocked", parse(fixture(), installed.copy(debug = true)).status)
    assertEquals("signature", parse(fixture(certificate = "c".repeat(64))).reason)
  }
  @Test fun legacyContractNeverLoadsAssets() {
    val f = fixture("0.5.0", 8)
    f.release.remove("assets")
    val result = UpdatePolicy.parse(f.release, installed) { _, _ -> error("Must not load legacy assets") }
    assertEquals("unsupported", result.status)
    assertEquals("legacy", result.reason)
  }
  @Test fun stableTagAndReleaseOnly() {
    for (tag in listOf("v0.6.1-beta", "0.6.1", "v00.6.1", "v0.6.1/evil", "v0.6.1?token=x")) {
      val f = fixture(); f.release.put("tag_name", tag); fails { parse(f) }
    }
    for (key in listOf("draft", "prerelease")) { val f = fixture(); f.release.put(key, true); fails { parse(f) } }
    val missing = fixture(); missing.release.remove("published_at"); fails { parse(missing) }
  }
  @Test fun strictlyValidateMetadataTypesAndIdentity() {
    for ((key, value) in listOf("applicationId" to "other.app", "schemaVersion" to 2, "versionCode" to 10.5, "versionCode" to "10", "versionCode" to -1, "versionCode" to 2100000001L, "versionName" to "0.6.2", "certificateSha256" to "bad", "apkAsset" to "unsigned.apk", "commit" to "main")) {
      fails { parse(fixture(metaChange = { it.put(key, value) })) }
    }
    fails { parse(fixture("0.6.0", 10)) }
    fails { parse(fixture("0.6.1", 9)) }
  }
  @Test fun requireExactlyThreeUniqueFixedAssets() {
    val f = fixture(); f.release.getJSONArray("assets").remove(1); fails("missing_assets") { parse(f) }
    val duplicate = fixture(); val a = duplicate.release.getJSONArray("assets"); a.put(1, a.getJSONObject(0)); fails("missing_assets") { parse(duplicate) }
    val wrong = fixture(); wrong.release.getJSONArray("assets").getJSONObject(0).put("name", "app-release-unsigned.apk"); fails("missing_assets") { parse(wrong) }
  }
  @Test fun boundDeclaredSizesAndOnlyAcceptCanonicalRepositoryUrl() {
    val big = fixture(); big.release.getJSONArray("assets").getJSONObject(0).put("size", UpdatePolicy.MAX_APK + 1); fails("size_limit") { parse(big) }
    val fractional = fixture(); fractional.release.getJSONArray("assets").getJSONObject(0).put("size", 1.5); fails { parse(fractional) }
    val wrong = fixture(); wrong.release.getJSONArray("assets").getJSONObject(0).put("browser_download_url", "https://evil.example/update.apk"); fails { parse(wrong) }
    val wrongPage = fixture(); wrongPage.release.put("html_url", "https://evil.example/"); fails { parse(wrongPage) }
  }
  @Test fun checksumsMustBindExactlyTheApkAndMetadata() {
    val f = fixture(); val corrupt = f.data.toMutableMap(); corrupt["memoez-v0.6.1.apk.sha256"] = "c".repeat(64).plus("  memoez-v0.6.1.apk\n").toByteArray()
    fails("checksum") { parse(f.copy(data = corrupt)) }
    val digest = fixture(); digest.release.getJSONArray("assets").getJSONObject(0).put("digest", "sha256:" + "0".repeat(64)); fails("checksum") { parse(digest) }
    fails("checksum") { parse(fixture(metaChange = { it.put("apkSha256", "d".repeat(64)) })) }
  }
  @Test fun cdnRedirectsHaveNoHttpCredentialsOrArbitraryHosts() {
    val original = UpdatePolicy.url("v0.6.1", "memoez-v0.6.1.apk")
    assertTrue(UpdatePolicy.redirectAllowed(original, "https://release-assets.githubusercontent.com/github-production-release-asset/123/test?signature=public-cdn-token"))
    for (url in listOf("http://release-assets.githubusercontent.com/github-production-release-asset/x", "https://user:pass@release-assets.githubusercontent.com/github-production-release-asset/x", "https://release-assets.githubusercontent.com.evil.example/github-production-release-asset/x", "https://release-assets.githubusercontent.com:444/github-production-release-asset/x", "https://github.com/other/repo/releases/download/a.apk", "https://release-assets.githubusercontent.com/other/x", "https://release-assets.githubusercontent.com/github-production-release-asset/%2e%2e/other", "https://release-assets.githubusercontent.com/github-production-release-asset/x#fragment")) {
      assertFalse(url, UpdatePolicy.redirectAllowed(original, url))
    }
  }
}
