"""Extend the existing four-role deliverables for the jwt.io-style UI revision."""
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
baseline = out / 'ui-baseline.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
env = os.environ.copy()
env['NO_PROXY'] = '127.0.0.1,localhost'
env.pop('FORCE_COLOR', None)
old_report = (out / 'previous-verification.txt').read_text(encoding='utf-8')
records = [old_report, '\n=== JWT.IO-STYLE UI REVISION ===',
           'TARGET: ' + str(app),
           'Changes: input handler now auto-decodes after 150ms; colorToken/showJson/switchView/copy handlers; Encoded/Decoded layout.',
           'Core protocol parsing and provider modules unchanged; no verification or encoding feature added.',
           'Input: synthetic JWT with alg=RS256, sub=synthetic-user, exp=1, synthetic signature AA.',
           'Before modification, baseline probe: status=输入已更新，请解析; decodedWithoutClick=false; coloredSegments=0; cleared=true; exit=0.',
           'Tool correction: apply_patch rejected delete/add on same path before changing those files; replaced exact approved UI files using UTF-8 writes.',
           'Review: DOM text nodes only for highlighting; property-own check for time explanations; cancelled timer and disabled copy on edits/clear.',
           'Review: mirror width follows textarea clientWidth to avoid scrollbar wrapping mismatch; forced-colors fallback retains readable input.',
           'Desktop/mobile screenshots reviewed using synthetic data only. Clipboard tested with an isolated stub; no real credential retained.',
           'Previous sample test belongs to prior revision; user credential was NOT reused or saved for this revision.']

for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'ROLLBACK.sh']:
    backup = out / ('previous-' + name)
    if not backup.exists(): shutil.copyfile(out / name, backup)

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

node = shutil.which('node')
npm = shutil.which('npm.cmd') or shutil.which('npm')
git = shutil.which('git')
for label, command in [('UNIT', [npm, 'test']), ('BUILD_AND_TYPES', [npm, 'run', 'build']),
                       ('BROWSER', [node, 'node_modules/@playwright/test/cli.js', 'test'])]:
    run(label, command, app)

with zipfile.ZipFile(baseline) as z:
    for name in ['src/core.ts', 'src/providers.ts']:
        assert z.read('token-inspector/' + name) == (app / name).read_bytes()
    assert z.read('.gitignore') == (root / '.gitignore').read_bytes()

base_dir = out / 'ui-baseline'
extract(baseline, base_dir)
probe = [node, str(root / '.artifacts/ui-probe.mjs')]
before = run('BASELINE', probe + [str(base_dir / 'token-inspector/dist')])
after = run('MODIFIED', probe + [str(app / 'dist')])
assert json.loads(before.splitlines()[0])['decodedWithoutClick'] is False
assert json.loads(after.splitlines()[0])['decodedWithoutClick'] is True

modified = out / 'MODIFIED_FILE.zip'
with zipfile.ZipFile(modified, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(root / '.gitignore', '.gitignore')
    for path in sorted(app.rglob('*')):
        if path.is_file() and not any(part in {'node_modules', '.npm-cache', 'test-results', 'playwright-report'} for part in path.relative_to(app).parts):
            z.write(path, path.relative_to(root).as_posix())
baseline_sha = sha(baseline.read_bytes())
modified_sha = sha(modified.read_bytes())
for dirname, source in [('ui-before', baseline), ('ui-after', modified)]:
    folder = out / dirname
    folder.mkdir(exist_ok=True)
    shutil.copyfile(source, folder / 'snapshot.zip')
diff = subprocess.run([git, 'diff', '--no-index', '--binary', '--', 'ui-before/snapshot.zip', 'ui-after/snapshot.zip'], cwd=out, capture_output=True)
assert diff.returncode == 1
patch = diff.stdout.replace(b'a/ui-before/snapshot.zip', b'a/snapshot.zip').replace(b'b/ui-after/snapshot.zip', b'b/snapshot.zip')
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
print('RESTORED UI baseline SHA256=' + hashlib.sha256(p.read_bytes()).hexdigest())
PYTHON
'''.replace('MODIFIED_SHA', modified_sha).replace('BASELINE_SHA', baseline_sha).replace('BASELINE_DATA', base64.b64encode(baseline.read_bytes()).decode())
rollback_path = out / 'ROLLBACK.sh'
rollback_path.write_text(rollback, encoding='utf-8', newline='\n')
rollback_path.chmod(0o755)
restore = out / 'ui-rollback'
restore.mkdir(exist_ok=True)
copy = restore / 'snapshot.zip'
shutil.copyfile(modified, copy)
bash = 'E:/Git/bin/bash.exe' if os.name == 'nt' else shutil.which('sh')
run('EXECUTE ROLLBACK ON COPY', [bash, str(rollback_path), str(copy)])
assert sha(copy.read_bytes()) == baseline_sha
extract(copy, restore / 'restored')
restored = run('ROLLBACK', probe + [str(restore / 'restored/token-inspector/dist')])
assert before == restored
run('REAPPLY PATCH', [git, 'apply', '--binary', '--directory=.artifacts/token-inspector/ui-rollback', str(out / 'DIFF_FILE.patch')])
assert sha(copy.read_bytes()) == modified_sha
records.extend(['BASELINE_SHA256=' + baseline_sha, 'MODIFIED_SHA256=' + modified_sha,
                'Restored baseline hash and observed behavior match exactly. Reapplied patch reproduces modified archive exactly.',
                'Working source remains on new UI; all rollback operations affected only the archive copy.'])
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
