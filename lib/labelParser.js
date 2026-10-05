// Turns every code read from one equipment label into { serial, mac }.
// Ported from the next_scanbarcode inventory app (barcodeParsers.ts and
// identifyBarcodes.ts): brand-specific rules first (URL QR codes, known S/N
// formats, MAC vendor prefix), then a brand-agnostic scorer.
import OUI_BRAND from "./ouiBrands.json";

const formatMac = (raw12) => raw12.match(/.{2}/g).join(":").toUpperCase();
const hexLetters = (s) => (s.match(/[A-F]/gi) ?? []).length;
// Yealink EAN/customs code and placeholders that look like MACs
const MAC_BLACKLIST = new Set(["841885104823", "000000000000", "FFFFFFFFFFFF"]);
// A 12-hex string with letters is far more likely a MAC than an S/N fragment
const realMac = (candidates) =>
  candidates.map((m) => m.toUpperCase()).find((m) => hexLetters(m) >= 2 && !MAC_BLACKLIST.has(m)) ?? "";

// ---- brand-specific parsers: return { serial, macRaw, model }

function parseUnifi(codes) {
  for (const c of codes) {
    // https://qr.ui.com/<model>/<type>/<MAC12>...  — on Unifi the S/N is the MAC
    const url = /qr\.ui\.com\/[^/]+\/[^/]+\/([A-F0-9]{12})/i.exec(c);
    if (url) return { serial: url[1].toUpperCase(), macRaw: url[1].toUpperCase() };
  }
  for (const c of codes) {
    // "58D61FC0822A-YcRa1C": MAC + device key
    const m = /^([A-F0-9]{12})(?:[-\s]?[A-Za-z0-9]+)?$/i.exec(c);
    if (m) return { serial: m[1].toUpperCase(), macRaw: m[1].toUpperCase() };
  }
  return null;
}

function parseReyee(codes) {
  const data = codes.join(" ");
  const url = /rj\.link\/e\?s=([^&\s]+)&d=([^&\s]+)&m=([A-F0-9]{12})/i.exec(data);
  if (url) return { serial: url[1], model: decodeURIComponent(url[2]), macRaw: url[3].toUpperCase() };
  const sn = data.match(/\b(?:CA|G1|ZA|AH)[A-Z0-9]{11}\b/);
  return { serial: sn?.[0] ?? "", macRaw: realMac(data.match(/\b[A-F0-9]{12}\b/gi) ?? []) };
}

// TP-Link Omada / VIGI: S/N "22" + 11-13 chars, MAC raw or formatted;
// the Device Key QR ("1534-B0C5-...") and Device ID (17 hex) are ignored.
function parseTpLink(codes) {
  const data = codes.join(" ");
  const sn = data.match(/\b22[A-Z0-9]{11,13}\b/);
  const fmt = data.match(/\b([A-F0-9]{2}[-:]){5}[A-F0-9]{2}\b/i);
  const raw = data.match(/\b[A-F0-9]{12}\b/gi) ?? [];
  return {
    serial: sn?.[0] ?? "",
    macRaw: fmt ? fmt[0].replace(/[-:]/g, "").toUpperCase() : (raw.find((m) => m !== sn?.[0]) ?? "").toUpperCase(),
  };
}

function parseInjector(codes) {
  const sn = codes.join(" ").toUpperCase().match(/\b42[A-Z0-9]{11}\b/);
  return { serial: sn?.[0] ?? "", macRaw: "" };
}

function parseHikvision(codes) {
  const data = codes.join(" ");
  const hc = /www\.hik-connect\.com\s+([A-Z0-9]+)\s+([A-Z0-9-]+)/i.exec(data);
  if (hc) return { serial: hc[1], model: hc[2], macRaw: "" };
  const gs = /\{GS\}([A-Z0-9]+)/i.exec(data);
  if (gs) return { serial: gs[1], macRaw: "" };
  return null;
}

function parseYealink(codes) {
  const data = codes.join(" ");
  const sn = data.match(/\b[A-Z0-9]{16}\b/);
  const macs = (data.match(/\b[A-F0-9]{12}\b/gi) ?? []).filter((m) => !MAC_BLACKLIST.has(m.toUpperCase()));
  return { serial: sn?.[0] ?? "", macRaw: (macs[0] ?? "").toUpperCase() };
}

// MikroTik QR is the S/N ("HM40B9W7FN2", "HM40B9W7FN2/r3" or https://mt.lv/<sn>);
// its MACs are printed text only.
function parseMikrotik(codes) {
  const data = codes.join(" ").trim();
  const url = data.match(/https?:\/\/[^\s/]+\/(\S+)/i);
  return { serial: (url ? url[1] : data).split("/")[0], macRaw: "" };
}

// Dahua: MAC (12 hex), S/N (15 chars), QR with model
function parseDahua(codes) {
  const data = codes.join(" ").toUpperCase();
  const macRaw = realMac(data.match(/[A-F0-9]{12}/g) ?? []);
  const serial = (data.match(/\b[A-Z0-9]{15}\b/g) ?? []).find((s) => !macRaw || !s.includes(macRaw)) ?? "";
  const model = data.match(/DH[A-Z]?-[A-Z]+-[A-Z0-9]+(?:[-/][A-Z0-9]+)*/)?.[0] ?? "";
  return { serial, macRaw, model };
}

// Cleanline UPS: "LCL" + digits; no network port, so no MAC
function parseCleanline(codes) {
  return { serial: codes.join(" ").toUpperCase().match(/LCL\d{6,}/)?.[0] ?? "", macRaw: "" };
}

// Cisco: S/N = 3 letters + 6 digits + 2 chars ("DNI210803Z9"), MAC = 12 hex
function parseCisco(codes) {
  const data = codes.join(" ").toUpperCase();
  return { serial: data.match(/\b[A-Z]{3}\d{6}[A-Z0-9]{2}\b/)?.[0] ?? "", macRaw: realMac(data.match(/[A-F0-9]{12}/g) ?? []) };
}

const PARSERS = {
  unifi: parseUnifi,
  reyee: parseReyee,
  "tp-link": parseTpLink,
  injector: parseInjector,
  hikvision: parseHikvision,
  yealink: parseYealink,
  mikrotik: parseMikrotik,
  dahua: parseDahua,
  cleanline: parseCleanline,
  cisco: parseCisco,
};

// Most specific first: URLs, unique S/N formats, MAC vendor prefix, then length guesses
export function detectBrand(codes) {
  const data = codes.join(" ").toUpperCase();
  if (/RJ\.LINK\//.test(data)) return "reyee";
  if (/HIK-CONNECT\.COM/.test(data) || /\{GS\}[A-Z0-9]/.test(data)) return "hikvision";
  if (/MT\.LV\//.test(data) || /^[A-Z0-9]{8,14}\/R\d+$/.test(codes[0]?.toUpperCase() ?? "")) return "mikrotik";
  if (/QR\.UI\.COM\//.test(data)) return "unifi";
  if (/LCL\d{6,}/.test(data)) return "cleanline";
  if (/\b[A-Z]{3}\d{6}[A-Z0-9]{2}\b/.test(data)) return "cisco";
  if (/\b(?:CA|G1|ZA|AH)[A-Z0-9]{11}\b/.test(data)) return "reyee";
  if (/\b42[A-Z0-9]{11}\b/.test(data)) return "injector";
  if (/\b22[A-Z0-9]{11,13}\b/.test(data)) return "tp-link";
  const macs = [...(data.match(/\b[A-F0-9]{12}(?=\b|-)/g) ?? [])].sort((a, b) => hexLetters(b) - hexLetters(a));
  for (const m of macs) {
    const brand = OUI_BRAND[m.slice(0, 6)];
    if (brand) return brand;
  }
  if (/\b[A-Z0-9]{16}\b/.test(data)) return "yealink";
  if (/\b[A-Z0-9]{15}\b/.test(data)) return "dahua";
  if (/^[0-9A-F]{12}/.test(codes[0]?.toUpperCase() ?? "")) return "unifi";
  return null;
}

// ---- brand-agnostic fallback

function scoreMac(s) {
  // Device/license keys: 3+ hex groups separated by - or space ("1A36-60B5-845D-812F-F000")
  if (/^[0-9A-F]{3,}([- ][0-9A-F]{3,}){2,}$/i.test(s)) return null;
  if (/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i.test(s)) {
    const raw = s.replace(/[:-]/g, "").toUpperCase();
    return MAC_BLACKLIST.has(raw) ? null : { source: s, raw, score: 100 };
  }
  if (/^[0-9A-F]{12}$/i.test(s)) {
    const raw = s.toUpperCase();
    if (MAC_BLACKLIST.has(raw)) return null;
    const l = hexLetters(raw);
    return { source: s, raw, score: l >= 2 ? 90 : l >= 1 ? 70 : 40 };
  }
  const prefix = s.match(/^([0-9A-F]{12})-?([A-Z0-9]+)$/i); // MAC + tail (Ubiquiti-style)
  if (prefix) {
    const raw = prefix[1].toUpperCase();
    if (MAC_BLACKLIST.has(raw)) return null;
    return { source: s, raw, score: hexLetters(raw) >= 2 ? 85 : 55 };
  }
  return null;
}

function scoreSerial(s) {
  if (s.length < 4 || s.length > 32) return 0;
  let score = 0;
  if (/^[A-Za-z0-9]+$/.test(s)) score += 30;
  if (/[A-Za-z]/.test(s) && /[0-9]/.test(s)) score += 20;
  if (s.length >= 8 && s.length <= 20) score += 20;
  if (/^\d/.test(s)) score += 5;
  if (/^LCL\d{6,}/.test(s)) score += 50;
  if (/^[A-Z]{3}\d{6}[A-Z0-9]{2}$/.test(s)) score += 50;
  if (/^https?:\/\//i.test(s)) score -= 60; // a link is not a serial
  return score;
}

function identify(codes) {
  const best = codes
    .map(scoreMac)
    .filter((c) => c && c.score >= 50)
    .sort((a, b) => b.score - a.score)[0];
  // One code with the MAC at the start (Ubiquiti): the MAC is the serial too
  if (best && codes.length === 1 && best.source.length > 12) return { serial: best.raw, macRaw: best.raw };
  const serial =
    codes
      .filter((s) => s !== best?.source)
      .map((s) => ({ s, score: scoreSerial(s) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.length - b.s.length)[0]?.s ?? "";
  return { serial, macRaw: best?.raw ?? "", macScore: best?.score ?? 0 };
}

// Strip "S/N:" / "MAC:" style prefixes a few labels put inside the code itself
const stripPrefix = (s) => s.replace(/^(s\/?n|serial(\s*no\.?)?|mac)(\s*[:#]\s*|\s+)/i, "").trim();

/**
 * codes: every string decoded from one label.
 * Returns { brand, serial, mac ("AA:BB:..." or ""), macRaw, model }.
 */
export function parseLabel(rawCodes) {
  const codes = [...new Set(rawCodes.map((c) => stripPrefix(String(c ?? "").trim())).filter(Boolean))];
  if (codes.length === 0) return { brand: null, serial: "", mac: "", macRaw: "", model: "" };

  const brand = detectBrand(codes);
  const specific = brand ? PARSERS[brand]?.(codes) : null;
  const generic = identify(codes);
  // Brand rules win. The generic scorer fills a missing S/N, and a missing MAC only
  // when it is clearly a MAC (formatted, or 12 hex with letters) — not a VIGI
  // Device ID or an S/N that merely starts with 12 hex-looking characters.
  const serial = specific ? specific.serial || generic.serial : generic.serial;
  const macRaw = specific
    ? specific.macRaw || (generic.macScore >= 90 && generic.macRaw !== serial ? generic.macRaw : "")
    : generic.macRaw;
  return { brand, serial, mac: macRaw ? formatMac(macRaw) : "", macRaw, model: specific?.model ?? "" };
}
