// HTTPS for `npm run dev`, so phones on the LAN can use the camera scanner.
//
// - certificates/dev-ca.pem: a local CA, made once (10 years). Optional: install
//   it on a phone (see /phone-setup) and the live camera works there. It is
//   name-constrained to localhost and this machine's LAN subnets, so even if the
//   key leaked it could not impersonate any other website.
// - certificates/dev-cert.pem: the server certificate, signed by that CA, for
//   localhost + current LAN IPs. Re-made when the IPs change; phones keep working.
// Without installing the CA, browsers show a warning once and the scanner falls
// back to "take a photo". Nothing is installed into Windows.
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { webcrypto } from "node:crypto";
import * as x509 from "@peculiar/x509";

x509.cryptoProvider.set(webcrypto);
const ALG = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", publicExponent: new Uint8Array([1, 0, 1]), modulusLength: 2048 };
const DAY = 24 * 60 * 60 * 1000;

const dir = new URL("../certificates/", import.meta.url);
const file = (name) => new URL(name, dir);
const publicCa = new URL("../public/dev-ca.crt", import.meta.url); // downloadable by phones

// --- what the certificates must cover
const lan = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal);
const hosts = { dns: ["localhost", os.hostname()], ips: ["127.0.0.1", ...lan.map((n) => n.address)] };
const subnets = [...new Set(lan.map((n) => `${n.address}/${n.netmask}`))].map((s) => {
  const [ip, mask] = s.split("/");
  const m = mask.split(".").map(Number);
  return { net: ip.split(".").map((b, i) => Number(b) & m[i]), mask: m };
});

// --- minimal DER for the NameConstraints extension (not built into @peculiar/x509)
const tlv = (tag, bytes) => {
  const len = bytes.length;
  const head = len < 0x80 ? [len] : len < 0x100 ? [0x81, len] : [0x82, len >> 8, len & 0xff];
  return [tag, ...head, ...bytes];
};
const seq = (...parts) => tlv(0x30, parts.flat());
function nameConstraints() {
  const permitted = [
    seq(tlv(0x82, [...Buffer.from("localhost")])), // dNSName
    seq(tlv(0x82, [...Buffer.from(os.hostname())])),
    seq(tlv(0x87, [127, 0, 0, 0, 255, 0, 0, 0])), // iPAddress + mask
    ...subnets.map((s) => seq(tlv(0x87, [...s.net, ...s.mask]))),
  ];
  const der = seq(tlv(0xa0, permitted.flat())); // permittedSubtrees [0]
  return new x509.Extension("2.5.29.30", true, new Uint8Array(der));
}

const pem = (label, buf) =>
  `-----BEGIN ${label}-----\n${Buffer.from(buf).toString("base64").match(/.{1,64}/g).join("\n")}\n-----END ${label}-----\n`;

async function loadOrCreateCa() {
  if (existsSync(file("dev-ca.pem")) && existsSync(file("dev-ca-key.pem"))) {
    const cert = new x509.X509Certificate(await readFile(file("dev-ca.pem"), "utf8"));
    const keyPem = await readFile(file("dev-ca-key.pem"), "utf8");
    const der = Buffer.from(keyPem.replace(/-----[^-]+-----|\s/g, ""), "base64");
    const privateKey = await webcrypto.subtle.importKey("pkcs8", der, ALG, true, ["sign"]);
    return { cert, privateKey };
  }
  const keys = await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  const now = new Date();
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("hex").replace(/^[89a-f]/, "1"),
    name: `CN=netdoi stock dev CA (${os.hostname()})`,
    notBefore: now,
    notAfter: new Date(now.getTime() + 3650 * DAY),
    keys,
    signingAlgorithm: ALG,
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true),
      nameConstraints(),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  });
  await writeFile(file("dev-ca.pem"), cert.toString("pem"));
  await writeFile(file("dev-ca-key.pem"), pem("PRIVATE KEY", await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)));
  console.log("Created local dev CA (certificates/dev-ca.pem)");
  return { cert, privateKey: keys.privateKey };
}

await mkdir(dir, { recursive: true });
const ca = await loadOrCreateCa();
await mkdir(new URL(".", publicCa), { recursive: true });
await copyFile(file("dev-ca.pem"), publicCa);

// Keep the server certificate if it already covers the same names and CA
const stamp = JSON.stringify({ hosts, ca: ca.cert.serialNumber });
const old = await readFile(file("dev-hosts.json"), "utf8").catch(() => "");
if (old === stamp && existsSync(file("dev-cert.pem")) && existsSync(file("dev-key.pem"))) process.exit(0);

const keys = await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
const now = new Date();
const cert = await x509.X509CertificateGenerator.create({
  serialNumber: Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("hex").replace(/^[89a-f]/, "1"),
  subject: "CN=netdoi stock dev",
  issuer: ca.cert.subject,
  notBefore: now,
  notAfter: new Date(now.getTime() + 825 * DAY), // Apple's limit for TLS server certificates
  signingKey: ca.privateKey,
  publicKey: keys.publicKey,
  signingAlgorithm: ALG,
  extensions: [
    new x509.SubjectAlternativeNameExtension([
      ...hosts.dns.map((value) => ({ type: "dns", value })),
      ...hosts.ips.map((value) => ({ type: "ip", value })),
    ]),
    new x509.BasicConstraintsExtension(false, undefined, true),
    new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment, true),
    new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
    await x509.AuthorityKeyIdentifierExtension.create(ca.cert, false),
  ],
});

await writeFile(file("dev-key.pem"), pem("PRIVATE KEY", await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)));
// Full chain so clients that don't have the CA yet still see who issued it
await writeFile(file("dev-cert.pem"), cert.toString("pem") + "\n" + ca.cert.toString("pem"));
await writeFile(file("dev-hosts.json"), stamp);
console.log(`HTTPS dev certificate created for: ${[...hosts.dns, ...hosts.ips].join(", ")}`);
