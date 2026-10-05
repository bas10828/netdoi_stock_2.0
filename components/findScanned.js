"use client";

// Exact lookup for a scanned label: by S/N first, then by MAC.
// Returns { devices, by } where by is "serial" | "mac" | null (not found).
export default async function findScanned(value, label) {
  const tries = [
    ["serial", label?.serial || value],
    ["mac", label?.mac],
  ].filter(([, v]) => v);
  for (const [by, v] of tries) {
    const res = await fetch(`/api/devices/lookup?serial=${encodeURIComponent(v)}`);
    if (!res.ok) throw new Error("lookup failed");
    const { devices = [] } = await res.json();
    if (devices.length > 0) return { devices, by };
  }
  return { devices: [], by: null };
}
