// Creates a self-signed HTTPS certificate for `npm run dev`, valid for localhost
// and this machine's current LAN IPs, so phones on the LAN can use the camera
// scanner (browsers only allow the camera on HTTPS). Re-created automatically
// when the machine's IPs change. Nothing is installed into Windows.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import selfsigned from "selfsigned";

const dir = new URL("../certificates/", import.meta.url);
const keyFile = new URL("dev-key.pem", dir);
const certFile = new URL("dev-cert.pem", dir);
const hostsFile = new URL("dev-hosts.json", dir);

const ips = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n.address);
const hosts = { dns: ["localhost", os.hostname()], ips: ["127.0.0.1", ...ips] };

// Keep the existing certificate if it already covers the same names
if (existsSync(keyFile) && existsSync(certFile) && existsSync(hostsFile)) {
  const old = await readFile(hostsFile, "utf8").catch(() => "");
  if (old === JSON.stringify(hosts)) process.exit(0);
}

const now = new Date();
const pems = await selfsigned.generate([{ name: "commonName", value: "netdoi stock dev" }], {
  keySize: 2048,
  algorithm: "sha256",
  notBeforeDate: now,
  notAfterDate: new Date(now.getTime() + 825 * 24 * 60 * 60 * 1000), // browser max for TLS certs
  extensions: [
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    { name: "extKeyUsage", serverAuth: true },
    {
      name: "subjectAltName",
      altNames: [...hosts.dns.map((value) => ({ type: 2, value })), ...hosts.ips.map((ip) => ({ type: 7, ip }))],
    },
  ],
});

await mkdir(dir, { recursive: true });
await writeFile(keyFile, pems.private);
await writeFile(certFile, pems.cert);
await writeFile(hostsFile, JSON.stringify(hosts));
console.log(`HTTPS dev certificate created for: ${[...hosts.dns, ...hosts.ips].join(", ")}`);
