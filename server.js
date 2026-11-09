// Servidor estático mínimo (sin dependencias): node server.js [puerto]
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = +process.env.PORT || +process.argv[2] || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.nes': 'application/octet-stream', '.css': 'text/css', '.png': 'image/png', '.map': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Contra en http://localhost:${port}/`));
