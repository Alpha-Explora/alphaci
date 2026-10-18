/**
 * Liveness probe for the container HEALTHCHECK and the reverse proxy. It answers
 * while the Next.js server serves requests and deliberately does not call the
 * backend, so a backend outage does not mark the frontend container unhealthy.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
