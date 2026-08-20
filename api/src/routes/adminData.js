const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

// ============ TRASH / HAPUS DATA ============
router.get('/trash', async (req, res) => {
  try {
    const { sub_rayon_id } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM trash WHERE ($1::int IS NULL OR sub_rayon_id=$1) ORDER BY deleted_at DESC`,
      [sub_rayon_id || null]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/trash/restore/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query('SELECT * FROM trash WHERE id = $1', [req.params.id]);
    if (t.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Data tidak ditemukan.' }); }
    if (t.rows[0].permanent) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Data yang sudah dihapus permanen tidak bisa dipulihkan.' }); }
    const tabelTarget = { sekolah: 'sekolah', operator: 'operator', ptk: 'ptk', sertifikasi: 'sertifikasi' }[t.rows[0].source_type];
    if (tabelTarget) {
      const data = t.rows[0].data_json;
      const kolom = Object.keys(data).filter(k => !['dibuat_pada', 'diperbarui_pada'].includes(k));
      const placeholders = kolom.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`INSERT INTO ${tabelTarget} (${kolom.join(',')}) VALUES (${placeholders})`, kolom.map(k => data[k]));
    }
    await client.query('DELETE FROM trash WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});
router.delete('/trash/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM trash WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/trash/hapus-permanen-massal', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Daftar ID kosong.' });
  try {
    const { rowCount } = await pool.query('DELETE FROM trash WHERE id = ANY($1::int[])', [ids]);
    res.json({ dihapus: rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ AKUN PENGGUNA ============
router.get('/akun/superadmin', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nama, username, must_change_password, dibuat_pada FROM superadmin_account ORDER BY nama');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/akun/superadmin', async (req, res) => {
  const { nama, username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO superadmin_account (nama, username, password_hash) VALUES ($1,$2,$3) RETURNING id, nama, username',
      [nama, username, hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah dipakai.' });
    res.status(400).json({ error: err.message });
  }
});
router.put('/akun/superadmin/:id', async (req, res) => {
  const { nama, username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'UPDATE superadmin_account SET nama=$1, username=$2, password_hash=$3 WHERE id=$4 RETURNING id, nama, username',
      [nama, username, hash, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah dipakai.' });
    res.status(400).json({ error: err.message });
  }
});
router.delete('/akun/superadmin/:id', async (req, res) => {
  try {
    const { rows: cek } = await pool.query('SELECT COUNT(*) FROM superadmin_account');
    if (parseInt(cek[0].count, 10) <= 1) return res.status(409).json({ error: 'Tidak bisa menghapus — minimal harus ada 1 akun Superadmin.' });
    const { rowCount } = await pool.query('DELETE FROM superadmin_account WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/akun/admin', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT aa.id, aa.nama, aa.level_admin, aa.jabatan, aa.username, aa.must_change_password, sr.nama_sub_rayon
      FROM admin_account aa LEFT JOIN sub_rayon sr ON sr.id = aa.sub_rayon_id ORDER BY aa.nama
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/akun/admin', async (req, res) => {
  const { nama, level_admin, jabatan, sub_rayon_id, username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO admin_account (nama, level_admin, jabatan, sub_rayon_id, username, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nama, username',
      [nama, level_admin||null, jabatan, sub_rayon_id||null, username, hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah dipakai.' });
    res.status(400).json({ error: err.message });
  }
});
router.put('/akun/admin/:id', async (req, res) => {
  const { nama, level_admin, jabatan, sub_rayon_id, username, password } = req.body;
  try {
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const { rows } = await pool.query(
      `UPDATE admin_account SET nama=$1, level_admin=$2, jabatan=$3, sub_rayon_id=$4, username=$5${hash ? ', password_hash=$6' : ''}
       WHERE id=$${hash ? 7 : 6} RETURNING id, nama, username`,
      hash ? [nama, level_admin||null, jabatan, sub_rayon_id||null, username, hash, req.params.id]
           : [nama, level_admin||null, jabatan, sub_rayon_id||null, username, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah dipakai.' });
    res.status(400).json({ error: err.message });
  }
});
router.delete('/akun/admin/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM admin_account WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// Batas percobaan login: maksimal 8 kali gagal dalam 15 menit terakhir dari 1 alamat IP yang sama.
const BATAS_GAGAL_LOGIN = 8;
const JENDELA_WAKTU_MENIT = 15;
function ambilAlamatIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.ip || (req.connection && req.connection.remoteAddress) || 'tidak diketahui';
}
router.post('/auth/login', async (req, res) => {
  const { username, password, role } = req.body; // role: 'superadmin' | 'admin'
  const tabel = role === 'superadmin' ? 'superadmin_account' : 'admin_account';
  const ip = ambilAlamatIp(req);
  try {
    const { rows: percobaan } = await pool.query(
      `SELECT COUNT(*)::int AS jumlah FROM login_attempts WHERE alamat_ip = $1 AND berhasil = false AND waktu > now() - interval '${JENDELA_WAKTU_MENIT} minutes'`,
      [ip]
    );
    if (percobaan[0].jumlah >= BATAS_GAGAL_LOGIN) {
      return res.status(429).json({ error: 'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ' + JENDELA_WAKTU_MENIT + ' menit.' });
    }

    const { rows } = await pool.query(`SELECT * FROM ${tabel} WHERE username = $1`, [username]);
    const cocok = rows.length > 0 ? await bcrypt.compare(password, rows[0].password_hash) : false;

    await pool.query('INSERT INTO login_attempts (username, alamat_ip, berhasil) VALUES ($1,$2,$3)', [username, ip, cocok]);

    if (rows.length === 0 || !cocok) return res.status(401).json({ error: 'Username atau password salah.' });
    const { password_hash, ...userAman } = rows[0];
    res.json(userAman);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/auth/ganti-password', async (req, res) => {
  const { username, role, passwordLama, passwordBaru } = req.body;
  const tabel = role === 'superadmin' ? 'superadmin_account' : 'admin_account';
  try {
    const { rows } = await pool.query(`SELECT * FROM ${tabel} WHERE username = $1`, [username]);
    if (rows.length === 0) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    const cocok = await bcrypt.compare(passwordLama, rows[0].password_hash);
    if (!cocok) return res.status(401).json({ error: 'Password lama tidak sesuai.' });
    const hashBaru = await bcrypt.hash(passwordBaru, 10);
    await pool.query(`UPDATE ${tabel} SET password_hash = $1, must_change_password = false WHERE username = $2`, [hashBaru, username]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/auth/reset-password-default', async (req, res) => {
  const { username } = req.body;
  try {
    let ditemukan = false;
    for (const tabel of ['superadmin_account', 'admin_account']) {
      const cek = await pool.query(`SELECT id FROM ${tabel} WHERE username = $1`, [username]);
      if (cek.rows.length > 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await pool.query(`UPDATE ${tabel} SET password_hash = $1, must_change_password = true WHERE username = $2`, [hash, username]);
        ditemukan = true;
        break;
      }
    }
    if (!ditemukan) return res.status(404).json({ error: 'Username "' + username + '" tidak ditemukan.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ PENGATURAN TAMPILAN (Superadmin) ============
router.get('/pengaturan-tampilan', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM app_settings WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/pengaturan-tampilan', async (req, res) => {
  const { login_background, sidebar_color, page_bg_color, font_color, font_size, logo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE app_settings SET
         login_background = COALESCE($1, login_background),
         sidebar_color = COALESCE($2, sidebar_color),
         page_bg_color = COALESCE($3, page_bg_color),
         font_color = COALESCE($4, font_color),
         font_size = COALESCE($5, font_size),
         logo = COALESCE($6, logo),
         diperbarui_pada = now()
       WHERE id = 1 RETURNING *`,
      [login_background||null, sidebar_color||null, page_bg_color||null, font_color||null, font_size||null, logo||null]
    );
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.post('/pengaturan-tampilan/reset', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE app_settings SET login_background=NULL, sidebar_color=NULL, page_bg_color=NULL, font_color=NULL, font_size=NULL, logo=NULL, diperbarui_pada=now() WHERE id=1 RETURNING *`
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ INFORMASI ============
router.get('/informasi', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM informasi ORDER BY tanggal_dibuat DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/informasi', async (req, res) => {
  const { judul, isi, deadline, tujuan_jabatan } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO informasi (judul, isi, deadline, tujuan_jabatan) VALUES ($1,$2,$3,$4) RETURNING *',
      [judul, isi||null, deadline||null, tujuan_jabatan||[]]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.patch('/informasi/:id', async (req, res) => {
  const kolom = ['judul','isi','deadline','tujuan_jabatan'];
  const updates = Object.keys(req.body).filter(k => kolom.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]); values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE informasi SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.delete('/informasi/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM informasi WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.patch('/informasi/:id/kirim', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE informasi SET terkirim = true, tanggal_kirim = now() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.patch('/informasi/:id/batal-kirim', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE informasi SET terkirim = false, tanggal_kirim = NULL WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ USER MANUAL ============
router.get('/user-manual', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM user_manual ORDER BY tanggal_upload DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/user-manual', async (req, res) => {
  const { nama_manual, tanggal_upload, file_data, file_name, file_size_kb } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO user_manual (nama_manual, tanggal_upload, file_data, file_name, file_size_kb) VALUES ($1,$2,$3,$4,$5) RETURNING id, nama_manual, tanggal_upload, file_name, file_size_kb, dibuat_pada',
      [nama_manual, tanggal_upload, file_data||null, file_name||null, file_size_kb||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.patch('/user-manual/:id', async (req, res) => {
  const kolom = ['nama_manual','tanggal_upload','file_data','file_name','file_size_kb'];
  const updates = Object.keys(req.body).filter(k => kolom.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field valid.' });
  const setClause = updates.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(k => req.body[k]); values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE user_manual SET ${setClause} WHERE id = $${values.length} RETURNING id, nama_manual, tanggal_upload, file_name, file_size_kb, dibuat_pada`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.get('/user-manual/:id/file', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT file_data FROM user_manual WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json({ file_data: rows[0].file_data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/user-manual/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM user_manual WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ FORMAT SURAT ============
router.get('/format-surat/:tahun_anggaran', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM format_surat WHERE tahun_anggaran = $1', [req.params.tahun_anggaran]);
    res.json(rows[0] || { tahun_anggaran: req.params.tahun_anggaran, file_docx_map: {}, nomor_surat_map: {}, edited_surat_map: {} });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/format-surat', async (req, res) => {
  const { tahun_anggaran, file_docx_target, file_docx_entry, nomor_surat_map, edited_surat_map } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM format_surat WHERE tahun_anggaran = $1', [tahun_anggaran]);
    let fileDocxMap = existing.rows[0] ? existing.rows[0].file_docx_map || {} : {};
    if (file_docx_target && file_docx_entry) fileDocxMap = Object.assign({}, fileDocxMap, { [file_docx_target]: file_docx_entry });
    const { rows } = await pool.query(
      `INSERT INTO format_surat (tahun_anggaran, file_docx_map, nomor_surat_map, edited_surat_map) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tahun_anggaran) DO UPDATE SET
         file_docx_map = $2,
         nomor_surat_map = COALESCE($3, format_surat.nomor_surat_map),
         edited_surat_map = COALESCE($4, format_surat.edited_surat_map),
         diperbarui_pada = now()
       RETURNING tahun_anggaran, file_docx_map, nomor_surat_map, edited_surat_map, diperbarui_pada`,
      [tahun_anggaran, JSON.stringify(fileDocxMap), nomor_surat_map?JSON.stringify(nomor_surat_map):(existing.rows[0]?JSON.stringify(existing.rows[0].nomor_surat_map):null), edited_surat_map?JSON.stringify(edited_surat_map):(existing.rows[0]?JSON.stringify(existing.rows[0].edited_surat_map):null)]
    );
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
