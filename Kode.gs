const SHEET_NAME = "Data Keuangan";
const BUDGET_SHEET_NAME = "Budget Kategori";
const RECURRING_SHEET_NAME = "Transaksi Rutin";
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

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Ledger Harian")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

function getOrCreateSheet() {
  const sheet = getOrCreateNamedSheet(SHEET_NAME, HEADERS, "#1a7a3c");
  return sheet;
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

function getCurrentOwnerKey_(fallbackOwner) {
  if (fallbackOwner) return fallbackOwner.toString();
  const email = Session.getActiveUser().getEmail();
  const tempKey = Session.getTemporaryActiveUserKey();
  return email || tempKey || "";
}

function requireOwnerKey_(fallbackOwner) {
  const owner = getCurrentOwnerKey_(fallbackOwner);
  if (!owner) {
    throw new Error(
      "User tidak teridentifikasi. Buka app dengan akun Google agar data pribadi bisa dipisahkan.",
    );
  }
  return owner;
}

function getPrimaryOwnerKey_(owner) {
  const props = PropertiesService.getScriptProperties();
  let primary = props.getProperty("PRIMARY_OWNER_KEY");
  if (!primary && owner) {
    props.setProperty("PRIMARY_OWNER_KEY", owner);
    primary = owner;
  }
  return primary || "";
}

function canReadLegacyRows_(owner, fallbackOwner) {
  if (fallbackOwner) return false;
  return owner && owner === getPrimaryOwnerKey_(owner);
}

function rowBelongsToOwner_(rowOwner, owner, canReadLegacy) {
  rowOwner = rowOwner ? rowOwner.toString() : "";
  return rowOwner === owner || (!rowOwner && canReadLegacy);
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

function getData(ownerOverride) {
  try {
    const owner = requireOwnerKey_(ownerOverride);
    const canReadLegacy = canReadLegacyRows_(owner, ownerOverride);
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    return data
      .filter((row) => row[0] !== "" && rowBelongsToOwner_(row[8], owner, canReadLegacy))
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

function getAppState() {
  requireOwnerKey_();
  processRecurringTransactions();
  return {
    transactions: getData(),
    budgets: getBudgets(),
    recurring: getRecurringTransactions(),
  };
}

function getBudgets(ownerOverride) {
  try {
    const owner = requireOwnerKey_(ownerOverride);
    const canReadLegacy = canReadLegacyRows_(owner, ownerOverride);
    const sheet = getOrCreateNamedSheet(BUDGET_SHEET_NAME, BUDGET_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    return sheet
      .getRange(2, 1, lastRow - 1, BUDGET_HEADERS.length)
      .getValues()
      .filter((row) => row[0] !== "" && rowBelongsToOwner_(row[2], owner, canReadLegacy))
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
    const owner = requireOwnerKey_(data.owner);
    const canReadLegacy = canReadLegacyRows_(owner, data.owner);
    const sheet = getOrCreateNamedSheet(BUDGET_SHEET_NAME, BUDGET_HEADERS);
    const kategori = (data.kategori || "").toString().trim();
    const nominal = Number(data.nominal);
    if (!kategori) throw new Error("Kategori wajib diisi");
    if (!nominal || nominal <= 0) throw new Error("Budget harus lebih dari 0");

    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, BUDGET_HEADERS.length).getValues();
      for (let i = 0; i < rows.length; i++) {
        if (
          rows[i][0].toString().toLowerCase() === kategori.toLowerCase() &&
          rowBelongsToOwner_(rows[i][2], owner, canReadLegacy)
        ) {
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

function deleteBudget(kategori) {
  try {
    const owner = requireOwnerKey_();
    const canReadLegacy = canReadLegacyRows_(owner);
    const sheet = getOrCreateNamedSheet(BUDGET_SHEET_NAME, BUDGET_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true };

    const rows = sheet.getRange(2, 1, lastRow - 1, BUDGET_HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === kategori.toString() && rowBelongsToOwner_(rows[i][2], owner, canReadLegacy)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: true };
  } catch (e) {
    throw new Error("Gagal menghapus budget: " + e.message);
  }
}

function getRecurringTransactions(ownerOverride) {
  try {
    const owner = requireOwnerKey_(ownerOverride);
    const canReadLegacy = canReadLegacyRows_(owner, ownerOverride);
    const sheet = getOrCreateNamedSheet(RECURRING_SHEET_NAME, RECURRING_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    return sheet
      .getRange(2, 1, lastRow - 1, RECURRING_HEADERS.length)
      .getValues()
      .filter((row) => row[0] !== "" && rowBelongsToOwner_(row[11], owner, canReadLegacy))
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
    const owner = requireOwnerKey_(data.owner);
    const canReadLegacy = canReadLegacyRows_(owner, data.owner);
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
        if (rows[i][0].toString() === id && rowBelongsToOwner_(rows[i][11], owner, canReadLegacy)) {
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

function deleteRecurringTransaction(id) {
  try {
    const owner = requireOwnerKey_();
    const canReadLegacy = canReadLegacyRows_(owner);
    const sheet = getOrCreateNamedSheet(RECURRING_SHEET_NAME, RECURRING_HEADERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true };

    const rows = sheet.getRange(2, 1, lastRow - 1, RECURRING_HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === id.toString() && rowBelongsToOwner_(rows[i][11], owner, canReadLegacy)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: true };
  } catch (e) {
    throw new Error("Gagal menghapus transaksi rutin: " + e.message);
  }
}

function processRecurringTransactions(ownerOverride) {
  const owner = requireOwnerKey_(ownerOverride);
  const canReadLegacy = canReadLegacyRows_(owner, ownerOverride);
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
    if (!rowBelongsToOwner_(row[11], owner, canReadLegacy)) return;
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
    if (!row[11]) sheet.getRange(i + 2, 12).setValue(owner);
    created++;
  });

  return { success: true, created: created };
}

function addData(data) {
  try {
    const owner = requireOwnerKey_(data.owner);
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
    const owner = requireOwnerKey_(data.owner);
    const canReadLegacy = canReadLegacyRows_(owner, data.owner);
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("Data tidak ditemukan");

    const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === data.id.toString() && rowBelongsToOwner_(rows[i][8], owner, canReadLegacy)) {
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

function deleteData(id) {
  try {
    const owner = requireOwnerKey_();
    const canReadLegacy = canReadLegacyRows_(owner);
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("Data tidak ditemukan");

    const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0].toString() === id.toString() && rowBelongsToOwner_(rows[i][8], owner, canReadLegacy)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    throw new Error("ID tidak ditemukan: " + id);
  } catch (e) {
    throw new Error("Gagal menghapus data: " + e.message);
  }
}


