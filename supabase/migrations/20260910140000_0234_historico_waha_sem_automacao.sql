-- 0234 — eventos de mensagens recuperadas não reexecutam automações.
-- A linha continua no event_log para auditoria e para recompor a inbox, mas o
-- dispatcher identifica o marcador e não entrega o evento a consumidores.
CREATE OR REPLACE FUNCTION public.fn_emit_message_event() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_event text;
  v_payload jsonb;
begin
  if new.direction = 'inbound' then
    v_event := 'message.received';
  else
    v_event := case new.status
      when 'sending' then 'message.sending'
      when 'sent' then 'message.sent'
      when 'failed' then 'message.failed'
      else 'message.outbound'
    end;
  end if;

  v_payload := jsonb_build_object(
    'message_id', new.id, 'conversation_id', new.conversation_id,
    'contact_id', new.contact_id, 'direction', new.direction,
    'type', new.type, 'status', new.status, 'external_id', new.external_id,
    'channel_session_id', new.channel_session_id,
    'body_preview', left(new.body, 280),
    'historical_sync', coalesce((new.metadata->>'historical_sync')::boolean, false)
  );
  perform public.fn_log_event(new.organization_id, v_event, v_payload);
  return new;
end$$;

ALTER FUNCTION public.fn_emit_message_event() OWNER TO postgres;
