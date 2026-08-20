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

module.exports = app;
