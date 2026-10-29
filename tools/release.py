#!/usr/bin/env python3
"""Fail-closed release tooling. No tags/releases are written except by `publish`."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / 'tools/release-policy.json').read_text())
REPO = 'YanTKYS/memoez'
OWNER = 'YanTKYS'
ENVIRONMENT = 'release-signing'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def version(value):
    require(isinstance(value, str) and re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', value), 'Stable X.Y.Z version required')
    return tuple(map(int, value.split('.')))


def fingerprint(value):
    value = value.replace(':', '').strip().lower()
    require(re.fullmatch(r'[0-9a-f]{64}', value), 'Expected signing certificate SHA-256 is required')
    return value


def digest(path):
    with open(path, 'rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def command(args, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, **kwargs)
    # Do not relay subprocess errors: signing tools may include sensitive inputs.
    require(result.returncode == 0, f'{Path(args[0]).name} failed')
    return result.stdout


def api(path, method='GET', data=None):
    args = ['gh', 'api', f'repos/{REPO}/{path}', '--method', method]
    if data is not None:
        args += ['--input', '-']
    output = command(args, input=json.dumps(data) if data is not None else None)
    return json.loads(output) if output.strip() else None


def pages(path):
    result = []
    for page in range(1, 101):
        rows = api(f'{path}{"&" if "?" in path else "?"}per_page=100&page={page}')
        require(isinstance(rows, list), 'Unexpected GitHub list response')
        result.extend(rows)
        if len(rows) < 100:
            return result
    raise ValueError('Incomplete GitHub history; release refused')


def release_notes(text, tag):
    # Draft headings deliberately do not match. An owner must finalize the notes.
    section = re.search(r'^## ' + re.escape(tag) + r'\s*\n(.*?)(?=^## |\Z)', text, re.M | re.S)
    require(section, 'Finalized exact-version release notes required (no draft heading)')
    title = re.search(r'^### Title\s*\n([^\n]+)', section[1], re.M)
    body = re.search(r'^### Note\s*\n(.*)', section[1], re.M | re.S)
    require(title and body and body[1].strip(), 'Release Title and Note required')
    title = title[1].strip().strip('`')
    require(title.startswith(tag + ':'), 'Release title must start with the exact tag')
    require('ドラフト' not in title and 'draft' not in title.lower(), 'Draft release title refused')
    return title, re.sub(r'\n---\s*$', '', body[1].strip()).strip()


def validate_version(app, tag, releases, tags, previous):
    require(tag == 'v' + app['version'], 'Tag/app.json version mismatch')
    current = version(app['version'])
    code = app['android']['versionCode']
    require(app['android']['package'] == POLICY['applicationId'], 'Application ID changed')
    require(type(code) is int and 0 < code <= 2100000000, 'Invalid Android versionCode')
    require(current > version(POLICY['legacyVersionName']) and code > POLICY['legacyVersionCode'], 'Version must exceed the legacy migration floor')
    require(not any(t['name'] == tag for t in tags), 'Tag already exists; never overwrite')
    for t in tags:
        if re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', t['name']):
            require(current > version(t['name'][1:]), 'Version must exceed existing stable tags, including interrupted releases')
    require(not any(r['tag_name'] == tag for r in releases), 'Release or draft already exists')
    signed_history = []
    for r in releases:
        if r['draft'] or r['prerelease']:
            continue
        name = r['tag_name']
        require(re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', name), 'Unknown stable release naming; owner review required')
        require(current > version(name[1:]), 'Version rollback or duplicate version')
        if version(name[1:]) > version(POLICY['legacyVersionName']):
            signed_history.append(name)
    if signed_history:
        name = max(signed_history, key=lambda tag: version(tag[1:]))
        meta = previous[name]
        require(meta['schemaVersion'] == 1 and meta['versionName'] == name[1:] and meta['applicationId'] == POLICY['applicationId'], 'Invalid previous release metadata')
        require(type(meta['versionCode']) is int and code > meta['versionCode'], 'versionCode must increase')
        require(meta['certificateSha256'] == fingerprint(os.environ.get('MEMOEZ_RELEASE_CERT_SHA256', '')), 'Signing certificate rotation refused')
    return code


def push_context(sha):
    require(os.environ.get('GITHUB_EVENT_NAME') == 'push' and os.environ.get('GITHUB_REF') == 'refs/heads/main' and os.environ.get('GITHUB_REPOSITORY') == REPO, 'Only main push events may release')
    require(re.fullmatch(r'[0-9a-f]{40}', sha or '') and os.environ.get('GITHUB_SHA') == sha, 'Invalid triggering commit')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    require(event.get('ref') == 'refs/heads/main' and event.get('after') == sha and not any(event.get(k) for k in ['forced', 'deleted', 'created']), 'Ordinary main merge push required')
    require(re.fullmatch(r'[0-9a-f]{40}', event.get('before', '')) and event['before'] != '0' * 40, 'Push before SHA required')
    return event


def approval(sha, branch, pr, environment, policies, event, commit, comparison=None):
    require(sha == event['after'] == branch['commit']['sha'], 'Release SHA must be the current main HEAD')
    require(branch['protected'], 'Protect main before enabling releases')
    require(pr.get('merged_at') and pr.get('merge_commit_sha') == sha and (pr.get('merged_by') or {}).get('login') == OWNER and pr['base']['ref'] == 'main' and pr['base']['repo']['full_name'] == REPO, 'Owner-merged main PR required')
    require(not pr.get('draft') and pr.get('state') == 'closed', 'Merged non-draft PR required')
    require(commit['sha'] == sha, 'Commit lookup mismatch')
    parents = [p['sha'] for p in commit['parents']]
    if len(parents) == 2:
        require(parents == [event['before'], pr['head']['sha']], 'Merge parents do not match push and source PR head')
    elif len(parents) == 1 and parents[0] == event['before']:
        # GitHub merge_commit_sha is the squash commit, or the tip of a one-commit rebase.
        pass
    else:
        # Multi-commit rebase: GitHub maps merge_commit_sha to its final rebased commit.
        require(len(parents) == 1 and comparison is not None, 'Unsupported merge topology')
        commits = comparison['commits']
        require(comparison['status'] == 'ahead' and comparison['total_commits'] == pr['commits'] == len(commits) and 1 < len(commits) <= 250, 'Incomplete or unrelated rebased range')
        previous = event['before']
        for item in commits:
            require([p['sha'] for p in item['parents']] == [previous], 'Rebase range must be a complete single-parent chain')
            previous = item['sha']
        require(previous == sha, 'Rebase range tip differs from approved merge')
        pairs = comparison.get('patch_ids', [])
        require(len(pairs) == len(commits) and all(re.fullmatch(r'[0-9a-f]{40}', original) and original == rebased for original, rebased in pairs), 'Rebased patches differ from source PR commits')
    require(environment.get('deployment_branch_policy', {}).get('custom_branch_policies'), 'Environment must restrict deployment branches')
    require(policies == [{'name': 'main', 'type': 'branch'}], 'Environment must allow only main (no tags or wildcard branches)')
    require(not any(r['type'] == 'required_reviewers' and r.get('reviewers') for r in environment['protection_rules']), 'Remove per-release Environment reviewers; owner PR merge is the approval')


def patch_id(sha):
    require(re.fullmatch(r'[0-9a-f]{40}', sha), 'Invalid rebase commit SHA')
    diff = command(['gh', 'api', f'repos/{REPO}/commits/{sha}', '-H', 'Accept: application/vnd.github.diff'])
    result = command(['git', 'patch-id', '--stable'], input=diff).split()
    require(len(result) == 2 and re.fullmatch(r'[0-9a-f]{40}', result[0]), 'Unverifiable or empty rebased patch')
    return result[0]


def check_remote_approval(sha):
    event = push_context(sha)
    branch = api('branches/main')
    require(branch['protected'] and branch['commit']['sha'] == sha, 'Current protected main required')
    prs = [api(f'pulls/{p["number"]}') for p in pages(f'commits/{sha}/pulls')]
    matches = [p for p in prs if p.get('merged_at') and p.get('merge_commit_sha') == sha and (p.get('merged_by') or {}).get('login') == OWNER and p['base']['ref'] == 'main' and p['base']['repo']['full_name'] == REPO]
    require(len(matches) == 1, 'Exactly one owner-merged main PR must identify this SHA')
    pr = matches[0]
    commit = api(f'git/commits/{sha}')
    comparison = None
    if len(commit['parents']) == 1 and commit['parents'][0]['sha'] != event['before']:
        comparison = api(f'compare/{event["before"]}...{sha}')
        originals = pages(f'pulls/{pr["number"]}/commits')
        require(1 < len(originals) == pr['commits'] == comparison['total_commits'] == len(comparison['commits']) <= 250 and originals[-1]['sha'] == pr['head']['sha'], 'Incomplete original/rebased commit evidence')
        comparison['patch_ids'] = [(patch_id(original['sha']), patch_id(rebased['sha'])) for original, rebased in zip(originals, comparison['commits'])]
    env = api(f'environments/{ENVIRONMENT}')
    policy_result = api(f'environments/{ENVIRONMENT}/deployment-branch-policies')
    require(policy_result['total_count'] == 1, 'Exactly one Environment deployment branch policy required')
    policies = [{'name': p['name'], 'type': p['type']} for p in policy_result['branch_policies']]
    approval(sha, branch, pr, env, policies, event, commit, comparison)


def latest_metadata(releases):
    stable = [r for r in releases if not r['draft'] and not r['prerelease']]
    for release in stable:
        require(re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', release['tag_name']), 'Unknown stable release naming')
    if not stable:
        return None
    latest = max(stable, key=lambda r: version(r['tag_name'][1:]))
    name = latest['tag_name']
    if version(name[1:]) <= version(POLICY['legacyVersionName']):
        return None  # Explicit legacy baseline; not an assertion about old signing keys.
    with tempfile.TemporaryDirectory() as tmp:
        command(['gh', 'release', 'download', name, '--repo', REPO, '--pattern', f'memoez-{name}.json', '--dir', tmp])
        meta = json.loads((Path(tmp) / f'memoez-{name}.json').read_text())
    require(meta['schemaVersion'] == 1 and meta['applicationId'] == POLICY['applicationId'] and meta['versionName'] == name[1:] and type(meta['versionCode']) is int, 'Invalid published metadata')
    return meta


def decide(app, releases, tags, previous):
    name, code = app['version'], app['android']['versionCode']
    current = version(name)
    require(app['android']['package'] == POLICY['applicationId'] and type(code) is int and 0 < code <= 2100000000, 'Invalid package or versionCode')
    old_name = previous['versionName'] if previous else POLICY['legacyVersionName']
    old_code = previous['versionCode'] if previous else POLICY['legacyVersionCode']
    require(current >= version(old_name) and code >= old_code, 'Version rollback')
    matching = [r for r in releases if r['tag_name'] == 'v' + name]
    if current == version(old_name):
        require(code == old_code, 'Same versionName has a different versionCode')
        require(len(matching) == 1 and not matching[0]['draft'] and not matching[0]['prerelease'] and any(t['name'] == 'v' + name for t in tags), 'Published version must have exactly one stable Release and its tag')
        require(not any(re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', t['name']) and version(t['name'][1:]) > current for t in tags), 'Unresolved future tag')
        return 'skip'
    require(code > old_code, 'versionCode must increase')
    validate_version(app, 'v' + name, releases, tags, {'v' + old_name: previous} if previous else {})
    return 'release'


def make_plan(tag=None, sha=None):
    sha = sha or os.environ.get('GITHUB_SHA')
    push_context(sha)
    require(command(['git', 'rev-parse', 'HEAD'], cwd=ROOT).strip() == sha, 'Checkout differs from triggering SHA')
    app = json.loads((ROOT / 'app.json').read_text())['expo']
    require(json.loads((ROOT / 'package.json').read_text())['version'] == app['version'], 'package.json/app.json version mismatch')
    require(tag is None or tag == 'v' + app['version'], 'Plan/app version mismatch')
    base = dict(tag='v' + app['version'], commit=sha, versionName=app['version'], versionCode=app['android']['versionCode'])
    if os.environ.get('MEMOEZ_RELEASE_ENABLED') != 'true':
        return dict(base, action='skip', reason='release disabled; initial owner setup pending')
    releases, tags = pages('releases'), pages('tags')
    previous = latest_metadata(releases)
    action = decide(app, releases, tags, previous)
    if action == 'skip':
        return dict(base, action='skip', reason='version already published')
    cert = fingerprint(os.environ.get('MEMOEZ_RELEASE_CERT_SHA256', ''))
    check_remote_approval(sha)
    title, notes = release_notes((ROOT / 'docs/release-note.md').read_text(), base['tag'])
    return dict(base, action='release', applicationId=POLICY['applicationId'], certificateSha256=cert, title=title, notes=notes, previous=previous)


def verify_history(plan):
    meta = plan['previous']
    if meta is None:
        return
    require(re.fullmatch(r'[0-9a-f]{40}', meta['commit']), 'Invalid previous commit metadata')
    previous_plan = dict(tag='v' + meta['versionName'], applicationId=POLICY['applicationId'], versionName=meta['versionName'], versionCode=meta['versionCode'], commit=meta['commit'], certificateSha256=plan['certificateSha256'])
    with tempfile.TemporaryDirectory() as tmp:
        command(['gh', 'release', 'download', previous_plan['tag'], '--repo', REPO, '--dir', tmp])
        verify_bundle(Path(tmp), previous_plan)


def tool(name):
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    require(sdk, 'ANDROID_HOME is required')
    path = Path(sdk) / 'build-tools/35.0.0' / name
    require(path.is_file(), f'Android Build-Tools 35.0.0 {name} required')
    return str(path)


def verify_apk(apk, plan):
    cert = command([tool('apksigner'), 'verify', '--verbose', '--print-certs', str(apk)])
    hashes = re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\w+)$', cert, re.M)
    require(len(hashes) == 1 and fingerprint(hashes[0]) == plan['certificateSha256'], 'Unexpected signing certificate or multiple signers')
    require('CN=Android Debug' not in cert, 'Android debug signing certificate refused')
    badging = command([tool('aapt2'), 'dump', 'badging', str(apk)])
    package = re.search(r"^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'", badging, re.M)
    require(package and package.groups() == (plan['applicationId'], str(plan['versionCode']), plan['versionName']), 'APK package/version mismatch')
    require('application-debuggable' not in badging, 'Debuggable APK refused')
    return digest(apk)


def sign(apk, plan, out):
    names = ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']
    missing = [name for name in names if not os.environ.get(name)]
    require(not missing, 'Missing release signing secrets: ' + ', '.join(missing))
    require(plan['certificateSha256'] == fingerprint(os.environ.get('MEMOEZ_RELEASE_CERT_SHA256', '')), 'Certificate binding mismatch')
    require(not out.exists(), 'Output directory must not exist; never reuse a previous signed result')
    out.mkdir(parents=True, mode=0o700)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            key = Path(tmp) / 'release.jks'
            # New file opened with mode 600 before any key material is written.
            with os.fdopen(os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as f:
                f.write(base64.b64decode(os.environ[names[0]], validate=True))
            aligned = Path(tmp) / 'aligned.apk'
            command([tool('zipalign'), '-p', '-f', '4', str(apk), str(aligned)])
            output = out / f'memoez-{plan["tag"]}.apk'
            command([tool('apksigner'), 'sign', '--v4-signing-enabled', 'false', '--ks', str(key), '--ks-key-alias', os.environ['ANDROID_KEY_ALIAS'], '--ks-pass', 'env:ANDROID_KEYSTORE_PASSWORD', '--key-pass', 'env:ANDROID_KEY_PASSWORD', '--out', str(output), str(aligned)])
            sha = verify_apk(output, plan)
        (out / (output.name + '.sha256')).write_text(f'{sha}  {output.name}\n')
        metadata = {k: plan[k] for k in ['applicationId', 'versionName', 'versionCode', 'commit', 'certificateSha256']}
        metadata.update(schemaVersion=1, apkSha256=sha, apkAsset=output.name)
        (out / f'memoez-{plan["tag"]}.json').write_text(json.dumps(metadata, indent=2) + '\n')
        verify_bundle(out, plan)
    except Exception:
        # Remove partial APKs/metadata, never upload a failed signing result.
        for p in out.iterdir():
            p.unlink()
        out.rmdir()
        raise


def verify_bundle(directory, plan):
    stem = 'memoez-' + plan['tag']
    require({p.name for p in directory.iterdir()} == {stem + '.apk', stem + '.apk.sha256', stem + '.json'}, 'Unexpected or missing release assets')
    sha = verify_apk(directory / (stem + '.apk'), plan)
    require((directory / (stem + '.apk.sha256')).read_text() == f'{sha}  {stem}.apk\n', 'Checksum mismatch')
    meta = json.loads((directory / (stem + '.json')).read_text())
    require(meta == dict(schemaVersion=1, apkSha256=sha, apkAsset=stem + '.apk', **{k: plan[k] for k in ['applicationId', 'versionName', 'versionCode', 'commit', 'certificateSha256']}), 'Release metadata mismatch')
    return sha


def verify_uploaded_assets(assets, directory):
    expected = {p.name: p for p in directory.iterdir()}
    require(len(assets) == len(expected) and {a['name'] for a in assets} == set(expected), 'Remote assets changed')
    for asset in assets:
        path = expected[asset['name']]
        require(asset['state'] == 'uploaded' and asset['size'] == path.stat().st_size and asset.get('digest') == 'sha256:' + digest(path), 'Remote asset size/digest mismatch')


def publish(directory, plan):
    # Recheck remote state immediately before creating anything. No write on a failed gate.
    require(plan.get('action') == 'release' and make_plan(plan['tag'], plan['commit']) == plan, 'Release approval/state changed')
    verify_history(plan)
    sha = verify_bundle(directory, plan)
    api('git/refs', 'POST', {'ref': 'refs/tags/' + plan['tag'], 'sha': plan['commit']})
    created = api('releases', 'POST', {'tag_name': plan['tag'], 'target_commitish': plan['commit'], 'name': plan['title'], 'body': plan['notes'], 'draft': True, 'prerelease': False})
    require(created['draft'] and not created['prerelease'], 'Unexpected staging release state')
    # No --clobber: duplicate assets and interrupted runs fail closed.
    command(['gh', 'release', 'upload', plan['tag'], *map(str, sorted(directory.iterdir())), '--repo', REPO])
    with tempfile.TemporaryDirectory() as tmp:
        command(['gh', 'release', 'download', plan['tag'], '--repo', REPO, '--dir', tmp])
        require(verify_bundle(Path(tmp), plan) == sha, 'Uploaded artifact changed')
    current = api(f'releases/{created["id"]}')
    require(current['draft'] and not current['prerelease'] and current['tag_name'] == plan['tag'] and current['target_commitish'] == plan['commit'], 'Staging release state changed')
    verify_uploaded_assets(current['assets'], directory)
    check_remote_approval(plan['commit'])
    require(api('git/ref/tags/' + plan['tag'])['object']['sha'] == plan['commit'], 'Tag moved before publication')
    published = api(f'releases/{created["id"]}', 'PATCH', {'draft': False, 'make_latest': 'true'})
    require(not published['draft'] and not published['prerelease'], 'Publication not confirmed')
    print(published['html_url'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('plan')
    p.add_argument('--out', type=Path, required=True)
    p = sub.add_parser('verify-history')
    p.add_argument('--plan', type=Path, required=True)
    for name in ['sign', 'verify', 'publish']:
        p = sub.add_parser(name)
        p.add_argument('--plan', type=Path, required=True)
        if name == 'sign':
            p.add_argument('--apk', type=Path, required=True)
            p.add_argument('--out', type=Path, required=True)
        else:
            p.add_argument('--directory', type=Path, required=True)
    args = parser.parse_args()
    if args.cmd == 'plan':
        plan = make_plan()
        args.out.write_text(json.dumps(plan, indent=2) + '\n')
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
                output.write('action=' + plan['action'] + '\n')
        summary = f"## {plan['action']}\n{plan.get('reason', 'New release candidate; verification and publication still pending')}\nVersion: {plan['versionName']} / {plan['versionCode']}\nCommit: {plan['commit']}\n"
        print(summary)
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
                output.write(summary)
    else:
        plan = json.loads(args.plan.read_text())
        require(plan['tag'] == 'v' + plan['versionName'], 'Invalid plan tag')
        version(plan['versionName'])
        require(plan['applicationId'] == POLICY['applicationId'], 'Invalid plan application ID')
        require(plan['certificateSha256'] == fingerprint(os.environ.get('MEMOEZ_RELEASE_CERT_SHA256', '')), 'Expected certificate must match the plan')
        if args.cmd == 'verify-history':
            verify_history(plan)
        elif args.cmd == 'sign':
            sign(args.apk, plan, args.out)
        elif args.cmd == 'verify':
            print('Verified APK SHA-256: ' + verify_bundle(args.directory, plan))
        else:
            publish(args.directory, plan)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Only our controlled validation messages are printed, never third-party exception inputs.
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
                output.write('## failed\nRelease guard refused this operation; inspect the failed step.\n')
        print('Release refused: ' + (str(error) if type(error) is ValueError else type(error).__name__), file=sys.stderr)
        sys.exit(1)
