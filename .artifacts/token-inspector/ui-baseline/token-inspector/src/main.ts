import './style.css';
import { inspectToken, type InspectionResult } from './core';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('token');
function reset() {
  for (const id of ['summary', 'diagnostics', 'details']) $(id).hidden = true;
  for (const id of ['summary', 'warnings', 'fields', 'header-json', 'payload-json']) $(id).replaceChildren();
  $('empty').hidden = false;
  $('status').textContent = input.value ? '输入已更新，请解析' : '等待输入';
}
function row(label: string, value: string) {
  const item = document.createElement('div'); item.className = 'summary-row';
  const key = document.createElement('span'); key.textContent = label;
  const text = document.createElement('strong'); text.textContent = value;
  item.append(key, text); $('summary').append(item);
}
function render(result: InspectionResult) {
  $('empty').hidden = true; $('summary').hidden = false; $('diagnostics').hidden = false;
  $('status').textContent = { decoded: '已解码 · 内容未经验证', encrypted: '已识别加密结构 · 无法读取载荷', opaque: '不透明或未知格式 · 无法读取内容', error: '未能解析 · 请检查输入' }[result.status];
  row('格式', result.format); row('发行方线索', result.provider);
  row('Token 用途', '未确定（不能仅凭格式区分 Access / Refresh）');
  if (result.claims?.aud !== undefined) row('受众声明', JSON.stringify(result.claims.aud));
  for (const [key, value] of Object.entries(result.times)) row(`${key} · UTC`, value);
  for (const message of [...result.evidence, ...result.warnings]) {
    const li = document.createElement('li'); li.textContent = message; $('warnings').append(li);
  }
  if (result.header) {
    $('details').hidden = false;
    $('header-json').textContent = JSON.stringify(result.header, null, 2);
    $('payload-json').textContent = result.claims ? JSON.stringify(result.claims, null, 2) : '载荷已加密，无法显示。';
    for (const field of result.fields) {
      const tr = document.createElement('tr');
      for (const value of [field.name, JSON.stringify(field.value), field.description]) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      $('fields').append(tr);
    }
  }
}
input.addEventListener('input', () => {
  $('byte-count').textContent = `${new TextEncoder().encode(input.value).length.toLocaleString()} B`;
  reset();
});
$('inspect').addEventListener('click', () => { reset(); render(inspectToken(input.value)); });
$('clear').addEventListener('click', () => { input.value = ''; $('byte-count').textContent = '0 B'; reset(); input.focus(); });
window.addEventListener('pagehide', () => { input.value = ''; reset(); });
