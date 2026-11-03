export type VoiceWait = 'asked' | 'line' | null;

export function voiceWait(o: { on: boolean; want: boolean; relang: boolean; playing: boolean; preparing: boolean; starting: number | null | undefined }): VoiceWait {
  if (!o.on) return null;
  if (o.want || o.relang) return 'asked';
  if (o.playing && (o.preparing || o.starting != null)) return 'line';
  return null;
}

export const VOICE_WAIT_TITLE = 'Preparing the voice…';
