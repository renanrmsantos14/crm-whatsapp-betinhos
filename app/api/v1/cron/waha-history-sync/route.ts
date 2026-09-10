import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarHistoricoWaha } from "@/lib/waha/history-sync";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const accepted = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (!provided || !accepted.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  try {
    const summary = await sincronizarHistoricoWaha(createAdminClient());
    return ok(summary, { requestId });
  } catch (err) {
    return fail("internal_error", err instanceof Error ? err.message : "History sync failed.", 500, { requestId });
  }
}

export const GET = handle;
export const POST = handle;
