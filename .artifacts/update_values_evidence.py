"""Four-role deliverables for the permission/client/audience value-matching revision."""
from pathlib import Path
import base64
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parent.parent
app = root / 'token-inspector'
out = root / '.artifacts/token-inspector'
report = out / 'VERIFICATION.txt'
values_baseline = out / 'values-baseline.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
env = os.environ.copy()
env['NO_PROXY'] = '127.0.0.1,localhost'
env.pop('FORCE_COLOR', None)

if not values_baseline.exists():
    shutil.copyfile(out / 'MODIFIED_FILE.zip', values_baseline)
backup = out / 'before-values-VERIFICATION.txt'
if not backup.exists():
    shutil.copyfile(report, backup)
old_report = backup.read_text(encoding='utf-8')
records = [old_report, '\n=== PERMISSION / CLIENT / AUDIENCE VALUE MATCHING REVISION ===',
           'TARGET: ' + str(app),
           'Change: new src/permissions.ts knowledge table (top GraphPreConsentExplorer frequency values + Microsoft Graph permission reference); main.ts renders scp/roles as value chips with critical scopes highlighted red, matches azp/appid first-party client names (FOCI/BroCi clients red with redemption-reason tooltip) and aud API names; style.css adds .perm-chip/.perm-critical/.value-match styles.',
           'Data source: GraphPreConsentExplorer.yaml (1664 apps / 342 unique permission values) for client IDs, name/foci/broci/notes and permission frequency; critical flag = tenant-wide/admin-consent/privilege-escalation scopes plus prefix rules (Directory.Read*, Policy.ReadWrite*, RoleManagement.ReadWrite*, Privileged*, ...) plus every FOCI or BroCi first-party client (clientApp() derivation).',
           'Matching is a static display-only knowledge table; decoding, signature verification and network behavior are unchanged.',
           'Tests: new tests/permissions.test.ts and tests/browser/values.spec.ts; unit count 77 -> 82, browser count 8 -> 10.',
           'Same synthetic RS256 key/token generated inside values-probe.mjs for BASELINE, MODIFIED and ROLLBACK probes; probe reads chip/match DOM state, baseline is the claims-revision build.',
           'Tool environment: rtk unavailable (exit 1), native commands used; prior records retained above.']

for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'ROLLBACK.sh']:
    backup_file = out / ('before-values-' + name)
    if not backup_file.exists():
        shutil.copyfile(out / name, backup_file)

def run(label, args, cwd=root):
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True)
    stdout = result.stdout.decode('utf-8', errors='replace')
    stderr = result.stderr.decode('utf-8', errors='replace')
    records.extend(['\n[' + label + ']', 'CWD: ' + str(cwd), 'COMMAND: ' + json.dumps(args),
                    'STDOUT:\n' + stdout, 'STDERR:\n' + stderr, 'EXIT: ' + str(result.returncode)])
    report.write_text('\n'.join(records), encoding='utf-8')
    print(label, 'exit=', result.returncode, flush=True)
    assert result.returncode == 0, label
    return stdout

def extract(archive, dest):
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            assert (dest / name).resolve().is_relative_to(dest.resolve())
        z.extractall(dest)

node = shutil.which('node')
npm = shutil.which('npm.cmd') or shutil.which('npm')
git = shutil.which('git')
for label, command in [('UNIT', [npm, 'test']), ('BUILD_AND_TYPES', [npm, 'run', 'build']),
                       ('BROWSER', [node, 'node_modules/@playwright/test/cli.js', 'test'])]:
    run(label, command, app)

changed = []
with zipfile.ZipFile(values_baseline) as z:
    assert z.read('.gitignore') == (root / '.gitignore').read_bytes()
    for name in z.namelist():
        if not name.startswith('token-inspector/'):
            continue
        relative = Path(name).relative_to('token-inspector')
        if any(part in {'node_modules', '.npm-cache', 'dist', 'test-results', 'playwright-report'} for part in relative.parts):
            continue
        current = app / relative
        if not current.exists() or z.read(name) != current.read_bytes():
            changed.append(name)
expected_changes = {'token-inspector/src/main.ts', 'token-inspector/src/style.css', 'token-inspector/README.md'}
assert set(changed) == expected_changes, changed
new_files = ['token-inspector/src/permissions.ts', 'token-inspector/tests/permissions.test.ts',
             'token-inspector/tests/browser/values.spec.ts']
for name in new_files:
    assert (app / Path(name).relative_to('token-inspector')).is_file(), name
records.append('CHANGED vs values baseline: ' + ', '.join(changed) + '; new files: ' + ', '.join(new_files))

base_dir = out / 'values-baseline'
extract(values_baseline, base_dir)
probe = [node, str(root / '.artifacts/values-probe.mjs')]
before = run('BASELINE', probe + [str(base_dir / 'token-inspector/dist')])
after = run('MODIFIED', probe + [str(app / 'dist')])
b0, a0 = json.loads(before.splitlines()[0]), json.loads(after.splitlines()[0])
assert b0['signature'] == a0['signature'] and 'Signature Verified' in a0['signature'], (b0['signature'], a0['signature'])
assert b0['chips'] == [] and b0['valueMatches'] == [] and b0['critical'] == [], b0
assert len(a0['chips']) == 5, a0['chips']
assert a0['critical'] == ['Directory.Read.All', 'RoleManagement.ReadWrite.Directory'], a0['critical']
assert '值匹配：User.Read=' not in b0['payloadFields']
assert '值匹配：User.Read=' in a0['payloadFields'] and '共 3 项委托权限' in a0['payloadFields']
assert any('Microsoft Azure CLI' in match for match in a0['valueMatches']), a0['valueMatches']
assert any('Microsoft Graph' in match for match in a0['valueMatches']), a0['valueMatches']
assert any('ADIbizaUX' in match for match in a0['valueMatches']), a0['valueMatches']
assert json.loads(before.splitlines()[1]) == json.loads(after.splitlines()[1])
records.append('BASELINE has no chips/matches; MODIFIED has 5 chips, 2 critical, client and audience matches: ' + ', '.join(a0['valueMatches']))

modified = out / 'MODIFIED_FILE.zip'
with zipfile.ZipFile(modified, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(root / '.gitignore', '.gitignore')
    for path in sorted(app.rglob('*')):
        if path.is_file() and not any(part in {'node_modules', '.npm-cache', 'test-results', 'playwright-report'} for part in path.relative_to(app).parts):
            z.write(path, path.relative_to(root).as_posix())
baseline_sha = sha(values_baseline.read_bytes())
modified_sha = sha(modified.read_bytes())
for dirname, source in [('values-before', values_baseline), ('values-after', modified)]:
    folder = out / dirname
    folder.mkdir(exist_ok=True)
    shutil.copyfile(source, folder / 'snapshot.zip')
diff = subprocess.run([git, 'diff', '--no-index', '--binary', '--', 'values-before/snapshot.zip', 'values-after/snapshot.zip'], cwd=out, capture_output=True)
assert diff.returncode == 1
patch = diff.stdout.replace(b'a/values-before/snapshot.zip', b'a/snapshot.zip').replace(b'b/values-after/snapshot.zip', b'b/snapshot.zip')
(out / 'DIFF_FILE.patch').write_bytes(patch)

rollback = '''#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: ROLLBACK.sh /path/to/snapshot-copy.zip" >&2; exit 2; fi
if python3 -c 'import sys; assert sys.version_info.major == 3' >/dev/null 2>&1; then PY=python3
elif python -c 'import sys; assert sys.version_info.major == 3' >/dev/null 2>&1; then PY=python
else echo "Python 3 required" >&2; exit 2; fi
"$PY" - "$1" <<'PYTHON'
from pathlib import Path
import base64, hashlib, os, sys
p = Path(sys.argv[1]).resolve(strict=True)
if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest() != 'MODIFIED_SHA':
    raise SystemExit('Refusing to overwrite an unknown or edited archive')
data = base64.b64decode('BASELINE_DATA')
assert hashlib.sha256(data).hexdigest() == 'BASELINE_SHA'
temp = p.with_name(p.name + '.rollback-tmp')
with temp.open('xb') as f: f.write(data)
os.replace(temp, p)
print('RESTORED values baseline SHA256=' + hashlib.sha256(p.read_bytes()).hexdigest())
PYTHON
'''.replace('MODIFIED_SHA', modified_sha).replace('BASELINE_SHA', baseline_sha).replace('BASELINE_DATA', base64.b64encode(values_baseline.read_bytes()).decode())
rollback_path = out / 'ROLLBACK.sh'
rollback_path.write_text(rollback, encoding='utf-8', newline='\n')
rollback_path.chmod(0o755)
restore = out / 'values-rollback'
restore.mkdir(exist_ok=True)
copy = restore / 'snapshot.zip'
shutil.copyfile(modified, copy)
bash = 'E:/Git/bin/bash.exe' if os.name == 'nt' else shutil.which('sh')
run('EXECUTE ROLLBACK ON COPY', [bash, str(rollback_path), str(copy)])
assert sha(copy.read_bytes()) == baseline_sha
extract(copy, restore / 'restored')
restored = run('ROLLBACK', probe + [str(restore / 'restored/token-inspector/dist')])
assert before == restored
run('REAPPLY PATCH', [git, 'apply', '--binary', '--directory=.artifacts/token-inspector/values-rollback', str(out / 'DIFF_FILE.patch')])
assert sha(copy.read_bytes()) == modified_sha
records.extend(['BASELINE_SHA256=' + baseline_sha, 'MODIFIED_SHA256=' + modified_sha,
                'Restored baseline hash and observed behavior match exactly. Reapplied patch reproduces modified archive exactly.',
                'Working source remains on the value-matching revision; all rollback operations affected only the archive copy.'])
with zipfile.ZipFile(modified) as z:
    assert z.testzip() is None
    records.append('SOURCE/BUILT FILE HASHES:')
    for name in z.namelist(): records.append(name + ' ' + sha(z.read(name)))
for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'ROLLBACK.sh']:
    p = out / name
    records.append(f'REOPENED {p} SHA256={sha(p.read_bytes())}')
report.write_text('\n'.join(records), encoding='utf-8')
for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'VERIFICATION.txt', 'ROLLBACK.sh']:
    p = out / name
    data = p.read_bytes()
    print(f'REOPENED {p} bytes={len(data)} SHA256={sha(data)}')
