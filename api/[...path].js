// Fungsi serverless tunggal untuk SEMUA permintaan /api/* -- dirujuk secara EKSPLISIT lewat
// konfigurasi "routes" di vercel.json (bukan mengandalkan penamaan file otomatis), supaya
// path bertingkat seperti /api/akun/superadmin dijamin sampai ke sini dan diteruskan ke Express.
module.exports = require('./src/app');
