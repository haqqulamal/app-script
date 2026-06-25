const SHEET_NAME = "Data Keuangan";
const HEADERS = [
  "ID",
  "Tanggal",
  "Jenis",
  "Kategori",
  "Deskripsi",
  "Nominal",
  "Metode Bayar",
  "Catatan",
];

// ─── doGet: Render halaman utama ───────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Daily Finance Tracker")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

// ─── getOrCreateSheet: Ambil/buat sheet ────────────
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet
      .getRange(1, 1, 1, HEADERS.length)
      .setBackground("#1a7a3c")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  }
  return sheet;
}

// ─── formatSheetDate: Handle Date obj dari Sheets ──
function formatSheetDate(val) {
  if (val instanceof Date) {
    var d = val.getDate(),
      m = val.getMonth() + 1,
      y = val.getFullYear();
    return (d < 10 ? "0" : "") + d + "/" + (m < 10 ? "0" : "") + m + "/" + y;
  }
  return val ? val.toString() : "";
}

// ─── getData: Ambil semua data transaksi ───────────
function getData() {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    return data
      .filter((row) => row[0] !== "")
      .map((row) => ({
        id: row[0].toString(),
        tanggal: formatSheetDate(row[1]),
        jenis: row[2].toString(),
        kategori: row[3].toString(),
        deskripsi: row[4].toString(),
        nominal: Number(row[5]),
        metode: row[6] ? row[6].toString() : "",
        catatan: row[7] ? row[7].toString() : "",
      }));
  } catch (e) {
    throw new Error("Gagal mengambil data: " + e.message);
  }
}

// ─── addData: Tambah transaksi baru ───────────────
function addData(data) {
  try {
    const sheet = getOrCreateSheet();
    const id = new Date().getTime().toString();
    sheet.appendRow([
      id,
      data.tanggal,
      data.jenis,
      data.kategori,
      data.deskripsi,
      Number(data.nominal),
      data.metode || "",
      data.catatan || "",
    ]);
    return { success: true, id: id };
  } catch (e) {
    throw new Error("Gagal menambah data: " + e.message);
  }
}

// ─── updateData: Update transaksi berdasarkan ID ──
function updateData(data) {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("Data tidak ditemukan");

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0].toString() === data.id.toString()) {
        const rowNum = i + 2;
        sheet
          .getRange(rowNum, 2, 1, 7)
          .setValues([
            [
              data.tanggal,
              data.jenis,
              data.kategori,
              data.deskripsi,
              Number(data.nominal),
              data.metode || "",
              data.catatan || "",
            ],
          ]);
        return { success: true };
      }
    }
    throw new Error("ID tidak ditemukan: " + data.id);
  } catch (e) {
    throw new Error("Gagal memperbarui data: " + e.message);
  }
}

// ─── deleteData: Hapus transaksi berdasarkan ID ───
function deleteData(id) {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("Data tidak ditemukan");

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0].toString() === id.toString()) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    throw new Error("ID tidak ditemukan: " + id);
  } catch (e) {
    throw new Error("Gagal menghapus data: " + e.message);
  }
}
