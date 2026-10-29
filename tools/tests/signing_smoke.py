#!/usr/bin/env python3
"""Local integration test ONLY: temporary test key, never GitHub API/tag/publication."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import release as r


def rejected(fn):
    try:
        fn()
    except ValueError:
        return
    raise AssertionError('Unsafe APK unexpectedly accepted')


def main():
    app = json.loads((r.ROOT / 'app.json').read_text())['expo']
    unsigned = r.ROOT / 'android/app/build/outputs/apk/release/app-release-unsigned.apk'
    debug = r.ROOT / 'android/app/build/outputs/apk/debug/app-debug.apk'
    assert unsigned.is_file() and debug.is_file(), 'Build unsigned release and debug APKs first'
    with tempfile.TemporaryDirectory(prefix='memoez-signing-test-') as tmp:
        tmp = Path(tmp)
        key, cert = tmp / 'TEST-ONLY.jks', tmp / 'TEST-ONLY.der'
        with patch.dict(os.environ, {'SMOKE_PASSWORD': secrets.token_urlsafe(32)}):
            r.command(['keytool', '-genkeypair', '-noprompt', '-storetype', 'JKS', '-keystore', str(key), '-alias', 'test-only', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '2', '-dname', 'CN=MemoEZ Temporary Test Only', '-storepass:env', 'SMOKE_PASSWORD', '-keypass:env', 'SMOKE_PASSWORD'])
            r.command(['keytool', '-exportcert', '-keystore', str(key), '-alias', 'test-only', '-storepass:env', 'SMOKE_PASSWORD', '-file', str(cert)])
            expected = hashlib.sha256(cert.read_bytes()).hexdigest()
            plan = dict(tag='v' + app['version'], applicationId=app['android']['package'], versionName=app['version'], versionCode=app['android']['versionCode'], commit=r.command(['git', 'rev-parse', 'HEAD'], cwd=r.ROOT).strip(), certificateSha256=expected)
            test_env = dict(ANDROID_KEYSTORE_BASE64=base64.b64encode(key.read_bytes()).decode(), ANDROID_KEYSTORE_PASSWORD=os.environ['SMOKE_PASSWORD'], ANDROID_KEY_ALIAS='test-only', ANDROID_KEY_PASSWORD=os.environ['SMOKE_PASSWORD'], MEMOEZ_RELEASE_CERT_SHA256=expected)
            with patch.dict(os.environ, test_env):
                for i in (1, 2):
                    out = tmp / f'dist-{i}'
                    r.sign(unsigned, plan, out)
                    r.verify_bundle(out, plan)
                signed = tmp / 'dist-1' / f'memoez-{plan["tag"]}.apk'
                rejected(lambda: r.verify_apk(unsigned, plan))
                rejected(lambda: r.verify_apk(signed, {**plan, 'certificateSha256': '0' * 64}))
                rejected(lambda: r.sign(debug, plan, tmp / 'debug-must-not-ship'))
                assert not (tmp / 'debug-must-not-ship').exists()
                # Alter a real signed APK, then demand cryptographic verification failure.
                tampered = tmp / 'tampered.apk'
                data = bytearray(signed.read_bytes())
                data[len(data) // 2] ^= 1
                tampered.write_bytes(data)
                rejected(lambda: r.verify_apk(tampered, plan))
    print('PASS: same temporary key signs twice; certificate/package/version/non-debuggable verified; unsigned, wrong certificate, debug and tampered APKs refused. Test key and outputs deleted. No publication performed.')


if __name__ == '__main__':
    main()
