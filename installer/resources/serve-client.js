/**
 * OneSoft ERP — Client Static File Server
 * يعمل كـ Windows Service عبر NSSM
 * يخدم ملفات React المبنية على منفذ 5000
 */
'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT      = parseInt(process.env['ONESOFT_FRONTEND_PORT'] || '5000', 10);
const DIST_DIR  = path.join(__dirname, '..', 'dist');
const INDEX     = path.join(DIST_DIR, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf',
};

const server = http.createServer((req, res) => {
  let pathname = url.parse(req.url || '/').pathname || '/';

  // Health check endpoint
  if (pathname === '/health' || pathname === '/__health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT, timestamp: new Date().toISOString() }));
    return;
  }

  // محاولة خدمة الملف الثابت
  let filePath = path.join(DIST_DIR, pathname);

  // منع تجاوز المجلد
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback — أرسل index.html لجميع المسارات غير الموجودة
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(INDEX).pipe(res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[OneSoft-Client] يعمل على http://0.0.0.0:${PORT}`);
  console.log(`[OneSoft-Client] مجلد الملفات: ${DIST_DIR}`);
});

server.on('error', (err) => {
  console.error('[OneSoft-Client] خطأ:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  server.close(() => { console.log('[OneSoft-Client] توقف.'); process.exit(0); });
});
