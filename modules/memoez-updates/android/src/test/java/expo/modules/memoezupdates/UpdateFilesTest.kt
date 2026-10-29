package expo.modules.memoezupdates

import java.io.File
import java.io.IOException
import org.junit.Assert.*
import org.junit.Test

class UpdateFilesTest {
  private fun withFiles(test: (UpdateFiles) -> Unit) {
    val root = java.nio.file.Files.createTempDirectory("memoez-cache-test-").toFile()
    try { test(UpdateFiles(root)) } finally { root.deleteRecursively() }
  }
  @Test fun failedOrCancelledOrFullStorageLeavesNoApkOrPartialFile() = withFiles { files ->
    for (failure in listOf(IOException("network"), UpdateFailure("cancelled"), UpdateFailure("storage"))) {
      assertThrows(Exception::class.java) { files.stage({ it.writeText("partial"); throw failure }, { fail("Must not verify failed download") }) }
      assertFalse(files.partial.exists()); assertFalse(files.apk.exists())
    }
  }
  @Test fun failedVerificationIsDiscardedAndOnlyVerifiedFileIsRetained() = withFiles { files ->
    assertThrows(UpdateFailure::class.java) { files.stage({ it.writeText("untrusted") }, { throw UpdateFailure("signature") }) }
    assertFalse(files.apk.exists()); assertFalse(files.partial.exists())
    files.stage({ it.writeText("verified fixture") }, { assertEquals("verified fixture", files.apk.readText()) })
    assertTrue(files.apk.exists()); assertFalse(files.partial.exists())
    files.discard()
    assertFalse(files.apk.exists())
  }
  @Test fun processRestartCleansOnlyOurKnownFiles() = withFiles { files ->
    files.apk.writeText("old")
    files.partial.writeText("interrupted")
    val unrelated = File(files.directory, "unrelated")
    unrelated.writeText("keep")
    UpdateFiles(files.directory)
    assertFalse(files.apk.exists()); assertFalse(files.partial.exists())
    assertEquals("keep", unrelated.readText())
  }
}
