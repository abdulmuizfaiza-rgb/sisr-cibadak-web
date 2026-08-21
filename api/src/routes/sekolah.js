const express = require('express');
const router = express.Router();
const { pool } = require('../db');

function pesanErrorRamah(err) {
  if (err.code === '23514') {
    if (err.constraint && err.constraint.includes('npsn')) return 'NPSN harus 8 digit angka.';
    if (err.message.includes('nip_pengawas') || err.message.includes('nip_kepala')) return 'NIP harus 18 digit angka, atau tanda "-".';
    return 'Salah satu data tidak sesuai format yang diizinkan.';
  }
  if (err.code === '23505') return 'NPSN ini sudah terdaftar.';
  if (err.message && err.message.includes('Kecamatan')) return err.message; // dari trigger cek_kecamatan_sesuai_subrayon
  if (err.message && err.message.includes('NIP')) return err.message; // dari trigger cek_nip_tidak_boleh_sama
  return err.message;
}

// GET semua sekolah (terurut: Status Negeri dulu, lalu Nama Sekolah, lalu Kecamatan -- sesuai instruksi asli)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sk.*, sr.nama_sub_rayon
      FROM sekolah sk LEFT JOIN sub_rayon sr ON sr.id = sk.sub_rayon_id
      ORDER BY CASE sk.status_sekolah WHEN 'Negeri' THEN 0 WHEN 'Swasta' THEN 1 ELSE 2 END, sk.nama_sekolah, sk.kecamatan
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO sekolah (npsn, nama_sekolah, status_sekolah, sub_rayon_id, kecamatan, alamat_sekolah,
        nama_pengawas_pembina, nip_pengawas_pembina, nama_kepala_sekolah, nip_kepala_sekolah, nama_pemda,
        website_sekolah, email_sekolah, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [d.npsn, d.nama_sekolah, d.status_sekolah, d.sub_rayon_id || null, d.kecamatan || null, d.alamat_sekolah || null,
       d.nama_pengawas_pembina || null, d.nip_pengawas_pembina || null, d.nama_kepala_sekolah || null, d.nip_kepala_sekolah || null,
       d.nama_pemda || null, d.website_sekolah || null, d.email_sekolah || null, d.input_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: pesanErrorRamah(err) });
  }
});

// PATCH -- update SATU field saja (dipakai tabel spreadsheet inline / copy-paste per kolom)
router.patch('/:npsn', async (req, res) => {
  const kolomDiizinkan = ['npsn','nama_sekolah','status_sekolah','sub_rayon_id','kecamatan','alamat_sekolah',
    'nama_pengawas_pembina','nip_pengawas_pembina','nama_kepala_sekolah','nip_kepala_sekolah',
    'nama_pemda','website_sekolah','email_sekolah','logo_sekolah','logo_pemda'];
  // Field yang WAJIB diisi (tidak boleh dikonversi jadi null meski kosong) -- selebihnya opsional.
  const kolomWajib = ['npsn','nama_sekolah','status_sekolah'];
  const updates = Object.keys(req.body).filter(k => kolomDiizinkan.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid untuk diperbarui.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => {
    const v = req.body[k];
    // Konsisten dengan route POST: string kosong pada field opsional dianggap "tidak diisi" (NULL),
    // supaya tidak melanggar CHECK constraint (misal NIP harus 18 digit / '-' / NULL, bukan '').
    if (!kolomWajib.includes(k) && (v === '' || v === undefined)) return null;
    return v;
  });
  values.push(req.params.npsn);
  try {
    const { rows } = await pool.query(`UPDATE sekolah SET ${setClause} WHERE npsn = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Sekolah tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: pesanErrorRamah(err) });
  }
});

router.delete('/:npsn', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dipakaiPtk = await client.query('SELECT 1 FROM ptk WHERE unit_kerja = $1 LIMIT 1', [req.params.npsn]);
    const dipakaiOp = await client.query('SELECT 1 FROM operator WHERE unit_kerja = $1 LIMIT 1', [req.params.npsn]);
    if (dipakaiPtk.rows.length || dipakaiOp.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Sekolah ini tidak bisa dihapus karena masih dipakai data Operator/PTK.' });
    }
    const sk = await client.query('SELECT * FROM sekolah WHERE npsn = $1', [req.params.npsn]);
    if (sk.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Sekolah tidak ditemukan.' }); }
    await client.query('DELETE FROM sekolah WHERE npsn = $1', [req.params.npsn]);
    await client.query(
      `INSERT INTO trash (source_type, label, data_json, sub_rayon_id, reason) VALUES ('sekolah',$1,$2,$3,$4)`,
      [sk.rows[0].nama_sekolah, JSON.stringify(sk.rows[0]), sk.rows[0].sub_rayon_id, req.body.reason || null]
    );
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
