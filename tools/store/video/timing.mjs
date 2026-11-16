// The timeline (timing.json) for the JavaScript side
import { readFileSync } from 'node:fs';
const T = JSON.parse(readFileSync(new URL('./timing.json', import.meta.url), 'utf8'));
export const FPS = T.fps;
export const SCENES = Object.fromEntries(T.scenes.map(s => [s.id, { ...s, frames: Math.ceil(s.beats * T.bar_frames / 4) + T.overlap }]));
