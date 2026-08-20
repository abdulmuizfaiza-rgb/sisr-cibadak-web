const { Pool } = require('pg');

// Supabase menyediakan 2 jenis koneksi:
// 1. "Direct connection" (port 5432) -- cocok untuk aplikasi yang selalu menyala (misal server biasa)
// 2. "Connection pooler" (port 6543, mode transaction/PgBouncer) -- WAJIB dipakai untuk fungsi
//    serverless seperti Netlify Functions, karena setiap pemanggilan fungsi bisa membuka koneksi
//    baru, dan tanpa pooler jumlah koneksi cepat habis (Supabase punya batas koneksi langsung).
// Ambil connection string LENGKAP dari Supabase Dashboard > Project Settings > Database >
// "Connection string" > pilih tab "Transaction" (pooler), lalu simpan sebagai env var DATABASE_URL
// di Netlify (Site settings > Environment variables).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase mewajibkan koneksi SSL
  max: 1, // di lingkungan serverless, tiap pemanggilan fungsi sebaiknya pakai sedikit koneksi
});

pool.on('error', (err) => {
  console.error('Kesalahan tak terduga pada koneksi database Supabase:', err);
});

module.exports = { pool };
