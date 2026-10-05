import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const port = Number(process.argv[2] ?? 4610);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };

createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname).replace(/^\/+/, '') || 'timewaster.html';
  try {
    const body = await readFile(join('test/pages', name));
    res.writeHead(200, { 'content-type': types[extname(name)] ?? 'text/plain', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port);
