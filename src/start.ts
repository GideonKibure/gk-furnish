import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { warnIfDevelopmentUsesProduction } from "@/lib/dev-safety.server";
import { securityHeaders } from "@/lib/image-size";

warnIfDevelopmentUsesProduction();

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

function responseOf(value: unknown): Response | null {
  if (value instanceof Response) return value;
  if (!value || typeof value !== "object" || !("response" in value)) return null;
  const nested = (value as { response?: unknown }).response;
  return nested instanceof Response ? nested : null;
}

const securityMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const response = responseOf(result);
  if (!response) return result;
  const host = getRequest()?.headers.get("host")?.split(":")[0] ?? "";
  for (const [key, value] of Object.entries(securityHeaders(host))) response.headers.set(key, value);
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, securityMiddleware],
}));
