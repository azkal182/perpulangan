import { createRequestContext } from "@/server/request-context";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { log, timer } = await createRequestContext(req);

  log.info("health check");

  const duration = timer();

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    duration,
  });
}
