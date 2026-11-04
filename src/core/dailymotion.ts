export const DAILYMOTION_PLAYER = 'x8lr5';

const PLAYER_ID = /^x[a-z0-9]{2,}$/i;

export function dailymotionPlayerId(id: string | null | undefined): string {
  const v = id?.trim();
  return v && PLAYER_ID.test(v) ? v : DAILYMOTION_PLAYER;
}

export function dailymotionLib(player?: string | null): string {
  return `https://geo.dailymotion.com/libs/player/${dailymotionPlayerId(player)}.js`;
}

export function dailymotionFrame(video: string, at: { t: number; play: boolean; player?: string | null }): string {
  const q = new URLSearchParams({ video, mute: 'true', startTime: String(Math.max(0, Math.floor(at.t))) });
  if (at.play) q.set('autoplay', 'true');
  return `https://geo.dailymotion.com/player/${dailymotionPlayerId(at.player)}.html?${q}`;
}

export interface DmState { videoTime?: number; playerIsPlaying?: boolean; adIsPlaying?: boolean; videoId?: string | null; videoDuration?: number; playerIsReplayScreen?: boolean; playerIsMuted?: boolean; playerVolume?: number; playerIsBuffering?: boolean }

export type DmStep = { kind: 'none' } | { kind: 'reload' } | { kind: 'play' } | { kind: 'pause' } | { kind: 'seek'; to: number };

export function dmStep(s: DmState, want: { video: string; t: number; playing: boolean; settling?: boolean }, over = 1.5): DmStep {
  if (s.adIsPlaying) return { kind: 'none' };
  if (s.videoId && s.videoId !== want.video) return { kind: 'reload' };
  if (!want.playing) return s.playerIsPlaying ? { kind: 'pause' } : { kind: 'none' };
  const to = Math.max(0, want.t);
  if (s.videoDuration && to >= s.videoDuration - 0.5) return s.playerIsPlaying ? { kind: 'pause' } : { kind: 'none' };
  if (s.playerIsBuffering || want.settling) return { kind: 'none' };
  if (typeof s.videoTime === 'number' && Math.abs(s.videoTime - to) > over) return { kind: 'seek', to };
  return s.playerIsPlaying && !s.playerIsReplayScreen ? { kind: 'none' } : { kind: 'play' };
}

export function dmLoud(s: DmState | null | undefined): boolean {
  return !!s && (s.playerIsMuted === false || (typeof s.playerVolume === 'number' && s.playerVolume > 0));
}
