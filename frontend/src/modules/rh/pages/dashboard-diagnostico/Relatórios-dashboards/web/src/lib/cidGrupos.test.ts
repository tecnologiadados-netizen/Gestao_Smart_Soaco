import { describe, expect, it } from 'vitest'
import { acumularCidPlanilha, chaveAgregacaoCidPlanilha } from './cidGrupos'

describe('chaveAgregacaoCidPlanilha', () => {
  it('unifica A09 com grafia e pontuação diferentes', () => {
    const a = 'A09 - Diarréia e gastroenterite de origem infecciosa presumível'
    const b = 'A09- Diarreia e gastroenterite de origem infecciosa presumível.'
    expect(chaveAgregacaoCidPlanilha(a)).toBe('A09')
    expect(chaveAgregacaoCidPlanilha(b)).toBe('A09')
  })

  it('soma QNTD na mesma chave', () => {
    const map = new Map<string, { chave: string; rotulo: string; qntd: number; melhorLinhaQtd: number }>()
    acumularCidPlanilha(map, 'A09 - Diarréia e gastroenterite de origem infecciosa presumível', 147)
    acumularCidPlanilha(map, 'A09- Diarreia e gastroenterite de origem infecciosa presumível.', 5)
    expect(map.size).toBe(1)
    expect(map.get('A09')?.qntd).toBe(152)
  })
})
