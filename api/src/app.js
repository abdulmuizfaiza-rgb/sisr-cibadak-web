const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/run-migration', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        login_background TEXT,
        sidebar_color TEXT,
        page_bg_color TEXT,
        font_color TEXT,
        font_size INT,
        logo TEXT,
        diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
    await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS dashboard_chart_config JSONB NOT NULL DEFAULT '{}'::jsonb;`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS informasi_popup (
        id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        aktif BOOLEAN NOT NULL DEFAULT false,
        ikon TEXT NOT NULL DEFAULT 'info',
        judul TEXT,
        pesan TEXT,
        diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`INSERT INTO informasi_popup (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
    await pool.query(`ALTER TABLE informasi_popup ADD COLUMN IF NOT EXISTS tanggal_tayang TIMESTAMPTZ;`);
    res.json({ status: 'ok', pesan: 'Tabel app_settings dan informasi_popup berhasil dibuat/dipastikan ada.' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const cek = await pool.query('SELECT current_database() AS db, inet_server_addr()::text AS host');
    const tabel = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='app_settings'");
    res.json({
      status: 'ok',
      database_terhubung: cek.rows[0].db,
      host_server: cek.rows[0].host,
      tabel_app_settings_ada: tabel.rows.length > 0,
    });
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
