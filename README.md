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
| `id` | required | A share code. Or, with `token`, a transcription id. |
| `token` | none | A browser token (or a function returning one) for a private transcription. Never pass an API key to a browser. |
| `mode` | `'video'` | `'video'` for the full player, `'transcript'` for the reading view with a player. |
| `layout` | `'embed'` | `'embed'` sizes to its container (16:9 for video); `'page'` fills the page. |
| `initial` | none | `{ lang, cc, translateAudio, clonedVoices, removeBackground, labels, words, startAt }` |
| `endCard` | on | At the end of a video, offers to transcribe another link in the visitor's own VocalStack account. Pass `false` to turn it off. |
| `baseUrl` | `https://api.vocalstack.com` | |
| `onSource`, `onProgress`, `onError` | none | Callbacks for the loaded transcription, the transcription progress (0-100, `null` when done), and errors. |

Theme it by overriding the CSS variables on `.vsp`, for example `--vsp-radius`, `--brand` and `--vs-font-sans`.

## License

MIT
