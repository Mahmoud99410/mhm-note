import { useEffect, useRef, useState } from 'react';
import { Undo2, Redo2, Bold, Palette, Type, List, ListChecks, ImagePlus, PaintBucket, Rows3, X, Trash2, Highlighter, FilePlus2, Pipette } from 'lucide-react';
import { useT, useSettings, isDark } from '../settings';
import * as V from '../vault';
import { PAGE_COLORS, TEXT_COLORS, FONT_SIZES, HIGHLIGHTS, fmtFull, pageStyle } from '../constants';
import { FileChips } from './Editors';
import { toast } from './ui';
import { Confirm } from './ui';
const isImage = (a) => a.w != null || (a.type || '').startsWith('image/');

const SENTINEL_COLOR = 'rgb(1, 2, 3)';

// ---- caret <-> text offset (so undo/redo can put the cursor back) ----
function getCaret(root) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !root.contains(sel.focusNode)) return null;
  const r = document.createRange();
  r.selectNodeContents(root);
  r.setEnd(sel.focusNode, sel.focusOffset);
  return r.toString().length;
}
function setCaret(root, n) {
  if (n == null) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  let left = n;
  while ((node = w.nextNode())) {
    if (left <= node.length) {
      const r = document.createRange();
      r.setStart(node, left);
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
    left -= node.length;
  }
  const r = document.createRange();
  r.selectNodeContents(root);
  r.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
function blockOf(root, node) {
  while (node && node.parentNode !== root) node = node.parentNode;
  return node && node !== root ? node : null;
}

function Gallery({ it, update }) {
  const t = useT();
  const [urls, setUrls] = useState({});
  const [view, setView] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const out = {};
      for (const a of (it.attachments || []).filter(isImage)) out[a.id] = await V.imageURL(a.id);
      if (live) setUrls(out);
    })();
    return () => (live = false);
  }, [it.attachments]);
  const imgs = (it.attachments || []).filter(isImage);
  if (!imgs.length) return null;
  return (
    <>
      <div className="hint" style={{ marginTop: 26, fontWeight: 700 }}>🔒 {t.images}</div>
      <div className="gallery">
        {imgs.map((a) => (
          <button key={a.id} onClick={() => setView(a)}>{urls[a.id] && <img src={urls[a.id]} alt="" />}</button>
        ))}
      </div>
      {view && (
        <div className="viewer">
          <div className="bar">
            <button className="icon-btn" onClick={() => setView(null)}><X size={24} /></button>
            <button className="icon-btn" onClick={() => setConfirm(true)}><Trash2 size={22} /></button>
          </div>
          <img src={urls[view.id]} alt="" />
        </div>
      )}
      {confirm && (
        <Confirm
          text={t.removeImage + '؟'}
          onClose={() => setConfirm(false)}
          onYes={async () => {
            await V.removeImage(view.id);
            update({ attachments: it.attachments.filter((x) => x.id !== view.id) });
            setView(null);
          }}
        />
      )}
    </>
  );
}

export default function NoteEditor({ it, update }) {
  const t = useT();
  const s = useSettings();
  const dark = isDark(s);
  const ref = useRef(null);
  const titleRef = useRef(null);
  const fileRef = useRef(null);
  const pdfRef = useRef(null);
  const customRef = useRef(null);
  const saved = useRef(null);
  const hist = useRef({ stack: [], idx: -1, timer: null });
  const syncTimer = useRef(null);
  const enterInTodo = useRef(false);
  const [pop, setPop] = useState(null);
  const [, rerender] = useState(0);

  // ---------- history ----------
  const commit = () => {
    const h = hist.current;
    clearTimeout(h.timer);
    h.timer = null;
    const html = ref.current.innerHTML;
    if (h.stack[h.idx]?.html === html) {
      if (h.stack[h.idx]) h.stack[h.idx].caret = getCaret(ref.current);
      return;
    }
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push({ html, caret: getCaret(ref.current) });
    if (h.stack.length > 300) h.stack.shift();
    h.idx = h.stack.length - 1;
    rerender((x) => x + 1);
  };
  const scheduleCommit = () => {
    clearTimeout(hist.current.timer);
    hist.current.timer = setTimeout(commit, 500);
  };
  const restore = (snap) => {
    ref.current.innerHTML = snap.html;
    ref.current.focus();
    setCaret(ref.current, snap.caret);
    sync(true);
    rerender((x) => x + 1);
  };
  const undo = () => {
    if (hist.current.timer) commit();
    const h = hist.current;
    if (h.idx > 0) restore(h.stack[--h.idx]);
  };
  const redo = () => {
    if (hist.current.timer) commit();
    const h = hist.current;
    if (h.idx < h.stack.length - 1) restore(h.stack[++h.idx]);
  };

  // ---------- sync to store ----------
  const sync = (now) => {
    clearTimeout(syncTimer.current);
    const go = () => update({ html: ref.current?.innerHTML ?? '' });
    if (now) go();
    else syncTimer.current = setTimeout(go, 250);
  };

  const fixTodos = () => {
    const root = ref.current;
    root.querySelectorAll('.box').forEach((b) => {
      if (!b.parentElement?.classList.contains('todo') || b.parentElement.firstChild !== b) b.remove();
    });
    root.querySelectorAll('.todo').forEach((d) => {
      if (d.firstChild?.classList?.contains('box')) return;
      if (enterInTodo.current) {
        d.dataset.done = '0';
        const sel = window.getSelection();
        const caretHere = sel.rangeCount && d.contains(sel.anchorNode);
        d.insertBefore(mkBox(), d.firstChild);
        if (caretHere) {
          // keep the cursor after the checkbox so typing doesn't swallow it
          const r = document.createRange();
          r.setStart(d, 1);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      } else {
        d.classList.remove('todo');
        delete d.dataset.done;
      }
    });
    enterInTodo.current = false;
  };
  const mkBox = () => {
    const b = document.createElement('span');
    b.className = 'box';
    b.contentEditable = 'false';
    return b;
  };

  useEffect(() => {
    ref.current.innerHTML = it.html || '';
    hist.current = { stack: [{ html: ref.current.innerHTML, caret: 0 }], idx: 0, timer: null };
    if (it.fresh) titleRef.current?.focus();
    const onSel = () => {
      const sel = window.getSelection();
      if (sel.rangeCount && ref.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      clearTimeout(syncTimer.current);
      const cur = V.getState().items.find((x) => x.id === it.id);
      if (ref.current && cur && cur.html !== ref.current.innerHTML) update({ html: ref.current.innerHTML });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // page colour applies to the whole screen (top bar too)
  const ps = pageStyle(it.pageColor, dark);
  const pageBg = ps?.bg || null;
  const pageText = ps?.text || null;
  useEffect(() => {
    const main = document.querySelector('.main');
    if (!main) return;
    if (pageBg) main.style.setProperty('--page', pageBg);
    else main.style.removeProperty('--page');
    if (pageText) main.style.setProperty('--page-text', pageText);
    else main.style.removeProperty('--page-text');
    return () => {
      main.style.removeProperty('--page');
      main.style.removeProperty('--page-text');
    };
  }, [pageBg, pageText]);

  // ---------- commands ----------
  const restoreSel = () => {
    ref.current.focus();
    if (saved.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
  };
  const after = () => {
    fixTodos();
    commit();
    sync(true);
  };
  const exec = (cmd, val = null, css = false) => {
    if (hist.current.timer) commit();
    restoreSel();
    document.execCommand('styleWithCSS', false, css);
    document.execCommand(cmd, false, val);
    after();
  };
  const hasSelection = () => saved.current && !saved.current.collapsed && ref.current.contains(saved.current.commonAncestorContainer);

  const setColor = (c) => {
    setPop(null);
    if (!hasSelection()) return;
    exec('foreColor', c || SENTINEL_COLOR, true);
    if (!c) {
      ref.current.querySelectorAll('[style*="color"]').forEach((el) => {
        if (el.style.color === SENTINEL_COLOR) el.style.removeProperty('color');
        if (!el.getAttribute('style')) el.removeAttribute('style');
      });
      ref.current.querySelectorAll('font[color]').forEach((el) => el.removeAttribute('color'));
      sync(true);
    }
  };
  const setSize = (px) => {
    setPop(null);
    if (!hasSelection()) {
      update({ fontSize: px });
      return;
    }
    if (hist.current.timer) commit();
    restoreSel();
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    ref.current.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    ref.current.querySelectorAll('span[style*="xxx-large"]').forEach((sp) => (sp.style.fontSize = px + 'px'));
    after();
  };
  const toggleTodo = () => {
    if (hist.current.timer) commit();
    restoreSel();
    const sel = window.getSelection();
    let block = blockOf(ref.current, sel.anchorNode);
    if (!block || block.nodeType !== 1) {
      document.execCommand('formatBlock', false, 'div');
      block = blockOf(ref.current, window.getSelection().anchorNode);
    }
    if (!block || block.nodeType !== 1) return;
    if (block.classList.contains('todo')) {
      block.classList.remove('todo');
      delete block.dataset.done;
      block.querySelector('.box')?.remove();
    } else {
      block.classList.add('todo');
      block.dataset.done = '0';
      block.insertBefore(mkBox(), block.firstChild);
    }
    const r = document.createRange();
    r.selectNodeContents(block);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
    after();
  };

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      sync(true);
      V.flush();
      return;
    }
    if (e.key === 'Enter') {
      commit();
      const block = blockOf(ref.current, window.getSelection().anchorNode);
      if (block?.classList?.contains('todo')) {
        if (!block.textContent.trim()) {
          e.preventDefault();
          block.classList.remove('todo');
          delete block.dataset.done;
          block.querySelector('.box')?.remove();
          if (!block.firstChild) block.appendChild(document.createElement('br'));
          after();
        } else enterInTodo.current = true;
      }
    }
  };
  const onInput = (e) => {
    fixTodos();
    if (e.nativeEvent?.inputType === 'insertParagraph' || e.nativeEvent?.data === ' ') commit();
    else scheduleCommit();
    sync(it.fresh);
  };
  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (hist.current.timer) commit();
    document.execCommand('insertText', false, text);
    after();
  };
  const onClick = (e) => {
    if (e.target.classList?.contains('box')) {
      const d = e.target.parentElement;
      d.dataset.done = d.dataset.done === '1' ? '0' : '1';
      after();
    }
  };
  const setHighlight = (c) => {
    setPop(null);
    if (!hasSelection()) return;
    exec('hiliteColor', c || 'transparent', true);
  };
  const onPdf = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const added = [];
    for (const f of files) {
      try {
        added.push(await V.addFile(f));
      } catch (err) {
        toast(err.message === 'TOO_BIG' ? t.fileTooBig : '⚠️ ' + err.message);
      }
    }
    if (added.length) update({ attachments: [...(it.attachments || []), ...added] });
  };
  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const added = [];
    for (const f of files) added.push(await V.addImage(f));
    update({ attachments: [...(it.attachments || []), ...added] });
  };

  const tb = (Icon, title, onClick, active, disabled) => (
    <button
      className={'icon-btn' + (active ? ' active' : '')}
      title={title}
      disabled={disabled}
      style={disabled ? { opacity: 0.35 } : null}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon size={20} />
    </button>
  );
  const h = hist.current;
  const fs = it.fontSize || 17;
  const lineColor = ps?.darkBg ? 'rgba(255,255,255,.09)' : dark ? 'rgba(255,255,255,.07)' : 'rgba(23,132,90,.13)';

  return (
    <div className="editor-wrap" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div className={'page' + (it.lines ? ' lines' : '')} style={{ '--fs': fs + 'px', '--line-color': lineColor }} onClick={() => setPop(null)}>
        <div className="page-inner">
          <input
            ref={titleRef}
            className="title-input"
            placeholder={t.title}
            value={it.title}
            onChange={(e) => update({ title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), ref.current.focus())}
          />
          <div className="edit-meta">
            <span>🕒 {t.createdAt}: {fmtFull(it.createdAt, s.lang)}</span>
            <span>✎ {t.modifiedAt}: {fmtFull(it.updatedAt, s.lang)}</span>
          </div>
          <div
            ref={ref}
            className="rte"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder={t.startWriting}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onClick={onClick}
            onBlur={() => { if (hist.current.timer) commit(); sync(true); }}
          />
          <Gallery it={it} update={update} />
          <FileChips it={it} update={update} />
        </div>
      </div>

      {pop === 'color' && (
        <div className="popover" onMouseDown={(e) => e.preventDefault()}>
          <h4>{t.textColor}</h4>
          <div className="swatches">
            {TEXT_COLORS.map((c, i) => (
              <button key={i} className="swatch" style={{ background: c || 'var(--text)' }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
      )}
      {pop === 'size' && (
        <div className="popover" onMouseDown={(e) => e.preventDefault()}>
          <h4>{t.fontSize}</h4>
          <div className="size-row">
            {FONT_SIZES.map((px) => (
              <button key={px} className={!hasSelection() && fs === px ? 'on' : ''} onClick={() => setSize(px)} style={{ fontSize: Math.min(px, 22) }}>
                {px}
              </button>
            ))}
          </div>
        </div>
      )}
      {pop === 'hl' && (
        <div className="popover" onMouseDown={(e) => e.preventDefault()}>
          <h4>{t.highlight}</h4>
          <div className="swatches">
            <button className="swatch" title={t.noHighlight} style={{ background: 'var(--surface)', display: 'grid', placeItems: 'center' }} onClick={() => setHighlight(null)}><X size={16} /></button>
            {HIGHLIGHTS.map((c) => <button key={c} className="swatch" style={{ background: c }} onClick={() => setHighlight(c)} />)}
          </div>
        </div>
      )}
      {pop === 'page' && (
        <div className="popover" onMouseDown={(e) => e.preventDefault()}>
          <h4>{t.pageColor}</h4>
          <div className="swatches">
            {PAGE_COLORS.map((p) => (
              <button
                key={p.id}
                className={'swatch' + ((it.pageColor || 'default') === p.id ? ' on' : '')}
                style={{ background: p.id === 'default' ? 'var(--surface)' : pageStyle(p.id, dark).bg }}
                onClick={() => update({ pageColor: p.id })}
              />
            ))}
            <button
              className={'swatch custom' + (it.pageColor?.startsWith('#') ? ' on' : '')}
              title={t.customColor}
              style={it.pageColor?.startsWith('#') ? { background: it.pageColor } : null}
              onClick={() => customRef.current.click()}
            >
              <Pipette size={16} />
            </button>
            <input ref={customRef} type="color" hidden value={it.pageColor?.startsWith('#') ? it.pageColor : '#ffe9a8'} onChange={(e) => update({ pageColor: e.target.value })} />
          </div>
          <button className="menu-item" style={{ marginTop: 10 }} onClick={() => update({ lines: !it.lines })}>
            <Rows3 size={20} /> <span className="grow">{t.pageLines}</span>
            <span className="chip-btn" style={{ height: 28 }}>{it.lines ? '✓' : '—'}</span>
          </button>
        </div>
      )}

      <div className="toolbar">
        {tb(Undo2, t.undo, undo, false, h.idx <= 0 && !h.timer)}
        {tb(Redo2, t.redo, redo, false, h.idx >= h.stack.length - 1)}
        <span className="sep" />
        {tb(Bold, t.bold, () => exec('bold'))}
        {tb(Palette, t.textColor, () => setPop(pop === 'color' ? null : 'color'), pop === 'color')}
        {tb(Highlighter, t.highlight, () => setPop(pop === 'hl' ? null : 'hl'), pop === 'hl')}
        {tb(Type, t.fontSize, () => setPop(pop === 'size' ? null : 'size'), pop === 'size')}
        {tb(List, t.list, () => exec('insertUnorderedList'))}
        {tb(ListChecks, t.checklist, toggleTodo)}
        <span className="sep" />
        {tb(ImagePlus, t.addImage, () => fileRef.current.click())}
        {tb(FilePlus2, t.attachPdf, () => pdfRef.current.click())}
        {tb(PaintBucket, t.pageColor, () => setPop(pop === 'page' ? null : 'page'), pop === 'page')}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <input ref={pdfRef} type="file" accept="*/*" multiple hidden onChange={onPdf} />
    </div>
  );
}
