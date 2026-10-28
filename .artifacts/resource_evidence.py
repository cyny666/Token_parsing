from pathlib import Path
import base64, hashlib, json, shutil, sys, zipfile
import purpose_evidence as pe

sys.stdout.reconfigure(encoding='utf-8')
ROOT, APP, OUT = pe.ROOT, pe.APP, pe.OUT
pe.LEDGER = OUT / 'resource-execution.json'
pe.INPUT_DESCRIPTION = 'synthetic resource-descriptor fixture only; exact identical token printed in BASELINE/MODIFIED/ROLLBACK stdout'
STATE = OUT / 'resource-state.json'
run, snapshot, sha = pe.run, pe.snapshot, pe.sha

def baseline():
    assert not STATE.exists(), 'Do not overwrite the recorded refresh baseline'
    for name in pe.ROLES:
        shutil.copyfile(OUT / name, OUT / ('before-resource-' + name))
    archive = OUT / 'resource-baseline.zip'
    snapshot(archive)
    with zipfile.ZipFile(archive) as z:
        manifest = {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
    STATE.write_text(json.dumps(dict(target=str(APP), baseline=str(archive), sha256=sha(archive), manifest=manifest), indent=2), 'utf-8')
    print('BASELINE_SHA256=' + sha(archive))
    return run('BASELINE', ['node', str(ROOT / '.artifacts/resource-probe.mjs'), str(APP)]).returncode

def pack():
    state = json.loads(STATE.read_text('utf-8'))
    modified = OUT / 'MODIFIED_FILE.zip'
    snapshot(modified)
    with zipfile.ZipFile(modified) as z:
        assert z.testzip() is None
        manifest = {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
    changed = sorted(n for n in set(manifest) | set(state['manifest']) if manifest.get(n) != state['manifest'].get(n))
    assert changed == ['token-inspector/' + n for n in ['README.md', 'THIRD_PARTY_NOTICES.txt', 'src/decoder.ts', 'src/graph-permissions.ts', 'src/main.ts', 'src/permissions.ts', 'tests/browser/values.spec.ts', 'tests/permissions.test.ts']], changed
    state.update(modified_sha256=sha(modified), changed=changed)
    STATE.write_text(json.dumps(state, indent=2), 'utf-8')
    patchroot = OUT / 'resource-patch'
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
    (OUT / 'resource-source.diff').write_bytes(p.stdout)
    # Preserve the tested rollback implementation; replace its archive identities and embedded baseline.
    script = (OUT / 'before-resource-ROLLBACK.sh').read_text('utf-8')
    import re
    script = re.sub(r"hexdigest\(\) != '[0-9a-f]{64}'", "hexdigest() != '" + state['modified_sha256'] + "'", script)
    script = re.sub(r"data = base64.b64decode\('[A-Za-z0-9+/=]+'\)", "data = base64.b64decode('" + base64.b64encode(Path(state['baseline']).read_bytes()).decode('ascii') + "')", script)
    script = re.sub(r"hexdigest\(\) == '[0-9a-f]{64}'", "hexdigest() == '" + state['sha256'] + "'", script)
    rollback = OUT / 'ROLLBACK.sh'
    rollback.write_bytes(script.encode('utf-8'))
    rollback.chmod(0o755)
    copy = OUT / 'resource-rollback.zip'
    shutil.copyfile(modified, copy)
    p = run('ROLLBACK_EXECUTION', ['E:/Git/bin/bash.exe', rollback.relative_to(ROOT).as_posix(), copy.relative_to(ROOT).as_posix()])
    assert p.returncode == 0 and sha(copy) == state['sha256']
    with zipfile.ZipFile(copy) as z:
        z.extractall(OUT / 'resource-rollback')
    reapply = OUT / 'resource-reapply'
    reapply.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(state['baseline']), reapply / 'snapshot.zip')
    p = run('PATCH_REAPPLY', ['git', 'apply', '-p2', '--directory=' + reapply.relative_to(ROOT).as_posix(), str((OUT / 'DIFF_FILE.patch').relative_to(ROOT))])
    assert p.returncode == 0 and sha(reapply / 'snapshot.zip') == state['modified_sha256']
    print('MODIFIED_SHA256=' + state['modified_sha256'])

def finalize():
    state = json.loads(STATE.read_text('utf-8'))
    snapshot(OUT / 'MODIFIED_FILE.zip')
    assert sha(OUT / 'MODIFIED_FILE.zip') == state['modified_sha256']
    assert sha(OUT / 'resource-rollback.zip') == state['sha256']
    rows = json.loads(pe.LEDGER.read_text('utf-8'))
    for label in ['BASELINE', 'MODIFIED', 'ROLLBACK', 'UNIT', 'BROWSER', 'BUILD', 'TYPECHECK', 'PATCH_REAPPLY', 'DIFF_CHECK']:
        assert [r for r in rows if r['label'] == label][-1]['exit'] == 0, label
    text = (OUT / 'before-resource-VERIFICATION.txt').read_text('utf-8')
    text += '\n\n=== RESOURCE-AWARE PERMISSION TRANSACTION ===\n'
    text += f'TARGET: {APP}\nCHANGED SYMBOLS: permissionContext(); permissionInfo(value, context); decoder.render() scp/roles/wids branches.\n'
    text += 'GOAL: select resource dictionary by exact aud; Graph-only MVP; distinguish delegated/application/app-role/directory-role; unknown audiences/types/values retain raw JSON and never inherit Graph descriptions or risk prefixes.\n'
    text += 'Evidence: pre-turn baseline includes all existing user changes. Current scoped source snapshot is extended, never checked out or reset.\n'
    text += 'Sources: Microsoft access-token claims reference; MIT-licensed microsoftgraph/microsoft-graph-devx-content Chinese permission metadata, filtered to pre-existing curated names; snapshot and license saved in .artifacts/resource-source*. No runtime networking added.\n'
    text += 'Review: resource/type gates, conservative roles classification, own-property dictionary lookup, strict audience aliases and unknown/mixed audience handling; raw token JSON preserved; existing Refresh and verification logic unchanged.\n'
    text += 'Visual review: synthetic-only desktop and mobile permission screenshots inspected.\n'
    text += 'Test correction: first browser run exited 1 (25 passed, 1 failed). An assertion about unknown permission values incorrectly covered the whole payload, including legitimate aud name matching. Narrowed the assertion to the scp row; application behavior was unchanged. Literal failed output is retained below.\n'
    text += 'MODIFIED_FILE.zip contains source without dependency/cache/build folders. DIFF_FILE.patch reconstructs exact modified ZIP bytes. ROLLBACK.sh embeds the pre-turn baseline and refuses unknown copies. Rollback ran only on a separate copy.\n'
    text += 'Previous roles preserved as before-resource-*; previous ledger retained above. Supplemental source diff: ' + str(OUT / 'resource-source.diff') + '\n'
    text += 'BASELINE_SHA256=' + state['sha256'] + '\nMODIFIED_SHA256=' + state['modified_sha256'] + '\nROLLBACK_SHA256=' + sha(OUT / 'resource-rollback.zip') + '\n'
    text += 'Modified archive regenerated after rollback verification; still GOAL-applied and hash-identical.\nNative PowerShell used because rtk was confirmed unavailable in prior turns.\n'
    text += 'Changed source paths:\n' + '\n'.join(state['changed']) + '\n'
    for r in rows:
        text += f'\n[{r["label"]}]\nCWD: {r["cwd"]}\nCOMMAND: {json.dumps(r["command"], ensure_ascii=False)}\nINPUT: {r["input"]}\nSTDOUT:\n{r["stdout"]}\nSTDERR:\n{r["stderr"]}\nEXIT: {r["exit"]}\n'
    for name in ['MODIFIED_FILE.zip', 'DIFF_FILE.patch', 'ROLLBACK.sh']:
        p = OUT / name
        text += f'ROLE: {p}\nSHA256: {sha(p)}\nBYTES: {p.stat().st_size}\n'
    (OUT / 'VERIFICATION.txt').write_text(text, 'utf-8')
    for name in pe.ROLES:
        p = OUT / name
        data = p.read_bytes()
        assert data
        if name.endswith('.zip'):
            with zipfile.ZipFile(p) as z:
                assert z.testzip() is None
                assert z.read('token-inspector/src/permissions.ts') == (APP / 'src/permissions.ts').read_bytes()
        elif name == 'DIFF_FILE.patch': assert b'GIT binary patch' in data
        elif name == 'ROLLBACK.sh': assert data.startswith(b'#!/bin/sh\n')
        else: assert 'CUSTOM_CRITICAL=2' in data.decode('utf-8') and 'CUSTOM_CRITICAL=0' in data.decode('utf-8')
        print(f'REOPENED {p}\nSHA256={sha(p)} BYTES={len(data)}')

if __name__ == '__main__':
    if sys.argv[1] == 'baseline': sys.exit(baseline())
    elif sys.argv[1] == 'pack': pack()
    elif sys.argv[1] == 'finalize': finalize()
