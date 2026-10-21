"""Four-role deliverables for the Entra claim-meanings and value-matching revision."""
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
claims_baseline = out / 'claims-baseline.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
env = os.environ.copy()
env['NO_PROXY'] = '127.0.0.1,localhost'
env.pop('FORCE_COLOR', None)

if not claims_baseline.exists():
    shutil.copyfile(out / 'MODIFIED_FILE.zip', claims_baseline)
backup = out / 'before-claims-VERIFICATION.txt'
if not backup.exists():
    shutil.copyfile(report, backup)
old_report = backup.read_text(encoding='utf-8')
records = [old_report, '\n=== ENTRA CLAIM MEANINGS AND VALUE MATCHING REVISION ===',
           'TARGET: ' + str(app),
           'Change: providers.ts explains every claim in the official Entra access-token claims reference and adds hint() value matching; core.ts appends provider hints to payload field descriptions; header adds x5t/x5c.',
           'Value matching covers amr method codes, appidacr/azpacr client-auth codes, acr, ver, v1/v2 issuer format, consumer tenant GUID, scp/roles/wids/groups counts, xms_cc cp1, groups overage pointers and aud shape.',
           'Source of truth: learn.microsoft.com Entra access-token claims reference. GraphPreConsentExplorer.html contains no claim reference (application/permission browser) and was not used as a claim source.',
           'Behavior change is display-only; decoding, signature verification and network behavior are unchanged.',
           'Tests: new tests/providers.test.ts; total unit count 70 -> 77.',
           'Same synthetic fixture bytes/public key reused for BASELINE, MODIFIED and ROLLBACK probes; payload-field explanation text is compared between revisions.',
           'Tool environment: rtk unavailable (exit 1), native commands used; prior records retained above.']

for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'ROLLBACK.sh']:
    backup_file = out / ('before-claims-' + name)
    if not backup_file.exists():
        shutil.copyfile(out / name, backup_file)

def run(label, args, cwd=root):
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True)
    stdout = result.stdout.decode('utf-8', errors='replace')
    stderr = result.stderr.decode('utf-8', errors='replace')
    records.extend(['\n[' + label + ']', 'CWD: ' + str(cwd), 'COMMAND: ' + json.dumps(args),
                    'STDOUT:\n' + stdout, 'STDERR:\n' + stderr, 'EXIT: ' + str(result.returncode)])
    report.write_text('\n'.join(records), encoding='utf-8')
    print(label, 'exit=', result.returncode, '\n', stdout, stderr, flush=True)
    assert result.returncode == 0, label
    return stdout

def extract(archive, dest):
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            assert (dest / name).resolve().is_relative_to(dest.resolve())
        z.extractall(dest)

def payload_fields(output):
    return json.loads(output.splitlines()[0])['payloadFields']

node = shutil.which('node')
npm = shutil.which('npm.cmd') or shutil.which('npm')
git = shutil.which('git')
for label, command in [('UNIT', [npm, 'test']), ('BUILD_AND_TYPES', [npm, 'run', 'build']),
                       ('BROWSER', [node, 'node_modules/@playwright/test/cli.js', 'test'])]:
    run(label, command, app)

changed = []
with zipfile.ZipFile(claims_baseline) as z:
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
expected_changes = {'token-inspector/src/providers.ts', 'token-inspector/src/core.ts', 'token-inspector/README.md'}
assert set(changed) == expected_changes, changed
assert (app / 'tests/providers.test.ts').is_file()
records.append('CHANGED vs claims baseline: ' + ', '.join(changed) + '; new file token-inspector/tests/providers.test.ts')

base_dir = out / 'claims-baseline'
extract(claims_baseline, base_dir)
probe = [node, str(root / '.artifacts/claims-probe.mjs')]
before = run('BASELINE', probe + [str(base_dir / 'token-inspector/dist')])
after = run('MODIFIED', probe + [str(app / 'dist')])
assert 'Signature Verified' in json.loads(before.splitlines()[0])['signature']
assert 'Signature Verified' in json.loads(after.splitlines()[0])['signature']
assert 'Invalid Signature' in json.loads(after.splitlines()[1])['signature']
assert '取值匹配' not in payload_fields(before) and '两两成对' not in payload_fields(before)
assert '取值匹配' in payload_fields(after) and '两两成对' in payload_fields(after)

modified = out / 'MODIFIED_FILE.zip'
with zipfile.ZipFile(modified, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(root / '.gitignore', '.gitignore')
    for path in sorted(app.rglob('*')):
        if path.is_file() and not any(part in {'node_modules', '.npm-cache', 'test-results', 'playwright-report'} for part in path.relative_to(app).parts):
            z.write(path, path.relative_to(root).as_posix())
baseline_sha = sha(claims_baseline.read_bytes())
modified_sha = sha(modified.read_bytes())
for dirname, source in [('claims-before', claims_baseline), ('claims-after', modified)]:
    folder = out / dirname
    folder.mkdir(exist_ok=True)
    shutil.copyfile(source, folder / 'snapshot.zip')
diff = subprocess.run([git, 'diff', '--no-index', '--binary', '--', 'claims-before/snapshot.zip', 'claims-after/snapshot.zip'], cwd=out, capture_output=True)
assert diff.returncode == 1
patch = diff.stdout.replace(b'a/claims-before/snapshot.zip', b'a/snapshot.zip').replace(b'b/claims-after/snapshot.zip', b'b/snapshot.zip')
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
print('RESTORED claims baseline SHA256=' + hashlib.sha256(p.read_bytes()).hexdigest())
PYTHON
'''.replace('MODIFIED_SHA', modified_sha).replace('BASELINE_SHA', baseline_sha).replace('BASELINE_DATA', base64.b64encode(claims_baseline.read_bytes()).decode())
rollback_path = out / 'ROLLBACK.sh'
rollback_path.write_text(rollback, encoding='utf-8', newline='\n')
rollback_path.chmod(0o755)
restore = out / 'claims-rollback'
restore.mkdir(exist_ok=True)
copy = restore / 'snapshot.zip'
shutil.copyfile(modified, copy)
bash = 'E:/Git/bin/bash.exe' if os.name == 'nt' else shutil.which('sh')
run('EXECUTE ROLLBACK ON COPY', [bash, str(rollback_path), str(copy)])
assert sha(copy.read_bytes()) == baseline_sha
extract(copy, restore / 'restored')
restored = run('ROLLBACK', probe + [str(restore / 'restored/token-inspector/dist')])
assert before == restored
run('REAPPLY PATCH', [git, 'apply', '--binary', '--directory=.artifacts/token-inspector/claims-rollback', str(out / 'DIFF_FILE.patch')])
assert sha(copy.read_bytes()) == modified_sha
records.extend(['BASELINE_SHA256=' + baseline_sha, 'MODIFIED_SHA256=' + modified_sha,
                'Restored baseline hash and observed behavior match exactly. Reapplied patch reproduces modified archive exactly.',
                'Working source remains on the claim-meanings revision; all rollback operations affected only the archive copy.'])
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
