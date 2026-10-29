package expo.modules.memoezupdates

import org.json.JSONObject
import java.net.URI

class UpdateFailure(val reason: String) : Exception(reason)
fun ensure(ok: Boolean, reason: String = "invalid_metadata") { if (!ok) throw UpdateFailure(reason) }

data class Installed(val name: String, val code: Long, val certificate: String, val debug: Boolean)
data class ArchiveInfo(val id: String, val name: String, val code: Long, val debug: Boolean)
data class Asset(val name: String, val url: String, val size: Long, val digest: String?)
data class Offer(val name: String, val code: Long, val sha: String, val certificate: String, val apk: Asset, val notes: String) {
  val tag get() = "v$name"
  val page get() = "${UpdatePolicy.REPO}/releases/tag/$tag"
  fun view() = mapOf("versionName" to name, "versionCode" to code, "page" to page, "notes" to notes, "size" to apk.size)
}
data class Check(val status: String, val offer: Offer? = null, val reason: String? = null, val name: String? = null, val page: String? = null) {
  fun view() = mapOf("status" to status, "release" to offer?.view(), "reason" to reason, "versionName" to (offer?.name ?: name), "page" to (offer?.page ?: page))
}

object UpdatePolicy {
  const val ID = "com.memoez.app"
  const val REPO = "https://github.com/YanTKYS/memoez"
  const val LATEST = "https://api.github.com/repos/YanTKYS/memoez/releases/latest"
  const val MAX_APK = 256L * 1024 * 1024
  const val RESERVE = 20L * 1024 * 1024
  fun text(obj: JSONObject, key: String): String { val value = obj.opt(key); ensure(value is String); return value as String }
  fun integer(obj: JSONObject, key: String): Long {
    val value = obj.opt(key)
    ensure(value is Int || value is Long)
    return (value as Number).toLong()
  }
  fun version(name: String): List<Int> {
    ensure(Regex("(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})").matches(name))
    return name.split('.').map { it.toInt() }
  }
  fun compare(a: String, b: String): Int {
    for ((x, y) in version(a).zip(version(b))) if (x != y) return x.compareTo(y)
    return 0
  }
  fun hash(value: String): String { ensure(Regex("[0-9a-f]{64}").matches(value)); return value }
  fun url(tag: String, name: String) = "$REPO/releases/download/$tag/$name"
  fun redirectAllowed(original: String, target: String): Boolean = try {
    val u = URI(target)
    u.scheme == "https" && u.path.split('/').none { it == "." || it == ".." } && u.userInfo == null && u.fragment == null && (u.port == -1 || u.port == 443) &&
      (target == original || (u.host == "release-assets.githubusercontent.com" && u.path.startsWith("/github-production-release-asset/")) ||
        (u.host == "objects.githubusercontent.com" && u.path.startsWith("/github-production-release-asset-")))
  } catch (_: Exception) { false }

  /** Called only on explicit check. Text loader is bounded and can only use these derived asset URLs. */
  fun parse(release: JSONObject, installed: Installed, load: (Asset, Int) -> ByteArray): Check {
    ensure(release.opt("draft") == false && release.opt("prerelease") == false)
    ensure(release.opt("published_at") is String && text(release, "published_at").isNotBlank())
    val tag = text(release, "tag_name")
    ensure(tag.startsWith('v'))
    val name = tag.substring(1)
    version(name)
    val page = "$REPO/releases/tag/$tag"
    ensure(text(release, "html_url") == page)
    if (compare(name, "0.5.0") <= 0) return Check("unsupported", reason = "legacy", name = name, page = page)
    val stem = "memoez-$tag"
    val expected = setOf("$stem.apk", "$stem.apk.sha256", "$stem.json")
    val list = release.optJSONArray("assets") ?: throw UpdateFailure("missing_assets")
    ensure(list.length() == 3, "missing_assets")
    val assets = (0 until list.length()).map { index ->
      val item = list.getJSONObject(index)
      val file = text(item, "name")
      ensure(file in expected, "missing_assets")
      ensure(text(item, "browser_download_url") == url(tag, file))
      ensure(text(item, "state") == "uploaded", "missing_assets")
      val size = integer(item, "size")
      ensure(size in 1..(if (file.endsWith(".apk")) MAX_APK else if (file.endsWith(".json")) 16384 else 512), "size_limit")
      val digest = if (item.isNull("digest")) null else text(item, "digest").also { ensure(it.startsWith("sha256:")); hash(it.removePrefix("sha256:")) }
      Asset(file, url(tag, file), size, digest)
    }
    ensure(assets.map { it.name }.toSet() == expected, "missing_assets")
    fun read(file: String, limit: Int): String {
      val asset = assets.single { it.name == file }
      val bytes = load(asset, limit)
      ensure(bytes.size.toLong() == asset.size)
      asset.digest?.let { ensure(it == "sha256:" + ApkSafety.digest(bytes), "checksum") }
      return bytes.toString(Charsets.UTF_8)
    }
    val meta = JSONObject(read("$stem.json", 16384))
    ensure(integer(meta, "schemaVersion") == 1L && text(meta, "applicationId") == ID)
    ensure(text(meta, "versionName") == name && text(meta, "apkAsset") == "$stem.apk")
    ensure(Regex("[0-9a-f]{40}").matches(text(meta, "commit")))
    val code = integer(meta, "versionCode")
    ensure(code in 1..2100000000L)
    val sha = hash(text(meta, "apkSha256"))
    val certificate = hash(text(meta, "certificateSha256"))
    ensure(read("$stem.apk.sha256", 512) == "$sha  $stem.apk\n", "checksum")
    val apk = assets.single { it.name == "$stem.apk" }
    apk.digest?.let { ensure(it == "sha256:$sha", "checksum") }
    val notes = if (release.isNull("body")) "" else text(release, "body").take(12000)
    val offer = Offer(name, code, sha, certificate, apk, notes)
    if (compare(name, installed.name) < 0 || code < installed.code) return Check("older", offer)
    if (name == installed.name && code == installed.code) return Check("current", offer)
    ensure(compare(name, installed.name) > 0 && code > installed.code)
    if (installed.debug) return Check("blocked", offer, "debug_build")
    if (certificate != installed.certificate) return Check("blocked", offer, "signature")
    return Check("available", offer)
  }
}
