// One spelling per brand and device type, so counts and filters aren't split
// ("tp-link" / "TP-LINK" / "TP-Link"). Used when saving devices, by
// scripts/normalize-catalog.mjs for existing data, and by the dashboard.
// Plain module: no "@/" imports, so Node scripts can import it too.

const key = (v) => String(v ?? "").trim().toLowerCase().replace(/\.+$/, "");

// lower-case alias -> canonical name. Unknown values are kept as typed (trimmed).
const BRAND_ALIASES = {
  "tp-link": "TP-Link", tplink: "TP-Link", "tp link": "TP-Link",
  unifi: "UniFi",
  reyee: "Reyee",
  ruijie: "Ruijie",
  cisco: "Cisco",
  cleanline: "Cleanline",
  hikvision: "Hikvision",
  mikrotik: "MikroTik",
  yealink: "Yealink",
  zkteco: "ZKTeco",
  dahua: "Dahua",
  ubiquiti: "Ubiquiti",
  ipower: "iPower",
  unv: "UNV",
  apc: "APC",
  hpe: "HPE",
  imou: "Imou",
  dk: "DK Technology",
  "dk technology": "DK Technology",
  "western digital": "Western Digital",
  wd: "Western Digital",
};

const TYPE_ALIASES = {
  "access point": "Access Point", accesspoint: "Access Point", ap: "Access Point",
  switch: "Switch",
  "switch poe": "Switch PoE", "switch-poe": "Switch PoE", "poe switch": "Switch PoE",
  "switch core": "Switch Core",
  "switch poe core": "Switch PoE Core",
  "switch sfp": "Switch SFP",
  injector: "PoE Injector", "poe injector": "PoE Injector",
  "ip camera": "IP Camera", "ip cam": "IP Camera", cctv: "IP Camera",
  nvr: "NVR",
  ups: "UPS",
  router: "Router",
  controller: "Controller",
  hdd: "HDD",
  "access control": "Access Control",
};

export function canonicalBrand(value) {
  const trimmed = String(value ?? "").trim().replace(/\.+$/, "");
  if (!trimmed) return null;
  return BRAND_ALIASES[key(trimmed)] ?? trimmed;
}

export function canonicalType(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return TYPE_ALIASES[key(trimmed)] ?? trimmed;
}

// A device written with the old "injector" brand (TP-Link PoE injector, e.g. POE260S)
export function fixDevice(d) {
  let brand = canonicalBrand(d.brand);
  let type = canonicalType(d.device_type);
  if (key(d.brand) === "injector") {
    brand = "TP-Link";
    type = type ?? "PoE Injector";
  }
  return { brand, device_type: type };
}

// Statistics group manufacturers with their sub-brands / product lines
const BRAND_GROUPS = {
  UniFi: "Ubiquiti",
  Ubiquiti: "Ubiquiti",
  Reyee: "Ruijie / Reyee",
  Ruijie: "Ruijie / Reyee",
};

export function brandGroup(value) {
  const brand = canonicalBrand(value);
  if (!brand) return "ไม่ระบุยี่ห้อ";
  return BRAND_GROUPS[brand] ?? brand;
}

export const NO_TYPE = "ไม่ระบุประเภท";
export function typeGroup(value) {
  return canonicalType(value) ?? NO_TYPE;
}

// For callers that save one field at a time
export function canonicalizeField(field, value) {
  if (field === "brand") return canonicalBrand(value);
  if (field === "device_type") return canonicalType(value);
  return value;
}
