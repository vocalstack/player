import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { D, Icon } from '../ds/Icons';
import { useColW, useSidePins } from '../data/prefs';
import { TabBar, type TabSpec } from './shared';

export interface SideTabsOpts<K extends string> {
  tabs: TabSpec<K>[];
  tabbed?: boolean;
  pinnable?: K[];
  autoPin?: K[];
  forcePin?: K[];
  cur: K | 'none' | null;
  pref?: K;
  onPick: (k: K) => void;
}

export interface SidePanelState { show: boolean; pinned: boolean; order: number; pill: boolean; title: string; toggle: () => void }

export interface SideTabs<K extends string> {
  id: string;
  tabbed: boolean;
  cur: K | null;
  seq: K[];
  pinnable: K[];
  tabKeys: K[];
  stripTabs: TabSpec<K>[];
  panel: (k: K) => SidePanelState;
  pin: (k: K, at?: number) => void;
  unpin: (k: K) => void;
}

export function useSideTabs<K extends string>(id: string, o: SideTabsOpts<K>): SideTabs<K> {
  const [stored, setStored] = useSidePins(id);
  const keys = o.tabs.map((t) => t.key);
  const tabbed = o.tabbed !== false;
  const pinnable = o.pinnable ?? keys;
  let list = stored;
  [...(o.autoPin ?? [])].reverse().forEach((k) => { if (keys.includes(k) && !list.includes(k) && !list.includes(`!${k}`)) list = [k, ...list]; });
  const kept = list;
  (o.forcePin ?? []).forEach((k) => { list = list.filter((x) => x !== `!${k}`); if (keys.includes(k) && !list.includes(k)) list = [k, ...list]; });
  const forced = (k: string) => (o.forcePin ?? []).includes(k as K) && !kept.includes(k);
  const seq = tabbed ? (list.filter((k) => keys.includes(k as K) && pinnable.includes(k as K)) as K[]) : [];
  const tabKeys = keys.filter((k) => !seq.includes(k));
  const cur = o.cur && o.cur !== 'none' && tabKeys.includes(o.cur) ? o.cur : o.pref && tabKeys.includes(o.pref) ? o.pref : (tabKeys[0] ?? null);
  const after = (k: K) => { const rest = tabKeys.filter((x) => x !== k); return rest[tabKeys.indexOf(k)] ?? rest[rest.length - 1] ?? null; };
  const pin = (k: K, at?: number) => {
    if (!pinnable.includes(k)) return;
    const next = seq.filter((x) => x !== k);
    next.splice(at == null ? next.length : at, 0, k);
    if (cur === k) { const n = after(k); if (n) o.onPick(n); }
    setStored([...next.filter((x) => !forced(x) || x === k), ...kept.filter((x) => !next.includes(x as K) && x !== `!${k}`)]);
  };
  const unpin = (k: K) => {
    setStored([...kept.filter((x) => x !== k && x !== `!${k}`), ...((o.autoPin ?? []).includes(k) ? [`!${k}`] : [])]);
    o.onPick(k);
  };
  const label = (k: K) => o.tabs.find((t) => t.key === k)?.label ?? k;
  const panel = (k: K): SidePanelState => {
    const p = seq.includes(k), avail = keys.includes(k);
    return {
      show: avail && (!tabbed || p || cur === k), pinned: p, order: p ? seq.indexOf(k) + 1 : 1000,
      pill: tabbed && avail && pinnable.includes(k) && tabKeys.length > 0 && (p || tabKeys.length > 1),
      title: p ? `Unpin — return ${label(k)} to the tabs` : `Pin ${label(k)} open above the tabs`,
      toggle: () => (p ? unpin(k) : pin(k)),
    };
  };
  return { id, tabbed: tabbed && tabKeys.length > 1, cur, seq, pinnable, tabKeys, stripTabs: o.tabs.filter((t) => tabKeys.includes(t.key)), panel, pin, unpin };
}

export function SidePanels<K extends string>({ col, order, render, grip, onPick, wrapClass }: {
  col: SideTabs<K>; order: K[]; render: (k: K) => ReactNode; grip?: Partial<Record<K, number>>; onPick?: (k: K) => void;
  wrapClass?: (k: K, pinned: boolean) => string;
}) {
  usePanelGrip(col);
  return (
    <>
      {order.map((k) => {
        const p = col.panel(k);
        if (!p.show) return null;
        const body = render(k);
        if (!body) return null;
        return (
          <div key={k} data-panel-key={k} data-pinned={p.pinned ? 'true' : 'false'} className={`pinwrap sidepanel ${wrapClass?.(k, p.pinned) ?? ''}`} style={{ order: p.order, ['--grip-h' as string]: `${grip?.[k] ?? 30}px` }}>
            {body}
            {p.pill && <button type="button" data-pin-pill="" className={`pinpill${p.pinned ? ' is-on' : ''}`} title={p.title} aria-label={p.title} aria-pressed={p.pinned} onClick={p.toggle}><Icon d={D.pin} size={12} sw={2} /></button>}
          </div>
        );
      })}
      {col.tabbed && col.cur && (
        <div className="deskstrip" style={{ order: 999 }}>
          <TabBar tabs={col.stripTabs} current={col.cur} onPick={(k) => { if (k !== 'none') (onPick ?? (() => {}))(k); }} fold={false} />
        </div>
      )}
    </>
  );
}

function usePanelGrip<K extends string>(col: SideTabs<K>) {
  const live = useRef(col);
  live.current = col;
  const id = col.id;
  useEffect(() => {
    let hot: HTMLElement | null = null;
    type Drag = { el: HTMLElement; col: HTMLElement; key: K; x0: number; y0: number; on: boolean; px?: number; py?: number; raf?: number; clone?: HTMLElement;
      grid?: boolean; orig?: [HTMLElement, string][]; snap?: Record<string, DOMRect>; tabsSnap?: DOMRect | null; sig?: string; target?: { zone: 'pin' | 'tabs'; idx?: number } | null };
    let drag: Drag | null = null;
    const set = (w: HTMLElement | null) => {
      if (hot === w) return;
      if (hot) hot.removeAttribute('data-grip-hot');
      hot = w;
      if (w) w.setAttribute('data-grip-hot', '');
    };
    const tabsEl = (d: Drag) => d.col.querySelector<HTMLElement>('[data-desk-tabs]');
    const begin = (d: Drag) => {
      const r = d.el.getBoundingClientRect();
      const c = d.el.cloneNode(true) as HTMLElement;
      c.querySelectorAll<HTMLElement>('*').forEach((x) => { x.style.animation = 'none'; x.style.transition = 'none'; });
      c.querySelectorAll('iframe,video').forEach((f) => { const b = document.createElement('div'); b.style.cssText = 'width:100%;height:100%;background:#000'; f.replaceWith(b); });
      c.removeAttribute('data-panel-key');
      c.querySelectorAll('[data-panel-key],[data-pin-pill]').forEach((x) => (x.hasAttribute('data-pin-pill') ? x.remove() : x.removeAttribute('data-panel-key')));
      Object.assign(c.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '1000', pointerEvents: 'none', opacity: '.95', borderRadius: '14px', boxShadow: '0 14px 36px rgba(0,0,0,.3)', animation: 'none', transition: 'none', cursor: 'move', willChange: 'transform', contain: 'layout paint', overflow: 'hidden' });
      const cs = getComputedStyle(d.el);
      for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith('--')) c.style.setProperty(p, cs.getPropertyValue(p)); }
      c.style.fontFamily = cs.fontFamily; c.style.color = cs.color;
      let g: HTMLElement | null = d.el.parentElement, ground = '';
      while (g && !ground) { const bg = getComputedStyle(g).backgroundColor; if (bg && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg) && !/\/ 0\.|, 0\.\d+\)$/.test(bg)) ground = bg; g = g.parentElement; }
      c.style.background = ground || getComputedStyle(document.body).backgroundColor;
      document.body.appendChild(c);
      d.orig = [...d.col.querySelectorAll<HTMLElement>('[data-panel-key]')].map((x) => [x, x.style.order]);
      d.snap = {}; d.orig.forEach(([x]) => { d.snap![x.getAttribute('data-panel-key')!] = x.getBoundingClientRect(); });
      d.tabsSnap = tabsEl(d)?.getBoundingClientRect() ?? null;
      const pg = d.col.querySelector('[data-panel-grid]'); d.grid = !!pg && getComputedStyle(pg).display === 'grid';
      d.el.classList.add('is-dragging');
      document.documentElement.style.cursor = 'move'; document.body.style.userSelect = 'none'; document.body.style.webkitUserSelect = 'none';
      Object.assign(d, { on: true, clone: c });
      set(null);
    };
    const frame = () => {
      const d = drag;
      if (!d || !d.on || d.px == null || d.py == null) return;
      d.raf = 0;
      d.clone!.style.transform = `translate3d(${d.px - d.x0}px,${d.py - d.y0}px,0)`;
      const c = live.current, k = d.key, tabs = tabsEl(d);
      const pinned = c.seq.includes(k), canPin = pinned || c.tabKeys.length > 1;
      const tr = tabs && d.tabsSnap;
      const zone = !tr || d.py < tr.top + tr.height / 2 ? (canPin ? 'pin' : null) : 'tabs';
      let t: Drag['target'] = null;
      if (zone === 'pin') {
        const rs = c.seq.filter((x) => x !== k).map((x) => d.snap![x]).filter(Boolean);
        const idx = d.grid
          ? rs.filter((r) => r.bottom < d.py! || (r.top <= d.py! && r.left + r.width / 2 < d.px!)).length
          : rs.filter((r) => r.top + r.height / 2 < d.py!).length;
        if (!(pinned && c.seq.indexOf(k) === idx)) t = { zone, idx };
      } else if (zone === 'tabs' && pinned) t = { zone };
      const sig = t ? t.zone + (t.idx ?? '') : '';
      if (sig === d.sig) return;
      d.sig = sig; d.target = t;
      d.orig!.forEach(([x, o]) => { x.style.order = o; });
      if (t?.zone === 'pin') {
        const next = c.seq.filter((x) => x !== k); next.splice(t.idx!, 0, k);
        next.forEach((x, i) => { const n = d.col.querySelector<HTMLElement>(`[data-panel-key="${x}"]`); if (n) n.style.order = String(i + 1); });
      } else if (t?.zone === 'tabs') d.el.style.order = '998';
      if (tabs) { if (t?.zone === 'tabs') tabs.setAttribute('data-drop-hot', ''); else tabs.removeAttribute('data-drop-hot'); }
    };
    const end = (commit: boolean) => {
      const d = drag; drag = null;
      if (!d || !d.on) return;
      if (d.raf) cancelAnimationFrame(d.raf);
      d.clone!.remove(); d.orig!.forEach(([x, o]) => { x.style.order = o; });
      d.el.classList.remove('is-dragging');
      document.documentElement.style.cursor = ''; document.body.style.userSelect = ''; document.body.style.webkitUserSelect = '';
      tabsEl(d)?.removeAttribute('data-drop-hot');
      if (commit && d.target) { const c = live.current; if (d.target.zone === 'tabs') { if (c.seq.includes(d.key)) c.unpin(d.key); } else c.pin(d.key, d.target.idx); }
    };
    const myCol = (t: EventTarget | null) => { const el = t instanceof Element ? t.closest<HTMLElement>('[data-tab-col]') : null; return el && el.getAttribute('data-tab-col') === id ? el : null; };
    const onMove = (e: PointerEvent) => {
      if (drag) {
        if (!drag.on) { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return; begin(drag); }
        drag.px = e.clientX; drag.py = e.clientY;
        if (!drag.raf) drag.raf = requestAnimationFrame(frame);
        return;
      }
      const t = e.target as Element | null;
      if (!myCol(t)) { if (hot && hot.closest('[data-tab-col]')?.getAttribute('data-tab-col') === id) set(null); return; }
      const w = t!.closest<HTMLElement>('[data-panel-key]');
      const surf = w?.firstElementChild;
      if (!w || !surf || !live.current.tabbed || !live.current.pinnable.includes(w.getAttribute('data-panel-key') as K) || t!.closest('[role=button],[role=tab],button,a,input,textarea,select,iframe,[data-pin-pill],[contenteditable=true]')) return set(null);
      const r = surf.getBoundingClientRect(), h = parseFloat(getComputedStyle(w).getPropertyValue('--grip-h')) || 30;
      set(e.clientY >= r.top && e.clientY <= r.top + h ? w : null);
    };
    const onDown = (e: PointerEvent) => {
      if (!hot || e.button !== 0) return;
      const c = myCol(hot); if (!c) return;
      e.preventDefault(); e.stopImmediatePropagation();
      drag = { el: hot, col: c, key: hot.getAttribute('data-panel-key') as K, x0: e.clientX, y0: e.clientY, on: false };
    };
    const onUp = () => end(true);
    const onCancel = () => end(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && drag) { e.preventDefault(); e.stopImmediatePropagation(); end(false); } };
    const onLeave = () => { if (!drag) set(null); };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerleave', onLeave);
    return () => {
      end(false); set(null);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [id]);
}

export function SideFrame({ id, className, gap, hidden, plain, children }: { id: string; className: string; gap: number; hidden?: boolean; plain?: boolean; children: ReactNode }) {
  const [w, setW] = useColW(id);
  const col = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  useMasonry(grid);
  useEffect(() => { document.documentElement.style.setProperty('--colw', `${w}px`); }, [w]);
  const onGrip = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = col.current, row = el?.parentElement;
    if (e.button !== 0 || !el || !row) return;
    e.preventDefault();
    const g = e.currentTarget;
    const cs = getComputedStyle(row);
    const avail = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (parseFloat(cs.columnGap) || 0);
    const MIN = 320, CONTENT = 320, max = Math.max(MIN, avail - CONTENT);
    const x0 = e.clientX, w0 = el.getBoundingClientRect().width;
    let nw = w0;
    g.classList.add('is-on');
    const prev = { cur: document.body.style.cursor, sel: document.body.style.userSelect };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    const move = (ev: PointerEvent) => { nw = Math.round(Math.min(max, Math.max(MIN, w0 + (x0 - ev.clientX)))); el.style.flexBasis = `${nw}px`; document.documentElement.style.setProperty('--colw', `${nw}px`); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      document.body.style.cursor = prev.cur; document.body.style.userSelect = prev.sel; g.classList.remove('is-on');
      setW(nw);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const shown: CSSProperties | undefined = hidden ? { display: 'none' } : undefined;
  return (
    <>
      <div aria-hidden="true" className="colgrip" style={{ marginRight: -gap, ...shown }}>
        <div className="colgrip__bar" style={{ left: -(gap / 2 + 6) }} title="Drag to resize · double-click to reset" onPointerDown={onGrip} onDoubleClick={() => setW(null)} />
      </div>
      <div ref={col} data-tab-col={id} className={`${className} sidecol`} style={{ flex: `0 0 ${w}px`, ...shown }}>
        {plain ? children : <div ref={grid} data-panel-grid="" className="panelgrid">{children}</div>}
      </div>
    </>
  );
}

function useMasonry(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const GAP = 16;
    let raf = 0;
    const layout = () => {
      raf = 0;
      const on = getComputedStyle(g).display === 'grid';
      [...g.children].forEach((c) => {
        const el = c as HTMLElement;
        if (!on) { if (el.style.gridRowEnd) el.style.gridRowEnd = ''; return; }
        const h = el.getBoundingClientRect().height;
        const v = h > 0 ? `span ${Math.ceil(h + GAP)}` : 'span 1';
        if (el.style.gridRowEnd !== v) el.style.gridRowEnd = v;
      });
    };
    const mark = () => { if (!raf) raf = requestAnimationFrame(layout); };
    const ro = new ResizeObserver(mark);
    const watch = () => { ro.disconnect(); ro.observe(g); [...g.children].forEach((c) => ro.observe(c)); mark(); };
    const mo = new MutationObserver(watch);
    mo.observe(g, { childList: true });
    watch();
    return () => { ro.disconnect(); mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [ref]);
}
