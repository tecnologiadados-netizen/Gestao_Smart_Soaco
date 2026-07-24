import { describe, expect, it } from 'vitest';
import {
  montarObsFromContatos,
  parseObsInadimplente,
} from './parseObsInadimplente';

describe('parseObsInadimplente', () => {
  it('divide múltiplas cobranças com datas', () => {
    const texto =
      'Cobrança em 01/11/2024,cobrança 05/11/24 cliente Caroliny informou que o pagemnto está previsto para 06/11/2024.Cobrança em 07/11/2024 ,previsão paa hoje .';
    const parts = parseObsInadimplente(texto);
    expect(parts.length).toBe(3);
    expect(parts[0]!.dataContato?.getDate()).toBe(1);
    expect(parts[0]!.dataContato?.getMonth()).toBe(10);
    expect(parts[1]!.texto.toLowerCase()).toContain('caroliny');
    expect(parts[1]!.texto).toContain('06/11/2024');
    expect(parts[2]!.texto.toLowerCase()).toContain('previsão');
  });

  it('reconhece Agendado para dia', () => {
    const parts = parseObsInadimplente(
      'Agendado para dia 03/10/2024. Cobrança efetuada 09/10/24 novamente.'
    );
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0]!.dataContato?.getDate()).toBe(3);
    expect(parts[0]!.dataContato?.getMonth()).toBe(9);
  });

  it('separa Cobraça (typo) e datas soltas da lista de tentativas', () => {
    const texto =
      'Agendado para dia 03/10/2024. Cobraça efetuada 09/10/24 novamente,25/11/2024 ,09,12,2024 e sem 03/01/2025 ,respondeu mais não definiu pagamento';
    const parts = parseObsInadimplente(texto);
    expect(parts).toHaveLength(5);
    expect(parts[0]!.texto.toLowerCase()).toContain('agendado');
    expect(parts[0]!.dataContato?.getDate()).toBe(3);
    expect(parts[1]!.texto.toLowerCase()).toContain('cobraça efetuada');
    expect(parts[1]!.dataContato?.getDate()).toBe(9);
    expect(parts[2]!.dataContato?.getMonth()).toBe(10); // nov
    expect(parts[2]!.dataContato?.getDate()).toBe(25);
    expect(parts[3]!.dataContato?.getMonth()).toBe(11); // dez
    expect(parts[3]!.dataContato?.getDate()).toBe(9);
    expect(parts[3]!.texto.toLowerCase()).toContain('e sem');
    expect(parts[4]!.dataContato?.getFullYear()).toBe(2025);
    expect(parts[4]!.texto.toLowerCase()).toContain('respondeu');
  });

  it('sem âncora vira um único contato', () => {
    const parts = parseObsInadimplente('Cliente sem previsão definida');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.dataContato).toBeNull();
    expect(parts[0]!.texto).toContain('sem previsão');
  });

  it('montarObsFromContatos concatena', () => {
    const obs = montarObsFromContatos([
      { dataContato: new Date(2024, 10, 1, 12), texto: 'Cobrança em 01/11/2024' },
      { dataContato: new Date(2024, 10, 7, 12), texto: 'Cobrança em 07/11/2024. previsão para hoje' },
    ]);
    expect(obs).toContain('01/11/2024');
    expect(obs).toContain('07/11/2024');
  });
});
