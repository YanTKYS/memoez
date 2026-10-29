package expo.modules.memoezupdates

import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.URI
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/** No cookies, auth headers, POSTs, arbitrary initial URLs or unconstrained redirects. */
class UpdateNetwork(
  private val cancelled: () -> Boolean,
  private val connect: (String) -> HttpsURLConnection = { URL(it).openConnection() as HttpsURLConnection },
  private val now: () -> Long = System::nanoTime
) {
  @Volatile private var active: HttpsURLConnection? = null
  fun cancel() { active?.disconnect() }
  private fun initialAllowed(url: String): Boolean = try {
    if (url == UpdatePolicy.LATEST) true else {
      val parts = URI(url).path.removePrefix("/YanTKYS/memoez/releases/download/").split('/')
      if (parts.size != 2 || !parts[0].startsWith('v')) false else {
        UpdatePolicy.version(parts[0].substring(1))
        parts[1] in setOf("memoez-${parts[0]}.apk", "memoez-${parts[0]}.apk.sha256", "memoez-${parts[0]}.json") && url == UpdatePolicy.url(parts[0], parts[1])
      }
    }
  } catch (_: Exception) { false }

  fun transfer(original: String, expected: Long?, limit: Long, output: OutputStream, tick: (Long) -> Unit = {}) {
    ensure(initialAllowed(original), "unsafe_url")
    ensure(expected == null || expected in 1..limit, "size_limit")
    val deadline = now() + (if (original.endsWith(".apk")) 180L else 30L) * 1_000_000_000
    fun check() {
      ensure(!cancelled(), "cancelled")
      ensure(now() < deadline, "timeout")
    }
    var target = original
    for (hop in 0..3) {
      check()
      val connection = connect(target)
      active = connection
      try {
        connection.instanceFollowRedirects = false
        connection.useCaches = false
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        connection.setRequestProperty("User-Agent", "MemoEZ-Update")
        connection.setRequestProperty("Accept", if (original == UpdatePolicy.LATEST) "application/vnd.github+json" else "application/octet-stream")
        connection.setRequestProperty("Accept-Encoding", "identity")
        connection.setRequestProperty("Cookie", "")
        val status = connection.responseCode
        check()
        if (status in listOf(301, 302, 303, 307, 308)) {
          ensure(original != UpdatePolicy.LATEST && hop < 3, "unsafe_url")
          val next = URI(target).resolve(connection.getHeaderField("Location") ?: "").toString()
          ensure(UpdatePolicy.redirectAllowed(original, next), "unsafe_url")
          target = next
          continue
        }
        if (status == 404) throw UpdateFailure(if (original == UpdatePolicy.LATEST) "no_release" else "missing_assets")
        if ((status == 403 || status == 429) && original == UpdatePolicy.LATEST) throw UpdateFailure("rate_limit")
        ensure(status == 200, "network")
        val length = connection.getHeaderFieldLong("Content-Length", -1)
        ensure(length < 0 || length <= limit, "size_limit")
        ensure(expected == null || length < 0 || expected == length, "incomplete")
        connection.inputStream.use { input ->
          if (expected != null) {
            ApkSafety.copy(input, output, expected) { count -> check(); tick(count) }
          } else {
            var count = 0L
            val buffer = ByteArray(8192)
            while (true) {
              check()
              val read = input.read(buffer)
              if (read < 0) break
              count += read
              ensure(count <= limit, "size_limit")
              output.write(buffer, 0, read)
            }
            ensure(length < 0 || length == count, "incomplete")
          }
        }
        check()
        return
      } finally {
        connection.disconnect()
        if (active === connection) active = null
      }
    }
    throw UpdateFailure("unsafe_url")
  }

  fun bytes(url: String, expected: Long?, limit: Int): ByteArray = ByteArrayOutputStream().use { output ->
    transfer(url, expected, limit.toLong(), output)
    output.toByteArray()
  }
}
