import { handler, json } from "@/lib/api";
import { searchDevices, searchPlaces } from "@/lib/queries";

// Devices by serial/MAC/model/location, plus sites and jobs by name
export const GET = handler(async (request) => {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const [devices, places] = await Promise.all([searchDevices(q, limit), searchPlaces(q)]);
  return json({ devices, ...places });
});
