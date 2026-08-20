// Vercel secara otomatis mengubah setiap file di dalam folder /api menjadi fungsi serverless.
// Nama file "[...path].js" berarti "tangkap semua path" -- jadi permintaan apapun ke /api/xxx/yyy
// akan sampai ke sini, lalu diteruskan ke aplikasi Express yang sama (lihat src/app.js).
// Berbeda dengan versi Netlify, di sini TIDAK perlu serverless-http karena Vercel Node.js runtime
// bisa langsung menerima aplikasi Express sebagai handler (req, res).
module.exports = require('./src/app');
