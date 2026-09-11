---
impacto: nada_mudou
secao: corrigido
titulo: Resposta automática da IA recebe perfil rápido e espera menor
---

O worker agora verifica o dispatch de mensagens recebidas a cada 2 segundos quando está ocioso.
O debounce padrão caiu de 8 para 3 segundos. O perfil opcional `AGENT_FAST_MODE=true` limita
agentes já publicados a 10 mensagens/4.000 tokens, no máximo 6 steps, e remove o classificador
de estágio consultivo, mantendo envio e guardrails. Novos agentes passam a nascer com 8 steps,
10 mensagens e 4.000 tokens de histórico.
