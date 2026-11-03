import { useEffect, useRef, useState, type ReactNode } from 'react';

type Tile = { name: string; glyph: ReactNode; tint: string };

const fill = (d: string, rule: 'evenodd' | 'nonzero' = 'nonzero') => <path d={d} fill="currentColor" fillRule={rule} />;

const file = (ext: string): ReactNode => (
  <>
    <path d="M6.5 2.75h7.25l4.75 4.75v12.25a1.5 1.5 0 0 1-1.5 1.5H6.5a1.5 1.5 0 0 1-1.5-1.5V4.25a1.5 1.5 0 0 1 1.5-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M13.75 2.75V7.5h4.75" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <text x="11.75" y="17.4" textAnchor="middle" fontSize={ext.length > 3 ? 4.4 : 5.2} fontWeight="800" fill="currentColor" fontFamily="inherit" letterSpacing=".2">{ext}</text>
  </>
);

const TILES: Tile[] = [
  { name: 'YouTube', tint: '#ff3b30', glyph: fill('M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.1V8.9l5.3 3.1L10 15.1Z', 'evenodd') },
  { name: 'MP3', tint: '#f78472', glyph: file('MP3') },
  { name: 'Vimeo', tint: '#1ab7ea', glyph: fill('M22 7.4c-.1 2-1.5 4.7-4.2 8.1-2.8 3.6-5.1 5.4-7 5.4-1.2 0-2.2-1.1-3-3.3L6.2 11.6C5.6 9.4 5 8.3 4.3 8.3c-.1 0-.6.3-1.4.9L2 8l2.7-2.4C5.9 4.6 6.8 4 7.4 4c1.4-.1 2.3.9 2.6 2.9.4 2.2.6 3.6.8 4.1.4 1.8.9 2.7 1.4 2.7.4 0 1-.6 1.8-1.9.8-1.2 1.2-2.2 1.3-2.8.1-1.1-.3-1.6-1.3-1.6-.5 0-.9.1-1.4.3.9-3 2.7-4.5 5.3-4.4 1.9.1 2.8 1.3 2.7 3.7Z') },
  { name: 'Video', tint: '#55abe5', glyph: <><rect x="3" y="5.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />{fill('M16 10.2 21 7v10l-5-3.2v-3.6Z')}</> },
  { name: 'Twitch', tint: '#a970ff', glyph: fill('M5 2.5 3 6.5v13h4.5V22H10l2.5-2.5h3.8L21 14.8V2.5H5Zm14 11.4-2.9 2.9h-4.3L9.4 19.2v-2.4H6V4.5h13v9.4ZM15.2 7.4h1.9v5.2h-1.9V7.4Zm-5 0h1.9v5.2h-1.9V7.4Z', 'evenodd') },
  { name: 'WAV', tint: '#7ee0b4', glyph: file('WAV') },
  { name: 'SoundCloud', tint: '#ff7a1a', glyph: <>{fill('M11 8.6a5 5 0 0 1 7.8 3.1 3 3 0 0 1-.3 6H11V8.6Z')}<rect x="8.6" y="9.4" width="1.3" height="8.3" rx=".65" fill="currentColor" /><rect x="6.2" y="10.6" width="1.3" height="7.1" rx=".65" fill="currentColor" /><rect x="3.8" y="12.2" width="1.3" height="5.5" rx=".65" fill="currentColor" /><rect x="1.4" y="13.8" width="1.3" height="3.9" rx=".65" fill="currentColor" /></> },
  { name: 'MP4', tint: '#5b63d7', glyph: file('MP4') },
  { name: 'TikTok', tint: '#25f4ee', glyph: fill('M16.6 2.5c.3 2.3 1.7 3.8 3.9 4v2.7a6.8 6.8 0 0 1-3.9-1.3v6.5a5.7 5.7 0 1 1-5.7-5.7l.9.1v2.8a2.9 2.9 0 1 0 2 2.8V2.5h2.8Z') },
  { name: 'Audio', tint: '#f7c948', glyph: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 10.5v3M6.5 7.5v9M10 4.5v15M13.5 8v8M17 6v12M20.5 10v4" /></g> },
  { name: 'X', tint: '#e8eaf2', glyph: fill('M17.8 3h3.1l-6.7 7.7L22 21h-6.2l-4.8-6.3L5.5 21H2.4l7.2-8.2L2.1 3h6.3l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z') },
  { name: 'MOV', tint: '#55abe5', glyph: file('MOV') },
  { name: 'Facebook', tint: '#3b82f6', glyph: fill('M13.9 21.5v-8h2.7l.4-3.1h-3.1V8.4c0-.9.3-1.5 1.6-1.5H17V4.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.9v3.1h2.7v8h3.3Z') },
  { name: 'Podcast', tint: '#c46bff', glyph: <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="9" y="3" width="6" height="10.5" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></g> },
  { name: 'Instagram', tint: '#f56aa0', glyph: <g fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none" /></g> },
  { name: 'M4A', tint: '#f78472', glyph: file('M4A') },
  { name: 'Dailymotion', tint: '#4aa3ff', glyph: fill('M14.6 3.5h3.2V20h-3v-1.2a5.4 5.4 0 0 1-3.6 1.4c-3.3 0-5.9-2.7-5.9-6.1S7.9 8 11.2 8c1.3 0 2.5.4 3.4 1.2V3.5Zm-3.1 7.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z', 'evenodd') },
  { name: 'Radio', tint: '#7ee0b4', glyph: <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></g> },
  { name: 'WEBM', tint: '#5b63d7', glyph: file('WEBM') },
  { name: 'Loom', tint: '#8f7bff', glyph: fill('M21 11h-5.2l4.5-2.6-1-1.7-4.5 2.6 2.6-4.5-1.7-1-2.6 4.5V3h-2v5.3L8.5 3.8l-1.7 1 2.6 4.5-4.5-2.6-1 1.7L8.2 11H3v2h5.2l-4.5 2.6 1 1.7 4.5-2.6-2.6 4.5 1.7 1 2.6-4.5V21h2v-5.2l2.6 4.5 1.7-1-2.6-4.5 4.5 2.6 1-1.7-4.5-2.6H21v-2Zm-9 3.4a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z', 'evenodd') },
  { name: 'FLAC', tint: '#f7c948', glyph: file('FLAC') },
  { name: 'Live', tint: '#ff5a5a', glyph: <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="6" width="18" height="12" rx="3" /><circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" /><path d="M11.5 10h6M11.5 14h4" /></g> },
];

const ROWS = 14;
const COPIES = 4;

function row(i: number): Tile[] {
  const n = TILES.length;
  const out: Tile[] = [];
  for (let k = 0; k < 11; k++) out.push(TILES[(k + i * 7) % n]);
  return out;
}

function Cell({ t }: { t: Tile }) {
  return (
    <span className="vsp-prov__tile" style={{ ['--tint' as string]: t.tint }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">{t.glyph}</svg>
      <span className="vsp-prov__name">{t.name}</span>
    </span>
  );
}

export function ProviderGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(true);
  const [shown, setShown] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const vis = () => setShown(!document.hidden);
    document.addEventListener('visibilitychange', vis);
    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting));
      io.observe(el);
    }
    return () => { document.removeEventListener('visibilitychange', vis); io?.disconnect(); };
  }, []);
  return (
    <div ref={ref} className={`vsp-prov${seen && shown ? '' : ' vsp-prov--still'}`} aria-hidden="true">
      <div className="vsp-prov__plane">
        {Array.from({ length: ROWS }, (_, i) => {
          const cells = row(i);
          return (
            <div key={i} className={`vsp-prov__row${i % 2 ? ' vsp-prov__row--rev' : ''}`} style={{ animationDuration: `${80 + i * 11}s`, animationDelay: `-${i * 17}s` }}>
              {Array.from({ length: COPIES }, (_, c) => cells.map((t, k) => <Cell key={`${c}-${k}`} t={t} />))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
