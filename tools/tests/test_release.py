import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('release', Path(__file__).parents[1] / 'release.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
CERT = 'a' * 64
SHA = 'b' * 40


def app():
    return {'version': '0.5.1', 'android': {'package': 'com.memoez.app', 'versionCode': 9}}


def approval_args():
    return ['workflow_dispatch', 'YanTKYS', 'refs/heads/main', SHA, SHA,
            {'protected': True, 'commit': {'sha': SHA}},
            [{'merged_at': 'now', 'merge_commit_sha': SHA, 'merged_by': {'login': 'YanTKYS'}, 'base': {'ref': 'main', 'repo': {'full_name': r.REPO}}}],
            {'deployment_branch_policy': {'custom_branch_policies': True}, 'protection_rules': [{'type': 'required_reviewers', 'reviewers': [{'reviewer': {'login': 'YanTKYS'}}]}]},
            [{'name': 'main', 'type': 'branch'}]]


class ReleaseGuards(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'MEMOEZ_RELEASE_CERT_SHA256': CERT})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_future_version_and_owner_approval(self):
        self.assertEqual(r.validate_version(app(), 'v0.5.1', [], [], {}), 9)
        r.approval(*approval_args())

    def test_reject_nonstable_versions(self):
        for value in ['0.5.1-beta', '01.5.1', '0.5', '0.5.1;echo bad', '', '../x']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                r.version(value)

    def test_invalid_certificate(self):
        for value in ['', 'x' * 64, 'a' * 63]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                r.fingerprint(value)
        self.assertEqual(r.fingerprint(':'.join(['AA'] * 32)), 'a' * 64)

    def test_package_version_floor_and_tag_mismatch(self):
        for candidate, tag in [(app(), 'v0.5.2'), ({**app(), 'version': '0.5.0'}, 'v0.5.0'),
                               ({**app(), 'android': {'package': 'other.app', 'versionCode': 9}}, 'v0.5.1'),
                               ({**app(), 'android': {'package': 'com.memoez.app', 'versionCode': 8}}, 'v0.5.1'),
                               ({**app(), 'android': {'package': 'com.memoez.app', 'versionCode': True}}, 'v0.5.1')]:
            with self.subTest(candidate=candidate, tag=tag), self.assertRaises(ValueError):
                r.validate_version(candidate, tag, [], [], {})

    def test_no_existing_tag_or_release_even_draft(self):
        with self.assertRaises(ValueError):
            r.validate_version(app(), 'v0.5.1', [], [{'name': 'v0.5.1'}], {})
        for draft, prerelease in [(True, False), (False, True), (False, False)]:
            with self.subTest(draft=draft), self.assertRaises(ValueError):
                r.validate_version(app(), 'v0.5.1', [{'tag_name': 'v0.5.1', 'draft': draft, 'prerelease': prerelease}], [], {})

    def test_previous_release_code_and_certificate(self):
        releases = [{'tag_name': 'v0.5.1', 'draft': False, 'prerelease': False}]
        meta = dict(schemaVersion=1, applicationId='com.memoez.app', versionName='0.5.1', versionCode=9, certificateSha256=CERT)
        newer = {'version': '0.5.2', 'android': {'package': 'com.memoez.app', 'versionCode': 10}}
        r.validate_version(newer, 'v0.5.2', releases, [], {'v0.5.1': meta})
        for changes in [{'versionCode': 10}, {'certificateSha256': 'c' * 64}, {'applicationId': 'other.app'}, {'versionName': '0.5.9'}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                r.validate_version(newer, 'v0.5.2', releases, [], {'v0.5.1': {**meta, **changes}})
        with self.assertRaises(KeyError):
            r.validate_version(newer, 'v0.5.2', releases, [], {})

    def test_version_rollback(self):
        with self.assertRaises(ValueError):
            r.validate_version(app(), 'v0.5.1', [{'tag_name': 'v0.6.0', 'draft': False, 'prerelease': False}], [], {})

    def test_legacy_release_uses_explicit_floor(self):
        r.validate_version(app(), 'v0.5.1', [{'tag_name': 'v0.5.0', 'draft': False, 'prerelease': False}], [], {})

    def test_notes_exact_section(self):
        text = '# Notes\n## v0.5.1\n\n### Title\n`v0.5.1: Release`\n\n### Note\nKeep my data.\n\n---\n\n## v0.5.0\nold\n'
        self.assertEqual(r.release_notes(text, 'v0.5.1'), ('v0.5.1: Release', 'Keep my data.'))
        for changed in [text.replace('## v0.5.1\n', '## v0.5.1（ドラフト）\n'), text.replace('### Note', '### Missing'), text.replace('`v0.5.1: Release`', '`v0.5.2: Release`')]:
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                r.release_notes(changed, 'v0.5.1')

    def test_pr_tag_branch_actor_sha_direct_push_guards(self):
        for index, value in [(0, 'pull_request'), (0, 'push'), (1, 'contributor'), (2, 'refs/tags/v0.5.1'), (2, 'refs/heads/test'), (4, 'c' * 40), (4, 'HEAD')]:
            args = approval_args()
            args[index] = value
            with self.subTest(index=index, value=value), self.assertRaises(ValueError):
                r.approval(*args)
        for changes in [{'protected': False}, {'commit': {'sha': 'c' * 40}}]:
            args = approval_args()
            args[5].update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                r.approval(*args)
        for prs in [[], [{**approval_args()[6][0], 'merged_by': {'login': 'contributor'}}], [{**approval_args()[6][0], 'merge_commit_sha': 'd' * 40}]]:
            args = approval_args()
            args[6] = prs
            with self.subTest(prs=prs), self.assertRaises(ValueError):
                r.approval(*args)

    def test_environment_guards(self):
        for policies in [[], [{'name': '*', 'type': 'branch'}], [{'name': 'main', 'type': 'tag'}], [{'name': 'main', 'type': 'branch'}, {'name': 'test', 'type': 'branch'}]]:
            args = approval_args()
            args[8] = policies
            with self.subTest(policies=policies), self.assertRaises(ValueError):
                r.approval(*args)
        args = approval_args()
        args[7]['protection_rules'] = []
        with self.assertRaises(ValueError):
            r.approval(*args)

    def test_disabled_release_never_calls_github(self):
        with patch.dict(os.environ, {'MEMOEZ_RELEASE_ENABLED': ''}), patch.object(r, 'api') as api:
            with self.assertRaises(ValueError):
                r.make_plan('v0.5.1', SHA)
            api.assert_not_called()

    def test_missing_secrets_fail_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {}, clear=True):
            out = Path(tmp) / 'dist'
            with self.assertRaises(ValueError):
                r.sign(Path('missing.apk'), {}, out)
            self.assertFalse(out.exists())

    def test_debuggable_and_wrong_certificate_are_rejected(self):
        plan = dict(applicationId='com.memoez.app', versionName='0.5.1', versionCode=9, certificateSha256=CERT)
        cert = 'Signer #1 certificate SHA-256 digest: ' + CERT + '\n'
        badging = "package: name='com.memoez.app' versionCode='9' versionName='0.5.1'\n"
        with patch.object(r, 'tool', side_effect=lambda n: n), patch.object(r, 'digest', return_value='sha'):
            for cert_out, badge in [(cert.replace(CERT, 'c' * 64), badging), (cert + 'CN=Android Debug', badging), (cert * 2, badging), (cert, badging + 'application-debuggable'), (cert, badging.replace("'9'", "'8'"))]:
                with self.subTest(cert=cert_out, badge=badge), patch.object(r, 'command', side_effect=[cert_out, badge]), self.assertRaises(ValueError):
                    r.verify_apk(Path('input.apk'), plan)
            with patch.object(r, 'command', side_effect=[cert, badging]):
                self.assertEqual(r.verify_apk(Path('input.apk'), plan), 'sha')

    def test_partial_signing_result_removed(self):
        secrets = dict(ANDROID_KEYSTORE_BASE64='dGVzdA==', ANDROID_KEYSTORE_PASSWORD='test-only', ANDROID_KEY_ALIAS='test-only', ANDROID_KEY_PASSWORD='test-only')
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, secrets), patch.object(r, 'tool', side_effect=lambda n: n), patch.object(r, 'command', side_effect=ValueError('signer failed')):
            out = Path(tmp) / 'dist'
            with self.assertRaises(ValueError):
                r.sign(Path('test.apk'), {'certificateSha256': CERT}, out)
            self.assertFalse(out.exists())

    def test_publish_collision_does_not_write(self):
        plan = {'tag': 'v0.5.1', 'commit': SHA}
        with patch.object(r, 'make_plan', side_effect=ValueError('Tag exists')), patch.object(r, 'api') as api:
            with self.assertRaises(ValueError):
                r.publish(Path('unused'), plan)
            api.assert_not_called()

    def test_bundle_tampering_or_extra_files(self):
        plan = dict(tag='v0.5.1', applicationId='com.memoez.app', versionName='0.5.1', versionCode=9, commit=SHA, certificateSha256=CERT)
        with tempfile.TemporaryDirectory() as tmp, patch.object(r, 'verify_apk', return_value='hash'):
            d = Path(tmp)
            (d / 'memoez-v0.5.1.apk').write_bytes(b'test')
            (d / 'memoez-v0.5.1.apk.sha256').write_text('hash  memoez-v0.5.1.apk\n')
            meta = {k: plan[k] for k in ['applicationId', 'versionName', 'versionCode', 'commit', 'certificateSha256']}
            meta.update(schemaVersion=1, apkSha256='hash', apkAsset='memoez-v0.5.1.apk')
            (d / 'memoez-v0.5.1.json').write_text(json.dumps(meta))
            self.assertEqual(r.verify_bundle(d, plan), 'hash')
            (d / 'private.jks').write_bytes(b'not-a-key')
            with self.assertRaises(ValueError):
                r.verify_bundle(d, plan)
            (d / 'private.jks').unlink()
            (d / 'memoez-v0.5.1.apk.sha256').write_text('wrong checksum')
            with self.assertRaises(ValueError):
                r.verify_bundle(d, plan)

    def test_failed_download_verification_never_publishes(self):
        plan = {'tag': 'v0.5.1', 'commit': SHA, 'title': 'Release', 'notes': 'Notes'}
        def remote(path, method='GET', data=None):
            if path == 'releases' and method == 'POST':
                return {'id': 123, 'draft': True, 'prerelease': False}
            return {}
        with tempfile.TemporaryDirectory() as tmp, patch.object(r, 'make_plan', return_value=plan), patch.object(r, 'verify_bundle', side_effect=['hash', ValueError('Downloaded APK differs')]), patch.object(r, 'api', side_effect=remote) as api, patch.object(r, 'command'):
            with self.assertRaises(ValueError):
                r.publish(Path(tmp), plan)
            self.assertFalse(any(call.args[1:2] == ('PATCH',) for call in api.call_args_list))

    def test_approval_change_after_upload_never_publishes(self):
        plan = {'tag': 'v0.5.1', 'commit': SHA, 'title': 'Release', 'notes': 'Notes'}
        def remote(path, method='GET', data=None):
            if path == 'releases' and method == 'POST':
                return {'id': 123, 'draft': True, 'prerelease': False}
            if path == 'releases/123':
                return {'draft': True, 'prerelease': False, 'tag_name': plan['tag'], 'target_commitish': SHA, 'assets': []}
            return {}
        with tempfile.TemporaryDirectory() as tmp, patch.object(r, 'make_plan', return_value=plan), patch.object(r, 'verify_bundle', return_value='hash'), patch.object(r, 'api', side_effect=remote) as api, patch.object(r, 'command'), patch.object(r, 'check_remote_approval', side_effect=ValueError('Main advanced')), patch.object(r, 'verify_uploaded_assets'):
            with self.assertRaises(ValueError):
                r.publish(Path(tmp), plan)
            self.assertFalse(any(call.args[1:2] == ('PATCH',) for call in api.call_args_list))

    def test_remote_assets_require_exact_names_sizes_and_github_digest(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / 'release.apk').write_bytes(b'fixture')
            assets = [dict(name='release.apk', state='uploaded', size=7, digest='sha256:' + r.digest(d / 'release.apk'))]
            r.verify_uploaded_assets(assets, d)
            for changes in [{'size': 8}, {'digest': 'sha256:' + '0' * 64}, {'state': 'new'}, {'name': 'wrong.apk'}]:
                with self.subTest(changes=changes), self.assertRaises(ValueError):
                    r.verify_uploaded_assets([{**assets[0], **changes}], d)
            with self.assertRaises(ValueError):
                r.verify_uploaded_assets(assets + assets, d)

    def test_orphan_future_tag_blocks_version_rollback(self):
        with self.assertRaises(ValueError):
            r.validate_version(app(), 'v0.5.1', [], [{'name': 'v0.5.2'}], {})

    def test_nonowner_rerun_refused_before_remote_access(self):
        with patch.dict(os.environ, {'GITHUB_TRIGGERING_ACTOR': 'contributor'}), patch.object(r, 'api') as api:
            with self.assertRaises(ValueError):
                r.check_remote_approval(SHA)
            api.assert_not_called()

    def test_successful_publish_is_last_write_after_verification(self):
        plan = {'tag': 'v0.5.1', 'commit': SHA, 'title': 'Release', 'notes': 'Notes'}
        def remote(path, method='GET', data=None):
            if path == 'releases' and method == 'POST':
                return {'id': 123, 'draft': True, 'prerelease': False}
            if path == 'releases/123' and method == 'GET':
                return {'draft': True, 'prerelease': False, 'tag_name': plan['tag'], 'target_commitish': SHA, 'assets': []}
            if path == 'releases/123' and method == 'PATCH':
                return {'draft': False, 'prerelease': False, 'html_url': 'https://example.invalid/test-only'}
            return {'object': {'sha': SHA}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(r, 'make_plan', return_value=plan), patch.object(r, 'verify_bundle', return_value='hash') as verify, patch.object(r, 'api', side_effect=remote) as api, patch.object(r, 'command'), patch.object(r, 'check_remote_approval') as approval, patch.object(r, 'verify_uploaded_assets') as assets, patch('builtins.print'):
            r.publish(Path(tmp), plan)
            self.assertEqual(verify.call_count, 2)
            approval.assert_called_once_with(SHA)
            assets.assert_called_once()
            self.assertEqual(api.call_args_list[-1].args, ('releases/123', 'PATCH', {'draft': False, 'make_latest': 'true'}))


if __name__ == '__main__':
    unittest.main()
