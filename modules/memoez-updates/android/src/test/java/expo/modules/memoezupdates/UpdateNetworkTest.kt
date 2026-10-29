package expo.modules.memoezupdates

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.URL
import java.security.cert.Certificate
import javax.net.ssl.HttpsURLConnection
import org.junit.Assert.*
import org.junit.Test

class UpdateNetworkTest {
  private class Response(val status: Int = 200, val bytes: ByteArray = byteArrayOf(1, 2, 3), val length: Long = bytes.size.toLong(), val location: String? = null) : HttpsURLConnection(URL(UpdatePolicy.LATEST)) {
    var closed = false
    override fun connect() {}
    override fun disconnect() { closed = true }
    override fun usingProxy() = false
    override fun getCipherSuite() = "test-only"
    override fun getLocalCertificates(): Array<Certificate>? = null
    override fun getServerCertificates(): Array<Certificate> = emptyArray()
    override fun getResponseCode() = status
    override fun getHeaderFieldLong(name: String?, defaultValue: Long) = length
    override fun getHeaderField(name: String?) = location
    override fun getInputStream(): InputStream = ByteArrayInputStream(bytes)
  }
  private val asset = UpdatePolicy.url("v0.6.1", "memoez-v0.6.1.apk")
  private fun fail(reason: String, action: () -> Unit) { assertEquals(reason, assertThrows(UpdateFailure::class.java, action).reason) }
  @Test fun downloadIsBoundedAndConnectionsClosed() {
    val response = Response()
    val network = UpdateNetwork({ false }, { response })
    val out = ByteArrayOutputStream()
    network.transfer(asset, 3, 3, out)
    assertArrayEquals(response.bytes, out.toByteArray())
    assertTrue(response.closed)
    assertFalse(response.instanceFollowRedirects)
    fail("size_limit") { UpdateNetwork({ false }, { Response(length = 10) }).transfer(asset, 3, 3, ByteArrayOutputStream()) }
    fail("incomplete") { UpdateNetwork({ false }, { Response(length = 4) }).transfer(asset, 3, 10, ByteArrayOutputStream()) }
    fail("incomplete") { UpdateNetwork({ false }, { Response(bytes = byteArrayOf(1), length = -1) }).transfer(asset, 3, 3, ByteArrayOutputStream()) }
    fail("size_limit") { UpdateNetwork({ false }, { Response(length = -1) }).transfer(asset, 2, 3, ByteArrayOutputStream()) }
  }
  @Test fun unknownLengthApiResponseStillHasSizeCap() {
    fail("size_limit") { UpdateNetwork({ false }, { Response(length = -1) }).bytes(UpdatePolicy.LATEST, null, 2) }
  }
  @Test fun noArbitraryUrlsOrUnsafeRedirects() {
    fail("unsafe_url") { UpdateNetwork({ false }, { error("Must not connect") }).bytes("https://evil.example/", null, 100) }
    for (target in listOf("http://github.com/x", "https://evil.example/update.apk")) {
      val response = Response(status = 302, location = target)
      fail("unsafe_url") { UpdateNetwork({ false }, { response }).transfer(asset, 3, 10, ByteArrayOutputStream()) }
      assertTrue(response.closed)
    }
    fail("unsafe_url") { UpdateNetwork({ false }, { Response(status = 302, location = asset) }).transfer(asset, 3, 10, ByteArrayOutputStream()) }
  }
  @Test fun followsOnlyAllowedCdnWithFreshConnections() {
    val first = Response(status = 302, location = "https://release-assets.githubusercontent.com/github-production-release-asset/123/file")
    val second = Response()
    val calls = mutableListOf<String>()
    val network = UpdateNetwork({ false }, { url -> calls += url; if (calls.size == 1) first else second })
    network.transfer(asset, 3, 3, ByteArrayOutputStream())
    assertEquals(2, calls.size)
    assertTrue(first.closed && second.closed)
  }
  @Test fun distinguishNotFoundRateLimitAndCancellation() {
    fail("no_release") { UpdateNetwork({ false }, { Response(status = 404) }).bytes(UpdatePolicy.LATEST, null, 100) }
    fail("missing_assets") { UpdateNetwork({ false }, { Response(status = 404) }).transfer(asset, 3, 3, ByteArrayOutputStream()) }
    for (code in listOf(403, 429)) fail("rate_limit") { UpdateNetwork({ false }, { Response(status = code) }).bytes(UpdatePolicy.LATEST, null, 100) }
    fail("cancelled") { UpdateNetwork({ true }, { error("Must not connect") }).bytes(UpdatePolicy.LATEST, null, 100) }
    var cancelled = false
    val response = Response()
    fail("cancelled") { UpdateNetwork({ cancelled }, { response }).transfer(asset, 3, 3, ByteArrayOutputStream()) { if (it > 0) cancelled = true } }
    assertTrue(response.closed)
  }
  @Test fun deadlineDoesNotAllowAnUnboundedSlowResponse() {
    var time = 0L
    fail("timeout") { UpdateNetwork({ false }, { Response() }, { time += 31_000_000_000; time }).bytes(UpdatePolicy.LATEST, null, 100) }
  }
}
