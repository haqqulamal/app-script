// ════════════════════════════════════════════
// TELEGRAM BOT — Money Tracker
// ════════════════════════════════════════════

var HELP_TEXT =
  "🤖 Cara pakai Money Tracker Bot\n\n" +
  "Format:\n" +
  "<tipe> <nominal> <keterangan> [#kategori] [@metode]\n\n" +
  "Tipe:\n" +
  "• k / keluar  → pengeluaran\n" +
  "• m / masuk   → pemasukan\n\n" +
  "Nominal bisa ditulis:\n" +
  "• 15000 atau 15.000\n" +
  "• 15rb / 15ribu\n" +
  "• 1.5jt / 2juta\n\n" +
  "Contoh:\n" +
  "k 15rb kopi pagi #makanan @tunai\n" +
  "m 2jt gaji bulanan #gaji @transfer\n" +
  "k 50000 bensin\n\n" +
  'Kategori & metode opsional (default: "Lainnya").\n\n' +
  "Perintah lain:\n" +
  "/saldo     → lihat total saldo\n" +
  "/hariini   → rekap transaksi hari ini\n" +
  "/help      → tampilkan pesan ini";

// ─── doPost: Entry point webhook Telegram ───────────
function doPost(e) {
  try {
    var update = JSON.parse(e.postData.contents);

    // ── Cegah proses ulang update yang sama (anti-spam akibat retry Telegram) ──
    var cache = CacheService.getScriptCache();
    var cacheKey = "upd_" + update.update_id;
    if (cache.get(cacheKey)) {
      return HtmlService.createHtmlOutput("ok"); // sudah pernah diproses, abaikan
    }
    cache.put(cacheKey, "1", 300); // tandai sudah diproses selama 5 menit

    var message = update.message;
    if (!message || !message.text) {
      return HtmlService.createHtmlOutput("ok");
    }

    var chatId = message.chat.id;
    var text = message.text.trim();

    if (text === "/start" || text === "/help") {
      sendTelegramMessage(chatId, HELP_TEXT);
      return HtmlService.createHtmlOutput("ok");
    }

    if (text === "/saldo") {
      sendTelegramMessage(chatId, getSaldoText());
      return HtmlService.createHtmlOutput("ok");
    }

    if (text === "/hariini" || text === "/today") {
      sendTelegramMessage(chatId, getRekapHariIniText());
      return HtmlService.createHtmlOutput("ok");
    }

    var parsed = parseTelegramText(text);
    if (!parsed) {
      sendTelegramMessage(chatId, "⚠️ Format gak dikenali.\n\n" + HELP_TEXT);
      return HtmlService.createHtmlOutput("ok");
    }

    var tanggal = Utilities.formatDate(
      new Date(),
      "Asia/Jakarta",
      "dd/MM/yyyy",
    );

    addData({
      tanggal: tanggal,
      jenis: parsed.jenis,
      kategori: parsed.kategori,
      deskripsi: parsed.deskripsi,
      nominal: parsed.nominal,
      metode: parsed.metode,
      catatan: "",
    });

    var emoji = parsed.jenis === "Pengeluaran" ? "💸" : "💰";
    var reply =
      emoji +
      " Tercatat!\n" +
      parsed.jenis +
      ": Rp" +
      formatRupiah(parsed.nominal) +
      "\n" +
      "Kategori: " +
      parsed.kategori +
      "\n" +
      "Keterangan: " +
      parsed.deskripsi +
      (parsed.metode ? "\nMetode: " + parsed.metode : "");

    sendTelegramMessage(chatId, reply);
  } catch (err) {
    try {
      var chatIdErr = JSON.parse(e.postData.contents).message.chat.id;
      sendTelegramMessage(chatIdErr, "❌ Gagal mencatat: " + err.message);
    } catch (e2) {
      // diam aja kalau bahkan ini gagal
    }
  }
  return HtmlService.createHtmlOutput("ok");
}

// ─── parseTelegramText: Ubah teks chat jadi data transaksi ───
function parseTelegramText(text) {
  text = text.trim();
  if (!text) return null;

  var tokens = text.split(/\s+/);
  var first = tokens[0].toLowerCase();
  var jenis;

  if (["k", "keluar", "-", "out"].indexOf(first) !== -1) {
    jenis = "Pengeluaran";
  } else if (["m", "masuk", "+", "in"].indexOf(first) !== -1) {
    jenis = "Pemasukan";
  } else {
    return null;
  }

  var rest = tokens.slice(1).join(" ");

  var kategori = "Lainnya";
  var katMatch = rest.match(/#(\S+)/);
  if (katMatch) {
    kategori = katMatch[1];
    rest = rest.replace(katMatch[0], "").trim();
  }

  var metode = "";
  var metMatch = rest.match(/@(\S+)/);
  if (metMatch) {
    metode = metMatch[1];
    rest = rest.replace(metMatch[0], "").trim();
  }

  var restTokens = rest.split(/\s+/).filter(Boolean);
  if (restTokens.length === 0) return null;

  var nominal = parseNominal(restTokens.shift());
  if (nominal === null) return null;

  var deskripsi = restTokens.join(" ").trim() || "(tanpa keterangan)";

  return {
    jenis: jenis,
    kategori: kategori,
    deskripsi: deskripsi,
    nominal: nominal,
    metode: metode,
  };
}

// ─── parseNominal: "15rb" / "1.5jt" / "15.000" → angka ───
function parseNominal(token) {
  token = token.toLowerCase().trim();
  var match = token.match(/^([\d.,]+)\s*(rb|ribu|jt|juta|k)?$/);
  if (!match) return null;

  var rawNum = match[1];
  var suffix = match[2];
  var num;

  if (suffix === "rb" || suffix === "ribu" || suffix === "k") {
    num = parseFloat(rawNum.replace(",", ".")) * 1000;
  } else if (suffix === "jt" || suffix === "juta") {
    num = parseFloat(rawNum.replace(",", ".")) * 1000000;
  } else {
    num = parseFloat(rawNum.replace(/\./g, "").replace(",", "."));
  }

  return isNaN(num) ? null : num;
}

// ─── formatRupiah: angka → "15.000" ───
function formatRupiah(num) {
  return Math.round(num).toLocaleString("id-ID");
}

// ─── getSaldoText: ringkasan total ───
function getSaldoText() {
  var data = getData();
  var masuk = 0,
    keluar = 0;
  data.forEach(function (row) {
    if (row.jenis === "Pemasukan") masuk += row.nominal;
    else if (row.jenis === "Pengeluaran") keluar += row.nominal;
  });
  var saldo = masuk - keluar;
  return (
    "📊 Ringkasan\n" +
    "Total Pemasukan: Rp" +
    formatRupiah(masuk) +
    "\n" +
    "Total Pengeluaran: Rp" +
    formatRupiah(keluar) +
    "\n" +
    "Saldo: Rp" +
    formatRupiah(saldo)
  );
}

// ─── getRekapHariIniText: rekap transaksi hari ini ───
function getRekapHariIniText() {
  var todayStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
  var data = getData().filter(function (row) {
    return row.tanggal === todayStr;
  });

  if (data.length === 0) {
    return "📅 Belum ada transaksi hari ini (" + todayStr + ").";
  }

  var masuk = 0,
    keluar = 0;
  var lines = data.map(function (row) {
    if (row.jenis === "Pemasukan") {
      masuk += row.nominal;
      return "+Rp" + formatRupiah(row.nominal) + " - " + row.deskripsi;
    } else {
      keluar += row.nominal;
      return "-Rp" + formatRupiah(row.nominal) + " - " + row.deskripsi;
    }
  });

  return (
    "📅 Transaksi hari ini (" +
    todayStr +
    ")\n\n" +
    lines.join("\n") +
    "\n\nTotal masuk: Rp" +
    formatRupiah(masuk) +
    "\nTotal keluar: Rp" +
    formatRupiah(keluar)
  );
}

// ─── sendTelegramMessage: balas ke chat Telegram ───
function sendTelegramMessage(chatId, text) {
  var token =
    PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN");
  var url = "https://api.telegram.org/bot" + token + "/sendMessage";
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: text }),
    muteHttpExceptions: true,
  });
}
