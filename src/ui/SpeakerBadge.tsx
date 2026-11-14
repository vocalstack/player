import type { CSSProperties, ReactNode } from 'react';

export type SpeakerBadgeProps = {
  name: ReactNode;
  initials: string;
  fg?: string | null;
  soft?: string | null;
  lane?: string | null;
  size?: 'sm' | 'md';
  unknown?: boolean;
  label?: string;
  children?: ReactNode;
};

export function speakerInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0] ?? '').join('').toUpperCase();
}

export function SpeakerBadge({ name, initials, fg, soft, lane, size = 'md', unknown, label, children }: SpeakerBadgeProps) {
  const tint = unknown ? undefined : ({
    '--spk': fg ?? (lane ? `var(--lane-${lane})` : 'var(--ink-45)'),
    '--spk-soft': soft ?? (lane ? `var(--lane-${lane}-soft)` : 'var(--fill-06)'),
  } as CSSProperties);
  return (
    <span className={`spkbadge spkbadge--${size}${unknown ? ' spkbadge--unknown' : ''}`} style={tint} aria-label={label}>
      <span className="spkbadge__dot" aria-hidden="true">{initials}</span>
      <span className="spkbadge__name">{name}</span>
      {children}
    </span>
  );
}

export function SpeakerBadgeMore({ count, size = 'md' }: { count: number; size?: 'sm' | 'md' }) {
  return <span className={`spkbadge spkbadge--${size} spkbadge--more`} aria-hidden="true">+{count}</span>;
}
