const SHEET_NAME = "Data Keuangan";
const BUDGET_SHEET_NAME = "Budget Kategori";
const RECURRING_SHEET_NAME = "Transaksi Rutin";
const PROFILE_SHEET_NAME = "Profil User";
const OWNER_HEADER = "Pemilik";
const HEADERS = [
  "ID",
  "Tanggal",
  "Jenis",
  "Kategori",
  "Deskripsi",
  "Nominal",
  "Metode Bayar",
  "Catatan",
  OWNER_HEADER,
];
const BUDGET_HEADERS = ["Kategori", "Budget Bulanan", OWNER_HEADER];
const RECURRING_HEADERS = [
  "ID",
  "Jenis",
  "Kategori",
  "Deskripsi",
  "Nominal",
  "Metode Bayar",
  "Catatan",
  "Tanggal Mulai",
  "Hari Tagih",
  "Aktif",
  "Terakhir Dibuat",
  OWNER_HEADER,
];
const PROFILE_HEADERS = ["Profil", "PIN Hash", "Dibuat Pada"];

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Ledger Harian")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

function getOrCreateSheet() {
  return getOrCreateNamedSheet(SHEET_NAME, HEADERS, "#1a7a3c");
}

function getOrCreateNamedSheet(name, headers, color) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setBackground(color || "#17231f")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  }
  ensureHeaders(sheet, headers);
  return sheet;
}

function ensureHeaders(sheet, headers) {
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  headers.forEach((header, index) => {
    if (existing[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
}

function normalizeProfileName_(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashPin_(pin) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(pin || ""),
    Utilities.Charset.UTF_8,
  );
  return Utilities.base64Encode(raw);
}

function profileOwner_(profileName) {
  const profile = normalizeProfileName_(profileName);
  return profile ? "profile:" + profile : "";
}

function ensureProfile(auth) {
  try {
    const profile = normalizeProfileName_(auth && auth.profileName);
    const pin = auth && auth.pin ? String(auth.pin) : "";
    if (!profile) throw new Error("Nama profil wajib diisi");
    if (pin.length < 4) throw new Error("PIN minimal 4 karakter");

    const sheet = getOrCreateNamedSheet(PROFILE_SHEET_NAME, PROFILE_HEADERS);
    const lastRow = sheet.getLastRow();
    const hash = hashPin_(pin);

    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, PROFILE_HEADERS.length).getValues();
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0].toString() === profile) {
          if (rows[i][1].toString() !== hash) throw new Error("PIN profil salah");
          return { success: true, profileName: profile, owner: profileOwner_(profile) };
        }
      }
    }

    sheet.appendRow([profile, hash, new Date()]);
    return { success: true, profileName: profile, owner: profileOwner_(profile), created: true };
  } catch (e) {
    throw new Error("Gagal masuk profil: " + e.message);
  }
}

function requireOwnerKey_(auth) {
  if (typeof auth === "string") return auth;
  return ensureProfile(auth).owner;
}

function rowBelongsToOwner_(rowOwner, owner) {
  rowOwner = rowOwner ? rowOwner.toString() : "";
  return rowOwner === owner;
}

function formatSheetDate(val) {
  if (val instanceof Date) {
    var d = val.getDate(),
      m = val.getMonth() + 1,
      y = val.getFullYear();
    return (d < 10 ? "0" : "") + d + "/" + (m < 10 ? "0" : "") + m + "/" + y;
  }
  return val ? val.toString() : "";
}

function getData(auth) {
  try {
    const owner = requireOwnerKey_(auth);
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    return data
      .filter((row) => row[0] !== "" && rowBelongsToOwner_(row[8], owner))
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

function getAppState(auth) {
  const owner = requireOwnerKey_(auth);
  processRecurringTransactions(auth);
  return {
    profile: owner,
    transactions: getData(owner),
    budgets: getBudgets(owner),
    recurring: getRecurringTransactions(owner),
  };
}

function getBudgets(auth) {
  try {
    const owner = requireOwnerKey_(auth);
    const sheet = getOrCreateNamedSheet(BUDGET_SHEET_NAME, BUDGET_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    return sheet
      .getRange(2, 1, lastRow - 1, BUDGET_HEADERS.length)
      .getValues()
      .filter((row) => row[0] !== "" && rowBelongsToOwner_(row[2], owner))
      .map((row) => ({
        kategori: row[0].toString(),
        nominal: Number(row[1]) || 0,
      }));
  } catch (e) {
    throw new Error("Gagal mengambil budget: " + e.message);
  }
}

function saveBudget(data) {
  try {
    const owner = requireOwnerKey_(data.auth || data.owner);
    const sheet = getOrCreateNamedSheet(BUDGET_SHEET_NAME, BUDGET_HEADERS);
    const kategori = (data.kategori || "").toString().trim();
    const nominal = Number(data.nominal);
    if (!kategori) throw new Error("Kategori wajib diisi");
    if (!nominal || nominal <= 0) throw new Error("Budget harus lebih dari 0");

    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, BUDGET_HEADERS.length).getValues();
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0].toString().toLowerCase() === kategori.toLowerCase() && rowBelongsToOwner_(rows[i][2], owner)) {
          sheet.getRange(i + 2, 1, 1, BUDGET_HEADERS.length).setValues([[kategori, nominal, owner]]);
          return { success: true };
        }
      }
    }

    sheet.appendRow([kategori, nominal, owner]);
    return { success: true };
  } catch (e) {
    throw new Error("Gagal menyimpan budget: " + e.message);
  }
}

function deleteBudget(kategori, auth) {
  try {
    const owner = requireOwnerKey_(auth);
    const sheet = getOrCreateNamedSheet(BUDGET_SHEET_NAME, BUDGET_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true };

    const rows = sheet.getRange(2, 1, lastRow - 1, BUDGET_HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === kategori.toString() && rowBelongsToOwner_(rows[i][2], owner)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: true };
  } catch (e) {
    throw new Error("Gagal menghapus budget: " + e.message);
  }
}

function getRecurringTransactions(auth) {
  try {
    const owner = requireOwnerKey_(auth);
    const sheet = getOrCreateNamedSheet(RECURRING_SHEET_NAME, RECURRING_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    return sheet
      .getRange(2, 1, lastRow - 1, RECURRING_HEADERS.length)
      .getValues()
      .filter((row) => row[0] !== "" && rowBelongsToOwner_(row[11], owner))
      .map((row) => ({
        id: row[0].toString(),
        jenis: row[1].toString(),
        kategori: row[2].toString(),
        deskripsi: row[3].toString(),
        nominal: Number(row[4]) || 0,
        metode: row[5] ? row[5].toString() : "",
        catatan: row[6] ? row[6].toString() : "",
        tanggalMulai: formatSheetDate(row[7]),
        hariTagih: Number(row[8]) || 1,
        aktif: row[9] === true || row[9].toString().toLowerCase() === "true",
        terakhirDibuat: row[10] ? row[10].toString() : "",
      }));
  } catch (e) {
    throw new Error("Gagal mengambil transaksi rutin: " + e.message);
  }
}

function saveRecurringTransaction(data) {
  try {
    const owner = requireOwnerKey_(data.auth || data.owner);
    const sheet = getOrCreateNamedSheet(RECURRING_SHEET_NAME, RECURRING_HEADERS);
    const id = data.id ? data.id.toString() : new Date().getTime().toString();
    const row = [
      id,
      data.jenis,
      data.kategori,
      data.deskripsi,
      Number(data.nominal),
      data.metode || "",
      data.catatan || "",
      data.tanggalMulai || "",
      Number(data.hariTagih) || 1,
      data.aktif !== false,
      data.terakhirDibuat || "",
      owner,
    ];

    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, RECURRING_HEADERS.length).getValues();
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0].toString() === id && rowBelongsToOwner_(rows[i][11], owner)) {
          sheet.getRange(i + 2, 1, 1, RECURRING_HEADERS.length).setValues([row]);
          return { success: true, id: id };
        }
      }
    }

    sheet.appendRow(row);
    return { success: true, id: id };
  } catch (e) {
    throw new Error("Gagal menyimpan transaksi rutin: " + e.message);
  }
}

function deleteRecurringTransaction(id, auth) {
  try {
    const owner = requireOwnerKey_(auth);
    const sheet = getOrCreateNamedSheet(RECURRING_SHEET_NAME, RECURRING_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true };

    const rows = sheet.getRange(2, 1, lastRow - 1, RECURRING_HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === id.toString() && rowBelongsToOwner_(rows[i][11], owner)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: true };
  } catch (e) {
    throw new Error("Gagal menghapus transaksi rutin: " + e.message);
  }
}

function processRecurringTransactions(auth) {
  const owner = requireOwnerKey_(auth);
  const sheet = getOrCreateNamedSheet(RECURRING_SHEET_NAME, RECURRING_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, created: 0 };

  const now = new Date();
  const ym = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM");
  const month = now.getMonth();
  const year = now.getFullYear();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const rows = sheet.getRange(2, 1, lastRow - 1, RECURRING_HEADERS.length).getValues();
  let created = 0;

  rows.forEach((row, i) => {
    if (!rowBelongsToOwner_(row[11], owner)) return;
    const active = row[9] === true || row[9].toString().toLowerCase() === "true";
    if (!active || row[10] === ym) return;

    const start = row[7] instanceof Date ? row[7] : null;
    if (start && start > now) return;

    const dueDay = Math.min(Number(row[8]) || 1, lastDay);
    const dueDate = new Date(year, month, dueDay);
    if (dueDate > now) return;

    addData({
      tanggal: Utilities.formatDate(dueDate, "Asia/Jakarta", "dd/MM/yyyy"),
      jenis: row[1],
      kategori: row[2],
      deskripsi: row[3],
      nominal: Number(row[4]),
      metode: row[5] || "",
      catatan: row[6] || "Dibuat otomatis dari transaksi rutin",
      owner: owner,
    });
    sheet.getRange(i + 2, 11).setValue(ym);
    created++;
  });

  return { success: true, created: created };
}

function addData(data) {
  try {
    const owner = requireOwnerKey_(data.auth || data.owner);
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
      owner,
    ]);
    return { success: true, id: id };
  } catch (e) {
    throw new Error("Gagal menambah data: " + e.message);
  }
}

function updateData(data) {
  try {
    const owner = requireOwnerKey_(data.auth || data.owner);
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("Data tidak ditemukan");

    const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === data.id.toString() && rowBelongsToOwner_(rows[i][8], owner)) {
        const rowNum = i + 2;
        sheet
          .getRange(rowNum, 2, 1, 8)
          .setValues([
            [
              data.tanggal,
              data.jenis,
              data.kategori,
              data.deskripsi,
              Number(data.nominal),
              data.metode || "",
              data.catatan || "",
              owner,
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

function deleteData(id, auth) {
  try {
    const owner = requireOwnerKey_(auth);
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("Data tidak ditemukan");

    const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === id.toString() && rowBelongsToOwner_(rows[i][8], owner)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    throw new Error("ID tidak ditemukan: " + id);
  } catch (e) {
    throw new Error("Gagal menghapus data: " + e.message);
  }
}

function processReceiptImage(payload) {
  try {
    const auth = payload && payload.auth ? payload.auth : payload;
    const owner = requireOwnerKey_(auth);
    const dataUrl = payload && payload.dataUrl ? payload.dataUrl : "";
    if (!dataUrl) throw new Error("Gambar struk kosong");

    const content = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const bytes = Utilities.base64Decode(content);
    return processReceiptImageData_(bytes, owner);
  } catch (e) {
    throw new Error("Gagal membaca struk: " + e.message);
  }
}

function processReceiptImageData_(imageBytes, owner) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GOOGLE_VISION_API_KEY");
  if (!apiKey) {
    throw new Error("Belum ada GOOGLE_VISION_API_KEY. Tambahkan di Script Properties untuk fitur OCR struk.");
  }

  const requestBody = {
    requests: [{
      image: { content: Utilities.base64Encode(imageBytes) },
      features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
    }],
  };

  const response = UrlFetchApp.fetch(
    "https://vision.googleapis.com/v1/images:annotate?key=" + apiKey,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true,
    }
  );

  const json = JSON.parse(response.getContentText());
  if (json.error) {
    throw new Error(json.error.message || "OCR gagal");
  }

  const text =
    (json.responses && json.responses[0] && json.responses[0].fullTextAnnotation && json.responses[0].fullTextAnnotation.text) ||
    "";

  if (!text.trim()) {
    throw new Error("Gambar struk tidak terbaca. Coba gunakan foto yang lebih jelas.");
  }

  return parseReceiptText_(text, owner);
}

function parseReceiptText_(text, owner) {
  const lines = String(text)
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const combined = lines.join(" ");
  const priceMatch = combined.match(/(?:Rp|IDR|idr|rupiah)\s*[:]?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:,[0-9]{2})?)/gi);
  let nominal = 0;
  if (priceMatch && priceMatch.length) {
    const last = priceMatch[priceMatch.length - 1];
    const cleaned = last.replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(",", ".");
    nominal = Number(cleaned || 0);
  }

  const numMatches = [...combined.matchAll(/\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b|\b\d+(?:,\d{2})?\b/g)].map((m) => m[0]);
  if (!nominal && numMatches.length) {
    const candidate = numMatches.filter((n) => Number(n.replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(",", ".")) > 500)
      .sort((a, b) => Number(b.replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(",", ".")) - Number(a.replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(",", ".")))[0];
    nominal = Number((candidate || numMatches[numMatches.length - 1]).replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(",", "."));
  }

  const dateMatch = combined.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b|\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/);
  let tanggal = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
  if (dateMatch) {
    const raw = dateMatch[0].replace(/\//g, "-").replace(/\./g, "-");
    const parts = raw.split("-");
    if (parts.length === 3) {
      let d = Number(parts[0]), m = Number(parts[1]), y = Number(parts[2]);
      if (y < 100) y = 2000 + y;
      const dateObj = new Date(y, m - 1, d);
      if (!isNaN(dateObj.getTime())) {
        tanggal = Utilities.formatDate(dateObj, "Asia/Jakarta", "dd/MM/yyyy");
      }
    }
  }

  let deskripsi = "Pembelian struk";
  const merchantLine = lines.find((line) => !/total|bayar|kembalian|cash|change|terima kasih|thank you|invoice|receipt/i.test(line) && line.length > 3);
  if (merchantLine) deskripsi = merchantLine;

  let kategori = "Lainnya";
  const low = combined.toLowerCase();
  if (/makan|resto|coffee|kopi|warung|food|bakso|nasi|pizza|ayam|sate|juice|milk/i.test(low)) kategori = "Makanan";
  else if (/bensin|ojol|grab|gocar|transport|taxi|kereta|bus|parkir|toll|pesawat|motor|mobil/i.test(low)) kategori = "Transport";
  else if (/listrik|internet|wifi|telkom|pulsa|air|indihome|pln|hp|operator|tagihan|voucher/i.test(low)) kategori = "Tagihan";
  else if (/obat|klinik|dokter|rs|rumah sakit|farmasi|kesehatan|apotek/i.test(low)) kategori = "Kesehatan";
  else if (/sekolah|buku|kursus|kuliah|pendidikan|alat tulis/i.test(low)) kategori = "Pendidikan";
  else if (/belanja|mart|market|supermarket|retail|grosir|barang/i.test(low)) kategori = "Belanja";

  let metode = "";
  if (/qris|ewallet|ovo|gopay|dana|shopeepay|linkaja/i.test(low)) metode = "QRIS";
  else if (/transfer|bank|bca|mandiri|bri|bnl|bni/i.test(low)) metode = "Transfer";
  else if (/cash|tunai/i.test(low)) metode = "Cash";
  else if (/debit|kartu debit|credit|kredit|visa|mastercard/i.test(low)) metode = "Kartu Debit";

  const result = {
    tanggal,
    jenis: "Pengeluaran",
    kategori,
    deskripsi: deskripsi.slice(0, 80),
    nominal: Math.max(Number(nominal) || 0, 0),
    metode,
    catatan: "Dibuat otomatis dari hasil scan struk",
    owner,
  };

  if (!result.nominal || result.nominal <= 0) {
    throw new Error("Nominal struk tidak bisa terbaca dengan jelas. Silakan edit secara manual.");
  }

  return result;
}
