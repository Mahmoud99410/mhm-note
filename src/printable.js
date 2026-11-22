// Builds printable HTML (for PDF export) and plain text (for sharing) from items.
import * as V from './vault';
import { fmtFull, pageStyle } from './constants';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cleanHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  d.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((n) => n.remove());
  d.querySelectorAll('*').forEach((el) => [...el.attributes].forEach((a) => /^on/i.test(a.name) && el.removeAttribute(a.name)));
  d.querySelectorAll('.todo').forEach((t) => {
    const box = t.querySelector('.box');
    if (box) box.outerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid #17845a;border-radius:4px;margin-inline-end:8px;vertical-align:-2px;background:${t.dataset.done === '1' ? '#17845a' : 'transparent'}"></span>`;
    if (t.dataset.done === '1') t.style.textDecoration = 'line-through';
  });
  return d.innerHTML;
}

async function imagesHtml(it) {
  const out = [];
  for (const a of it.attachments || []) {
    if (!a.type?.startsWith('image/') && a.w == null) continue;
    const bytes = await V.blobBytes(a.id);
    if (!bytes) continue;
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    out.push(`<img src="data:image/jpeg;base64,${btoa(s)}" style="max-width:100%;max-height:900px;border-radius:8px;margin:8px 0;display:block">`);
  }
  return out.join('');
}

const row = (label, value, ltr) =>
  value ? `<tr><td style="padding:6px 10px;color:#6a7a72;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:6px 10px;${ltr ? 'direction:ltr;unicode-bidi:isolate;' : ''}font-weight:600">${esc(value)}</td></tr>` : '';

export async function itemHtml(it, t, lang, folderName) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const ps = pageStyle(it.pageColor, false);
  const bg = ps ? ps.bg : '#ffffff';
  const fg = ps?.text || '#111111';
  const head = `<div style="font-size:12px;color:#6a7a72;margin-bottom:4px">${esc(folderName || '')}</div>
    <h1 style="margin:0 0 6px;font-size:24px;unicode-bidi:plaintext">${esc(it.title || t.untitled)}</h1>
    <div style="font-size:11px;color:#6a7a72;margin-bottom:16px">${esc(t.createdAt)}: ${esc(fmtFull(it.createdAt, lang))} — ${esc(t.modifiedAt)}: ${esc(fmtFull(it.updatedAt, lang))}</div>`;
  let body = '';
  if (it.type === 'note') {
    body = `<div style="font-size:${it.fontSize || 17}px;line-height:1.8;unicode-bidi:plaintext">${cleanHtml(it.html)}</div>${await imagesHtml(it)}`;
    const files = (it.attachments || []).filter((a) => a.type === 'application/pdf');
    if (files.length) body += `<p style="color:#6a7a72;font-size:12px">📎 ${files.map((f) => esc(f.name)).join('، ')}</p>`;
  } else if (it.type === 'account') {
    body = `<table style="border-collapse:collapse;font-size:15px">${row(t.email, it.email, true)}${row(t.username, it.username, true)}${row(t.password, it.password, true)}${row(t.link, it.url, true)}${row(t.notes, it.notes)}</table>`;
  } else if (it.type === 'contact') {
    body = `<table style="border-collapse:collapse;font-size:15px">${(it.phones || []).map((p) => row(p.label || t.phone, p.number, true)).join('')}${row(t.notes, it.notes)}</table>`;
  } else if (it.type === 'file') {
    body = `<p>📎 ${esc(it.attachments?.[0]?.name || '')}</p>${row(t.notes, it.notes)}`;
  }
  return `<div class="pdf-page" dir="${dir}" style="background:${bg};padding:36px 40px;min-height:200px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:${fg}">${head}${body}</div>`;
}

export async function itemsHtml(items, t, lang, folderName) {
  const parts = [];
  for (const it of items) parts.push(await itemHtml(it, t, lang, folderName));
  return parts.join('');
}

export function itemText(it, t) {
  const lines = [it.title || t.untitled];
  if (it.type === 'note') {
    const d = document.createElement('div');
    d.innerHTML = (it.html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li|h\d)>/gi, '\n</$1>');
    d.querySelectorAll('.todo').forEach((x) => x.prepend(x.dataset.done === '1' ? '☑ ' : '☐ '));
    lines.push('', d.textContent.replace(/\n{3,}/g, '\n\n').trim());
  }
  if (it.type === 'account') {
    if (it.email) lines.push(`${t.email}: ${it.email}`);
    if (it.username) lines.push(`${t.username}: ${it.username}`);
    if (it.password) lines.push(`${t.password}: ${it.password}`);
    if (it.url) lines.push(`${t.link}: ${it.url}`);
    if (it.notes) lines.push('', it.notes);
  }
  if (it.type === 'contact') {
    for (const p of it.phones || []) if (p.number) lines.push(`${p.label ? p.label + ': ' : ''}${p.number}`);
    if (it.notes) lines.push('', it.notes);
  }
  return lines.join('\n').trim();
}
