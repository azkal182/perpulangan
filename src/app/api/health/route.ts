import { createRequestContext } from "@/server/request-context";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { log } = createRequestContext(req);

  log.info("health check");

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
