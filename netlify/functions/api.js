const serverless = require('serverless-http');
const app = require('./src/app');

// basePath di-strip supaya Express tidak perlu tahu soal awalan path internal Netlify Functions --
// permintaan publik "/api/sub-rayon" (setelah melalui redirect di netlify.toml) akan sampai ke sini
// sebagai "/.netlify/functions/api/sub-rayon", lalu basePath ini menghilangkan bagian depannya
// sehingga Express cukup mencocokkan "/sub-rayon" saja (lihat src/app.js).
exports.handler = serverless(app, { basePath: '/.netlify/functions/api' });
