import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'output');
const work = join(root, '.render');
import {scenes,svg,cursor,W,H,fps} from './feature-scenes.mjs';

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

function soundtrack() {
  const sr = 48000, seconds = 60, n = sr * seconds;
  const left = new Float32Array(n), right = new Float32Array(n);
  const midi = m => 440 * 2 ** ((m - 69) / 12);
  const beat = 60 / 104;
  const progression = [[50, 57, 60, 64], [46, 53, 57, 60], [53, 60, 64, 67], [48, 55, 59, 62]];
  function tone(start, duration, freq, gain, pan, kind) {
    const begin = Math.floor(start * sr), end = Math.min(n, Math.floor((start + duration) * sr));
    for (let i = begin; i < end; i++) {
      const t = (i - begin) / sr, p = t / duration;
      let env, v;
      if (kind === 'pad') {
        env = Math.min(1, t / .7) * Math.min(1, (duration - t) / 1.2);
        v = (Math.sin(t * freq * Math.PI * 2) + .18 * Math.sin(t * freq * Math.PI * 4)) * env;
      } else if (kind === 'kick') {
        v = Math.sin(2 * Math.PI * (47 * t + 4 * (1 - Math.exp(-t * 35)))) * Math.exp(-t * 17);
      } else {
        env = Math.min(1, t / .012) * Math.exp(-t * 4.2) * Math.min(1, (1 - p) * 10);
        v = (Math.sin(t * freq * Math.PI * 2) + .18 * Math.sin(t * freq * Math.PI * 4)) * env;
      }
      left[i] += v * gain * Math.sqrt((1 - pan) / 2);
      right[i] += v * gain * Math.sqrt((1 + pan) / 2);
    }
  }
  for (let bar = 0; bar * beat * 4 < 60; bar++) {
    const notes = progression[bar % 4], start = bar * beat * 4;
    notes.forEach((m, j) => tone(start, beat * 4 + 1.3, midi(m), .063, (j - 1.5) * .35, 'pad'));
    if (start > 4 && start < 54) {
      for (let i = 0; i < 8; i++) tone(start + i * beat / 2, 1.2, midi(notes[[0, 2, 1, 3, 2, 1, 3, 2][i]] + 12), .065, Math.sin(i * 2) * .5, 'pluck');
      for (let i = 0; i < 4; i++) tone(start + i * beat, .3, 50, .15, 0, 'kick');
      tone(start, beat * 3.8, midi(notes[0] - 12), .10, 0, 'pad');
    }
  }
  const wav = Buffer.alloc(44 + n * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / sr / 2.5, (60 - i / sr) / 3.5);
    wav.writeInt16LE(Math.round(Math.tanh(left[i]) * fade * 29000), 44 + i * 4);
    wav.writeInt16LE(Math.round(Math.tanh(right[i]) * fade * 29000), 46 + i * 4);
  }
  return wav;
}
const timestamp = t => {
  const ms = Math.round(t * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

await mkdir(output, { recursive: true });
await mkdir(work, { recursive: true });
await sharp(Buffer.from(svg(''))).png().toFile(join(work, 'background.png'));
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${cursor(10, 5)}</svg>`)).png().toFile(join(work, 'cursor.png'));
let start = 0;
for (const scene of scenes) {
  scene.start = start;
  await writeFile(join(work, `${scene.id}.svg`), svg(scene.content()));
  await sharp(Buffer.from(svg(scene.content()))).png().toFile(join(work, `${scene.id}.png`));
  await sharp(Buffer.from(svg(scene.content(), false))).png().toFile(join(work, `${scene.id}-layer.png`));
  start += scene.duration - .5;
}
await sharp(join(work, '12-closing.png')).jpeg({ quality: 94 }).toFile(join(output, 'earnedvoice-poster.jpg'));
await writeFile(join(work, 'soundtrack.wav'), soundtrack());
await writeFile(join(output, 'earnedvoice-captions.vtt'), `WEBVTT\n\n${scenes.map((s, i) => `${i + 1}\n${timestamp(s.start)} --> ${timestamp(i === scenes.length - 1 ? 60 : scenes[i + 1].start - .001)}\n${s.caption}\n`).join('\n')}`);
await writeFile(join(output, 'scene-manifest.json'), JSON.stringify({ width: W, height: H, fps, duration: 60, illustrative: true, scenes: scenes.map(({ content, ...s }) => s) }, null, 2));
console.log('Scene artwork, poster, original soundtrack and captions created.');
if (process.argv.includes('--artwork-only')) process.exit(0);

for (const [i, s] of scenes.entries()) {
  const target = join(work, `${s.id}.mp4`);
  const frames = Math.round(s.duration * fps);
  const filters = [];
  const centered = i === 0 || i === scenes.length - 1;
  if (centered) {
    filters.push('[1:v]format=rgba,fade=t=in:st=0:d=0.65:alpha=1[art]');
    filters.push("[0:v][art]overlay=x=0:y='24*exp(-4*t)':eval=frame[stage]");
  } else {
    filters.push('[1:v]format=rgba,fade=t=in:st=0.10:d=0.55:alpha=1[art]');
    filters.push("[0:v][art]overlay=x='45*exp(-4.6*t)':y='12*sin(t*0.8)*min(t/2,1)':eval=frame[stage]");
  }
  const pointer = ({ 1: [1440, 646], 2: [1350, 709], 3: [1480, 750], 4: [1535, 730], 5: [1400, 680], 6: [1390, 691], 7: [1470, 710], 8: [1430, 720] })[i];
  let finalStage = 'stage';
  if (pointer) {
    filters.push('[2:v]format=rgba,fade=t=in:st=0.9:d=0.25:alpha=1[pointer]');
    filters.push(`[stage][pointer]overlay=x='${pointer[0]}+110*exp(-2.2*max(t-0.8,0))':y='${pointer[1]}+75*exp(-2.2*max(t-0.8,0))':eval=frame[interaction]`);
    finalStage = 'interaction';
  }
  filters.push(`[${finalStage}]scale=out_color_matrix=bt709,format=yuv420p,setsar=1[finished]`);
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y', '-loop', '1', '-framerate', String(fps), '-i', join(work, 'background.png'), '-loop', '1', '-framerate', String(fps), '-i', join(work, `${s.id}-layer.png`), '-loop', '1', '-framerate', String(fps), '-i', join(work, 'cursor.png'), '-filter_complex_threads', '2', '-filter_complex', filters.join(';'), '-map', '[finished]', '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-threads', '4', '-an', target]);
  console.log(`Rendered ${i + 1}/${scenes.length}: ${s.id}`);
}
const args = ['-hide_banner', '-loglevel', 'warning', '-y'];
for (const s of scenes) args.push('-i', join(work, `${s.id}.mp4`));
args.push('-i', join(work, 'soundtrack.wav'));
const filter = [];
scenes.forEach((_, i) => filter.push(`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS[v${i}]`));
let previous = 'v0';
for (let i = 1; i < scenes.length; i++) {
  filter.push(`[${previous}][v${i}]xfade=transition=fade:duration=0.5:offset=${scenes[i].start.toFixed(3)}[mix${i}]`);
  previous = `mix${i}`;
}
filter.push(`[${previous}]fade=t=in:st=0:d=0.45,fade=t=out:st=59.35:d=0.65,format=yuv420p[video]`);
filter.push(`[${scenes.length}:a]loudnorm=I=-18:TP=-2:LRA=9,aresample=48000[audio]`);
args.push('-filter_complex_threads', '2', '-filter_complex', filter.join(';'), '-map', '[video]', '-map', '[audio]', '-t', '60', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-threads', '4', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-metadata', 'title=EarnedVoice — Give Your Expertise a Voice', '-metadata', 'comment=Original illustrative product film. Not a recording of live publishing.', join(output, 'earnedvoice-product-film-1080p.mp4'));
await run('ffmpeg', args);
await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,avg_frame_rate,sample_rate,channels', '-of', 'json', join(output, 'earnedvoice-product-film-1080p.mp4')]);
console.log(`Finished: ${output}`);