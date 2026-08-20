const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// ============ BKU ============
router.get('/bku', async (req, res) => {
  try {
    const { triwulan, tahun_anggaran } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM bku_entries WHERE ($1::int IS NULL OR triwulan=$1) AND ($2::text IS NULL OR tahun_anggaran=$2) ORDER BY tanggal`,
      [triwulan || null, tahun_anggaran || null]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/bku', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO bku_entries (triwulan, tahun_anggaran, tanggal, kode_kegiatan, kode_rekening, no_bukti, uraian,
        penerimaan, pengeluaran, verifikasi_kategori, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [d.triwulan, d.tahun_anggaran, d.tanggal, d.kode_kegiatan||null, d.kode_rekening||null, d.no_bukti||null,
       d.uraian||null, d.penerimaan||0, d.pengeluaran||0, d.verifikasi_kategori||null, d.sub_rayon_id||null, d.input_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.patch('/bku/:id', async (req, res) => {
  const kolom = ['tanggal','kode_kegiatan','kode_rekening','no_bukti','uraian','penerimaan','pengeluaran','verifikasi_kategori'];
  const updates = Object.keys(req.body).filter(k => kolom.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]); values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE bku_entries SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.delete('/bku/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM bku_entries WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/bku/saldo-awal', async (req, res) => {
  const { triwulan, tahun_anggaran, input_by } = req.query;
  try {
    const { rows } = await pool.query('SELECT * FROM bku_saldo_awal WHERE triwulan=$1 AND tahun_anggaran=$2 AND input_by=$3', [triwulan, tahun_anggaran, input_by]);
    res.json(rows[0] || { saldo_awal: 0, saldo_tunai_awal: 0, saldo_bank_awal: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/bku/saldo-awal', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO bku_saldo_awal (triwulan, tahun_anggaran, input_by, saldo_awal, saldo_tunai_awal, saldo_bank_awal)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (triwulan, tahun_anggaran, input_by) DO UPDATE SET saldo_awal=$4, saldo_tunai_awal=$5, saldo_bank_awal=$6
       RETURNING *`,
      [d.triwulan, d.tahun_anggaran, d.input_by, d.saldo_awal||0, d.saldo_tunai_awal||0, d.saldo_bank_awal||0]
    );
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============ LAPORAN BPK ============
router.get('/laporan-bpk', async (req, res) => {
  try {
    const { tahun_anggaran } = req.query;
    const { rows } = await pool.query(
      `SELECT lb.*, sk.nama_sekolah FROM laporan_bpk lb LEFT JOIN sekolah sk ON sk.npsn = lb.npsn
       WHERE ($1::text IS NULL OR lb.tahun_anggaran=$1) ORDER BY sk.nama_sekolah`,
      [tahun_anggaran || null]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/laporan-bpk', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO laporan_bpk (tahun_anggaran, npsn, saldo_bank_tw1, saldo_bank_tw2, saldo_bank_tw3, saldo_bank_tw4,
        saldo_tunai_tw1, saldo_tunai_tw2, saldo_tunai_tw3, saldo_tunai_tw4, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (tahun_anggaran, npsn) DO UPDATE SET
         saldo_bank_tw1=$3, saldo_bank_tw2=$4, saldo_bank_tw3=$5, saldo_bank_tw4=$6,
         saldo_tunai_tw1=$7, saldo_tunai_tw2=$8, saldo_tunai_tw3=$9, saldo_tunai_tw4=$10
       RETURNING *`,
      [d.tahun_anggaran, d.npsn, d.saldo_bank_tw1||0, d.saldo_bank_tw2||0, d.saldo_bank_tw3||0, d.saldo_bank_tw4||0,
       d.saldo_tunai_tw1||0, d.saldo_tunai_tw2||0, d.saldo_tunai_tw3||0, d.saldo_tunai_tw4||0, d.sub_rayon_id||null, d.input_by]
    );
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.delete('/laporan-bpk/:npsn', async (req, res) => {
  try {
    const { tahun_anggaran } = req.query;
    const { rowCount } = await pool.query('DELETE FROM laporan_bpk WHERE npsn = $1 AND tahun_anggaran = $2', [req.params.npsn, tahun_anggaran]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/stock-opname', async (req, res) => {
  try {
    const { tahun_anggaran } = req.query;
    const { rows } = await pool.query(
      `SELECT so.*, sk.nama_sekolah, sr.nama_sub_rayon FROM stock_opname so LEFT JOIN sekolah sk ON sk.npsn = so.npsn LEFT JOIN sub_rayon sr ON sr.id = so.sub_rayon_id
       WHERE ($1::text IS NULL OR so.tahun_anggaran=$1) ORDER BY sk.nama_sekolah`,
      [tahun_anggaran || null]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/stock-opname', async (req, res) => {
  const d = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO stock_opname (tahun_anggaran, npsn, nama_barang, unit, harga, saldo_awal_kuantitas, penerimaan_kuantitas, pengeluaran_kuantitas, keterangan, sub_rayon_id, input_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [d.tahun_anggaran, d.npsn||null, d.nama_barang||null, d.unit||null, d.harga||0, d.saldo_awal_kuantitas||0,
       d.penerimaan_kuantitas||0, d.pengeluaran_kuantitas||0, d.keterangan||null, d.sub_rayon_id||null, d.input_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.patch('/stock-opname/:id', async (req, res) => {
  const kolom = ['npsn','nama_barang','unit','harga','saldo_awal_kuantitas','penerimaan_kuantitas','pengeluaran_kuantitas','keterangan'];
  const updates = Object.keys(req.body).filter(k => kolom.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]); values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE stock_opname SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.delete('/stock-opname/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM stock_opname WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ PAJAK (data bulanan tersimpan sebagai JSON per pengguna per tahun) ============
router.get('/pajak', async (req, res) => {
  try {
    const { tahun_anggaran, input_by } = req.query;
    const { rows } = await pool.query('SELECT * FROM pajak_data WHERE tahun_anggaran=$1 AND input_by=$2', [tahun_anggaran, input_by]);
    res.json(rows[0] ? rows[0].data_json : { saldoAwal: 0, bulan: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/pajak', async (req, res) => {
  const { tahun_anggaran, input_by, sub_rayon_id, data } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO pajak_data (tahun_anggaran, input_by, data_json, sub_rayon_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tahun_anggaran, input_by) DO UPDATE SET data_json=$3 RETURNING *`,
      [tahun_anggaran, input_by, JSON.stringify(data), sub_rayon_id||null]
    );
    res.json(rows[0].data_json);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============ LAMPIRAN 2A/2B/2C ============
function buatRouteLampiran(nama, tabel, kolomInsert, kolomUrut) {
  router.get('/' + nama, async (req, res) => {
    try {
      const { triwulan, tahun_anggaran } = req.query;
      const { rows } = await pool.query(
        `SELECT * FROM ${tabel} WHERE ($1::int IS NULL OR triwulan=$1) AND ($2::text IS NULL OR tahun_anggaran=$2) ORDER BY ${kolomUrut}`,
        [triwulan || null, tahun_anggaran || null]
      );
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  router.post('/' + nama, async (req, res) => {
    const d = req.body;
    const kolom = kolomInsert.split(',').map(k => k.trim());
    const placeholders = kolom.map((_, i) => `$${i + 1}`).join(',');
    const values = kolom.map(k => d[k] ?? null);
    try {
      const { rows } = await pool.query(`INSERT INTO ${tabel} (${kolom.join(',')}) VALUES (${placeholders}) RETURNING *`, values);
      res.status(201).json(rows[0]);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  router.patch('/' + nama + '/:id', async (req, res) => {
    const kolom = kolomInsert.split(',').map(k => k.trim()).filter(k => k in req.body);
    if (kolom.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
    const setClause = kolom.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = kolom.map(k => req.body[k]); values.push(req.params.id);
    try {
      const { rows } = await pool.query(`UPDATE ${tabel} SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
      if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
      res.json(rows[0]);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  router.delete('/' + nama + '/:id', async (req, res) => {
    try {
      const { rowCount } = await pool.query(`DELETE FROM ${tabel} WHERE id = $1`, [req.params.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
      res.status(204).end();
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}
buatRouteLampiran('lampiran-2a', 'lampiran_2a', 'triwulan,tahun_anggaran,ptk_nrg,nuptk,nama_ptk,status_kepegawaian,nama_sekolah,gaji_pokok,npwp,sub_rayon_id,input_by', 'nama_sekolah');
buatRouteLampiran('lampiran-2b', 'lampiran_2b', 'triwulan,tahun_anggaran,ptk_nrg,nuptk,nama_ptk,nama_sekolah,tmt,keterangan,sub_rayon_id,input_by', 'nama_sekolah');
buatRouteLampiran('lampiran-2c', 'lampiran_2c', 'triwulan,tahun_anggaran,ptk_nrg,nama_ptk,tempat_tugas,jenis_kenaikan,golongan_dimiliki,masa_kerja_dimiliki,pangkat_berkala_baru,tmt_sk_terbaru,gaji_pokok_lama,gaji_pokok_baru,sub_rayon_id,input_by', 'nama_ptk');

module.exports = router;
