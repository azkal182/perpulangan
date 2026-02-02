import { auth } from "@/server/auth";
import { createRequestContext } from "@/server/request-context";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { log } = createRequestContext(req);

  try {
    const response = await handler.GET(req);
    log.info({ status: response.status }, "auth GET");
    return response;
  } catch (error) {
    log.error({ err: error }, "auth GET failed");
    throw error;
  }
}

export async function POST(req: Request) {
  const { log } = createRequestContext(req);

  try {
    const response = await handler.POST(req);
    log.info({ status: response.status }, "auth POST");
    return response;
  } catch (error) {
    log.error({ err: error }, "auth POST failed");
    throw error;
  }
}
