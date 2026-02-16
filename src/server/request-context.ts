import "server-only";
import { randomUUID } from "crypto";
import { logger, startTimer } from "@/server/logger";
import { auth } from "@/server/auth";

export async function createRequestContext(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const url = new URL(req.url);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  // Get user context from Better Auth session (if available)
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const timer = startTimer();

  const log = logger.child({
    requestId,
    method: req.method,
    path: url.pathname,
    ip,
    ...(userId && { userId }),
    ...(userEmail && { userEmail }),
  });

  return {
    requestId,
    url,
    log,
    timer,
    userId,
  };
}
