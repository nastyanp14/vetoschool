import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { handleCreateStripeCheckoutSession, handleCreateStripePortalSession, handleStripeWebhook } from "./src/lib/stripeCheckoutServer";

function readRequestBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function createRequestHeaders(req: IncomingMessage) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    }
  }

  return headers;
}

async function writeFetchResponse(res: ServerResponse, response: Response) {
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

function stripeCheckoutDevServerPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "");
  const serverEnv = {
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PORTAL_CONFIGURATION_ID: env.STRIPE_PORTAL_CONFIGURATION_ID,
    SUCCESS_URL: env.SUCCESS_URL,
    CANCEL_URL: env.CANCEL_URL,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return {
    name: "vetoschool-stripe-checkout-dev-server",
    configureServer(server) {
      const createCheckoutSessionMiddleware = async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const host = req.headers.host || "127.0.0.1:8080";
          const url = new URL(req.url || "", `http://${host}`);
          const body = req.method && !["GET", "HEAD"].includes(req.method) ? await readRequestBody(req) : undefined;
          const request = new Request(url, {
            method: req.method,
            headers: createRequestHeaders(req),
            body,
          });
          const response = await handleCreateStripeCheckoutSession(request, serverEnv);
          await writeFetchResponse(res, response);
        } catch (error) {
          console.error("Stripe Checkout dev middleware failed", error instanceof Error ? {
            message: error.message,
            stack: error.stack,
          } : error);
          await writeFetchResponse(res, new Response(JSON.stringify({ error: "Stripe Checkout is unavailable." }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          }));
        }
      };

      server.middlewares.use("/api/stripe/create-checkout-session", createCheckoutSessionMiddleware);
      server.middlewares.use("/api/create-checkout-session", createCheckoutSessionMiddleware);

      const createPortalSessionMiddleware = async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const host = req.headers.host || "127.0.0.1:8080";
          const url = new URL(req.url || "", `http://${host}`);
          const body = req.method && !["GET", "HEAD"].includes(req.method) ? await readRequestBody(req) : undefined;
          const request = new Request(url, {
            method: req.method,
            headers: createRequestHeaders(req),
            body,
          });
          const response = await handleCreateStripePortalSession(request, serverEnv);
          await writeFetchResponse(res, response);
        } catch (error) {
          console.error("Stripe Customer Portal dev middleware failed", error instanceof Error ? {
            message: error.message,
            stack: error.stack,
          } : error);
          await writeFetchResponse(res, new Response(JSON.stringify({ error: "Subscription management is unavailable." }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          }));
        }
      };

      server.middlewares.use("/api/stripe/create-portal-session", createPortalSessionMiddleware);
      server.middlewares.use("/api/stripe/portal", createPortalSessionMiddleware);

      server.middlewares.use("/api/stripe/webhook", async (req, res) => {
        try {
          const host = req.headers.host || "127.0.0.1:8080";
          const url = new URL(req.url || "", `http://${host}`);
          const body = req.method && !["GET", "HEAD"].includes(req.method) ? await readRequestBody(req) : undefined;
          const request = new Request(url, {
            method: req.method,
            headers: createRequestHeaders(req),
            body,
          });
          const response = await handleStripeWebhook(request, serverEnv);
          await writeFetchResponse(res, response);
        } catch (error) {
          console.error("Stripe webhook dev middleware failed", error instanceof Error ? {
            message: error.message,
            stack: error.stack,
          } : error);
          await writeFetchResponse(res, new Response(JSON.stringify({ error: "Stripe webhook is unavailable." }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), stripeCheckoutDevServerPlugin(mode), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
