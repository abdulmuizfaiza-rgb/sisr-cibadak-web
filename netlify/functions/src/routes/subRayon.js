const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET semua Sub Rayon + daftar kecamatan yang tercakup masing-masing
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sr.*, COALESCE(
        (SELECT array_agg(nama_kecamatan ORDER BY nama_kecamatan) FROM sub_rayon_kecamatan WHERE sub_rayon_id = sr.id),
        '{}'
      ) AS daftar_kecamatan
      FROM sub_rayon sr ORDER BY sr.nama_sub_rayon
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST tambah Sub Rayon baru -- daftar_kecamatan dikirim dari frontend (hasil pemetaan statis 8 Sub Rayon)
router.post('/', async (req, res) => {
  const { nama_sub_rayon, nama_ketua_sr, nip_ketua_sr, unit_kerja_ketua_sr, unit_sekretariat_sr, alamat_sekretariat_sr, daftar_kecamatan } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id, nama_ketua_sr FROM sub_rayon WHERE nama_sub_rayon = $1', [nama_sub_rayon]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `"${nama_sub_rayon}" sudah terdaftar dengan Ketua ${existing.rows[0].nama_ketua_sr}. Satu Nama Sub Rayon hanya boleh punya satu profil.` });
    }
    const insertSr = await client.query(
      `INSERT INTO sub_rayon (nama_sub_rayon, nama_ketua_sr, nip_ketua_sr, unit_kerja_ketua_sr, unit_sekretariat_sr, alamat_sekretariat_sr)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [nama_sub_rayon, nama_ketua_sr, nip_ketua_sr, unit_kerja_ketua_sr, unit_sekretariat_sr, alamat_sekretariat_sr]
    );
    const srId = insertSr.rows[0].id;
    for (const kec of (daftar_kecamatan || [])) {
      await client.query('INSERT INTO sub_rayon_kecamatan (sub_rayon_id, nama_kecamatan) VALUES ($1,$2)', [srId, kec]);
    }
    await client.query('COMMIT');
    res.status(201).json({ id: srId });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23514') return res.status(400).json({ error: 'NIP Ketua SR harus 18 digit angka.' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update Sub Rayon (tidak mengubah daftar kecamatan -- itu tetap ditentukan oleh peta statis 8 Sub Rayon)
router.put('/:id', async (req, res) => {
  const { nama_ketua_sr, nip_ketua_sr, unit_kerja_ketua_sr, unit_sekretariat_sr, alamat_sekretariat_sr } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE sub_rayon SET nama_ketua_sr=$1, nip_ketua_sr=$2, unit_kerja_ketua_sr=$3, unit_sekretariat_sr=$4, alamat_sekretariat_sr=$5
       WHERE id=$6 RETURNING *`,
      [nama_ketua_sr, nip_ketua_sr, unit_kerja_ketua_sr, unit_sekretariat_sr, alamat_sekretariat_sr, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Sub Rayon tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23514') return res.status(400).json({ error: 'NIP Ketua SR harus 18 digit angka.' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
