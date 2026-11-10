export type VoiceWait = 'asked' | 'line' | null;

export function voiceWait(o: { on: boolean; want: boolean; relang: boolean; playing: boolean; preparing: boolean; starting: number | null | undefined }): VoiceWait {
  if (!o.on) return null;
  if (o.want || o.relang) return 'asked';
  if (o.playing && (o.preparing || o.starting != null)) return 'line';
  return null;
}

export const VOICE_WAIT_TITLE = 'Preparing the voice…';

export type WaitKind = 'translating' | 'voice' | 'starting' | 'voiceFailed' | 'translateFailed';

export function softWaitOf(o: { videoLed: boolean; wait: WaitKind | null | undefined; relang: boolean }): boolean {
  return o.videoLed && (o.wait === 'translating' || (o.wait === 'voice' && o.relang));
}

export function holdsClock(o: { timeline: boolean; videoLed: boolean; voiceOn: boolean; starting: number | null; wait: WaitKind | null | undefined; relang: boolean; coming?: boolean }): boolean {
  if (!o.timeline || o.videoLed || !o.voiceOn) return false;
  return o.starting != null || !!o.coming || o.wait === 'translating' || (o.wait === 'voice' && o.relang);
}
