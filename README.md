# @vocalstack/player

A React video and transcript player for [VocalStack](https://vocalstack.com) transcriptions. It shows subtitles, a synced transcript, and spoken translations read in the speakers' own (cloned) or stock voices. It can also remove the background sound. It talks only to the public VocalStack API.

```bash
npm install @vocalstack/player
```

```tsx
import { VocalStackPlayer } from '@vocalstack/player';
import '@vocalstack/player/style.css';

export function Video() {
  return <VocalStackPlayer id="r4m4srrrhi24" mode="video" />;
}
```

`id` is the share code from a VocalStack share link (`vocalstack.com/v/<code>`). Shared transcriptions need no key.

## Props

| Prop | Default | |
|---|---|---|
| `id` | | A share code. Or, with `token`, a transcription id. With neither `id` nor `src`, the player opens on a box where the visitor pastes any video link and transcribes it in their own VocalStack account. |
| `src` | | A video or audio link (YouTube, Vimeo, an mp3 or any media URL) instead of `id`. If the visitor has already transcribed it with VocalStack, it plays. If not, they are asked whether to start transcribing it. With `token`, the link is looked up in that account instead. |
| `token` | | A browser token (or a function returning one) for a private transcription. Never pass an API key to a browser. |
| `mode` | `'video'` | `'video'` for the full player, `'transcript'` for the reading view with a player. |
| `layout` | `'embed'` | `'embed'` sizes to its container (16:9 for video). `'page'` fills the page. |
| `settings` | | Settings you control. Changing a value updates the player. See below. |
| `initial` | | The same settings, applied once at the start. The viewer can change them afterwards. |
| `onSettingsChange` | | Called with all the settings whenever the viewer changes one. |
| `controls` | all on | `{ language, subtitles, audio, export, share, fullscreen, settings }`. Pass `false` to hide one. |
| `autoplay` | `true` | Starts muted where the browser requires it. |
| `startAt` | | Start time in seconds. |
| `endCard` | on | At the end of a video, offers to transcribe another link in the visitor's own VocalStack account. Pass `false` to turn it off. |
| `baseUrl` | `https://api.vocalstack.com` | |
| `onSource`, `onProgress`, `onError` | | Called with the loaded transcription, the transcription progress (0-100, `null` when done), and errors. |
| `onPlayback` | | Called about ten times a second while anything changes, with `{ t, dur, playing, idx, seekN, lang }`: the time in seconds, the length, whether it plays, the index of the current line, a counter that grows on every seek, and the language shown. |
| `ref` | | A `PlayerHandle`: `seek(t)`, `play()`, `pause()`, `toggle()`. |
| `compact` | `false` | Small controls at any width, and no title, summary or share card when paused. For a player inside a side column or card. |
| `poster` | | An image shown behind the player before a video is chosen or before the visitor connects. |

### Settings

```ts
{
  lang?: string | null;          // translate into this language code; null = as spoken
  subtitles?: boolean;           // captions over the video
  speakerLabels?: boolean;       // who is speaking, before each line
  wordHighlight?: boolean;       // follow each word as it is spoken
  translateAudio?: boolean;      // hear the translation read aloud
  voices?: 'cloned' | 'synthetic';
  removeBackground?: boolean;    // play only the speech
}
```

```tsx
<VocalStackPlayer
  id="r4m4srrrhi24"
  settings={{ lang: 'es', speakerLabels: true, voices: 'cloned' }}
  controls={{ export: false, share: false }}
  onSettingsChange={(s) => console.log(s)}
/>

<VocalStackPlayer src="https://www.youtube.com/watch?v=QWCLiPOgeuw" />
```

Follow and drive it from your page:

```tsx
const player = useRef<PlayerHandle>(null);
<VocalStackPlayer ref={player} id="r4m4srrrhi24" onPlayback={(s) => setAt(s.t)} />
<button onClick={() => player.current?.seek(42)}>Jump to 0:42</button>
```

Theme it by overriding the CSS variables on `.vsp`, for example `--vsp-radius`, `--brand` and `--vs-font-sans`.

## License

MIT
