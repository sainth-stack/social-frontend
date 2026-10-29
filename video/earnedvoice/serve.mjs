import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.VIDEO_PORT || 3038);
const types = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.jpg': 'image/jpeg', '.json': 'application/json' };

createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep) || relative.startsWith('.') || !types[extname(path)]) { res.writeHead(404); res.end(); return; }
    const info = await stat(path);
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    const headers = { 'Content-Type': types[extname(path)], 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
    let start = 0, end = info.size - 1, code = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
      if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= info.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
      code = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    res.writeHead(code, { ...headers, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(path, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
}).listen(port, '127.0.0.1', () => console.log(`EarnedVoice film: http://127.0.0.1:${port}/`));