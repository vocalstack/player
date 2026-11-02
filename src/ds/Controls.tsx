import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { D, Icon } from './Icons';

export function Card({ children, panel, inset, className = '', style }: { children: ReactNode; panel?: boolean; inset?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`vs-card${panel ? ' panel' : ''}${inset ? ' vs-card--inset' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="vs-toggle" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="vs-toggle__knob" />
    </button>
  );
}

export function TextField({ label, value, onChange, onKeyDown, type = 'text', placeholder, hint, error, mono, inputMode, autoComplete, ariaLabel }: { label?: string; value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; type?: string; placeholder?: string; hint?: ReactNode; error?: string; mono?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; autoComplete?: string; ariaLabel?: string }) {
  const id = useId();
  return (
    <div className={`vs-field${error ? ' vs-field--invalid' : ''}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} className={`vs-input${mono ? ' vs-input--mono' : ''}`} type={type} value={value} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete} aria-label={label ? undefined : ariaLabel} aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
      {error ? <span className="vs-field__error" role="alert">{error}</span> : hint ? <span className="vs-field__hint">{hint}</span> : null}
    </div>
  );
}

export interface SwitchOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export function Checkbox({ checked, indeterminate, disabled, label, title, size, onChange }: { checked?: boolean; indeterminate?: boolean; disabled?: boolean; label?: string; title?: string; size?: 'sm'; onChange?: (v: boolean) => void }) {
  const on = !!checked, mixed = !!indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : on}
      aria-disabled={disabled || undefined}
      aria-label={label ? undefined : title}
      title={title}
      className={`vs-check${size === 'sm' ? ' vs-check--sm' : ''}${disabled ? ' vs-check--disabled' : ''}`}
      onClick={disabled ? undefined : () => onChange?.(!on)}
    >
      <span className={`vs-check__box${mixed ? ' vs-check__box--mixed' : on ? ' vs-check__box--on' : ''}`}>
        {mixed ? <span className="vs-check__dash" /> : on ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4.5 12.75 6 6 9-13.5" /></svg>
        ) : null}
      </span>
      {label ? <span className="vs-check__label">{label}</span> : null}
    </button>
  );
}

export function Tooltip({ open, onDismiss, content, side = 'bottom', align = 'center', width, children }: { open: boolean; onDismiss: () => void; content: ReactNode; side?: 'top' | 'bottom'; align?: 'start' | 'center' | 'end'; width?: number; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => window.addEventListener('click', onDismiss, { once: true }), 0);
    return () => { clearTimeout(t); window.removeEventListener('click', onDismiss); };
  }, [open, onDismiss]);
  return (
    <span className="vs-tip">
      {children}
      {open && (
        <span className={`vs-tip__bubble vs-tip__bubble--${side} vs-tip__bubble--${align}`} style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
          <span className="vs-tip__row">
            <span className="vs-tip__copy">{content}</span>
            <button type="button" className="vs-tip__close" aria-label="Dismiss" onClick={onDismiss}><Icon d={D.close} size={12} sw={1.8} /></button>
          </span>
          <span className="vs-tip__arrow" />
        </span>
      )}
    </span>
  );
}

export function Switch<T extends string>({ value, onChange, options, size, bordered = true, fill }: { value: T; onChange: (v: T) => void; options: SwitchOption<T>[]; size?: 'sm'; bordered?: boolean; fill?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opt = el.querySelectorAll<HTMLElement>('.vs-switch__opt')[idx];
    if (opt) setThumb({ left: opt.offsetLeft, width: opt.offsetWidth });
  }, [idx, options.length]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const opt = el.querySelectorAll<HTMLElement>('.vs-switch__opt')[idx];
      if (opt) setThumb({ left: opt.offsetLeft, width: opt.offsetWidth });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [idx]);
  return (
    <div ref={ref} role="tablist" className={`vs-switch${size === 'sm' ? ' vs-switch--sm' : ''}${bordered ? '' : ' vs-switch--borderless'}${fill ? ' vs-switch--fill' : ''}`}>
      {thumb && <span className="vs-switch__thumb" style={{ left: thumb.left, width: thumb.width }} aria-hidden="true" />}
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className="vs-switch__opt" onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton({ children, onClick, label, size, variant, bordered = true, active, title }: { children: ReactNode; onClick?: () => void; label: string; size?: 'sm'; variant?: 'default' | 'primary'; bordered?: boolean; active?: boolean; title?: string }) {
  return (
    <button type="button" className={`vs-icon-btn${size === 'sm' ? ' vs-icon-btn--sm' : ''}${variant === 'primary' ? ' vs-icon-btn--primary' : ''}${active ? ' vs-icon-btn--primary' : ''}${bordered ? '' : ' vs-icon-btn--borderless'}`} onClick={onClick} aria-label={label} title={title ?? label}>
      {children}
    </button>
  );
}

export function LanguageChip({ flag, code, label, onClick, variant, block, bordered = true, size, style, flagOnly }: { flag: ReactNode; code: string; label?: string; onClick?: () => void; variant?: 'primary'; block?: boolean; bordered?: boolean; size?: 'sm'; style?: React.CSSProperties; flagOnly?: boolean }) {
  if (flagOnly) {
    return (
      <button type="button" className="vs-lang-chip vs-lang-chip--flag" onClick={onClick} aria-label={label ? (code ? `${label} (${code})` : label) : code || 'Language'} title={label ?? code} style={style}>
        <span className="vs-lang-chip__flag">{flag}</span>
      </button>
    );
  }
  const named = block && !!code;
  return (
    <button type="button" className={`vs-lang-chip${variant ? ` vs-lang-chip--${variant}` : ''}${block ? ' vs-lang-chip--block' : ''}${block && !named ? ' vs-lang-chip--bare' : ''}${bordered ? '' : ' vs-lang-chip--borderless'}${size === 'sm' ? ' vs-lang-chip--sm' : ''}`} onClick={onClick} aria-label={label ? (code ? `${label} (${code})` : label) : code} style={style}>
      {flag ? <span className="vs-lang-chip__flag">{flag}</span> : null}
      {named ? <span className="vs-lang-chip__name">{label ?? code}</span> : block ? null : <span className="vs-lang-chip__code">{code}</span>}
      <Icon d={D.chevronDown} size={13} className="vs-lang-chip__chevron" style={{ color: variant === 'primary' ? 'currentColor' : 'var(--vs-text-muted)' }} />
    </button>
  );
}

export function CopyButton({ value, label = 'Copy', onCopied }: { value: string; label?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1400);
    } catch {
    }
  };
  return (
    <button
      type="button"
      className="vs-copyable__btn"
      data-copied={copied}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onClick={(e) => { e.stopPropagation(); void copy(); }}
    >
      <span className="vs-sr" aria-live="polite">{copied ? `Copied${label.replace(/^Copy\b/, '')}` : ''}</span>
      {copied ? (
        <Icon d={D.check} size={13} sw={2.2} />
      ) : (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
        </svg>
      )}
    </button>
  );
}

export function Copyable({ value, label = 'Copy' }: { value: string; label?: string }) {
  const copy = () => { void navigator.clipboard?.writeText(value).catch(() => {}); };
  return (
    <span className="vs-copyable" onClick={copy} title={label}>
      <span className="vs-copyable__value">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  );
}

function useVisualViewportInset(ref: React.RefObject<HTMLDivElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    if (!open || !el || !vv) return;
    let focusTimer = 0;
    const apply = () => {
      if (getComputedStyle(el).position === 'static') return;
      const r = el.getBoundingClientRect();
      const top = Math.max(0, Math.round(vv.offsetTop - r.top));
      const bottom = Math.max(0, Math.round(r.bottom - (vv.offsetTop + vv.height)));
      el.style.paddingTop = top ? `${top}px` : '';
      el.style.paddingBottom = bottom ? `${bottom}px` : '';
      el.classList.toggle('kb', bottom > 0);
      const a = document.activeElement;
      if (bottom > 0 && a instanceof HTMLElement && el.contains(a)) {
        window.clearTimeout(focusTimer);
        focusTimer = window.setTimeout(() => a.scrollIntoView({ block: 'nearest' }), 0);
      }
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      window.clearTimeout(focusTimer);
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, [ref, open]);
}

export function GrowBox({ children, ms = 220 }: { children: ReactNode; ms?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    const box = outer.current;
    if (!el || !box) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const room = () => {
      const sheet = box.closest<HTMLElement>('.vs-sheet');
      const max = sheet ? parseFloat(getComputedStyle(sheet).maxHeight) : NaN;
      if (!sheet || !Number.isFinite(max)) return Infinity;
      return Math.max(0, max - (sheet.offsetHeight - box.offsetHeight));
    };
    const measure = () => {
      const full = el.offsetHeight;
      clearTimeout(settle);
      setH(Math.min(full, room()));
      if (full > room()) settle = setTimeout(() => setH(full), ms);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return () => clearTimeout(settle);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(settle); };
  }, [ms]);
  return (
    <div ref={outer} style={{ height: h ?? undefined, overflow: 'clip', transition: h == null ? undefined : `height ${ms}ms cubic-bezier(.32,.72,0,1)` }}>
      <div ref={inner}>{children}</div>
    </div>
  );
}

export function Sheet({ open, onClose, title, titleNode, note, doneLabel = 'Done', children, drawer = false, header, kind, sticky = false }: { open: boolean; onClose: () => void; title: string; titleNode?: ReactNode; note?: string; doneLabel?: string; children: ReactNode; drawer?: boolean; header?: ReactNode; kind?: string; sticky?: boolean }) {
  const scrimRef = useRef<HTMLDivElement>(null);
  useVisualViewportInset(scrimRef, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={scrimRef} className={`vs-sheet-scrim${drawer ? ' drawer' : ''}${sticky ? ' vs-sheet-scrim--sticky' : ''}`} onClick={sticky ? undefined : onClose}>
      <div className={`vs-sheet${kind ? ` vs-sheet--${kind}` : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="vs-sheet__grip" />
        <div className="vs-sheet__head">
          {titleNode ?? <span className="vs-sheet__title">{title}</span>}
          <button type="button" className="vs-sheet__done" onClick={onClose}>
            {doneLabel}
          </button>
        </div>
        {note && <div className="vs-sheet__note">{note}</div>}
        {header && <div className="vs-sheet__header">{header}</div>}
        <div className="vs-sheet__body">{children}</div>
      </div>
    </div>
  );
}

export interface ModalAction {
  label: string;
  variant?: 'primary' | 'danger' | 'ghost';
  onClick: () => void;
}

export function Modal({ open, onClose, title, body, actions = [], children, dismissible = true, zIndex, width, page }: { open: boolean; onClose: () => void; title?: string; body?: ReactNode; actions?: ModalAction[]; children?: ReactNode; dismissible?: boolean; zIndex?: number; width?: number; page?: boolean }) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);
  if (!open) return null;
  const scrim = (
    <div className="vs-modal-scrim" style={{ ...(zIndex != null ? { zIndex } : {}), ...(page ? { position: 'fixed' } : {}) }} onClick={dismissible ? onClose : undefined}>
      <div className="vs-modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()}>
        {title && <div className="vs-modal__title">{title}</div>}
        {body && <div className="vs-modal__body">{body}</div>}
        {children && <div className="vs-modal__content">{children}</div>}
        {actions.length > 0 && (
          <div className="vs-modal__actions">
            {actions.map((a, i) => (
              <button key={i} type="button" className={`vs-modal__action vs-modal__action--${a.variant ?? 'ghost'}`} onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  return page ? createPortal(<div className="vsp vsp-portal" data-theme={portalTheme()}>{scrim}</div>, document.body) : scrim;
}

export function LiveBadge({ state, label, size, tone }: { state: 'live' | 'paused' | 'ended' | 'starting' | 'idle'; label?: string; size?: 'sm'; tone?: 'muted' }) {
  const copy = label ?? { live: 'LIVE', paused: 'PAUSED', ended: 'ENDED', starting: 'STARTING', idle: 'IDLE' }[state];
  const cls = ['vs-live-badge', `vs-live-badge--${state === 'starting' || state === 'idle' ? 'ended' : state}`, tone === 'muted' ? 'vs-live-badge--muted' : '', size === 'sm' ? 'vs-live-badge--sm' : ''].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      <span className="vs-live-badge__slot">
        {state === 'paused' ? (
          <span className="vs-live-badge__bars">
            <span />
            <span />
          </span>
        ) : state === 'starting' ? (
          <span style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid var(--ink-22)', borderTopColor: 'var(--ink-70)', animation: 'vs-spin .8s linear infinite' }} />
        ) : state === 'idle' ? (
          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="var(--ink-50)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
        ) : (
          <span className="vs-live-badge__dot" />
        )}
      </span>
      <span className="vs-live-badge__label">{copy}</span>
    </span>
  );
}

let recordingSince: number | null = null;
const REC_PULSE_MS = 60_000;
function useRecPulse(recording: boolean): boolean {
  if (!recording) recordingSince = null;
  else if (recordingSince == null) recordingSince = Date.now();
  const left = recording && recordingSince != null ? REC_PULSE_MS - (Date.now() - recordingSince) : 0;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), left + 50);
    return () => window.clearTimeout(id);
  }, [recording, left > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return left > 0;
}
export function RecordButton({ state, onClick, size, disabled, label }: { state: 'idle' | 'connecting' | 'recording' | 'paused' | 'captured' | 'warming' | 'ended'; onClick?: () => void; size?: 'sm' | 'md'; disabled?: boolean; label?: string }) {
  const pulsing = useRecPulse(state === 'recording');
  if (state === 'ended') {
    return (
      <div className={`vs-rec vs-rec--ended${size === 'sm' ? ' vs-rec--sm' : size === 'md' ? ' vs-rec--md' : ''}`}>
        <button type="button" className="vs-rec__back" onClick={onClick} aria-label={label ?? 'Back'}>
          <Icon d={D.arrowLeft} size={20} />
        </button>
      </div>
    );
  }
  return (
    <div className={`vs-rec vs-rec--${state}${state === 'recording' && !pulsing ? ' vs-rec--still' : ''}${size === 'sm' ? ' vs-rec--sm' : ''}`}>
      <span className="vs-rec__ring" aria-hidden="true" />
      <button type="button" className="vs-rec__btn" onClick={onClick} disabled={disabled} aria-pressed={state === 'recording'} aria-label={label ?? (state === 'recording' ? 'Pause recording' : state === 'paused' ? 'Resume recording' : 'Start recording')}>
        <span className="vs-rec__fill" aria-hidden="true" />
        <Icon d={state === 'captured' || state === 'warming' ? D.check : D.mic} size={24} sw={state === 'captured' || state === 'warming' ? 2.4 : undefined} className="vs-rec__mic" />
      </button>
    </div>
  );
}

export const MenuBadge = createContext(0);
export function MenuBadgeDot() {
  const n = useContext(MenuBadge);
  if (n <= 0) return null;
  return <span className="menubadge" aria-label={`${n} unread notification${n === 1 ? '' : 's'}`}>{n > 99 ? '99+' : n}</span>;
}

export function ScreenHeader({ onBack, backLabel = 'Back', leading, center, centerAlign, onCenter, centerLabel, title, avatar, badge, subtitle, actions, onMenu, menuActive, showMenu = true, headerRef, frost }: { onBack?: () => void; backLabel?: string; leading?: ReactNode; center?: ReactNode; centerAlign?: 'start' | 'center'; onCenter?: () => void; centerLabel?: string; title?: string; avatar?: ReactNode; badge?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; onMenu?: () => void; menuActive?: boolean; showMenu?: boolean; headerRef?: React.Ref<HTMLDivElement>; frost?: boolean }) {
  const tappable = typeof onBack === 'function';
  return (
    <div className={`vs-hdr${frost ? ' vs-hdr--frost' : ''}`} ref={headerRef}>
      {tappable ? (
        <button type="button" className="vs-hdr__caret" onClick={(e) => { e.currentTarget.blur(); onBack?.(); }} aria-label={backLabel} title={backLabel}>
          <Icon d={D.chevronLeft} size={19} sw={1.7} />
        </button>
      ) : (
        leading ?? null
      )}
      {center ? (
        <div
          className={`vs-hdr__center${centerAlign === 'start' ? ' vs-hdr__center--start' : ''}${onCenter || tappable ? ' vs-hdr__center--tap' : ''}`}
          onClick={onCenter ?? (tappable ? onBack : undefined)}
          title={onCenter ? centerLabel : tappable ? backLabel : undefined}
        >
          {center}
        </div>
      ) : (
        <div className={`vs-hdr__title${tappable ? ' vs-hdr__title--tap' : ''}${avatar ? ' vs-hdr__title--av' : ''}`} onClick={tappable ? onBack : undefined} title={tappable ? backLabel : undefined}>
          <div className={`vs-hdr__name${avatar ? ' vs-hdr__name--av' : ''}`}>
            {avatar}
            <span className="vs-hdr__text">{title}</span>
            {badge}
          </div>
          {subtitle && <div className="vs-hdr__sub">{subtitle}</div>}
        </div>
      )}
      <div className="vs-hdr__actions">
        {actions}
        {showMenu && (
          <button type="button" className={`vs-icon-btn vs-icon-btn--sm vs-icon-btn--borderless has-badge${menuActive ? ' vs-icon-btn--primary' : ''}`} onClick={onMenu} aria-label="Options" title="Options">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5.5" r="1.85" />
              <circle cx="12" cy="12" r="1.85" />
              <circle cx="12" cy="18.5" r="1.85" />
            </svg>
            <MenuBadgeDot />
          </button>
        )}
      </div>
    </div>
  );
}

export function Eyebrow({ children, style, className }: { children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return <div className={className ? `eyebrow ${className}` : 'eyebrow'} style={style}>{children}</div>;
}

export function portalTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  const el = document.querySelector<HTMLElement>('.vsp:not(.vsp-portal)');
  return el?.dataset.theme === 'light' ? 'light' : 'dark';
}
