# Ledger Harian

Ledger Harian adalah aplikasi pencatat keuangan pribadi berbasis Google Apps Script dan Google Sheets. Aplikasi ini dibuat untuk kebutuhan pencatatan pemasukan, pengeluaran, anggaran kategori, transaksi rutin, serta monitoring saldo dalam satu dashboard yang bisa diakses lewat browser dan Telegram.

## Fitur utama

- Catat transaksi harian dengan tipe pemasukan dan pengeluaran
- Dashboard saldo, total pemasukan, dan total pengeluaran
- Filter, pencarian, dan riwayat transaksi per profil
- Budget bulanan per kategori
- Transaksi rutin otomatis yang dibuat setiap bulan
- Rekap laporan bulanan dan grafik pengeluaran per kategori
- Integrasi Telegram bot untuk menambah transaksi via chat
- Fitur OCR sederhana untuk membaca struk foto menggunakan Google Vision API
- Multi-profil dengan nama profil dan PIN untuk memisahkan data antar pengguna
- Export data ke format CSV dan export laporan ke PDF dari browser

## Struktur project

```text
.
├── Kode.gs          # Logika utama Apps Script, sheet, profil, transaksi, export
├── Telegram.gs      # Webhook Telegram, parser pesan, perintah bot, OCR struk
├── index.html       # Antarmuka web aplikasi
├── appscript.json   # Manifest Google Apps Script
├── LICENSE
├── README.md
└── .clasp.json      # Opsional, jika project dipakai dengan clasp
```

## Prasyarat

- Akun Google
- Spreadsheet Google
- Google Apps Script
- Koneksi internet untuk CDN frontend:
  - Google Fonts
  - Chart.js
  - Lucide Icons
- Bot Telegram dari BotFather (opsional, untuk fitur Telegram)
- Google Vision API key (opsional, untuk fitur OCR struk)

Tidak diperlukan Node.js, npm, Composer, MySQL, atau server lokal.

## Setup aplikasi di Google Apps Script

1. Buat spreadsheet baru di Google Drive.
2. Buka spreadsheet lalu masuk ke menu `Extensions > Apps Script`.
3. Buat file baru dan salin isi dari project ini:
   - `Kode.gs`
   - `Telegram.gs`
   - `index.html`
   - `appscript.json`
4. Simpan project.
5. Jika diperlukan, aktifkan permissions yang diminta oleh Apps Script.

## Konfigurasi Script Properties

Beberapa fitur membutuhkan value yang disimpan di Script Properties di Apps Script.

### 1) Telegram Bot token

Masuk ke `Project Settings > Script Properties` lalu tambahkan:

```text
TELEGRAM_BOT_TOKEN = token_bot_kamu
```

### 2) Google Vision API key (opsional)

Untuk fitur scan struk otomatis, tambahkan:

```text
GOOGLE_VISION_API_KEY = api_key_kamu
```

> Jangan menaruh token atau API key di source code secara langsung.

## Deploy web app

1. Di editor Apps Script, klik `Deploy > New deployment`.
2. Pilih type `Web app`.
3. Gunakan konfigurasi:
   - Execute as: `Me`
   - Who has access: `Anyone`
4. Klik `Deploy`.
5. Copy URL hasil deploy yang berakhiran `/exec`.

Setelah perubahan kode, deploy ulang dengan cara:

```text
Deploy > Manage deployments > Edit > New version > Deploy
```

## Profil dan privacy

Aplikasi memakai sistem profil + PIN agar data antar pengguna tidak bercampur di satu spreadsheet.

### Cara login di web

1. Buka URL web app.
2. Masukkan nama profil, misalnya `haqqu`.
3. Masukkan PIN minimal 4 karakter.
4. Jika profil belum ada, aplikasi akan otomatis membuat profil baru.

### Cara login di Telegram

```text
/profil haqqu 1234
```

Setelah terhubung, semua perintah seperti `/saldo`, `/hariini`, dan transaksi baru akan memakai profil yang sama.

### Data lama

Sheet `Data Keuangan`, `Budget Kategori`, dan `Transaksi Rutin` memiliki kolom `Pemilik`.
Untuk menampilkan data lama pada profil tertentu, isi kolom `Pemilik` dengan format:

```text
profile:haqqu
```

Artinya data tersebut dimiliki oleh profil `haqqu`.

## Sheet yang dibuat otomatis

Aplikasi akan membuat sheet berikut jika belum ada:

- `Data Keuangan`
- `Budget Kategori`
- `Transaksi Rutin`
- `Profil User`

### `Data Keuangan`

```text
ID | Tanggal | Jenis | Kategori | Deskripsi | Nominal | Metode Bayar | Catatan | Pemilik
```

### `Budget Kategori`

```text
Kategori | Budget Bulanan | Pemilik
```

### `Transaksi Rutin`

```text
ID | Jenis | Kategori | Deskripsi | Nominal | Metode Bayar | Catatan | Tanggal Mulai | Hari Tagih | Aktif | Terakhir Dibuat | Pemilik
```

### `Profil User`

```text
Profil | PIN Hash | Dibuat Pada
```

## Bot Telegram

### Set webhook

Setelah bot dibuat via BotFather dan token sudah disimpan, arahkan webhook ke URL web app:

```text
https://api.telegram.org/botTOKEN_BOT_KAMU/setWebhook?url=URL_WEB_APP_EXEC
```

Contoh:

```text
https://api.telegram.org/bot123456:ABC/setWebhook?url=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Webhook biasanya tidak perlu diatur ulang jika token dan deployment tetap sama.

### Perintah Telegram

Hubungkan profil:

```text
/profil nama PIN
```

Contoh:

```text
/profil haqqu 1234
```

Perintah lain:

```text
/start
/help
/id
/unlink
/saldo
/hariini
/today
```

### Format catat transaksi via Telegram

```text
k 15rb kopi pagi #makanan @tunai
m 2jt gaji bulanan #gaji @transfer
k 50000 bensin
```

Tipe transaksi:

```text
k / keluar / - / out    = Pengeluaran
m / masuk / + / in      = Pemasukan
```

### Format nominal

Nominal bisa ditulis dalam format seperti:

```text
15000
15.000
15rb
15ribu
1.5jt
2juta
```

### Mengirim foto struk

Bot juga bisa membaca foto struk untuk mendeteksi nominal dan informasi transaksi secara otomatis, selama `GOOGLE_VISION_API_KEY` sudah diisi.

## Keamanan dan catatan penting

- Jangan pernah commit token bot ke repository publik.
- Simpan token di Script Properties, bukan di source code.
- PIN tersimpan dalam bentuk hash pada sheet `Profil User`.
- Karena web app menggunakan akses `Anyone`, pastikan URL web app tidak dibagikan sembarangan.
- Jika token bot terbuka di screenshot, log, atau repo publik, revoke token tersebut di BotFather dan buat token baru.

## Pengembangan

Project ini tidak memiliki build step. Untuk melakukan perubahan, cukup edit file source lalu simpan di Apps Script dan deploy versi baru.

Untuk validasi sintaks sederhana di lokal, bisa digunakan perintah berikut:

```bash
node --input-type=commonjs --check < Kode.gs
node --input-type=commonjs --check < Telegram.gs
```

Untuk `index.html`, disarankan untuk memeriksa script di dalam tag `<script>` sebelum deployment jika ada perubahan besar.

## Lisensi

Project ini dilisensikan di bawah MIT License. Lihat file LICENSE untuk detail lengkap.
