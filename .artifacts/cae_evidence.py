from pathlib import Path
import base64, hashlib, json, shutil, sys, zipfile
import purpose_evidence as pe

sys.stdout.reconfigure(encoding='utf-8')
ROOT, APP, OUT = pe.ROOT, pe.APP, pe.OUT
pe.LEDGER = OUT / 'cae-execution.json'
pe.INPUT_DESCRIPTION = 'synthetic cae-descriptor fixture only; exact identical token printed in BASELINE/MODIFIED/ROLLBACK stdout'
STATE = OUT / 'cae-state.json'
run, snapshot, sha = pe.run, pe.snapshot, pe.sha

def baseline():
    assert not STATE.exists(), 'Do not overwrite the recorded refresh baseline'
    for name in pe.ROLES:
        shutil.copyfile(OUT / name, OUT / ('before-cae-' + name))
    archive = OUT / 'cae-baseline.zip'
    snapshot(archive)
    with zipfile.ZipFile(archive) as z:
        manifest = {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
    STATE.write_text(json.dumps(dict(target=str(APP), baseline=str(archive), sha256=sha(archive), manifest=manifest), indent=2), 'utf-8')
    print('BASELINE_SHA256=' + sha(archive))
    return run('BASELINE', ['node', str(ROOT / '.artifacts/cae-probe.mjs'), str(APP)]).returncode

def pack():
    state = json.loads(STATE.read_text('utf-8'))
    modified = OUT / 'MODIFIED_FILE.zip'
    snapshot(modified)
    with zipfile.ZipFile(modified) as z:
        assert z.testzip() is None
        manifest = {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
    changed = sorted(n for n in set(manifest) | set(state['manifest']) if manifest.get(n) != state['manifest'].get(n))
    assert changed == ['token-inspector/' + n for n in ['src/decoder.ts', 'tests/browser/cae.spec.ts']], changed
    state.update(modified_sha256=sha(modified), changed=changed)
    STATE.write_text(json.dumps(state, indent=2), 'utf-8')
    patchroot = OUT / 'cae-patch'
    for label, archive in [('before', Path(state['baseline'])), ('after', modified)]:
        folder = patchroot / label
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(archive, folder / 'snapshot.zip')
        with zipfile.ZipFile(archive) as z:
            z.extractall(patchroot / (label + '-source'))
    p = run('ARCHIVE_DIFF', ['git', 'diff', '--binary', '--no-index', '--', 'before/snapshot.zip', 'after/snapshot.zip'], patchroot, quiet=True)
    assert p.returncode == 1
    (OUT / 'DIFF_FILE.patch').write_bytes(p.stdout)
    p = run('SOURCE_DIFF', ['git', '-c', 'core.autocrlf=false', 'diff', '--no-index', '--', 'before-source', 'after-source'], patchroot, quiet=True)
    assert p.returncode == 1
    (OUT / 'cae-source.diff').write_bytes(p.stdout)
    # Preserve the tested rollback implementation; replace its archive identities and embedded baseline.
    script = (OUT / 'before-cae-ROLLBACK.sh').read_text('utf-8')
    import re
    script = re.sub(r"hexdigest\(\) != '[0-9a-f]{64}'", "hexdigest() != '" + state['modified_sha256'] + "'", script)
    script = re.sub(r"data = base64.b64decode\('[A-Za-z0-9+/=]+'\)", "data = base64.b64decode('" + base64.b64encode(Path(state['baseline']).read_bytes()).decode('ascii') + "')", script)
    script = re.sub(r"hexdigest\(\) == '[0-9a-f]{64}'", "hexdigest() == '" + state['sha256'] + "'", script)
    rollback = OUT / 'ROLLBACK.sh'
    rollback.write_bytes(script.encode('utf-8'))
    rollback.chmod(0o755)
    copy = OUT / 'cae-rollback.zip'
    shutil.copyfile(modified, copy)
    p = run('ROLLBACK_EXECUTION', ['E:/Git/bin/bash.exe', rollback.relative_to(ROOT).as_posix(), copy.relative_to(ROOT).as_posix()])
    assert p.returncode == 0 and sha(copy) == state['sha256']
    with zipfile.ZipFile(copy) as z:
        z.extractall(OUT / 'cae-rollback')
    reapply = OUT / 'cae-reapply'
    reapply.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(state['baseline']), reapply / 'snapshot.zip')
    p = run('PATCH_REAPPLY', ['git', 'apply', '-p2', '--directory=' + reapply.relative_to(ROOT).as_posix(), str((OUT / 'DIFF_FILE.patch').relative_to(ROOT))])
    assert p.returncode == 0 and sha(reapply / 'snapshot.zip') == state['modified_sha256']
    print('MODIFIED_SHA256=' + state['modified_sha256'])

if __name__ == '__main__':
    if sys.argv[1] == 'baseline': sys.exit(baseline())
    elif sys.argv[1] == 'pack': pack()
