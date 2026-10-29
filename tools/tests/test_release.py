import importlib.util
import copy
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


BEFORE = 'c' * 40
HEAD = 'd' * 40


def approval_args():
    return [SHA, {'protected': True, 'commit': {'sha': SHA}},
            {'number': 1, 'state': 'closed', 'draft': False, 'commits': 2, 'user': {'login': 'author'}, 'head': {'sha': HEAD}, 'merged_at': 'now', 'merge_commit_sha': SHA, 'merged_by': {'login': 'YanTKYS'}, 'base': {'ref': 'main', 'repo': {'full_name': r.REPO}}},
            {'deployment_branch_policy': {'custom_branch_policies': True}, 'protection_rules': []},
            [{'name': 'main', 'type': 'branch'}],
            {'after': SHA, 'before': BEFORE},
            {'sha': SHA, 'parents': [{'sha': BEFORE}, {'sha': HEAD}]},
            [{'id': 1, 'state': 'APPROVED', 'commit_id': HEAD, 'user': {'login': 'reviewer', 'type': 'User'}}]]


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

    def test_merge_and_squash_and_single_rebase(self):
        r.approval(*approval_args())
        args = approval_args()
        args[6]['parents'] = [{'sha': BEFORE}]
        r.approval(*args)  # GitHub maps squash and single-commit rebase to this SHA.

    def test_multiple_commit_rebase_has_complete_chain(self):
        args = approval_args()
        middle = 'e' * 40
        args[6]['parents'] = [{'sha': middle}]
        comparison = dict(status='ahead', total_commits=2, patch_ids=[('1' * 40, '1' * 40), ('2' * 40, '2' * 40)], commits=[{'sha': middle, 'parents': [{'sha': BEFORE}]}, {'sha': SHA, 'parents': [{'sha': middle}]}])
        r.approval(*args, comparison)
        for key, value in [('total_commits', 3), ('status', 'diverged'), ('commits', comparison['commits'][1:]), ('patch_ids', [('1' * 40, '9' * 40)] * 2), ('patch_ids', [])]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                r.approval(*args, {**comparison, key: value})
        broken = copy.deepcopy(comparison)
        broken['commits'][0]['parents'] = [{'sha': HEAD}]
        with self.assertRaises(ValueError):
            r.approval(*args, broken)

    def test_wrong_owner_direct_push_or_old_sha(self):
        for key, value in [('merged_by', {'login': 'bot'}), ('merge_commit_sha', BEFORE), ('merged_at', None), ('draft', True), ('state', 'open')]:
            args = approval_args()
            args[2][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                r.approval(*args)
        for changes in [{'protected': False}, {'commit': {'sha': BEFORE}}]:
            args = approval_args()
            args[1].update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                r.approval(*args)
        for parents in [[], [{'sha': HEAD}], [{'sha': BEFORE}, {'sha': SHA}]]:
            args = approval_args()
            args[6]['parents'] = parents
            with self.subTest(parents=parents), self.assertRaises(ValueError):
                r.approval(*args)

    def test_review_must_cover_current_head_and_not_be_dismissed(self):
        for reviews in [[], [{**approval_args()[7][0], 'state': 'DISMISSED'}], [{**approval_args()[7][0], 'commit_id': BEFORE}], [{**approval_args()[7][0], 'user': {'login': 'author', 'type': 'User'}}], [{**approval_args()[7][0], 'user': {'login': 'org', 'type': 'Organization'}}], approval_args()[7] + [{**approval_args()[7][0], 'id': 2, 'state': 'CHANGES_REQUESTED'}]]:
            args = approval_args()
            args[7] = reviews
            with self.subTest(reviews=reviews), self.assertRaises(ValueError):
                r.approval(*args)
        args = approval_args()
        args[7].append({**args[7][0], 'id': 2, 'state': 'COMMENTED'})
        r.approval(*args)  # Discussion does not erase a valid approval.
        args[7] = [{**args[7][0], 'user': {'login': 'review-app[bot]', 'type': 'Bot'}}]
        r.approval(*args)  # A submitted app approval is allowed; a bot merge is not.

    def test_environment_requires_main_only_without_extra_reviewers(self):
        for policies in [[], [{'name': '*', 'type': 'branch'}], [{'name': 'main', 'type': 'tag'}], [{'name': 'main', 'type': 'branch'}, {'name': 'test', 'type': 'branch'}]]:
            args = approval_args()
            args[4] = policies
            with self.subTest(policies=policies), self.assertRaises(ValueError):
                r.approval(*args)
        args = approval_args()
        args[3]['protection_rules'] = [{'type': 'required_reviewers', 'reviewers': ['owner']}]
        with self.assertRaises(ValueError):
            r.approval(*args)

    def test_disabled_release_skips_without_remote_access(self):
        with patch.dict(os.environ, {'MEMOEZ_RELEASE_ENABLED': ''}), patch.object(r, 'push_context'), patch.object(r, 'command', return_value=SHA), patch.object(r, 'api') as api:
            self.assertEqual(r.make_plan('v0.5.0', SHA)['action'], 'skip')
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
        plan = {'action': 'release', 'previous': None, 'tag': 'v0.5.1', 'commit': SHA}
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
        plan = {'action': 'release', 'previous': None, 'tag': 'v0.5.1', 'commit': SHA, 'title': 'Release', 'notes': 'Notes'}
        def remote(path, method='GET', data=None):
            if path == 'releases' and method == 'POST':
                return {'id': 123, 'draft': True, 'prerelease': False}
            return {}
        with tempfile.TemporaryDirectory() as tmp, patch.object(r, 'make_plan', return_value=plan), patch.object(r, 'verify_bundle', side_effect=['hash', ValueError('Downloaded APK differs')]), patch.object(r, 'api', side_effect=remote) as api, patch.object(r, 'command'):
            with self.assertRaises(ValueError):
                r.publish(Path(tmp), plan)
            self.assertFalse(any(call.args[1:2] == ('PATCH',) for call in api.call_args_list))

    def test_approval_change_after_upload_never_publishes(self):
        plan = {'action': 'release', 'previous': None, 'tag': 'v0.5.1', 'commit': SHA, 'title': 'Release', 'notes': 'Notes'}
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


    def test_push_context_excludes_manual_pr_tag_force_push_and_wrong_sha(self):
        event = dict(ref='refs/heads/main', before=BEFORE, after=SHA, forced=False, created=False, deleted=False)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'event.json'
            path.write_text(json.dumps(event))
            context = dict(GITHUB_EVENT_NAME='push', GITHUB_REF='refs/heads/main', GITHUB_REPOSITORY=r.REPO, GITHUB_SHA=SHA, GITHUB_EVENT_PATH=str(path), GITHUB_TRIGGERING_ACTOR='collaborator')
            with patch.dict(os.environ, context):
                self.assertEqual(r.push_context(SHA), event)  # Re-run actor is not publication approval.
                for key, value in [('GITHUB_EVENT_NAME', 'workflow_dispatch'), ('GITHUB_EVENT_NAME', 'pull_request'), ('GITHUB_REF', 'refs/tags/v0.5.1'), ('GITHUB_SHA', BEFORE), ('GITHUB_REPOSITORY', 'other/repo')]:
                    with self.subTest(key=key, value=value), patch.dict(os.environ, {key: value}), self.assertRaises(ValueError):
                        r.push_context(SHA)
                for key, value in [('after', BEFORE), ('before', '0' * 40), ('forced', True), ('created', True), ('deleted', True)]:
                    path.write_text(json.dumps({**event, key: value}))
                    with self.subTest(key=key), self.assertRaises(ValueError):
                        r.push_context(SHA)

    def test_decide_same_published_version_and_initial_pr_skip(self):
        legacy = {'version': '0.5.0', 'android': {'package': 'com.memoez.app', 'versionCode': 8}}
        release = dict(tag_name='v0.5.0', draft=False, prerelease=False)
        self.assertEqual(r.decide(legacy, [release], [{'name': 'v0.5.0'}], None), 'skip')
        meta = dict(versionName='0.5.1', versionCode=9)
        release['tag_name'] = 'v0.5.1'
        self.assertEqual(r.decide(app(), [release], [{'name': 'v0.5.1'}], meta), 'skip')

    def test_decide_refuses_same_name_different_code_or_missing_published_tag(self):
        release = dict(tag_name='v0.5.1', draft=False, prerelease=False)
        for candidate, tags in [({**app(), 'android': {'package': 'com.memoez.app', 'versionCode': 10}}, [{'name': 'v0.5.1'}]), (app(), []), (app(), [{'name': 'v0.5.1'}, {'name': 'v0.5.2'}])]:
            with self.subTest(candidate=candidate, tags=tags), self.assertRaises(ValueError):
                r.decide(candidate, [release], tags, dict(versionName='0.5.1', versionCode=9))
        for flags in [{'draft': True}, {'prerelease': True}]:
            with self.subTest(flags=flags), self.assertRaises(ValueError):
                r.decide(app(), [{**release, **flags}], [{'name': 'v0.5.1'}], dict(versionName='0.5.1', versionCode=9))

    def test_decide_new_stable_requires_increasing_code(self):
        release = dict(tag_name='v0.5.0', draft=False, prerelease=False)
        self.assertEqual(r.decide(app(), [release], [{'name': 'v0.5.0'}], None), 'release')
        for candidate in [{'version': '0.4.0', 'android': {'package': 'com.memoez.app', 'versionCode': 9}}, {**app(), 'android': {'package': 'com.memoez.app', 'versionCode': 8}}, {**app(), 'version': '0.5.1-beta'}]:
            with self.subTest(candidate=candidate), self.assertRaises(ValueError):
                r.decide(candidate, [release], [{'name': 'v0.5.0'}], None)

    def test_full_plan_new_release_versus_ordinary_same_version_pr(self):
        for same in [False, True]:
            candidate = app() if not same else {'version': '0.5.0', 'android': {'package': 'com.memoez.app', 'versionCode': 8}}
            with self.subTest(same=same), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / 'docs').mkdir()
                (root / 'app.json').write_text(json.dumps({'expo': candidate}))
                (root / 'package.json').write_text(json.dumps({'version': candidate['version']}))
                (root / 'docs/release-note.md').write_text('## v0.5.1\n### Title\nv0.5.1: New\n### Note\nReviewed release.\n')
                with patch.object(r, 'ROOT', root), patch.dict(os.environ, {'MEMOEZ_RELEASE_ENABLED': 'true', 'GITHUB_SHA': SHA}), patch.object(r, 'push_context'), patch.object(r, 'command', return_value=SHA), patch.object(r, 'pages', side_effect=[[dict(tag_name='v0.5.0', draft=False, prerelease=False)], [{'name': 'v0.5.0'}]]), patch.object(r, 'check_remote_approval') as approval, patch.object(r, 'tool') as sdk:
                    plan = r.make_plan()
                    self.assertEqual(plan['action'], 'skip' if same else 'release')
                    sdk.assert_not_called()
                    if same:
                        approval.assert_not_called()
                    else:
                        approval.assert_called_once_with(SHA)

    def test_candidate_missing_certificate_or_draft_notes_fails(self):
        for missing in ['certificate', 'notes']:
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / 'docs').mkdir()
                (root / 'app.json').write_text(json.dumps({'expo': app()}))
                (root / 'package.json').write_text(json.dumps({'version': '0.5.1'}))
                (root / 'docs/release-note.md').write_text('## v0.5.1（ドラフト）\n### Title\nv0.5.1: New\n### Note\nDraft.\n')
                with patch.object(r, 'ROOT', root), patch.dict(os.environ, {'MEMOEZ_RELEASE_ENABLED': 'true', 'GITHUB_SHA': SHA, 'MEMOEZ_RELEASE_CERT_SHA256': '' if missing == 'certificate' else CERT}), patch.object(r, 'push_context'), patch.object(r, 'command', return_value=SHA), patch.object(r, 'pages', side_effect=[[], []]), patch.object(r, 'check_remote_approval'), self.assertRaises(ValueError):
                    r.make_plan()

    def test_api_evidence_resolves_full_pr_and_current_head_reviews(self):
        args = approval_args()
        def remote(path):
            return {'branches/main': args[1], 'pulls/1': args[2], 'git/commits/' + SHA: args[6], 'environments/release-signing': args[3], 'environments/release-signing/deployment-branch-policies': {'total_count': 1, 'branch_policies': args[4]}}[path]
        with patch.object(r, 'push_context', return_value=args[5]), patch.object(r, 'api', side_effect=remote) as api, patch.object(r, 'pages', side_effect=[[{'number': 1}], args[7]]):
            r.check_remote_approval(SHA)
            self.assertTrue(any(call.args == ('pulls/1',) for call in api.call_args_list))
        with patch.object(r, 'push_context', return_value=args[5]), patch.object(r, 'api', side_effect=remote), patch.object(r, 'pages', return_value=[]), self.assertRaises(ValueError):
            r.check_remote_approval(SHA)  # No associated merged PR = direct push, never release.


    def test_rebase_patch_ids_compare_actual_changes_not_line_offsets(self):
        diff = 'diff --git a/note b/note\nindex 1111111..2222222 100644\n--- a/note\n+++ b/note\n@@ -1 +1 @@\n-old\n+new\n'
        diffs = {SHA: diff, HEAD: diff.replace('@@ -1 +1 @@', '@@ -10 +10 @@'), BEFORE: diff.replace('+new', '+different')}
        original_command = r.command
        def route(args, **kwargs):
            return diffs[args[2].rsplit('/', 1)[-1]] if args[0] == 'gh' else original_command(args, **kwargs)
        with patch.object(r, 'command', side_effect=route):
            self.assertEqual(r.patch_id(SHA), r.patch_id(HEAD))
            self.assertNotEqual(r.patch_id(SHA), r.patch_id(BEFORE))
            diffs[SHA] = ''
            with self.assertRaises(ValueError):
                r.patch_id(SHA)

if __name__ == '__main__':
    unittest.main()
