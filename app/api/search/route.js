import { handler, json } from "@/lib/api";
import { searchDevices } from "@/lib/queries";

export const GET = handler(async (request) => {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const devices = await searchDevices(params.get("q") ?? "", limit);
  return json({ devices });
});
