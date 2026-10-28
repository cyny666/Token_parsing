import './style.css';
import { createDecoder } from './decoder';
import { modes, type TokenPurpose } from './modes';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('token');
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-purpose]')];
const decoder = createDecoder();
let purpose: TokenPurpose = 'access';
let timer: ReturnType<typeof setTimeout> | undefined;

function clearAll() {
  clearTimeout(timer);
  decoder.clear();
}

function showMode() {
  const mode = modes[purpose];
  decoder.setEnabled(mode.canDecode);
  $('purpose-title').textContent = mode.label;
  $('purpose-description').textContent = mode.description;
  $('purpose-panel').setAttribute('aria-labelledby', `tab-${purpose}`);
  $('details').hidden = !mode.canDecode;
  $('refresh-details').hidden = mode.canDecode;
  $('token-legend').hidden = !mode.canDecode;
  $('signature-badge').hidden = !mode.canDecode;
  $('mode-capability').textContent = mode.canDecode ? '不上传 Token · 解码与验签' : '实验性结构解码 · 不解密或换票';
  $('token-label').textContent = `粘贴 ${mode.label}`;
  input.placeholder = `在这里粘贴 ${mode.label}…\n\n支持 Bearer 前缀\n${mode.canDecode ? '输入后自动解析' : '样例格式：1.<描述段>.<不透明载荷>\n只解码公开结构，不解密、不验签'}`;
  for (const tab of tabs) {
    const selected = tab.dataset.purpose === purpose;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}

function selectMode(next: TokenPurpose) {
  if (next === purpose) return;
  clearAll();
  purpose = next;
  showMode();
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectMode(tab.dataset.purpose as TokenPurpose));
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab);
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].focus();
    selectMode(tabs[next].dataset.purpose as TokenPurpose);
  });
}

input.addEventListener('input', () => {
  clearTimeout(timer);
  $('byte-count').textContent = `${new TextEncoder().encode(input.value).length.toLocaleString()} B`;
  decoder.reset(input.value.trim() ? '正在解析…' : '等待输入');
  decoder.colorToken();
  if (input.value.trim()) timer = setTimeout(() => decoder.render(modes[purpose].inspect(input.value), purpose), 150);
});
$('clear').addEventListener('click', () => { clearAll(); input.focus(); });
window.addEventListener('pagehide', clearAll);
showMode();
