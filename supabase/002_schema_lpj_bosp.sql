-- ============================================================
-- SISR CIBADAK - Skema Database PostgreSQL
-- File 002: Modul LPJ BOSP & Pendukung
-- ============================================================

-- --- BOSP Entries: menyatukan 13 kategori LPJ BOSP dalam 1 tabel (kolom `kategori` membedakan) ---
-- Kategori "simple": honor_kegiatan, daya_jasa, biaya_pendaftaran_lomba, makan_minum, perjalanan_dinas
-- Kategori "barang": rincian_belanja_pemeliharaan, pemeliharaan_komputer, rincian_jasa_pemeliharaan,
--                     upah_pemeliharaan_komputer, peralatan_mesin_kib_b, aset_lainnya_kib_e, belanja_barang_habis_pakai
-- Kategori "jasa_pendidik": jasa_pendidik_tendik
CREATE TABLE bosp_entries (
  id SERIAL PRIMARY KEY,
  kategori TEXT NOT NULL CHECK (kategori IN (
    'honor_kegiatan','daya_jasa','biaya_pendaftaran_lomba','makan_minum','perjalanan_dinas',
    'rincian_belanja_pemeliharaan','pemeliharaan_komputer','rincian_jasa_pemeliharaan','upah_pemeliharaan_komputer',
    'peralatan_mesin_kib_b','aset_lainnya_kib_e','belanja_barang_habis_pakai','jasa_pendidik_tendik'
  )),
  triwulan INT NOT NULL CHECK (triwulan BETWEEN 1 AND 4),
  tahun_anggaran TEXT NOT NULL,
  tanggal DATE,
  npsn TEXT REFERENCES sekolah(npsn) ON UPDATE CASCADE,
  -- Field bersama kategori "simple"
  uraian TEXT,
  volume NUMERIC(14,2) DEFAULT 0,
  satuan TEXT,
  harga_satuan NUMERIC(14,2) DEFAULT 0,
  jumlah NUMERIC(14,2) DEFAULT 0,
  -- Field khusus kategori "barang"
  kode_upb TEXT,
  nama_barang TEXT,
  merk_barang TEXT,
  asal_usul TEXT CHECK (asal_usul IS NULL OR asal_usul IN ('BOSP/JKN','BOSP Kinerja')),
  keterangan TEXT,
  -- Field khusus kategori "jasa_pendidik_tendik"
  ptk_nrg TEXT REFERENCES ptk(nrg),
  nuptk TEXT,
  sub_rayon_id INT REFERENCES sub_rayon(id),
  input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bosp_entries_kat_tw ON bosp_entries(kategori, triwulan, tahun_anggaran);
CREATE INDEX idx_bosp_entries_npsn ON bosp_entries(npsn);

-- --- Lampiran 2a/2b/2c (Pemberkasan TPG PTK) ---
CREATE TABLE lampiran_2a (
  id SERIAL PRIMARY KEY,
  triwulan INT NOT NULL CHECK (triwulan BETWEEN 1 AND 4),
  tahun_anggaran TEXT NOT NULL,
  ptk_nrg TEXT REFERENCES ptk(nrg),
  nuptk TEXT, nama_ptk TEXT, status_kepegawaian TEXT, nama_sekolah TEXT, gaji_pokok NUMERIC(14,2) DEFAULT 0, npwp TEXT,
  sub_rayon_id INT REFERENCES sub_rayon(id), input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(), diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE lampiran_2b (
  id SERIAL PRIMARY KEY,
  triwulan INT NOT NULL CHECK (triwulan BETWEEN 1 AND 4),
  tahun_anggaran TEXT NOT NULL,
  ptk_nrg TEXT REFERENCES ptk(nrg),
  nuptk TEXT, nama_ptk TEXT, nama_sekolah TEXT, tmt DATE, keterangan TEXT,
  sub_rayon_id INT REFERENCES sub_rayon(id), input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(), diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE lampiran_2c (
  id SERIAL PRIMARY KEY,
  triwulan INT NOT NULL CHECK (triwulan BETWEEN 1 AND 4),
  tahun_anggaran TEXT NOT NULL,
  ptk_nrg TEXT REFERENCES ptk(nrg),
  nama_ptk TEXT, tempat_tugas TEXT REFERENCES sekolah(npsn) ON UPDATE CASCADE, jenis_kenaikan TEXT,
  golongan_dimiliki TEXT, masa_kerja_dimiliki TEXT, pangkat_berkala_baru TEXT, tmt_sk_terbaru DATE,
  gaji_pokok_lama NUMERIC(14,2) DEFAULT 0, gaji_pokok_baru NUMERIC(14,2) DEFAULT 0,
  sub_rayon_id INT REFERENCES sub_rayon(id), input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(), diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Laporan Realisasi BOSP-Form BPK (1 baris per sekolah per tahun anggaran) ---
CREATE TABLE laporan_bpk (
  id SERIAL PRIMARY KEY,
  tahun_anggaran TEXT NOT NULL,
  npsn TEXT NOT NULL REFERENCES sekolah(npsn) ON UPDATE CASCADE,
  saldo_bank_tw1 NUMERIC(14,2) DEFAULT 0, saldo_bank_tw2 NUMERIC(14,2) DEFAULT 0,
  saldo_bank_tw3 NUMERIC(14,2) DEFAULT 0, saldo_bank_tw4 NUMERIC(14,2) DEFAULT 0,
  saldo_tunai_tw1 NUMERIC(14,2) DEFAULT 0, saldo_tunai_tw2 NUMERIC(14,2) DEFAULT 0,
  saldo_tunai_tw3 NUMERIC(14,2) DEFAULT 0, saldo_tunai_tw4 NUMERIC(14,2) DEFAULT 0,
  sub_rayon_id INT REFERENCES sub_rayon(id), input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(), diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tahun_anggaran, npsn)
);

-- --- BKU (Buku Kas Umum) ---
CREATE TABLE bku_entries (
  id SERIAL PRIMARY KEY,
  triwulan INT NOT NULL CHECK (triwulan BETWEEN 1 AND 4),
  tahun_anggaran TEXT NOT NULL,
  tanggal DATE NOT NULL,
  kode_kegiatan TEXT, kode_rekening TEXT, no_bukti TEXT, uraian TEXT,
  penerimaan NUMERIC(14,2) DEFAULT 0, pengeluaran NUMERIC(14,2) DEFAULT 0,
  verifikasi_kategori TEXT,
  sub_rayon_id INT REFERENCES sub_rayon(id), input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(), diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE bku_saldo_awal (
  triwulan INT NOT NULL, tahun_anggaran TEXT NOT NULL, input_by TEXT NOT NULL,
  saldo_awal NUMERIC(14,2) DEFAULT 0, saldo_tunai_awal NUMERIC(14,2) DEFAULT 0, saldo_bank_awal NUMERIC(14,2) DEFAULT 0,
  PRIMARY KEY (triwulan, tahun_anggaran, input_by)
);

-- --- Stock Opname ---
CREATE TABLE stock_opname (
  id SERIAL PRIMARY KEY,
  tahun_anggaran TEXT NOT NULL,
  npsn TEXT REFERENCES sekolah(npsn) ON UPDATE CASCADE,
  nama_barang TEXT, unit TEXT, harga NUMERIC(14,2) DEFAULT 0,
  saldo_awal_kuantitas NUMERIC(14,2) DEFAULT 0, penerimaan_kuantitas NUMERIC(14,2) DEFAULT 0, pengeluaran_kuantitas NUMERIC(14,2) DEFAULT 0,
  keterangan TEXT,
  sub_rayon_id INT REFERENCES sub_rayon(id), input_by TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(), diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Pajak --- (data bulanan: saldo awal + 12 bulan x {debit, kredit} per pengguna per tahun anggaran)
CREATE TABLE pajak_data (
  id SERIAL PRIMARY KEY,
  tahun_anggaran TEXT NOT NULL,
  input_by TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{"saldoAwal":0,"bulan":[]}',
  sub_rayon_id INT REFERENCES sub_rayon(id),
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(), diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tahun_anggaran, input_by)
);

-- --- Informasi (pengumuman superadmin -> admin) ---
CREATE TABLE informasi (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL, isi TEXT, deadline DATE,
  tujuan_jabatan TEXT[] NOT NULL DEFAULT '{}',
  terkirim BOOLEAN NOT NULL DEFAULT false,
  tanggal_dibuat TIMESTAMPTZ NOT NULL DEFAULT now(),
  tanggal_kirim TIMESTAMPTZ
);

-- --- User Manual (upload PDF panduan) ---
CREATE TABLE user_manual (
  id SERIAL PRIMARY KEY,
  nama_manual TEXT NOT NULL,
  tanggal_upload DATE NOT NULL,
  file_data TEXT, -- data URL base64 (PDF)
  file_name TEXT,
  file_size_kb NUMERIC(10,2),
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Format Surat (template docx yang diunggah + info surat per tahun) ---
-- --- Format Surat (template docx per jenis surat + info surat per tahun) ---
CREATE TABLE format_surat (
  id SERIAL PRIMARY KEY,
  tahun_anggaran TEXT NOT NULL UNIQUE,
  file_docx_map JSONB DEFAULT '{}', -- {rekom2a: {dataUrl, filename, sizeKb, uploadedAt}, penghentian: {...}, pernyataan: {...}}
  nomor_surat_map JSONB DEFAULT '{}',
  edited_surat_map JSONB DEFAULT '{}',
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger auto-update timestamp untuk semua tabel baru di atas
CREATE TRIGGER trg_upd_bosp_entries BEFORE UPDATE ON bosp_entries FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_lampiran_2a BEFORE UPDATE ON lampiran_2a FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_lampiran_2b BEFORE UPDATE ON lampiran_2b FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_lampiran_2c BEFORE UPDATE ON lampiran_2c FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_laporan_bpk BEFORE UPDATE ON laporan_bpk FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_bku_entries BEFORE UPDATE ON bku_entries FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_stock_opname BEFORE UPDATE ON stock_opname FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();
CREATE TRIGGER trg_upd_pajak_data BEFORE UPDATE ON pajak_data FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();

-- Trigger: hitung otomatis kolom `jumlah` pada bosp_entries (volume x harga_satuan), meniru logika prototipe
CREATE OR REPLACE FUNCTION hitung_jumlah_bosp() RETURNS TRIGGER AS $$
BEGIN
  NEW.jumlah = COALESCE(NEW.volume,0) * COALESCE(NEW.harga_satuan,0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_hitung_jumlah_bosp BEFORE INSERT OR UPDATE ON bosp_entries FOR EACH ROW EXECUTE FUNCTION hitung_jumlah_bosp();
