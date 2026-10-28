from pathlib import Path
import hashlib, json, os, shutil, subprocess, sys, zipfile

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'token-inspector'
OUT = ROOT / '.artifacts/token-inspector'
STATE = OUT / 'purpose-state.json'
LEDGER = OUT / 'purpose-execution.json'
ROLES = ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'VERIFICATION.txt', 'ROLLBACK.sh']

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def snapshot(path):
    paths = [p for p in APP.rglob('*') if p.is_file() and not any(x in {'node_modules', '.npm-cache', 'dist', 'test-results'} for x in p.relative_to(APP).parts)]
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(paths):
            info = zipfile.ZipInfo('token-inspector/' + p.relative_to(APP).as_posix(), (2026, 10, 22, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, p.read_bytes())

def run(label, command, cwd=ROOT, quiet=False):
    env = dict(os.environ, NO_PROXY='127.0.0.1,localhost', no_proxy='127.0.0.1,localhost', FORCE_COLOR='0')
    p = subprocess.run(command, cwd=cwd, env=env, capture_output=True)
    item = dict(label=label, command=list(map(str, command)), cwd=str(cwd), input=globals().get('INPUT_DESCRIPTION', 'synthetic fixtures only; purpose-probe uses identical JWT for all three runs'), stdout=p.stdout.decode('utf-8', errors='replace'), stderr=p.stderr.decode('utf-8', errors='replace'), exit=p.returncode)
    rows = json.loads(LEDGER.read_text('utf-8')) if LEDGER.exists() else []
    rows.append(item)
    LEDGER.write_text(json.dumps(rows, ensure_ascii=False, indent=2), 'utf-8')
    if quiet:
        print(f'{label}: exit={p.returncode}; stdout/stderr recorded in {LEDGER}')
    else:
        print(json.dumps(item, ensure_ascii=False))
    return p

def pack():
    state = json.loads(STATE.read_text('utf-8'))
    modified = OUT / 'MODIFIED_FILE.zip'
    snapshot(modified)
    with zipfile.ZipFile(modified) as z:
        assert z.testzip() is None
        current = {name: hashlib.sha256(z.read(name)).hexdigest() for name in z.namelist()}
    changed = [name for name in sorted(set(current) | set(state['manifest'])) if current.get(name) != state['manifest'].get(name)]
    expected = {
        'README.md', 'index.html', 'src/main.ts', 'src/style.css', 'src/decoder.ts',
        'src/modes/types.ts', 'src/modes/access.ts', 'src/modes/id.ts', 'src/modes/refresh.ts', 'src/modes/index.ts',
        'tests/modes.test.ts', 'tests/browser/purposes.spec.ts', 'tests/browser/page.spec.ts',
    }
    assert set(changed) == {'token-inspector/' + name for name in expected}, changed
    state.update(modified_sha256=sha(modified), changed=changed)
    STATE.write_text(json.dumps(state, indent=2), 'utf-8')
    patch_root = OUT / 'purpose-patch'
    for name, archive in [('before', Path(state['baseline'])), ('after', modified)]:
        folder = patch_root / name
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(archive, folder / 'snapshot.zip')
    p = run('ARCHIVE_DIFF', ['git', 'diff', '--binary', '--no-index', '--', 'before/snapshot.zip', 'after/snapshot.zip'], patch_root, quiet=True)
    assert p.returncode == 1
    (OUT / 'DIFF_FILE.patch').write_bytes(p.stdout)
    # Human-readable supplemental diff; the primary patch reconstructs the exact ZIP bytes.
    for name, archive in [('before-source', Path(state['baseline'])), ('after-source', modified)]:
        folder = patch_root / name
        folder.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as z:
            z.extractall(folder)
    p = run('SOURCE_DIFF', ['git', '-c', 'core.autocrlf=false', 'diff', '--no-index', '--', 'before-source', 'after-source'], patch_root, quiet=True)
    assert p.returncode == 1
    (OUT / 'purpose-source.diff').write_bytes(p.stdout)
    script = '''#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: ROLLBACK.sh /path/to/modified-snapshot-copy.zip" >&2; exit 2; fi
if python3 -c 'import sys; assert sys.version_info.major == 3' >/dev/null 2>&1; then PY=python3
elif python -c 'import sys; assert sys.version_info.major == 3' >/dev/null 2>&1; then PY=python
else echo "Python 3 required" >&2; exit 2; fi
"$PY" - "$1" <<'PYTHON'
from pathlib import Path
import base64, hashlib, os, sys, tempfile
p = Path(sys.argv[1]).resolve(strict=True)
if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest() != 'MODIFIED_HASH':
    raise SystemExit('Refusing to overwrite an unknown or edited archive')
data = base64.b64decode('BASELINE_DATA')
assert hashlib.sha256(data).hexdigest() == 'BASELINE_HASH'
with tempfile.NamedTemporaryFile(dir=p.parent, prefix=p.name + '.', delete=False) as f:
    f.write(data)
    temporary = f.name
os.replace(temporary, p)
print('RESTORED SHA256=' + hashlib.sha256(p.read_bytes()).hexdigest())
PYTHON
'''
    import base64
    script = script.replace('MODIFIED_HASH', state['modified_sha256']).replace('BASELINE_HASH', state['sha256']).replace('BASELINE_DATA', base64.b64encode(Path(state['baseline']).read_bytes()).decode('ascii'))
    rollback = OUT / 'ROLLBACK.sh'
    rollback.write_bytes(script.encode('utf-8'))
    rollback.chmod(0o755)
    restore = OUT / 'purpose-rollback.zip'
    shutil.copyfile(modified, restore)
    p = run('ROLLBACK_EXECUTION', ['E:/Git/bin/bash.exe', rollback.relative_to(ROOT).as_posix(), restore.relative_to(ROOT).as_posix()])
    assert p.returncode == 0
    assert sha(restore) == state['sha256']
    with zipfile.ZipFile(restore) as z:
        assert z.testzip() is None
        z.extractall(OUT / 'purpose-rollback')
    reapply = OUT / 'purpose-reapply'
    reapply.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(state['baseline']), reapply / 'snapshot.zip')
    p = run('PATCH_REAPPLY', ['git', 'apply', '-p2', '--directory=' + reapply.relative_to(ROOT).as_posix(), str((OUT / 'DIFF_FILE.patch').relative_to(ROOT))])
    assert p.returncode == 0
    assert sha(reapply / 'snapshot.zip') == state['modified_sha256']
    print('Changed source files:', *changed, sep='\n')
    print('MODIFIED_SHA256=' + sha(modified))

def finalize():
    state = json.loads(STATE.read_text('utf-8'))
    before = sha(OUT / 'MODIFIED_FILE.zip')
    snapshot(OUT / 'MODIFIED_FILE.zip')
    assert sha(OUT / 'MODIFIED_FILE.zip') == before == state['modified_sha256']
    assert sha(OUT / 'purpose-rollback.zip') == state['sha256']
    rows = json.loads(LEDGER.read_text('utf-8'))
    for label in ['BASELINE', 'MODIFIED', 'ROLLBACK', 'UNIT', 'BROWSER', 'BUILD', 'TYPECHECK', 'PATCH_REAPPLY', 'DIFF_CHECK']:
        matches = [r for r in rows if r['label'] == label]
        assert matches and matches[-1]['exit'] == 0, label
    text = (OUT / 'before-purpose-VERIFICATION.txt').read_text('utf-8')
    text += '\n\n=== PURPOSE ENTRY TRANSACTION (2026-10-22) ===\n'
    text += f'TARGET: {APP}\nAPPROVAL: user requested "Implement the plan."\n'
    text += 'Baseline is the exact pre-turn working tree including all existing user modifications; no checkout/reset was used.\n'
    text += 'Changed branches: TokenPurpose access/id/refresh; TokenMode.canDecode; selectMode clears credentials, timers, results and cache; scheduleVerification disabled for refresh.\n'
    text += 'Source snapshots exclude node_modules, .npm-cache, dist and test-results; dependencies are unchanged.\n'
    text += 'MODIFIED_FILE.zip is the runnable source copy. DIFF_FILE.patch is a native git binary patch from purpose-baseline.zip to MODIFIED_FILE.zip.\n'
    text += 'ROLLBACK.sh is a self-contained executable POSIX shell script with embedded baseline, accepts a modified ZIP copy, requires Python 3, and refuses unknown archives.\n'
    text += 'Preserved prior four roles under before-purpose-*; prior verification ledger remains above. Supplemental source diff: ' + str(OUT / 'purpose-source.diff') + '\n'
    text += f'BASELINE SHA256: {state["sha256"]}\nMODIFIED SHA256: {state["modified_sha256"]}\nROLLBACK SHA256: {sha(OUT / "purpose-rollback.zip")}\n'
    text += 'Rollback was executed only on a separate modified archive copy, then extracted for the identical browser probe. The working app remained modified.\n'
    text += 'After rollback verification the modified source archive was regenerated from GOAL-applied working source and its hash rechecked.\n'
    text += 'Review: verified only the 13 intended source files changed versus pre-turn snapshot; core, providers, permissions, verification, dependencies and pre-existing changes preserved.\n'
    text += 'Review: textContent rendering retained; refresh strips decoded claims before rendering; disabled verifier blocks network scheduling; revision counters reject stale signature/clipboard output.\n'
    text += 'Visual review: desktop Access and 320px Refresh screenshots inspected; no clipped tabs or page overflow observed.\n'
    text += 'Tool errors: rtk unavailable (PowerShell exit 1), fallback native commands. First browser baseline spawn EPERM (exit 1), rerun with approved local process execution succeeded.\n'
    text += 'First shell rollback launch could not create signal pipe (Win32 error 5; exit 3221225794; wrapper exit 1). Corrected to approved local process execution and POSIX argument paths.\n'
    text += 'Patch-tool error: multiple operations target main.ts (tool validation error; no shell exit status); corrected by separate delete/add operations before testing.\n'
    text += 'Changed source manifest:\n' + '\n'.join(state['changed']) + '\n'
    for r in rows:
        text += f'\n[{r["label"]}]\nCWD: {r["cwd"]}\nCOMMAND: {json.dumps(r["command"], ensure_ascii=False)}\nINPUT: {r["input"]}\nSTDOUT:\n{r["stdout"]}\nSTDERR:\n{r["stderr"]}\nEXIT: {r["exit"]}\n'
    for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'ROLLBACK.sh']:
        p = OUT / name
        text += f'ROLE: {p}\nSHA256: {sha(p)}\nBYTES: {p.stat().st_size}\n'
    (OUT / 'VERIFICATION.txt').write_text(text, 'utf-8')
    for name in ROLES:
        p = OUT / name
        data = p.read_bytes()
        assert data
        if name.endswith('.zip'):
            with zipfile.ZipFile(p) as z:
                assert z.testzip() is None
                assert z.read('token-inspector/src/modes/refresh.ts') == (APP / 'src/modes/refresh.ts').read_bytes()
        elif name == 'DIFF_FILE.patch':
            assert b'GIT binary patch' in data
        elif name == 'ROLLBACK.sh':
            assert data.startswith(b'#!/bin/sh\n')
        else:
            assert 'TABS=0' in data.decode('utf-8') and 'TABS=3' in data.decode('utf-8')
        print(f'REOPENED {p}\nSHA256={sha(p)} BYTES={len(data)}')

if __name__ == '__main__' and sys.argv[1] == 'baseline':
    assert not STATE.exists(), 'baseline already recorded; do not overwrite'
    for name in ROLES:
        shutil.copyfile(OUT / name, OUT / ('before-purpose-' + name))
    baseline = OUT / 'purpose-baseline.zip'
    snapshot(baseline)
    with zipfile.ZipFile(baseline) as z:
        manifest = {name: hashlib.sha256(z.read(name)).hexdigest() for name in z.namelist()}
    STATE.write_text(json.dumps(dict(target=str(APP), baseline=str(baseline), sha256=sha(baseline), manifest=manifest), indent=2), 'utf-8')
    print('BASELINE_SHA256=' + sha(baseline))
    sys.exit(run('BASELINE', ['node', str(ROOT / '.artifacts/purpose-probe.mjs'), str(APP)]).returncode)
elif __name__ == '__main__' and sys.argv[1] == 'pack':
    pack()
elif __name__ == '__main__' and sys.argv[1] == 'finalize':
    finalize()
