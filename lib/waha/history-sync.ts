import type { SupabaseClient } from "@supabase/supabase-js";

import { dispatchWahaEvent } from "@/lib/waha/ingest";
import { getWahaClient } from "@/lib/waha/client";
import type { WahaPayload } from "@/lib/waha/envelope";
import { logger } from "@/lib/logger";

const JANELA_PADRAO_MS = 24 * 60 * 60 * 1000;
const SOBREPOSICAO_MS = 5 * 60 * 1000;

type SessionRow = {
  id: string;
  organization_id: string;
  provider: string | null;
  waha_session_name: string | null;
  status: string | null;
  archived_at: string | null;
};

export type HistorySyncSummary = {
  sessions: number;
  synced: number;
  messages: number;
  skipped: number;
  failed: number;
};

function timestampOf(message: WahaPayload): number {
  return typeof message.timestamp === "number" && Number.isFinite(message.timestamp)
    ? message.timestamp
    : 0;
}

export async function sincronizarHistoricoWaha(
  admin: SupabaseClient,
  now = new Date(),
): Promise<HistorySyncSummary> {
  const summary: HistorySyncSummary = { sessions: 0, synced: 0, messages: 0, skipped: 0, failed: 0 };
  const client = getWahaClient();
  if (!client) return summary;

  const { data, error } = await admin
    .from("channel_sessions")
    .select("id, organization_id, provider, waha_session_name, status, archived_at")
    .eq("provider", "waha")
    .eq("status", "WORKING")
    .is("archived_at", null)
    .not("waha_session_name", "is", null)
    .limit(50);
  if (error) throw new Error(`history_sessions_query: ${error.message}`);

  const sessions = (data ?? []) as SessionRow[];
  summary.sessions = sessions.length;
  const until = Math.floor(now.getTime() / 1000) - 30;

  for (const session of sessions) {
    try {
      const { data: latest, error: latestError } = await admin
        .from("messages")
        .select("sent_at")
        .eq("organization_id", session.organization_id)
        .eq("channel_session_id", session.id)
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw new Error(`history_cursor_query: ${latestError.message}`);

      const fallback = now.getTime() - JANELA_PADRAO_MS;
      const latestMs = latest?.sent_at ? new Date(latest.sent_at).getTime() : fallback;
      const since = Math.floor(Math.max(fallback, latestMs - SOBREPOSICAO_MS) / 1000);
      const messages = await client.getMessages(session.waha_session_name!, since, until);
      messages.sort((a, b) => timestampOf(a) - timestampOf(b));

      for (const payload of messages) {
        if (!payload.id) {
          summary.skipped++;
          continue;
        }
        await dispatchWahaEvent(
          admin,
          {
            id: session.id,
            organization_id: session.organization_id,
            is_warmup_complete: null,
            warmup_started_at: null,
          },
          { event: "message.any", payload },
          `waha-history:${session.id}:${payload.id}`,
          { historical: true },
        );
        summary.messages++;
      }
      summary.synced++;
    } catch (err) {
      summary.failed++;
      logger.warn("waha.history-sync: sessão não sincronizada", {
        session_id: session.id,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}
