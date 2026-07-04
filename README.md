# Ledger Harian

Ledger Harian adalah aplikasi pencatat keuangan berbasis Google Apps Script dan Google Sheets. Aplikasi ini menyediakan dashboard mobile, pencatatan pemasukan/pengeluaran, laporan bulanan, budget kategori, transaksi rutin, export CSV/PDF, insight otomatis, dan integrasi Telegram Bot.

## Fitur

- Catat pemasukan dan pengeluaran harian.
- Data pribadi dipisahkan memakai profil + PIN.
- Website dan Telegram bisa memakai data profil yang sama.
- Dashboard saldo, total pemasukan, dan total pengeluaran.
- Riwayat transaksi dengan filter jenis, tanggal, dan pencarian.
- Laporan bulanan dengan grafik pemasukan vs pengeluaran.
- Distribusi pengeluaran per kategori.
- Budget bulanan per kategori dengan progress pemakaian.
- Transaksi rutin bulanan untuk gaji, kos, tagihan, internet, dan kebutuhan berulang lain.
- Insight otomatis, seperti kategori terbesar dan perubahan pengeluaran dibanding bulan sebelumnya.
- Export data ke CSV.
- Export laporan ke PDF melalui print/save PDF browser.
- Telegram Bot untuk mencatat transaksi lewat chat.

## Struktur File

```text
.
|-- Kode.gs          # Backend utama Apps Script dan operasi Google Sheets
|-- Telegram.gs      # Webhook dan command Telegram Bot
|-- index.html       # UI aplikasi web
|-- appscript.json   # Manifest Apps Script
|-- LICENSE
`-- README.md
```

## Kebutuhan

- Akun Google.
- Google Spreadsheet.
- Google Apps Script.
- Koneksi internet untuk CDN frontend:
  - Google Fonts
  - Chart.js
  - Lucide Icons
- Opsional: Telegram Bot dari BotFather.

Tidak membutuhkan Node.js, npm, Composer, Laravel, MySQL, atau server lokal.

## Setup Google Apps Script

1. Buat Google Spreadsheet baru.
2. Buka `Extensions > Apps Script`.
3. Buat/isi file berikut di Apps Script:
   - `Kode.gs`
   - `Telegram.gs`
   - `index.html`
   - `appscript.json`
4. Klik `Save`.

## Deploy Web App

1. Klik `Deploy > New deployment`.
2. Pilih type `Web app`.
3. Gunakan pengaturan:
   - Execute as: `Me`
   - Who has access: `Anyone`
4. Klik `Deploy`.
5. Izinkan permission yang diminta Google.
6. Copy URL Web App yang berakhiran `/exec`.

Setelah melakukan perubahan kode, deploy ulang lewat:

```text
Deploy > Manage deployments > Edit > New version > Deploy
```

## Mode Privasi Profil

Aplikasi memakai profil + PIN agar data tidak bercampur walaupun URL web app dibuka orang lain.

Cara pakai di website:

1. Buka URL Web App.
2. Isi `Nama Profil`, misalnya `haqqu`.
3. Isi PIN minimal 4 karakter.
4. Profil baru akan dibuat otomatis jika belum ada.

Cara pakai di Telegram:

```text
/profil haqqu 1234
```

Gunakan nama profil dan PIN yang sama dengan website. Setelah tersambung, `/saldo`, `/hariini`, dan catatan transaksi Telegram akan membaca data profil tersebut.

Catatan migrasi data lama:

- Sheet `Data Keuangan`, `Budget Kategori`, dan `Transaksi Rutin` punya kolom `Pemilik`.
- Agar data lama muncul di profil kamu, isi kolom `Pemilik` dengan format `profile:nama`.
- Contoh untuk profil `haqqu`: isi `profile:haqqu` pada baris data lama yang ingin dimiliki profil itu.
- Orang lain bisa membuat profil dan PIN sendiri, sehingga mereka hanya melihat data miliknya.

## Sheet yang Digunakan

Aplikasi akan membuat sheet berikut secara otomatis jika belum ada:

- `Data Keuangan`
- `Budget Kategori`
- `Transaksi Rutin`
- `Profil User`

### Data Keuangan

Kolom utama:

```text
ID | Tanggal | Jenis | Kategori | Deskripsi | Nominal | Metode Bayar | Catatan | Pemilik
```

### Budget Kategori

Kolom:

```text
Kategori | Budget Bulanan | Pemilik
```

### Transaksi Rutin

Kolom:

```text
ID | Jenis | Kategori | Deskripsi | Nominal | Metode Bayar | Catatan | Tanggal Mulai | Hari Tagih | Aktif | Terakhir Dibuat | Pemilik
```

### Profil User

Kolom:

```text
Profil | PIN Hash | Dibuat Pada
```

## Setup Telegram Bot

1. Buat bot melalui BotFather di Telegram.
2. Copy token bot.
3. Buka Apps Script.
4. Masuk ke `Project Settings`.
5. Tambahkan Script Property:

```text
Property: TELEGRAM_BOT_TOKEN
Value: token_bot_kamu
```

Jangan menaruh token langsung di source code.

## Set Webhook Telegram

Webhook perlu diarahkan ke URL Web App `/exec`.

Buka browser dan akses URL berikut setelah mengganti bagian token dan URL:

```text
https://api.telegram.org/botTOKEN_BOT_KAMU/setWebhook?url=URL_WEB_APP_EXEC
```

Contoh format:

```text
https://api.telegram.org/bot123456:ABC/setWebhook?url=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Jika webhook sebelumnya sudah berhasil dan deployment yang sama masih dipakai, webhook tidak perlu diset ulang. Set ulang webhook hanya jika:

- Mengganti token bot.
- Revoke token di BotFather.
- Membuat deployment Web App baru dengan URL berbeda.
- Menghapus deployment lama.
- Pindah project Apps Script.

## Command Telegram

Hubungkan profil:

```text
/profil haqqu 1234
```

Format pencatatan:

```text
k 15rb kopi pagi #makanan @tunai
m 2jt gaji bulanan #gaji @transfer
k 50000 bensin
```

Tipe:

```text
k / keluar / - / out    = Pengeluaran
m / masuk / + / in      = Pemasukan
```

Command lain:

```text
/start
/help
/id
/saldo
/hariini
/today
```

## Format Nominal Telegram

Nominal bisa ditulis seperti:

```text
15000
15.000
15rb
15ribu
1.5jt
2juta
```

## Export PDF

Export PDF dilakukan dari halaman laporan. Klik `Export PDF`, lalu browser akan membuka halaman print. Pilih `Save as PDF`.

## Catatan Keamanan

- Jangan commit token Telegram.
- Simpan token hanya di Script Properties dengan nama `TELEGRAM_BOT_TOKEN`.
- Jika token pernah terlihat di screenshot/chat/public repo, revoke token melalui BotFather lalu buat token baru.
- PIN disimpan sebagai hash di sheet `Profil User`, tetapi tetap gunakan PIN yang tidak mudah ditebak.
- Karena konfigurasi web app memakai akses `Anyone`, gunakan URL dengan hati-hati.

## Development

Project ini tidak memakai build step. Edit file langsung, lalu salin ke Apps Script dan deploy versi baru.

Untuk cek sintaks lokal secara sederhana:

```bash
node --input-type=commonjs --check < Kode.gs
node --input-type=commonjs --check < Telegram.gs
```

Untuk `index.html`, cek script di dalam tag `<script>` sebelum deploy jika melakukan perubahan besar.
