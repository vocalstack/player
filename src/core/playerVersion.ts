import { PLAYER_VERSION } from '../version';

export const versionLine = (root: boolean): string | null => (root ? `Player ${PLAYER_VERSION}` : null);
