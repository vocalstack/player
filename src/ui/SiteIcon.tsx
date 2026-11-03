import type { CSSProperties } from 'react';
import type { Site } from '../core/sites';

export function SiteIcon({ site, size = 16, tinted = false, style, className }: { site: Site; size?: number; tinted?: boolean; style?: CSSProperties; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className} style={{ flex: 'none', display: 'block', color: tinted ? site.color : undefined, ...style }}>
      <path d={site.glyph} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
