"""Create source snapshots and verify a reversible archive transaction.

No real token or user claim data is stored here. Rollback affects an archive copy,
not the working project. Requires Python, Node, npm, Git, and a POSIX shell.
"""
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

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'token-inspector'
OUT = ROOT / '.artifacts' / 'token-inspector'
OUT.mkdir(parents=True, exist_ok=True)
REPORT = OUT / 'VERIFICATION.txt'
ORIGINAL_SHA = '114f3cdc2057d610cbc810f69cbc4f195acec0cd15dd54e9b154cf5f6657fc24'
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha((ROOT / '.gitignore').read_bytes()) == ORIGINAL_SHA
env = os.environ.copy()
env['NO_PROXY'] = '127.0.0.1,localhost'
env['NO_COLOR'] = '1'
env.pop('FORCE_COLOR', None)
records = [
    'TARGET: ' + str(APP),
    'Change: NEW standalone localhost application; inspectToken() JWT/JWE/Opaque/Invalid branches.',
    'Original repository contained .gitignore and .git, no runnable source. Existing .gitignore unchanged.',
    'Before creation: Test-Path token-inspector => False; .gitignore SHA256=' + ORIGINAL_SHA,
    'Four-role transaction uses source ZIP snapshots; rollback is executed on a separate archive copy only.',
    'The empty-project baseline is reconstructed from the unchanged original .gitignore; it is not an earlier runnable application.',
    'Initial environment issues: rtk absent (exit 1); npm offline registry lookups ENOTCACHED (exit 1).',
    "npm 10.8.2 and isolated npm 10.9.4 install error: Cannot read properties of null (reading 'edgesOut') (exit 1).",
    'Correction: npm install --legacy-peer-deps --offline=false --cache .npm-cache --no-audit --no-fund (exit 0); subsequent ordinary npm ci also succeeded.',
    'Sandbox Vite startup error: spawn EPERM (exit 1); correction: approved execution outside sandbox.',
    'First unit run: 34 passed / 1 failed: rejects invalid input "Bearer "; expected error, received opaque.',
    'Correction: remove bare Bearer as well as Bearer followed by whitespace. Final exact outputs follow.',
    'First browser run: Timed out waiting 60000ms from config.webServer. (exit 1). Correction: NO_PROXY for loopback.',
    'First evidence run: UnicodeEncodeError in Windows GBK stdout on build checkmark (exit 1); corrected runner stdout to UTF-8.',
    'First rollback run: WindowsApps python3 alias exited 49 without output; corrected interpreter detection to execute a Python 3 probe before selection.',
    'First patch-reapply check: git apply from repository subdirectory returned 0 but skipped root-relative snapshot.zip; archive hash assertion caught mismatch. Corrected explicit --directory from repository root.',
    'Review: fixed bare Bearer input; exact hostname matching avoids issuer suffix spoofing; textContent avoids HTML execution; unknown/prototype field names use own-property lookup; stale output cleared on edit.',
    'Review: claims never determine trust; no network fetch, storage, token logging, clipboard access, or refresh flow in application.',
    'Visual review: desktop and 390px mobile synthetic-only screenshots inspected; no horizontal page overflow.',
]

def run(label, args, cwd=APP, required=True):
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True)
    stdout = result.stdout.decode('utf-8', errors='replace')
    stderr = result.stderr.decode('utf-8', errors='replace')
    records.extend([f'\n[{label}]', 'CWD: ' + str(cwd), 'COMMAND: ' + json.dumps(args),
                    'INPUT: synthetic fixtures only / no real credential',
                    'STDOUT:\n' + stdout, 'STDERR:\n' + stderr, 'EXIT: ' + str(result.returncode)])
    REPORT.write_text('\n'.join(records), encoding='utf-8')
    print(f'{label}: exit={result.returncode}\n{stdout}\n{stderr}', flush=True)
    if required and result.returncode:
        raise RuntimeError(f'{label} failed; exact stdout/stderr retained in {REPORT}')
    return result

npm = shutil.which('npm.cmd') or shutil.which('npm')
node = shutil.which('node')
git = shutil.which('git')
if '--reuse-tests' in sys.argv:
    previous = REPORT.read_text(encoding='utf-8')
    records.append(previous[previous.index('\n[UNIT]'):previous.index('\n[BASELINE]')])
else:
    for label, command in [('UNIT', [npm, 'test']), ('TYPECHECK', [npm, 'run', 'typecheck']),
                           ('BUILD', [npm, 'run', 'build']),
                           ('BROWSER', [node, 'node_modules/@playwright/test/cli.js', 'test'])]:
        run(label, command)

ignored = {'node_modules', '.npm-cache', 'dist', 'test-results', 'playwright-report'}
files = {'.gitignore': (ROOT / '.gitignore').read_bytes()}
for path in sorted(APP.rglob('*')):
    relative = path.relative_to(APP)
    if path.is_file() and not any(part in ignored for part in relative.parts):
        files['token-inspector/' + relative.as_posix()] = path.read_bytes()

def archive(path, entries):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, data)

before = OUT / 'baseline'
after = OUT / 'modified'
before.mkdir(exist_ok=True)
after.mkdir(exist_ok=True)
archive(before / 'snapshot.zip', {'.gitignore': files['.gitignore']})
archive(after / 'snapshot.zip', files)
modified = OUT / 'MODIFIED_FILE.zip'
modified.write_bytes((after / 'snapshot.zip').read_bytes())
baseline_bytes = (before / 'snapshot.zip').read_bytes()
baseline_sha = sha(baseline_bytes)
modified_sha = sha(modified.read_bytes())
diff = subprocess.run([git, 'diff', '--no-index', '--binary', '--', 'baseline/snapshot.zip', 'modified/snapshot.zip'], cwd=OUT, capture_output=True)
assert diff.returncode == 1, diff.stderr
patch = diff.stdout.replace(b'a/baseline/snapshot.zip', b'a/snapshot.zip').replace(b'b/modified/snapshot.zip', b'b/snapshot.zip')
(OUT / 'DIFF_FILE.patch').write_bytes(patch)

rollback = '''#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: ROLLBACK.sh /absolute/path/to/snapshot-copy.zip" >&2; exit 2; fi
if python3 -c 'import sys; assert sys.version_info.major == 3' >/dev/null 2>&1; then PY=python3
elif python -c 'import sys; assert sys.version_info.major == 3' >/dev/null 2>&1; then PY=python
else echo "Python 3 is required" >&2; exit 2; fi
"$PY" - "$1" <<'PYTHON'
from pathlib import Path
import base64, hashlib, os, sys
target = Path(sys.argv[1]).resolve(strict=True)
if not target.is_file(): raise SystemExit('Target must be an archive file copy')
if hashlib.sha256(target.read_bytes()).hexdigest() != 'MODIFIED_SHA':
    raise SystemExit('Refusing to overwrite an unknown or edited archive')
original = base64.b64decode('BASELINE_DATA')
assert hashlib.sha256(original).hexdigest() == 'BASELINE_SHA'
# Exclusive temporary creation avoids overwriting any adjacent user file.
temp = target.with_name(target.name + '.rollback-tmp')
with temp.open('xb') as stream: stream.write(original)
os.replace(temp, target)
print('RESTORED baseline archive SHA256=' + hashlib.sha256(target.read_bytes()).hexdigest())
PYTHON
'''.replace('MODIFIED_SHA', modified_sha).replace('BASELINE_SHA', baseline_sha).replace('BASELINE_DATA', base64.b64encode(baseline_bytes).decode())
rollback_path = OUT / 'ROLLBACK.sh'
rollback_path.write_text(rollback, encoding='utf-8', newline='\n')
rollback_path.chmod(0o755)

probe = "import zipfile; z=zipfile.ZipFile('snapshot.zip'); print('project=' + ('present' if 'token-inspector/src/core.ts' in z.namelist() else 'absent')); print('existing_gitignore_sha256=' + __import__('hashlib').sha256(z.read('.gitignore')).hexdigest())"
python = shutil.which('python') or shutil.which('python3')
run('BASELINE', [python, '-c', probe], before)
run('MODIFIED', [python, '-c', probe], after)
restore = OUT / 'rollback-check'
restore.mkdir(exist_ok=True)
(restore / 'snapshot.zip').write_bytes(modified.read_bytes())
bash = 'E:/Git/bin/bash.exe' if os.name == 'nt' else shutil.which('sh')
run('EXECUTE ROLLBACK', [bash, str(rollback_path), str(restore / 'snapshot.zip')], OUT)
run('ROLLBACK', [python, '-c', probe], restore)
assert sha((restore / 'snapshot.zip').read_bytes()) == baseline_sha
run('REAPPLY DIFF', [git, 'apply', '--binary', '--directory=.artifacts/token-inspector/rollback-check', str(OUT / 'DIFF_FILE.patch')], ROOT)
assert sha((restore / 'snapshot.zip').read_bytes()) == modified_sha
run('REAPPLIED', [python, '-c', probe], restore)
assert sha((ROOT / '.gitignore').read_bytes()) == ORIGINAL_SHA

records.append('\nSOURCE SHA256 MANIFEST:')
records.extend(name + ' ' + sha(data) for name, data in sorted(files.items()))
records.extend(['BASELINE_ZIP_SHA256=' + baseline_sha, 'MODIFIED_ZIP_SHA256=' + modified_sha,
                'Rollback hash equals baseline; binary patch recreates exact modified ZIP; working project retained unchanged.'])
sample = OUT / 'sample-result.txt'
if sample.exists(): records.append('\nUSER SAMPLE (redacted output only):\n' + sample.read_text(encoding='utf-8'))
for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'ROLLBACK.sh']:
    path = OUT / name
    data = path.read_bytes()
    records.append(f'REOPENED {path} bytes={len(data)} SHA256={sha(data)}')
with zipfile.ZipFile(modified) as z: assert z.testzip() is None
REPORT.write_text('\n'.join(records), encoding='utf-8')
for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'VERIFICATION.txt', 'ROLLBACK.sh']:
    path = OUT / name
    data = path.read_bytes()
    print(f'REOPENED {path} bytes={len(data)} SHA256={sha(data)}')
