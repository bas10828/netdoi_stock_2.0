// Copies the zxing-wasm decoder into public/ so the barcode scanner loads it from
// this server (works without internet). Runs before `dev` and `build`.
import { copyFile, mkdir } from "node:fs/promises";

const src = new URL("../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", import.meta.url);
const dest = new URL("../public/zxing_reader.wasm", import.meta.url);
await mkdir(new URL(".", dest), { recursive: true });
await copyFile(src, dest);
