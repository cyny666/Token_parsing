from pathlib import Path
import base64, hashlib, json, shutil, sys, zipfile
import purpose_evidence as pe

sys.stdout.reconfigure(encoding='utf-8')
ROOT, APP, OUT = pe.ROOT, pe.APP, pe.OUT
pe.LEDGER = OUT / 'aud-execution.json'
pe.INPUT_DESCRIPTION = 'synthetic aud fixture only; exact identical JWT printed in BASELINE/MODIFIED/ROLLBACK stdout'
STATE = OUT / 'aud-state.json'
run, snapshot, sha = pe.run, pe.snapshot, pe.sha

def baseline():
    assert not STATE.exists(), 'Do not overwrite the recorded aud baseline'
    for name in pe.ROLES:
        shutil.copyfile(OUT / name, OUT / ('before-aud-' + name))
    archive = OUT / 'aud-baseline.zip'
    snapshot(archive)
    with zipfile.ZipFile(archive) as z:
        manifest = {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
    STATE.write_text(json.dumps(dict(target=str(APP), baseline=str(archive), sha256=sha(archive), manifest=manifest), indent=2), 'utf-8')
    print('BASELINE_SHA256=' + sha(archive))
    return run('BASELINE', ['node', str(ROOT / '.artifacts/aud-probe.mjs'), str(APP)]).returncode

def pack():
    state = json.loads(STATE.read_text('utf-8'))
    modified = OUT / 'MODIFIED_FILE.zip'
    snapshot(modified)
    with zipfile.ZipFile(modified) as z:
        assert z.testzip() is None
        manifest = {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}
    changed = sorted(n for n in set(manifest) | set(state['manifest']) if manifest.get(n) != state['manifest'].get(n))
    assert changed == ['token-inspector/' + n for n in ['src/decoder.ts', 'src/permissions.ts', 'tests/browser/values.spec.ts', 'tests/permissions.test.ts']], changed
    state.update(modified_sha256=sha(modified), changed=changed)
    STATE.write_text(json.dumps(state, indent=2), 'utf-8')
    patchroot = OUT / 'aud-patch'
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
    (OUT / 'aud-source.diff').write_bytes(p.stdout)
    # Preserve the tested rollback implementation; replace its archive identities and embedded baseline.
    script = (OUT / 'before-aud-ROLLBACK.sh').read_text('utf-8')
    import re
    script = re.sub(r"hexdigest\(\) != '[0-9a-f]{64}'", "hexdigest() != '" + state['modified_sha256'] + "'", script)
    script = re.sub(r"data = base64.b64decode\('[A-Za-z0-9+/=]+'\)", "data = base64.b64decode('" + base64.b64encode(Path(state['baseline']).read_bytes()).decode('ascii') + "')", script)
    script = re.sub(r"hexdigest\(\) == '[0-9a-f]{64}'", "hexdigest() == '" + state['sha256'] + "'", script)
    rollback = OUT / 'ROLLBACK.sh'
    rollback.write_bytes(script.encode('utf-8'))
    rollback.chmod(0o755)
    copy = OUT / 'aud-rollback.zip'
    shutil.copyfile(modified, copy)
    p = run('ROLLBACK_EXECUTION', ['E:/Git/bin/bash.exe', rollback.relative_to(ROOT).as_posix(), copy.relative_to(ROOT).as_posix()])
    assert p.returncode == 0 and sha(copy) == state['sha256']
    with zipfile.ZipFile(copy) as z:
        z.extractall(OUT / 'aud-rollback')
    reapply = OUT / 'aud-reapply'
    reapply.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(state['baseline']), reapply / 'snapshot.zip')
    p = run('PATCH_REAPPLY', ['git', 'apply', '-p2', '--directory=' + reapply.relative_to(ROOT).as_posix(), str((OUT / 'DIFF_FILE.patch').relative_to(ROOT))])
    assert p.returncode == 0 and sha(reapply / 'snapshot.zip') == state['modified_sha256']
    print('MODIFIED_SHA256=' + state['modified_sha256'])

def finalize():
    state = json.loads(STATE.read_text('utf-8'))
    snapshot(OUT / 'MODIFIED_FILE.zip')
    assert sha(OUT / 'MODIFIED_FILE.zip') == state['modified_sha256']
    assert sha(OUT / 'aud-rollback.zip') == state['sha256']
    rows = json.loads(pe.LEDGER.read_text('utf-8'))
    for label in ['BASELINE', 'MODIFIED', 'ROLLBACK', 'UNIT', 'BROWSER', 'BUILD', 'TYPECHECK', 'PATCH_REAPPLY', 'DIFF_CHECK']:
        assert [r for r in rows if r['label'] == label][-1]['exit'] == 0, label
    text = (OUT / 'before-aud-VERIFICATION.txt').read_text('utf-8')
    text += '\n\n=== AUD VALUE MATCH TRANSACTION ===\n'
    text += f'TARGET: {APP}\nCHANGED SYMBOLS: audienceNames(); decoder.render() payload.aud branch.\n'
    text += 'GOAL: map aud c44b4083-3bb0-49c1-b47d-974e53cbdf3c to Azure Portal, preserve raw GUID, show name beside the value and in the explanation.\n'
    text += 'Mapping source: https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mandatory-multifactor-authentication#application-ids-and-urls (Azure portal, Entra admin center and Intune admin center share this app ID).\n'
    text += 'Behavior: API audience table first, then known application ID fallback; case-normalize GUIDs only; own-property checks; unknown IDs remain unmapped. No network lookup, no token-use inference, no BroCi/FOCI risk inherited by audience.\n'
    text += 'Review: only four intended files differ from pre-turn source archive; previous purpose split, user changes, signature code and dependencies preserved. All untrusted names rendered as textContent.\n'
    text += 'MODIFIED_FILE.zip contains source without dependency/cache/build folders. DIFF_FILE.patch reconstructs exact modified ZIP bytes. ROLLBACK.sh embeds the pre-turn baseline and refuses unknown copies. Rollback ran only on a separate copy.\n'
    text += 'Previous roles preserved as before-aud-*; previous ledger retained above. Supplemental source diff: ' + str(OUT / 'aud-source.diff') + '\n'
    text += 'BASELINE_SHA256=' + state['sha256'] + '\nMODIFIED_SHA256=' + state['modified_sha256'] + '\nROLLBACK_SHA256=' + sha(OUT / 'aud-rollback.zip') + '\n'
    text += 'Modified archive regenerated after rollback verification; still GOAL-applied and hash-identical.\nTool retry: rtk unavailable (exit 1); native PowerShell used.\n'
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
        else: assert 'AUD_MATCHES=[]' in data.decode('utf-8') and '受众：Azure Portal' in data.decode('utf-8')
        print(f'REOPENED {p}\nSHA256={sha(p)} BYTES={len(data)}')

if __name__ == '__main__':
    if sys.argv[1] == 'baseline': sys.exit(baseline())
    elif sys.argv[1] == 'pack': pack()
    elif sys.argv[1] == 'finalize': finalize()
