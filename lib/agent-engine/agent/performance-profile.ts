/** Limites do perfil rápido da resposta automática. */
export const PERFIL_RAPIDO = {
  maxSteps: 6,
  historyLimit: 10,
  maxContextTokens: 4_000,
} as const;

export interface LimitesDoTurno {
  maxSteps: number;
  historyLimit: number;
  maxContextTokens: number;
}

/** Aplica limites sem aumentar nenhum valor escolhido pelo operador. */
export function limitesDoTurno(
  limites: LimitesDoTurno,
  fastMode: boolean,
): LimitesDoTurno {
  if (!fastMode) return limites;
  return {
    maxSteps: Math.min(limites.maxSteps, PERFIL_RAPIDO.maxSteps),
    historyLimit: Math.min(limites.historyLimit, PERFIL_RAPIDO.historyLimit),
    maxContextTokens: Math.min(limites.maxContextTokens, PERFIL_RAPIDO.maxContextTokens),
  };
}
