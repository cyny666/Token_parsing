import './style.css';
import { inspectToken, MAX_INPUT_BYTES, type InspectionResult } from './core';
import { clearVerificationCache, verifySignature, type SignatureResult } from './verification';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('token');
const parts = ['header', 'payload'] as const;
type Part = typeof parts[number];
let current: InspectionResult | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let revision = 0;
let verificationRevision = 0;
let verificationTimer: ReturnType<typeof setTimeout> | undefined;
let verificationRequest: AbortController | undefined;
const keyInput = $<HTMLTextAreaElement>('verification-key');

function resetSignature() {
  verificationRevision++;
  clearTimeout(verificationTimer);
  verificationRequest?.abort();
  $('signature-status').textContent = '签名未验证';
  $('signature-status').dataset.state = 'idle';
  $('signature-badge').textContent = '签名未验证';
  $('signature-badge').dataset.state = 'idle';
  $('signature-source').textContent = '';
  $('signature-time').textContent = '';
}

function displaySignature(result: SignatureResult) {
  $('signature-status').textContent = result.message;
  $('signature-status').dataset.state = result.state;
  $('signature-badge').textContent = result.state === 'verified' ? '签名匹配' : result.state === 'invalid' ? '签名不匹配' : '签名未验证';
  $('signature-badge').dataset.state = result.state;
  $('signature-source').textContent = result.source ? `密钥来源：${result.source}` : '';
}

function scheduleVerification() {
  resetSignature();
  if (!input.value.trim()) return;
  const version = verificationRevision;
  verificationTimer = setTimeout(async () => {
    $('signature-status').textContent = '正在自动验签…';
    verificationRequest = new AbortController();
    const result = await verifySignature(input.value, {
      mode: $<HTMLSelectElement>('key-source').value as 'entra' | 'manual',
      algorithm: $<HTMLSelectElement>('signature-algorithm').value,
      key: keyInput.value,
      base64Secret: $<HTMLInputElement>('secret-base64').checked,
      signal: verificationRequest.signal,
    });
    if (version !== verificationRevision) return;
    displaySignature(result);
    const decoded = current;
    if (decoded?.status === 'decoded') {
      const exp = decoded.claims?.exp, nbf = decoded.claims?.nbf;
      const now = Date.now() / 1000;
      $('signature-time').textContent = typeof exp === 'number' && now >= exp ? '时间声明：按 exp 已过期（签名仍可能匹配）。' : typeof nbf === 'number' && now < nbf ? '时间声明：按 nbf 尚未生效。' : decoded.times.exp ? '时间声明：按本机时钟暂未过期；不代表实际可用。' : '时间声明：缺少或存在异常 exp，无法确定过期时间。';
    }
  }, 200);
}

// Only serialized JSON is highlighted; untrusted values always use text nodes.
function showJson(target: HTMLElement, value: Record<string, unknown>) {
  const json = JSON.stringify(value, null, 2);
  const pattern = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let offset = 0;
  target.replaceChildren();
  for (const match of json.matchAll(pattern)) {
    target.append(document.createTextNode(json.slice(offset, match.index)));
    const span = document.createElement('span');
    const text = match[0];
    span.className = text.startsWith('"') ? (/^\s*:/.test(json.slice(match.index! + text.length)) ? 'json-key' : 'json-string') : 'json-literal';
    span.textContent = text;
    target.append(span);
    offset = match.index! + text.length;
  }
  target.append(document.createTextNode(json.slice(offset)));
}
function switchView(part: Part, view: string) {
  $(`${part}-json`).hidden = view !== 'json';
  $(`${part}-claims`).hidden = view !== 'claims';
  for (const button of document.querySelectorAll<HTMLButtonElement>(`[data-part="${part}"]`)) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
}
function clearResult(message = '等待输入') {
  resetSignature();
  revision++;
  current = undefined;
  $('diagnostics').hidden = true;
  for (const id of ['summary', 'warnings', 'header-fields', 'payload-fields', 'copy-status']) $(id).replaceChildren();
  for (const part of parts) {
    $(`${part}-json`).textContent = message;
    $<HTMLButtonElement>(`copy-${part}`).disabled = true;
    switchView(part, 'json');
  }
  $('status').textContent = message;
}
function colorToken() {
  const mirror = $('token-colors');
  mirror.style.width = `${input.clientWidth}px`;
  mirror.replaceChildren();
  const raw = input.value;
  const prefix = raw.match(/^\s*(?:Bearer\s+)?/i)?.[0] ?? '';
  const segments = raw.slice(prefix.length).split('.');
  if (segments.length === 3 && raw.length <= MAX_INPUT_BYTES) {
    mirror.append(document.createTextNode(prefix));
    segments.forEach((segment, index) => {
      if (index) mirror.append(document.createTextNode('.'));
      const span = document.createElement('span');
      span.className = `token-segment ${['header', 'payload', 'signature'][index]}-color`;
      span.textContent = segment;
      mirror.append(span);
    });
  } else mirror.textContent = raw;
  mirror.append(document.createTextNode('\u200b'));
  mirror.scrollTop = input.scrollTop;
  mirror.scrollLeft = input.scrollLeft;
}
function row(label: string, value: string) {
  const item = document.createElement('div'); item.className = 'summary-row';
  const key = document.createElement('span'); key.textContent = label;
  const text = document.createElement('strong'); text.textContent = value;
  item.append(key, text); $('summary').append(item);
}
function render(result: InspectionResult) {
  current = result;
  $('diagnostics').hidden = false;
  $('status').textContent = { decoded: '格式有效 · 已解码', encrypted: '已识别 JWE · 载荷加密', opaque: '不透明或未知格式 · 无法读取内容', error: '未能解析 · 请检查输入' }[result.status];
  row('格式', result.format); row('发行方线索', result.provider);
  for (const [key, value] of Object.entries(result.times)) row(`${key} · UTC`, value);
  for (const message of [...result.evidence, ...result.warnings]) {
    const li = document.createElement('li'); li.textContent = message; $('warnings').append(li);
  }
  for (const part of parts) {
    const value = part === 'header' ? result.header : result.claims;
    if (value) {
      showJson($(`${part}-json`), value);
      $<HTMLButtonElement>(`copy-${part}`).disabled = false;
    } else {
      $(`${part}-json`).textContent = part === 'payload' && result.status === 'encrypted' ? '载荷已加密，无法显示。' : '没有可解码的内容。';
    }
    for (const field of result.fields.filter(field => field.name.startsWith(`${part}.`))) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      const key = document.createElement('strong'); key.textContent = field.name.slice(part.length + 1);
      const value = document.createElement('code'); value.textContent = JSON.stringify(field.value, null, 2);
      td.append(key, value);
      const explanation = document.createElement('td'); explanation.textContent = field.description;
      const fieldName = field.name.slice(part.length + 1);
      if (part === 'payload' && Object.hasOwn(result.times, fieldName)) explanation.append(document.createTextNode(` UTC：${result.times[fieldName]}`));
      tr.append(td, explanation); $(`${part}-fields`).append(tr);
    }
  }
  scheduleVerification();
}
input.addEventListener('input', () => {
  clearTimeout(timer);
  $('byte-count').textContent = `${new TextEncoder().encode(input.value).length.toLocaleString()} B`;
  clearResult(input.value.trim() ? '正在解析…' : '等待输入');
  colorToken();
  if (input.value.trim()) timer = setTimeout(() => render(inspectToken(input.value)), 150);
});
input.addEventListener('scroll', () => {
  $('token-colors').scrollTop = input.scrollTop;
  $('token-colors').scrollLeft = input.scrollLeft;
});
window.addEventListener('resize', colorToken);
function clearAll() {
  clearTimeout(timer);
  input.value = '';
  keyInput.value = '';
  clearVerificationCache();
  $('token-colors').replaceChildren();
  $('byte-count').textContent = '0 B';
  clearResult();
}
function updateKeyControls() {
  const manual = $<HTMLSelectElement>('key-source').value === 'manual';
  $('manual-key').hidden = !manual;
  $('network-notice').hidden = manual;
  const hmac = $<HTMLSelectElement>('signature-algorithm').value.startsWith('HS');
  $('secret-options').hidden = !hmac;
  $('key-label').textContent = hmac ? '共享密钥（原文逐字使用；不自动裁剪空白）' : '公钥：PEM / 证书 / JWK / JWKS（不要输入私钥）';
  keyInput.placeholder = hmac ? '输入共享密钥后自动验签' : '粘贴可信公钥，输入后自动验签';
  scheduleVerification();
}
$('key-source').addEventListener('change', () => { clearVerificationCache(); updateKeyControls(); });
$('signature-algorithm').addEventListener('change', updateKeyControls);
$('secret-base64').addEventListener('change', scheduleVerification);
keyInput.addEventListener('input', scheduleVerification);
$('clear').addEventListener('click', () => { clearAll(); input.focus(); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
  button.addEventListener('click', () => switchView(button.dataset.part as Part, button.dataset.view!));
}
for (const part of parts) {
  $(`copy-${part}`).addEventListener('click', async () => {
    const value = part === 'header' ? current?.header : current?.claims;
    if (!value) return;
    const version = revision;
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      if (version === revision) $('copy-status').textContent = `${part === 'header' ? 'Header' : 'Payload'} 已复制到剪贴板。`;
    } catch {
      if (version === revision) $('copy-status').textContent = '复制失败，请手动选择 JSON 复制。';
    }
  });
}
window.addEventListener('pagehide', clearAll);
