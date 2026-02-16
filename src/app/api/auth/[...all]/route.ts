import { auth } from "@/server/auth";
import { createRequestContext } from "@/server/request-context";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { log } = await createRequestContext(req);

  try {
    const response = await handler.GET(req);
    log.info({ status: response.status }, "auth GET successful");
    return response;
  } catch (error) {
    log.error(
      { 
        err: error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "auth GET failed"
    );
    throw error;
  }
}

export async function POST(req: Request) {
  const { log } = await createRequestContext(req);

  try {
    const response = await handler.POST(req);
    log.info({ status: response.status }, "auth POST successful");
    return response;
  } catch (error) {
    log.error(
      { 
        err: error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "auth POST failed"
    );
    throw error;
  }
}
