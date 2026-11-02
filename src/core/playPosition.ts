export interface PlaySlot { sentenceId?: number | null; start: number }

export interface PlayPos {
  t: number;
  playing: boolean;
  sentenceId: number | null;
  offset: number;
  ended: boolean;
}

export interface PlayPlace { t: number; playing: boolean; index: number }

const EPS = 0.05;

const indexAt = (rows: readonly PlaySlot[], t: number): number => {
  let i = 0;
  for (let k = 0; k < rows.length; k++) if (rows[k].start <= t + 1e-6) i = k;
  return i;
};

export function snapPosition(rows: readonly PlaySlot[], t: number, playing: boolean, dur: number): PlayPos {
  const at = Math.max(0, t);
  const ended = dur > 0 && at >= dur - EPS;
  const i = rows.length && rows[0].start <= at + 1e-6 ? indexAt(rows, at) : -1;
  if (i < 0) return { t: at, playing: playing && !ended, sentenceId: null, offset: 0, ended };
  return { t: at, playing: playing && !ended, sentenceId: rows[i].sentenceId ?? null, offset: Math.max(0, at - rows[i].start), ended };
}

export function placePosition(pos: PlayPos, rows: readonly PlaySlot[], dur: number): PlayPlace {
  const end = Math.max(0, dur);
  if (pos.ended) return { t: end, playing: false, index: Math.max(0, rows.length - 1) };
  const j = pos.sentenceId == null ? -1 : rows.findIndex((r) => r.sentenceId === pos.sentenceId);
  let t = pos.t;
  if (j >= 0) {
    const from = rows[j].start;
    const len = Math.max(0, Math.min(rows[j + 1]?.start ?? end, end) - from);
    t = from + Math.min(pos.offset, Math.max(0, len - EPS));
  }
  t = Math.max(0, Math.min(end, t));
  const atEnd = end > 0 && t >= end - EPS && j < 0;
  return { t, playing: pos.playing && !atEnd, index: j >= 0 ? j : indexAt(rows, t) };
}
