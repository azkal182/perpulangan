import "server-only";
import { randomUUID } from "crypto";
import { logger } from "@/server/logger";

export function createRequestContext(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const url = new URL(req.url);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  const log = logger.child({
    requestId,
    method: req.method,
    path: url.pathname,
    ip,
  });

  return { requestId, url, log };
}
