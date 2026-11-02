import { createRoot } from 'react-dom/client';
import { VocalStackPlayer } from '../src';

const q = new URLSearchParams(location.search);
const src = q.get('src') || undefined;
const id = src || q.has('empty') ? undefined : q.get('id') || 'r4m4srrrhi24';
const settings = q.get('settings') ? JSON.parse(q.get('settings')!) : undefined;
const controls = q.get('controls') ? JSON.parse(q.get('controls')!) : undefined;
const api = q.get('api') || location.origin;
const mode = q.get('mode') === 'transcript' ? 'transcript' : 'video';

const embed = q.get('layout') !== 'page';

createRoot(document.getElementById('root')!).render(
  embed ? (
    <article style={{ maxWidth: 760, margin: '40px auto', padding: '0 16px', fontFamily: 'Georgia, serif', color: '#eee' }}>
      <h1>A blog post with a VocalStack player</h1>
      <p>Some text above the video, the way a host site would embed it.</p>
      <VocalStackPlayer id={id} src={src} baseUrl={api} mode={q.get('mode') ? mode : undefined} settings={settings} controls={controls} appUrl={q.get('app') || 'http://localhost:5176'} onSettingsChange={(s) => { (window as any).__settings = s; }} />
      <p>Some text below the video.</p>
    </article>
  ) : (
    <div style={{ height: '100%' }}>
      <VocalStackPlayer id={id} baseUrl={api} mode={q.get('mode') ? mode : undefined} layout="page" syncUrl />
    </div>
  ),
);
