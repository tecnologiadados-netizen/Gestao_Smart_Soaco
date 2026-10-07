import { describe, expect, it } from 'vitest';
import { normalizarCor, normalizarLinks, normalizarPrazo, normalizarStatusCadastro, normalizarTransicao } from './vagas.js';

describe('andamento da vaga', () => {
  it('só abre sem divulgação ou em divulgação', () => {
    expect(normalizarStatusCadastro('aberta_sem_divulgacao')).toBe('aberta_sem_divulgacao');
    expect(normalizarStatusCadastro('em_divulgacao')).toBe('em_divulgacao');
    expect(() => normalizarStatusCadastro('triagem')).toThrow(/aberta/i);
    expect(() => normalizarStatusCadastro('fechada')).toThrow(/aberta/i);
  });

  it('segue a divulgação até a triagem e permite fechar e reabrir', () => {
    expect(normalizarTransicao('aberta_sem_divulgacao', 'em_divulgacao')).toBe('em_divulgacao');
    expect(() => normalizarTransicao('aberta_sem_divulgacao', 'triagem')).toThrow(/andamento/i);
    expect(normalizarTransicao('em_divulgacao', 'triagem')).toBe('triagem');
    expect(normalizarTransicao('triagem', 'entrevista')).toBe('entrevista');
    expect(normalizarTransicao('entrevista', 'fechada')).toBe('fechada');
    expect(normalizarTransicao('fechada', 'em_divulgacao')).toBe('em_divulgacao');
    expect(normalizarTransicao('fechada', 'aberta_sem_divulgacao')).toBe('aberta_sem_divulgacao');
    expect(() => normalizarTransicao('fechada', 'triagem')).toThrow(/andamento/i);
  });

  it('aceita prazo vazio e recusa data impossível', () => {
    expect(normalizarPrazo('')).toBeNull();
    expect(normalizarPrazo(null)).toBeNull();
    expect(normalizarPrazo('2026-10-31')).toBe('2026-10-31');
    expect(() => normalizarPrazo('31/10/2026')).toThrow(/data limite/i);
    expect(() => normalizarPrazo('2026-02-31')).toThrow(/inválida/i);
  });

  it('aceita vários links de divulgação e ignora linha vazia', () => {
    const links = normalizarLinks([
      { id: 'a', descricao: 'LinkedIn', url: 'linkedin.com/jobs/1' },
      { descricao: '', url: '' },
      { url: 'https://empresa.com/vaga' },
    ]);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ id: 'a', descricao: 'LinkedIn', url: 'https://linkedin.com/jobs/1' });
    expect(links[1].url).toBe('https://empresa.com/vaga');
    expect(() => normalizarLinks([{ descricao: 'Site', url: '' }])).toThrow(/endereço/i);
  });

  it('aceita as cores do post-it e cai no branco quando vazia', () => {
    expect(normalizarCor(undefined)).toBe('branco');
    expect(normalizarCor('  Amarelo ')).toBe('amarelo');
    expect(() => normalizarCor('preto')).toThrow(/cor do post-it/i);
    expect(() => normalizarLinks([{ url: 'javascript:alert(1)' }])).toThrow(/inválido/i);
  });
});
