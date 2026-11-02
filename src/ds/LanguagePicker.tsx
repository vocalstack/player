import { useEffect, useMemo, useState } from 'react';
import { Sheet } from './Controls';
import { D, Icon, Spinner } from './Icons';
import { forgetRecentLang } from '../data/prefs';

export interface PickerLanguage {
  code: string;
  label: string;
  native: string;
  flag: string;
  voice?: boolean;
  live?: boolean;
}

export interface LanguageListProps { value: string | null; onSelect: (code: string | null) => void; languages: PickerLanguage[]; searchPlaceholder?: string; none?: string; pinned?: string[]; recent?: string[]; requireVoice?: boolean; keepOpen?: boolean; busy?: string | null }

export function useLanguageList({ open, onClose, value, onSelect, languages, searchPlaceholder = 'Search languages', none, pinned = [], recent = [], requireVoice, keepOpen, busy }: LanguageListProps & { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => { if (open) { setQ(''); setShowAll(false); setRefused(null); } }, [open]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? languages.filter((l) => l.label.toLowerCase().includes(needle) || l.native.toLowerCase().includes(needle) || l.code.toLowerCase().includes(needle))
      : languages;
    const ordered = [...list].sort((a, b) => {
      const pa = pinned.indexOf(a.code), pb = pinned.indexOf(b.code);
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
      return a.label.localeCompare(b.label);
    });
    return ordered;
  }, [languages, q, pinned]);
  const recents = useMemo(
    () => (q ? [] : recent.map((c) => filtered.find((l) => l.code === c)).filter((l): l is PickerLanguage => !!l).sort((a, b) => a.label.localeCompare(b.label))),
    [recent, filtered, q],
  );
  const rest = useMemo(() => (recents.length ? filtered.filter((l) => !recents.some((r) => r.code === l.code)) : filtered), [filtered, recents]);
  const shown = showAll || q ? rest : rest.slice(0, 12);
  const more = rest.length - shown.length;
  const row = (l: PickerLanguage, inRecent = false) => {
    const off = !!requireVoice && !l.voice;
    return (
      <button
        key={l.code}
        type="button"
        className={`vs-picker__row${off ? ' vs-picker__row--off' : ''}`}
        aria-selected={value === l.code}
        onClick={() => { if (off) { setRefused(l.code); return; } onSelect(l.code); if (!keepOpen) onClose(); }}
      >
        <span className="vs-picker__flag">{l.flag}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <div className="vs-picker__label">{l.label}</div>
          <div className="vs-picker__native">{l.native}</div>
        </span>
        <span className="vs-picker__slot">
          {inRecent && (
            <span className="vs-picker__forget" role="button" tabIndex={0} title={`Remove ${l.label} from recent`} aria-label={`Remove ${l.label} from recent`} onClick={(e) => { e.stopPropagation(); forgetRecentLang(l.code); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); forgetRecentLang(l.code); } }}>
              <Icon d={D.close} size={16} />
            </span>
          )}
        </span>
        <span className={`vs-picker__slot${off ? ' vs-picker__slot--wide' : ''}`} title={l.voice ? 'Voice available' : off ? 'No voice speaks this language yet' : undefined}>
          {off
            ? refused === l.code && <span className="vs-picker__off">UNAVAILABLE</span>
            : l.voice && <Icon d={D.headphones} size={16} />}
        </span>
        <span className="vs-picker__check">{value === l.code && (busy === l.code ? <Spinner size={15} color="var(--vs-link-hover)" track="var(--vs-border)" /> : <Icon d={D.check} size={16} sw={2.2} />)}</span>
      </button>
    );
  };
  const search = (
    <div className="vs-picker__search">
      <Icon d={D.search} size={16} sw={1.7} style={{ color: 'var(--vs-text-muted)' }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
    </div>
  );
  const list = (
    <div className="vs-picker__list">
      {none && !q && (
        <button type="button" className="vs-picker__row" data-vs-original="" aria-selected={value === null} onClick={() => { onSelect(null); if (!keepOpen) onClose(); }}>
          <span className="vs-picker__flag"><Icon d={D.mic} size={19} sw={1.6} style={{ color: 'var(--vs-text-muted)' }} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <div className="vs-picker__label">{none}</div>
            <div className="vs-picker__native">As spoken · no translation</div>
          </span>
          <span className="vs-picker__slot" />
          <span className="vs-picker__slot" />
          <span className="vs-picker__check">{value === null && <Icon d={D.check} size={16} sw={2.2} />}</span>
        </button>
      )}
      {recents.length > 0 && (
        <>
          <div className="vs-picker__head">RECENT</div>
          {recents.map((l) => row(l, true))}
          <div className="vs-picker__rule" />
        </>
      )}
      {shown.map((l) => row(l))}
      {more > 0 && (
        <button type="button" className="vs-picker__more" style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }} onClick={() => setShowAll(true)}>
          + {more} MORE LANGUAGES
        </button>
      )}
      {filtered.length === 0 && <div className="vs-picker__more">No match for “{q}”</div>}
    </div>
  );
  return { search, list };
}

export function LanguagePicker({ open, onClose, title, note, sticky, ...rest }: LanguageListProps & { open: boolean; onClose: () => void; title: string; note?: string; sticky?: boolean }) {
  const { search, list } = useLanguageList({ ...rest, open, onClose });
  return (
    <Sheet open={open} onClose={onClose} title={title} note={note} drawer={false} sticky={sticky} kind="picker" header={search}>
      {list}
    </Sheet>
  );
}
