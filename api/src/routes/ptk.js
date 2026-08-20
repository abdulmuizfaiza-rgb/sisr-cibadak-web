const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const KOLOM_DIIZINKAN = ['nuptk','nik','nama_ptk','jenis_kelamin','tempat_lahir','tanggal_lahir','nip','status_kepegawaian',
  'nama_jabatan','pangkat','golongan','gaji_pokok','status_ptk','unit_kerja','tmt_mengajar','tmt_sekolah_induk',
  'mata_pelajaran_diampu','jumlah_jam_mengajar','npwp','jenjang_pendidikan','jurusan_pendidikan_terakhir','tahun_lulus',
  'status_keaktifan','status_ptk_dapodik','alasan_tidak_aktif','jabatan_tugas_tambahan'];

function validasiNipPtk(body) {
  const bolehStrip = ['GTT','GTY','Honorer'].includes(body.status_kepegawaian);
  if (body.nip && body.nip !== '-' && !/^[0-9]{18}$/.test(body.nip) && !bolehStrip) {
    return 'NIP harus 18 digit angka.';
  }
  if (body.nip === '-' && !bolehStrip) {
    return "NIP hanya boleh '-' untuk status kepegawaian GTT/GTY/Honorer.";
  }
  return null;
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, sk.nama_sekolah FROM ptk p LEFT JOIN sekolah sk ON sk.npsn = p.unit_kerja ORDER BY sk.nama_sekolah, p.nama_ptk
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const d = req.body;
  const errNip = validasiNipPtk(d);
  if (errNip) return res.status(400).json({ error: errNip });
  try {
    const { rows } = await pool.query(
      `INSERT INTO ptk (nrg, nuptk, nik, nama_ptk, jenis_kelamin, tempat_lahir, tanggal_lahir, nip, status_kepegawaian,
        nama_jabatan, pangkat, golongan, gaji_pokok, status_ptk, unit_kerja, tmt_mengajar, tmt_sekolah_induk,
        mata_pelajaran_diampu, jumlah_jam_mengajar, npwp, jenjang_pendidikan, jurusan_pendidikan_terakhir, tahun_lulus,
        status_keaktifan, status_ptk_dapodik, alasan_tidak_aktif, jabatan_tugas_tambahan, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
      [d.nrg, d.nuptk||null, d.nik||null, d.nama_ptk, d.jenis_kelamin||null, d.tempat_lahir||null, d.tanggal_lahir||null,
       d.nip||null, d.status_kepegawaian||null, d.nama_jabatan||null, d.pangkat||'-', d.golongan||'-', d.gaji_pokok||0,
       d.status_ptk||null, d.unit_kerja||null, d.tmt_mengajar||null, d.tmt_sekolah_induk||null, d.mata_pelajaran_diampu||null,
       d.jumlah_jam_mengajar||0, d.npwp||null, d.jenjang_pendidikan||null, d.jurusan_pendidikan_terakhir||null, d.tahun_lulus||null,
       d.status_keaktifan||null, d.status_ptk_dapodik||null, d.alasan_tidak_aktif||null, d.jabatan_tugas_tambahan||'Tidak Ada',
       d.sub_rayon_id||null, d.input_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:nrg', async (req, res) => {
  const updates = Object.keys(req.body).filter(k => KOLOM_DIIZINKAN.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  if (updates.includes('nip') || updates.includes('status_kepegawaian')) {
    const current = await pool.query('SELECT status_kepegawaian, nip FROM ptk WHERE nrg = $1', [req.params.nrg]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'PTK tidak ditemukan.' });
    const merged = { ...current.rows[0], ...req.body };
    const errNip = validasiNipPtk(merged);
    if (errNip) return res.status(400).json({ error: errNip });
  }
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]);
  values.push(req.params.nrg);
  try {
    const { rows } = await pool.query(`UPDATE ptk SET ${setClause} WHERE nrg = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'PTK tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:nrg', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await client.query('SELECT * FROM ptk WHERE nrg = $1', [req.params.nrg]);
    if (p.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'PTK tidak ditemukan.' }); }
    await client.query('DELETE FROM ptk WHERE nrg = $1', [req.params.nrg]);
    await client.query(
      `INSERT INTO trash (source_type, label, data_json, sub_rayon_id, reason) VALUES ('ptk',$1,$2,$3,$4)`,
      [p.rows[0].nama_ptk, JSON.stringify(p.rows[0]), p.rows[0].sub_rayon_id, req.body.reason || null]
    );
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

module.exports = router;
