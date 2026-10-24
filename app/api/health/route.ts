// Liveness only: no auth, no database.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
