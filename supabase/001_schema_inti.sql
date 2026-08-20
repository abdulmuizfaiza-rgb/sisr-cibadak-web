-- ============================================================
-- SISR CIBADAK - Skema Database PostgreSQL
-- File 001: Modul Inti (Sub Rayon, Sekolah, Operator, PTK, Sertifikasi,
--           Penerimaan BOSP, Akun Pengguna)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --- Sub Rayon ---
-- Satu Nama Sub Rayon = satu profil (Ketua, Sekretariat, dll), berlaku
-- otomatis untuk BEBERAPA kecamatan (lihat tabel sub_rayon_kecamatan).
CREATE TABLE sub_rayon (
  id SERIAL PRIMARY KEY,
  nama_sub_rayon TEXT NOT NULL UNIQUE,
  nama_ketua_sr TEXT NOT NULL,
  nip_ketua_sr TEXT NOT NULL CHECK (nip_ketua_sr ~ '^[0-9]{18}$'),
  unit_kerja_ketua_sr TEXT,
  unit_sekretariat_sr TEXT,
  alamat_sekretariat_sr TEXT,
  logo_sub_rayon TEXT, -- data URL base64
  logo_sub_rayon_mime TEXT,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daftar kecamatan yang tercakup di bawah 1 Sub Rayon (many-to-one).
-- Ini yang menggantikan "SUB_RAYON_KECAMATAN_MAP" versi prototipe.
CREATE TABLE sub_rayon_kecamatan (
  id SERIAL PRIMARY KEY,
  sub_rayon_id INT NOT NULL REFERENCES sub_rayon(id) ON DELETE CASCADE,
  nama_kecamatan TEXT NOT NULL,
  UNIQUE (nama_kecamatan) -- 1 kecamatan hanya boleh masuk 1 Sub Rayon
);
CREATE INDEX idx_sub_rayon_kecamatan_sr ON sub_rayon_kecamatan(sub_rayon_id);

-- --- Sekolah ---
CREATE TABLE sekolah (
  npsn TEXT PRIMARY KEY CHECK (npsn ~ '^[0-9]{8}$'),
  nama_sekolah TEXT NOT NULL,
  status_sekolah TEXT NOT NULL CHECK (status_sekolah IN ('Negeri','Swasta')),
  sub_rayon_id INT REFERENCES sub_rayon(id),
  kecamatan TEXT, -- harus salah satu kecamatan yang valid untuk sub_rayon_id nya (divalidasi di app layer + trigger di bawah)
  alamat_sekolah TEXT,
  nama_pengawas_pembina TEXT,
  nip_pengawas_pembina TEXT CHECK (nip_pengawas_pembina IS NULL OR nip_pengawas_pembina = '-' OR nip_pengawas_pembina ~ '^[0-9]{18}$'),
  nama_kepala_sekolah TEXT,
  nip_kepala_sekolah TEXT CHECK (nip_kepala_sekolah IS NULL OR nip_kepala_sekolah = '-' OR nip_kepala_sekolah ~ '^[0-9]{18}$'),
  nama_pemda TEXT,
  website_sekolah TEXT,
  email_sekolah TEXT,
  logo_sekolah TEXT, -- data URL base64
  logo_pemda TEXT, -- data URL base64
  input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sekolah_sub_rayon ON sekolah(sub_rayon_id);

-- Trigger: NIP Pengawas Pembina & NIP Kepala Sekolah tidak boleh sama dengan NIP MANAPUN
-- (baik peran yang sama maupun berbeda) di sekolah lain manapun. Constraint UNIQUE biasa
-- TIDAK CUKUP di sini karena harus mengecek SILANG antar kedua kolom, bukan cuma per-kolom.
CREATE OR REPLACE FUNCTION cek_nip_tidak_boleh_sama() RETURNS TRIGGER AS $$
DECLARE
  bentrok RECORD;
BEGIN
  IF NEW.nip_pengawas_pembina IS NOT NULL AND NEW.nip_pengawas_pembina <> '-' THEN
    SELECT npsn, nama_pengawas_pembina AS nama, 'NIP Pengawas Pembina' AS peran INTO bentrok
    FROM sekolah WHERE npsn <> NEW.npsn AND nip_pengawas_pembina = NEW.nip_pengawas_pembina
    UNION ALL
    SELECT npsn, nama_kepala_sekolah AS nama, 'NIP Kepala Sekolah' AS peran
    FROM sekolah WHERE npsn <> NEW.npsn AND nip_kepala_sekolah = NEW.nip_pengawas_pembina
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'NIP Pengawas Pembina "%" sudah dipakai oleh % (%) di sekolah %', NEW.nip_pengawas_pembina, bentrok.nama, bentrok.peran, bentrok.npsn;
    END IF;
  END IF;
  IF NEW.nip_kepala_sekolah IS NOT NULL AND NEW.nip_kepala_sekolah <> '-' THEN
    SELECT npsn, nama_pengawas_pembina AS nama, 'NIP Pengawas Pembina' AS peran INTO bentrok
    FROM sekolah WHERE npsn <> NEW.npsn AND nip_pengawas_pembina = NEW.nip_kepala_sekolah
    UNION ALL
    SELECT npsn, nama_kepala_sekolah AS nama, 'NIP Kepala Sekolah' AS peran
    FROM sekolah WHERE npsn <> NEW.npsn AND nip_kepala_sekolah = NEW.nip_kepala_sekolah
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'NIP Kepala Sekolah "%" sudah dipakai oleh % (%) di sekolah %', NEW.nip_kepala_sekolah, bentrok.nama, bentrok.peran, bentrok.npsn;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cek_nip_sekolah
  BEFORE INSERT OR UPDATE ON sekolah
  FOR EACH ROW EXECUTE FUNCTION cek_nip_tidak_boleh_sama();

-- Trigger: pastikan Kecamatan sekolah termasuk wilayah Sub Rayon-nya
CREATE OR REPLACE FUNCTION cek_kecamatan_sesuai_subrayon() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kecamatan IS NOT NULL AND NEW.sub_rayon_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM sub_rayon_kecamatan
      WHERE sub_rayon_id = NEW.sub_rayon_id AND nama_kecamatan = NEW.kecamatan
    ) THEN
      RAISE EXCEPTION 'Kecamatan "%" tidak termasuk wilayah Sub Rayon terpilih', NEW.kecamatan;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cek_kecamatan_sekolah
  BEFORE INSERT OR UPDATE ON sekolah
  FOR EACH ROW EXECUTE FUNCTION cek_kecamatan_sesuai_subrayon();

-- --- Operator / Bendahara / Admin Aset ---
CREATE TABLE operator (
  id SERIAL PRIMARY KEY,
  nama_ops TEXT NOT NULL,
  status_kepegawaian TEXT, -- Tidak Ada / Operator Dapodik / Bendahara-Admin BOSP / Operator Aset
  nip TEXT,
  tempat_lahir TEXT,
  tanggal_lahir DATE,
  jabatan TEXT NOT NULL CHECK (jabatan IN ('Operator Dapodik','Bendahara/Admin BOSP','Admin OP Aset')),
  nama_admin_bosp TEXT,
  unit_kerja TEXT NOT NULL REFERENCES sekolah(npsn) ON UPDATE CASCADE,
  no_whatsapp TEXT CHECK (no_whatsapp IS NULL OR no_whatsapp ~ '^[0-9]{1,12}$'),
  alamat_rumah TEXT,
  foto_ops TEXT, -- data URL base64
  sk_ops_bendahara TEXT, -- data URL base64, wajib PDF (divalidasi di app layer)
  sub_rayon_id INT REFERENCES sub_rayon(id),
  input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_operator_unit_kerja ON operator(unit_kerja);

-- --- PTK ---
CREATE TABLE ptk (
  nrg TEXT PRIMARY KEY,
  nuptk TEXT,
  nik TEXT,
  nama_ptk TEXT NOT NULL,
  jenis_kelamin TEXT CHECK (jenis_kelamin IS NULL OR jenis_kelamin IN ('Laki-laki','Perempuan')),
  tempat_lahir TEXT,
  tanggal_lahir DATE,
  nip TEXT,
  status_kepegawaian TEXT CHECK (status_kepegawaian IS NULL OR status_kepegawaian IN ('PNS','PPPK','PPPK Paruh Waktu','GTY','GTT','Honorer')),
  nama_jabatan TEXT,
  pangkat TEXT,
  golongan TEXT,
  gaji_pokok NUMERIC(14,2) DEFAULT 0,
  status_ptk TEXT CHECK (status_ptk IS NULL OR status_ptk IN ('Sekolah Induk','Sekolah Non Induk')),
  unit_kerja TEXT REFERENCES sekolah(npsn) ON UPDATE CASCADE,
  tmt_mengajar DATE,
  tmt_sekolah_induk DATE,
  mata_pelajaran_diampu TEXT,
  jumlah_jam_mengajar INT DEFAULT 0,
  npwp TEXT,
  jenjang_pendidikan TEXT CHECK (jenjang_pendidikan IS NULL OR jenjang_pendidikan IN ('S1','S2','S3')),
  jurusan_pendidikan_terakhir TEXT,
  tahun_lulus TEXT,
  status_keaktifan TEXT CHECK (status_keaktifan IS NULL OR status_keaktifan IN ('Aktif','Tidak Aktif')),
  status_ptk_dapodik TEXT CHECK (status_ptk_dapodik IS NULL OR status_ptk_dapodik IN ('Terdaftar Di Dapodik','Belum Terdaftar Di Dapodik')),
  alasan_tidak_aktif TEXT,
  jabatan_tugas_tambahan TEXT DEFAULT 'Tidak Ada' CHECK (jabatan_tugas_tambahan IN ('Tidak Ada','Operator Dapodik','Bendahara/Admin BOSP','Operator Aset')),
  -- NIP kosong ATAU '-' diperbolehkan HANYA jika status_kepegawaian termasuk GTT/GTY/Honorer (dicek di app layer, bukan constraint SQL murni karena kondisional)
  sub_rayon_id INT REFERENCES sub_rayon(id),
  input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ptk_unit_kerja ON ptk(unit_kerja);

-- Arsip PTK per Tahun Anggaran (snapshot saat tutup tahun)
CREATE TABLE ptk_arsip (
  id SERIAL PRIMARY KEY,
  tahun_anggaran TEXT NOT NULL,
  data_json JSONB NOT NULL, -- snapshot lengkap 1 baris ptk pada saat arsip dibuat
  nrg TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ptk_arsip_tahun ON ptk_arsip(tahun_anggaran);

-- --- Sertifikasi ---
CREATE TABLE sertifikasi (
  id SERIAL PRIMARY KEY,
  ptk_nrg TEXT REFERENCES ptk(nrg),
  kode_bidang_studi TEXT,
  nama_bidang_studi TEXT,
  tanggal_mulai_berlaku DATE,
  nomor_peserta TEXT,
  nomor_sertifikat TEXT,
  nama_universitas TEXT,
  tahun_sertifikasi TEXT,
  naungan TEXT,
  sub_rayon_id INT REFERENCES sub_rayon(id),
  input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sertifikasi_ptk ON sertifikasi(ptk_nrg);

-- --- Penerimaan BOSP ---
CREATE TABLE penerimaan_bosp (
  id SERIAL PRIMARY KEY,
  tahun_anggaran TEXT NOT NULL,
  npsn TEXT NOT NULL REFERENCES sekolah(npsn) ON UPDATE CASCADE,
  kode_upb TEXT,
  jumlah_siswa INT DEFAULT 0,
  besaran_satuan NUMERIC(14,2) DEFAULT 0,
  tahap1 NUMERIC(14,2) DEFAULT 0,
  tahap2 NUMERIC(14,2) DEFAULT 0,
  tunai1 NUMERIC(14,2) DEFAULT 0,
  tunai2 NUMERIC(14,2) DEFAULT 0,
  tunai3 NUMERIC(14,2) DEFAULT 0,
  tunai4 NUMERIC(14,2) DEFAULT 0,
  sub_rayon_id INT REFERENCES sub_rayon(id),
  input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tahun_anggaran, npsn)
);
CREATE INDEX idx_penerimaan_bosp_npsn ON penerimaan_bosp(npsn);

-- --- Akun Pengguna ---
CREATE TABLE superadmin_account (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_account (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  level_admin TEXT,
  jabatan TEXT NOT NULL CHECK (jabatan IN ('Operator Dapodik','Bendahara/Admin BOSP','Admin OP Aset')),
  sub_rayon_id INT REFERENCES sub_rayon(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Trash / Hapus Data (soft-delete lintas menu) ---
CREATE TABLE trash (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL, -- 'sekolah' | 'operator' | 'ptk' | 'sertifikasi' | dst
  label TEXT NOT NULL,
  data_json JSONB NOT NULL,
  sub_rayon_id INT REFERENCES sub_rayon(id),
  reason TEXT,
  permanent BOOLEAN NOT NULL DEFAULT false,
  deleted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Pelacakan Percobaan Login (khusus versi ONLINE) ---
-- Karena versi web ini bisa diakses dari internet oleh siapa saja, perlu pembatasan supaya
-- tidak bisa dicoba tebak password berkali-kali secara otomatis (brute-force). Setiap percobaan
-- login (berhasil maupun gagal) dicatat di sini, backend menolak percobaan baru sementara waktu
-- kalau sudah terlalu banyak kegagalan berturut-turut dari alamat IP yang sama.
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  alamat_ip TEXT NOT NULL,
  berhasil BOOLEAN NOT NULL,
  waktu TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_ip_waktu ON login_attempts(alamat_ip, waktu);

-- Trigger umum: otomatis update kolom diperbarui_pada
CREATE OR REPLACE FUNCTION set_diperbarui_pada() RETURNS TRIGGER AS $$
BEGIN NEW.diperbarui_pada = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_sub_rayon BEFORE UPDATE ON sub_rayon FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_sekolah BEFORE UPDATE ON sekolah FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_operator BEFORE UPDATE ON operator FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_ptk BEFORE UPDATE ON ptk FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_sertifikasi BEFORE UPDATE ON sertifikasi FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_penerimaan_bosp BEFORE UPDATE ON penerimaan_bosp FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
