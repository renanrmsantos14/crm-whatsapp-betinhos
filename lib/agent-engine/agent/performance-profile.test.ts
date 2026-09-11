import { describe, expect, it } from 'vitest';

import { limitesDoTurno } from './performance-profile';

const CONFIGURACAO = { maxSteps: 10, historyLimit: 20, maxContextTokens: 8_000 };

describe('perfil rápido do turno', () => {
  it('não muda a configuração quando está desligado', () => {
    expect(limitesDoTurno(CONFIGURACAO, false)).toEqual(CONFIGURACAO);
  });

  it('reduz steps e contexto sem aumentar valores já menores', () => {
    expect(limitesDoTurno(CONFIGURACAO, true)).toEqual({
      maxSteps: 6,
      historyLimit: 10,
      maxContextTokens: 4_000,
    });
    expect(limitesDoTurno({ maxSteps: 3, historyLimit: 4, maxContextTokens: 900 }, true)).toEqual({
      maxSteps: 3,
      historyLimit: 4,
      maxContextTokens: 900,
    });
  });
});
