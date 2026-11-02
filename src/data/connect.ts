export const DEFAULT_APP = 'https://app.vocalstack.com';

export interface Started { id: string; recordingId: string | null; token: string; expiresAt: string | null }

export async function startFromEmbed(appUrl: string | undefined, url: string): Promise<Started | null> {
  throw new Error('Not wired yet');
}
