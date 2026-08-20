const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT op.*, sk.nama_sekolah, sr.nama_sub_rayon, sk.kecamatan
      FROM operator op
      LEFT JOIN sekolah sk ON sk.npsn = op.unit_kerja
      LEFT JOIN sub_rayon sr ON sr.id = sk.sub_rayon_id
      ORDER BY sk.nama_sekolah
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const d = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO operator (nama_ops, status_kepegawaian, nip, tempat_lahir, tanggal_lahir, jabatan, nama_admin_bosp,
        unit_kerja, no_whatsapp, alamat_rumah, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [d.nama_ops, d.status_kepegawaian || null, d.nip || null, d.tempat_lahir || null, d.tanggal_lahir || null,
       d.jabatan, d.nama_admin_bosp || null, d.unit_kerja, d.no_whatsapp || null, d.alamat_rumah || null,
       d.sub_rayon_id || null, d.input_by]
    );
    // Sinkronisasi otomatis ke Data PTK jika Status Kepegawaian diisi (bukan 'Tidak Ada')
    if (d.status_kepegawaian && d.status_kepegawaian !== 'Tidak Ada') {
      const existing = await client.query('SELECT nrg FROM ptk WHERE LOWER(nama_ptk) = LOWER($1) LIMIT 1', [d.nama_ops]);
      if (existing.rows.length > 0) {
        await client.query('UPDATE ptk SET jabatan_tugas_tambahan = $1 WHERE nrg = $2', [d.status_kepegawaian, existing.rows[0].nrg]);
      } else {
        const nrgSementara = 'OPS-' + rows[0].id; // NRG sementara sampai dilengkapi manual di Data PTK
        await client.query(
          `INSERT INTO ptk (nrg, nama_ptk, tempat_lahir, tanggal_lahir, nip, unit_kerja, status_keaktifan, jabatan_tugas_tambahan, sub_rayon_id, input_by)
           VALUES ($1,$2,$3,$4,$5,$6,'Aktif',$7,$8,$9)`,
          [nrgSementara, d.nama_ops, d.tempat_lahir || null, d.tanggal_lahir || null, d.nip || null, d.unit_kerja, d.status_kepegawaian, d.sub_rayon_id || null, d.input_by]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

router.patch('/:id', async (req, res) => {
  const kolomDiizinkan = ['nama_ops','status_kepegawaian','nip','tempat_lahir','tanggal_lahir','jabatan','nama_admin_bosp','unit_kerja','no_whatsapp','alamat_rumah'];
  const updates = Object.keys(req.body).filter(k => kolomDiizinkan.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  if (updates.includes('no_whatsapp') && req.body.no_whatsapp && !/^[0-9]{1,12}$/.test(req.body.no_whatsapp)) {
    return res.status(400).json({ error: 'No WhatsApp maksimal 12 digit angka.' });
  }
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]);
  values.push(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`UPDATE operator SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Operator tidak ditemukan.' }); }
    if (updates.includes('status_kepegawaian') && req.body.status_kepegawaian && req.body.status_kepegawaian !== 'Tidak Ada') {
      const op = rows[0];
      const existing = await client.query('SELECT nrg FROM ptk WHERE LOWER(nama_ptk) = LOWER($1) LIMIT 1', [op.nama_ops]);
      if (existing.rows.length > 0) {
        await client.query('UPDATE ptk SET jabatan_tugas_tambahan = $1 WHERE nrg = $2', [req.body.status_kepegawaian, existing.rows[0].nrg]);
      } else {
        await client.query(
          `INSERT INTO ptk (nrg, nama_ptk, tempat_lahir, tanggal_lahir, nip, unit_kerja, status_keaktifan, jabatan_tugas_tambahan, sub_rayon_id, input_by)
           VALUES ($1,$2,$3,$4,$5,$6,'Aktif',$7,$8,$9)`,
          ['OPS-' + op.id, op.nama_ops, op.tempat_lahir, op.tanggal_lahir, op.nip, op.unit_kerja, req.body.status_kepegawaian, op.sub_rayon_id, op.input_by]
        );
      }
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const op = await client.query('SELECT * FROM operator WHERE id = $1', [req.params.id]);
    if (op.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Operator tidak ditemukan.' }); }
    await client.query('DELETE FROM operator WHERE id = $1', [req.params.id]);
    await client.query(
      `INSERT INTO trash (source_type, label, data_json, sub_rayon_id, reason) VALUES ('operator',$1,$2,$3,$4)`,
      [op.rows[0].nama_ops, JSON.stringify(op.rows[0]), op.rows[0].sub_rayon_id, req.body.reason || null]
    );
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

module.exports = router;
