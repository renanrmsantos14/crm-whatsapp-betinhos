-- 0235 — defaults de agente com foco em resposta curta.
-- Não altera versões existentes: só novos registros que omitirem os campos.
alter table public.ai_agent_versions
  alter column max_steps set default 8,
  alter column history_message_window set default 10,
  alter column history_token_window set default 4000;
