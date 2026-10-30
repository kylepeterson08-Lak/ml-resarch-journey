import { createRemoteJWKSet, jwtVerify } from "jose";
import postgres from "postgres";

export interface Env {
  HYPERDRIVE: Hyperdrive;
  CALC: Fetcher;
  IDP_ISSUER: string;
  IDP_AUDIENCE: string;
  IDP_JWKS_URL: string;
}

interface Principal {
  subject: string;
  tenantId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

async function authenticate(request: Request, env: Env): Promise<Principal | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  jwks ??= createRemoteJWKSet(new URL(env.IDP_JWKS_URL));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: env.IDP_ISSUER, audience: env.IDP_AUDIENCE });
    const tenantId = payload["tenant_id"];
    if (typeof payload.sub !== "string" || typeof tenantId !== "string" || !UUID.test(tenantId)) return null;
    return { subject: payload.sub, tenantId };
  } catch {
    return null;
  }
}

// Every query runs in a transaction with app.tenant_id set for RLS, and still filters on tenant_id
// explicitly: defense in depth against a pooled connection or cache carrying another tenant's context.
async function withTenant<T>(
  env: Env,
  ctx: ExecutionContext,
  tenantId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false, prepare: false });
  try {
    return (await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    })) as T;
  } finally {
    ctx.waitUntil(sql.end());
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return json({ ok: true });

    const principal = await authenticate(request, env);
    if (!principal) return json({ error: "unauthorized" }, 401);

    if (request.method === "GET" && url.pathname === "/v1/assets") {
      const rows = await withTenant(env, ctx, principal.tenantId, (tx) => tx`
        select asset_id, asset_number, description, asset_class, placed_in_service_on, cost, status
        from fa.asset
        where tenant_id = ${principal.tenantId}
        order by asset_number
        limit 500`);
      return json({ assets: rows });
    }

    if (request.method === "POST" && url.pathname === "/v1/whatif") {
      // The calc service gets the full input bundle and has no database access.
      const body = await request.text();
      const upstream = await env.CALC.fetch("https://calc/v1/whatif", {
        method: "POST",
        headers: { "content-type": "application/json", "x-tenant-id": principal.tenantId },
        body,
      });
      return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
    }

    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
