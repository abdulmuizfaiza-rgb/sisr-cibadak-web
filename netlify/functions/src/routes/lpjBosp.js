const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// ============ SERTIFIKASI ============
router.get('/sertifikasi', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, p.nama_ptk AS nama_ptk_live, sk.nama_sekolah
      FROM sertifikasi s LEFT JOIN ptk p ON p.nrg = s.ptk_nrg LEFT JOIN sekolah sk ON sk.npsn = p.unit_kerja
      ORDER BY sk.nama_sekolah
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/sertifikasi', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO sertifikasi (ptk_nrg, kode_bidang_studi, nama_bidang_studi, tanggal_mulai_berlaku, nomor_peserta,
        nomor_sertifikat, nama_universitas, tahun_sertifikasi, naungan, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [d.ptk_nrg||null, d.kode_bidang_studi||null, d.nama_bidang_studi||null, d.tanggal_mulai_berlaku||null,
       d.nomor_peserta||null, d.nomor_sertifikat||null, d.nama_universitas||null, d.tahun_sertifikasi||null,
       d.naungan||null, d.sub_rayon_id||null, d.input_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.patch('/sertifikasi/:id', async (req, res) => {
  const kolom = ['ptk_nrg','kode_bidang_studi','nama_bidang_studi','tanggal_mulai_berlaku','nomor_peserta','nomor_sertifikat','nama_universitas','tahun_sertifikasi','naungan'];
  const updates = Object.keys(req.body).filter(k => kolom.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]); values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE sertifikasi SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.delete('/sertifikasi/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM sertifikasi WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ PENERIMAAN BOSP ============
router.get('/penerimaan-bosp', async (req, res) => {
  try {
    const { tahun_anggaran } = req.query;
    const { rows } = await pool.query(
      `SELECT pb.*, sk.nama_sekolah FROM penerimaan_bosp pb LEFT JOIN sekolah sk ON sk.npsn = pb.npsn
       WHERE ($1::text IS NULL OR pb.tahun_anggaran = $1) ORDER BY sk.nama_sekolah`,
      [tahun_anggaran || null]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/penerimaan-bosp', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO penerimaan_bosp (tahun_anggaran, npsn, kode_upb, jumlah_siswa, besaran_satuan, tahap1, tahap2,
        tunai1, tunai2, tunai3, tunai4, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [d.tahun_anggaran, d.npsn, d.kode_upb||null, d.jumlah_siswa||0, d.besaran_satuan||0,
       d.tahap1||0, d.tahap2||0, d.tunai1||0, d.tunai2||0, d.tunai3||0, d.tunai4||0, d.sub_rayon_id||null, d.input_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Sekolah ini sudah punya data Penerimaan BOSP di tahun anggaran ini.' });
    res.status(400).json({ error: err.message });
  }
});
router.patch('/penerimaan-bosp/:id', async (req, res) => {
  const kolom = ['kode_upb','jumlah_siswa','besaran_satuan','tahap1','tahap2','tunai1','tunai2','tunai3','tunai4'];
  const updates = Object.keys(req.body).filter(k => kolom.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]); values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE penerimaan_bosp SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============ BOSP ENTRIES (13 kategori LPJ BOSP, generik lewat kolom `kategori`) ============
router.get('/bosp-entries', async (req, res) => {
  try {
    const { kategori, triwulan, tahun_anggaran } = req.query;
    const { rows } = await pool.query(
      `SELECT be.*, sk.nama_sekolah FROM bosp_entries be LEFT JOIN sekolah sk ON sk.npsn = be.npsn
       WHERE ($1::text IS NULL OR be.kategori = $1) AND ($2::int IS NULL OR be.triwulan = $2) AND ($3::text IS NULL OR be.tahun_anggaran = $3)
       ORDER BY sk.nama_sekolah, be.tanggal`,
      [kategori || null, triwulan || null, tahun_anggaran || null]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/bosp-entries', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO bosp_entries (kategori, triwulan, tahun_anggaran, tanggal, npsn, uraian, volume, satuan, harga_satuan,
        kode_upb, nama_barang, merk_barang, asal_usul, keterangan, ptk_nrg, nuptk, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [d.kategori, d.triwulan, d.tahun_anggaran, d.tanggal||null, d.npsn||null, d.uraian||null, d.volume||0, d.satuan||null,
       d.harga_satuan||0, d.kode_upb||null, d.nama_barang||null, d.merk_barang||null, d.asal_usul||null, d.keterangan||null,
       d.ptk_nrg||null, d.nuptk||null, d.sub_rayon_id||null, d.input_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.patch('/bosp-entries/:id', async (req, res) => {
  const kolom = ['tanggal','npsn','uraian','volume','satuan','harga_satuan','kode_upb','nama_barang','merk_barang','asal_usul','keterangan','ptk_nrg','nuptk'];
  const updates = Object.keys(req.body).filter(k => kolom.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]); values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE bosp_entries SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.delete('/bosp-entries/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM bosp_entries WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
