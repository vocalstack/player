import './styles.css';

export { VocalStackPlayer, type VocalStackPlayerProps, type PlayerSettings } from './ui/VocalStackPlayer';
export type { EndCardOptions } from './ui/EndCard';
export type { PlayerSource, TokenSource } from './data/context';
export type { ErrorLike } from './data/errors';
export { setErrorReporter } from './core/audio';
