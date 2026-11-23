import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { X, ArrowRight, Download, Share2, ExternalLink, Copy, FileText, FileCode, FileArchive, Image as ImageIco, Folder, Code } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { unzipSync } from 'fflate';
import { useT } from '../settings';
import * as D from '../device';
import { openExternal } from '../native';
import { copyText, toast } from './ui';
import { fmtSize } from './Actions';

const TEXT_EXT = ['txt', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'py', 'java', 'kt', 'kts', 'xml', 'yml', 'yaml', 'sh', 'bat', 'ps1', 'dart', 'php', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'swift', 'sql', 'csv', 'gradle', 'properties', 'ini', 'toml', 'env', 'gitignore', 'log', 'vue', 'svelte', 'mq5', 'mqh', 'gs'];
const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
export const ext = (name) => {
  const n = (name || '').toLowerCase();
  const i = n.lastIndexOf('.');
  return i < 0 ? n : n.slice(i + 1);
};
export function fileKind(name, type = '') {
  const e = ext(name);
  if (e === 'pdf' || type === 'application/pdf') return 'pdf';
  if (e === 'zip' || /zip/.test(type)) return 'zip';
  if (e === 'md' || e === 'markdown') return 'md';
  if (e === 'html' || e === 'htm') return 'html';
  if (IMG_EXT.includes(e) || type.startsWith('image/')) return 'image';
  if (TEXT_EXT.includes(e) || type.startsWith('text/')) return 'text';
  return 'other';
}
export const viewable = (name, type) => ['md', 'html', 'zip', 'text', 'image'].includes(fileKind(name, type));
export const mimeOf = (name) =>
  ({ pdf: 'application/pdf', zip: 'application/zip', md: 'text/markdown', html: 'text/html', image: 'image/' + (ext(name) === 'jpg' ? 'jpeg' : ext(name)), text: 'text/plain' }[fileKind(name)] ||
  'application/octet-stream');

export function KindIcon({ name, type, size = 20 }) {
  const k = fileKind(name, type);
  const Icon = k === 'zip' ? FileArchive : k === 'md' || k === 'html' || k === 'text' ? FileCode : k === 'image' ? ImageIco : FileText;
  return <Icon size={size} />;
}
export const kindColor = (name, type) =>
  ({ pdf: '#e0473e', zip: '#ef7a2d', md: '#2578e2', html: '#d94a8c', text: '#5b6b75', image: '#1f9d8f' }[fileKind(name, type)] || '#7c5cf0');

const dec = new TextDecoder();

function Markdown({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { gfm: true, breaks: true })), [text]);
  return (
    <div
      className="md-view"
      dir="auto"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const a = e.target.closest('a');
        if (a?.href && /^https?:/i.test(a.getAttribute('href') || '')) {
          e.preventDefault();
          openExternal(a.href);
        } else if (a) e.preventDefault();
      }}
    />
  );
}

function ZipList({ bytes, onOpen }) {
  const t = useT();
  const entries = useMemo(() => {
    try {
      const files = unzipSync(bytes);
      return Object.entries(files)
        .filter(([p]) => !p.endsWith('/') && !p.startsWith('__MACOSX/'))
        .map(([path, data]) => ({ path, data }))
        .sort((a, b) => a.path.localeCompare(b.path));
    } catch (e) {
      return { error: e.message };
    }
  }, [bytes]);
  if (entries.error) return <p className="error">{t.zipError}: {entries.error}</p>;
  let lastDir = null;
  return (
    <div className="list">
      <p className="hint">{entries.length} {t.filesInZip}</p>
      {entries.map((en) => {
        const i = en.path.lastIndexOf('/');
        const dir = i < 0 ? '' : en.path.slice(0, i);
        const name = en.path.slice(i + 1);
        const head = dir !== lastDir;
        lastDir = dir;
        return (
          <div key={en.path}>
            {head && dir && <div className="hint ltr zip-dir"><Folder size={13} /> {dir}/</div>}
            <button className="item" style={{ padding: '9px 12px' }} onClick={() => onOpen(name, en.data)}>
              <span className="badge" style={{ '--bc': kindColor(name), width: 34, height: 34, borderRadius: 10 }}><KindIcon name={name} size={17} /></span>
              <span className="grow ltr ellipsis" style={{ textAlign: 'start', fontWeight: 600, fontSize: 14 }}>{name}</span>
              <span className="s">{fmtSize(en.data.length)}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Full-screen viewer for MD / HTML / ZIP / text / images
export default function FileViewer({ name, bytes, onClose }) {
  const t = useT();
  const kind = fileKind(name);
  const [source, setSource] = useState(false);
  const [inner, setInner] = useState(null);
  const text = useMemo(() => (['md', 'html', 'text'].includes(kind) ? dec.decode(bytes) : ''), [bytes, kind]);
  const imgUrl = useMemo(() => (kind === 'image' ? URL.createObjectURL(new Blob([bytes], { type: mimeOf(name) })) : null), [bytes, kind, name]);
  useEffect(() => () => imgUrl && URL.revokeObjectURL(imgUrl), [imgUrl]);
  useEffect(() => {
    const onBack = (e) => {
      if (inner) return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('mhm-back', onBack, true);
    return () => window.removeEventListener('mhm-back', onBack, true);
  }, [inner, onClose]);

  const save = async () => {
    try {
      const r = await D.saveFile(bytes, name, mimeOf(name));
      if (r) toast(t.savedTo + ' ' + (r.where || ''));
    } catch (e) {
      toast('⚠️ ' + e.message);
    }
  };
  const share = () => D.shareFile(bytes, name, mimeOf(name), name).catch(() => {});
  const openOut = () => D.openFile(bytes, name, mimeOf(name)).catch((e) => toast('⚠️ ' + e.message));

  if (inner) return <FileViewer name={inner.name} bytes={inner.bytes} onClose={() => setInner(null)} />;
  return (
    <div className="file-viewer">
      <div className="topbar">
        <button className="icon-btn" onClick={onClose}><ArrowRight size={22} style={{ transform: document.documentElement.dir === 'rtl' ? 'none' : 'scaleX(-1)' }} /></button>
        <span className="badge" style={{ '--bc': kindColor(name), width: 32, height: 32, borderRadius: 10 }}><KindIcon name={name} size={16} /></span>
        <h1 className="ltr" style={{ fontSize: 15, textAlign: 'start' }}>{name}</h1>
        {(kind === 'md' || kind === 'html') && (
          <button className={'icon-btn' + (source ? ' active' : '')} title={t.viewSource} onClick={() => setSource(!source)}><Code size={20} /></button>
        )}
        {text && <button className="icon-btn" title={t.copy} onClick={() => copyText(text, t)}><Copy size={19} /></button>}
        <button className="icon-btn" title={t.saveFileTo} onClick={save}><Download size={20} /></button>
        <button className="icon-btn" title={t.share} onClick={share}><Share2 size={19} /></button>
        <button className="icon-btn hide-mobile" title={t.openExternal} onClick={openOut}><ExternalLink size={19} /></button>
      </div>
      <div className="viewer-body">
        {kind === 'md' && !source && <Markdown text={text} />}
        {kind === 'html' && !source && (
          <>
            <iframe className="html-frame" sandbox="" srcDoc={text} title={name} />
            <button className="chip-btn" style={{ margin: '10px auto', display: 'flex' }} onClick={openOut}><ExternalLink size={15} />{t.openInBrowser}</button>
          </>
        )}
        {(kind === 'text' || source) && <pre className="code-view" dir="ltr">{text}</pre>}
        {kind === 'zip' && <ZipList bytes={bytes} onOpen={(n, b) => setInner({ name: n, bytes: b })} />}
        {kind === 'image' && <img src={imgUrl} alt="" style={{ maxWidth: '100%', borderRadius: 12, display: 'block', margin: '0 auto' }} />}
        {kind === 'other' && (
          <div className="empty">
            <p>{t.cantPreview}</p>
            <button className="btn" onClick={openOut}><ExternalLink size={18} />{t.openExternal}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// global host so any screen can open the viewer
let current = null;
const ls = new Set();
export function showFile(name, bytes) {
  current = { name, bytes };
  ls.forEach((l) => l());
}
export function ViewerHost() {
  const v = useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => current);
  if (!v) return null;
  return (
    <FileViewer
      name={v.name}
      bytes={v.bytes}
      onClose={() => {
        current = null;
        ls.forEach((l) => l());
      }}
    />
  );
}
export { X };
