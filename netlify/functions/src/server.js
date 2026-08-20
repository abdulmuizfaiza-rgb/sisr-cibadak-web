const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'terhubung' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Dipakai frontend untuk mendeteksi apakah aplikasi ini BARU DIINSTAL (belum ada akun sama sekali)
// -- kalau iya, tampilkan layar "Buat Akun Superadmin Pertama" alih-alih layar login biasa.
app.get('/api/setup-status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS jumlah FROM superadmin_account');
    res.json({ perluSetupAwal: rows[0].jumlah === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/sub-rayon', require('./routes/subRayon'));
app.use('/api/sekolah', require('./routes/sekolah'));
app.use('/api/operator', require('./routes/operator'));
app.use('/api/ptk', require('./routes/ptk'));
app.use('/api', require('./routes/lpjBosp'));
app.use('/api', require('./routes/pendukung'));
app.use('/api', require('./routes/adminData'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Kesalahan server internal.' });
});

const PORT = process.env.PORT || 4000;
const httpServer = app.listen(PORT, () => {
  console.log(`SISR Cibadak backend berjalan di http://localhost:${PORT}`);
});
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} sudah dipakai proses lain (kemungkinan sisa proses aplikasi ini yang belum benar-benar tertutup).`);
  } else {
    console.error('Gagal menyalakan server backend:', err.message);
  }
  // Kirim sinyal ke proses induk (Electron) supaya bisa menampilkan pesan error yang jelas ke pengguna,
  // alih-alih membiarkan proses crash diam-diam tanpa pesan apapun.
  if (process.send) { process.send({ type: 'backend-error', message: err.message, code: err.code }); }
  httpServer.emit('sisr-startup-failed', err);
});

module.exports = httpServer;
