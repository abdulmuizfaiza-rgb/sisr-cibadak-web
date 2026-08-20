# Panduan Deploy SISR Cibadak Versi Online (Supabase + Netlify)

Ikuti langkah-langkah ini **persis urutannya**. Setiap langkah sudah saya uji logikanya di sandbox saya — tugas Anda hanya mengeklik di website Supabase & Netlify sesuai instruksi.

---

## BAGIAN 1: Siapkan Database di Supabase

### 1.1 Buat Project Baru
1. Buka https://supabase.com dan login
2. Klik **"New Project"**
3. Isi:
   - **Name**: `sisr-cibadak` (bebas)
   - **Database Password**: buat password kuat, **SIMPAN BAIK-BAIK** (akan dipakai lagi nanti)
   - **Region**: pilih **Southeast Asia (Singapore)** — paling dekat dengan Indonesia
4. Klik **Create new project**, tunggu 1-2 menit sampai selesai disiapkan

### 1.2 Jalankan Skema Database
1. Di dashboard project, klik menu **SQL Editor** (ikon `</>`  di sidebar kiri)
2. Klik **New Query**
3. Buka file `supabase/001_schema_inti.sql` dari paket yang saya kirim, **copy semua isinya**, paste ke SQL Editor, klik **Run** (atau Ctrl+Enter)
4. Pastikan muncul "Success. No rows returned" (bukan error)
5. Klik **New Query** lagi, ulangi untuk file `supabase/002_schema_lpj_bosp.sql`

### 1.3 Ambil Connection String (untuk disambungkan ke Netlify nanti)
1. Klik ikon **⚙️ Project Settings** (sidebar kiri bawah) → **Database**
2. Cari bagian **"Connection string"**
3. Pilih tab **"Transaction"** (bukan "Session" atau "Direct connection" — ini penting untuk Netlify Functions)
4. Copy connection string-nya (bentuknya seperti: `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-x-xx-xxxx.pooler.supabase.com:6543/postgres`)
5. Ganti bagian `[YOUR-PASSWORD]` dengan password database yang Anda buat di langkah 1.1
6. **Simpan connection string lengkap ini** — akan dipakai di Bagian 2

---

## BAGIAN 2: Deploy ke Netlify

### 2.1 Upload Kode ke GitHub (kalau belum)
1. Buat repository baru di https://github.com (bisa **Private**)
2. Upload/push semua isi folder `sisr-web` yang saya kirim ke repository itu

### 2.2 Hubungkan ke Netlify
1. Buka https://app.netlify.com dan login
2. Klik **Add new site** → **Import an existing project**
3. Pilih **GitHub**, pilih repository yang tadi dibuat
4. Di bagian **Build settings**, biarkan default (netlify.toml sudah mengatur semuanya otomatis)
5. **Jangan klik Deploy dulu** — isi Environment Variables terlebih dahulu (langkah berikutnya)

### 2.3 Atur Environment Variable (Sambungkan ke Supabase)
1. Sebelum/sesudah deploy pertama, buka **Site settings** → **Environment variables**
2. Klik **Add a variable**
3. Key: `DATABASE_URL`
4. Value: **paste connection string dari Bagian 1.3**
5. Simpan, lalu klik **Deploy site** (atau **Trigger deploy** kalau sudah pernah deploy sebelumnya)

### 2.4 Tunggu Proses Deploy Selesai
- Lihat tab **Deploys**, tunggu sampai status **"Published"**
- Netlify akan memberi Anda alamat seperti `https://nama-acak-anda.netlify.app`

---

## BAGIAN 3: Buka & Gunakan Aplikasi

1. Buka alamat `https://nama-acak-anda.netlify.app` di browser
2. Karena database masih kosong, akan muncul layar **"Buat Akun Superadmin Pertama"**
3. Isi Nama, Username, Password → klik **Buat Akun & Mulai Gunakan Aplikasi**
4. Login dengan akun yang baru dibuat, lanjutkan seperti biasa (buat Profil Sub Rayon dulu, dst.)

---

## Kalau Ada Error

**Kirim ke saya persis:**
1. Screenshot error yang muncul di aplikasi
2. Buka Netlify → **Functions** tab → klik fungsi `api` → lihat **Function log**, kirim isinya kalau ada error merah di sana

## Catatan Keamanan Penting

- Saya sudah tambahkan **proteksi anti tebak-password** (maksimal 8 kali salah dalam 15 menit per alamat internet, otomatis diblokir sementara) — sudah saya uji dan bekerja
- **Ganti password default segera** setelah login pertama kali
- Jangan bagikan connection string Supabase ke siapapun selain saat mengisi Environment Variable di Netlify
