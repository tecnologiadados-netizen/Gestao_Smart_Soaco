import { describe, expect, it } from 'vitest';
import {
  canEditRoute,
  canViewRoute,
  granularPermissionFallback,
  normalizeRhPermissions,
} from './rh-permissions.js';
import {
  descreverMudancasCard,
  inserirAntes,
  normalizarChecklists,
  normalizarCor,
  normalizarEmails,
  normalizarPrazo,
  type EstadoCardNotificavel,
} from './demandasInternas.js';

describe('e-mails notificados do card', () => {
  it('aceita vários, em minúsculo e sem repetir', () => {
    expect(normalizarEmails([' Ana@SoAco.com.br ', 'bia@soaco.com.br', 'ana@soaco.com.br', ''])).toEqual([
      'ana@soaco.com.br',
      'bia@soaco.com.br',
    ]);
  });

  it('recusa e-mail inválido', () => {
    expect(() => normalizarEmails(['ana@soaco'])).toThrow(/E-mail inválido/);
    expect(() => normalizarEmails('ana@soaco.com.br')).toThrow(/lista/);
  });
});

describe('mudanças que geram aviso por e-mail', () => {
  const base: EstadoCardNotificavel = {
    titulo: 'PGR',
    observacao: '',
    concluido: false,
    prazo: '2026-10-16',
    checklists: [{ id: 'lista-0001', titulo: 'Etapas', itens: [{ id: 'item-0001', texto: 'Enviar laudo', feito: false }] }],
  };

  it('sem mudança relevante não gera aviso', () => {
    expect(descreverMudancasCard(base, { ...base })).toEqual([]);
  });

  it('descreve conclusão, prazo e item do checklist', () => {
    const depois: EstadoCardNotificavel = {
      ...base,
      concluido: true,
      prazo: '2026-10-20',
      checklists: [{ ...base.checklists[0], itens: [{ id: 'item-0001', texto: 'Enviar laudo', feito: true }] }],
    };
    expect(descreverMudancasCard(base, depois)).toEqual([
      'Card concluído.',
      'Prazo alterado de 16/10/2026 para 20/10/2026.',
      'Item concluído em “Etapas”: Enviar laudo',
    ]);
  });

  it('descreve prazo removido e card reaberto', () => {
    expect(descreverMudancasCard({ ...base, concluido: true }, { ...base, prazo: null })).toEqual([
      'Card reaberto.',
      'Prazo removido (era 16/10/2026).',
    ]);
  });
});

describe('ordem dos cards', () => {
  it('insere o card antes de outro e tira a posição antiga', () => {
    expect(inserirAntes(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(inserirAntes(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c']);
    expect(inserirAntes(['a', 'b', 'c'], 'b', null)).toEqual(['a', 'c', 'b']);
    expect(inserirAntes(['a', 'b'], 'a', 'b')).toEqual(['a', 'b']);
  });
});

describe('cor do post-it', () => {
  it('aceita a paleta e cai no branco quando vem vazio', () => {
    expect(normalizarCor('Vermelho')).toBe('vermelho');
    expect(normalizarCor('')).toBe('branco');
    expect(normalizarCor(undefined)).toBe('branco');
    expect(() => normalizarCor('preto')).toThrow(/cor do post-it/);
  });
});

describe('prazo do card', () => {
  it('aceita a data e limpa quando vem vazio', () => {
    expect(normalizarPrazo('2026-10-07')).toBe('2026-10-07');
    expect(normalizarPrazo('')).toBeNull();
    expect(normalizarPrazo(null)).toBeNull();
    expect(() => normalizarPrazo('07/10/2026')).toThrow(/prazo/);
    expect(() => normalizarPrazo('2026-02-31')).toThrow(/prazo/);
  });
});

describe('checklist do card', () => {
  it('descarta item vazio e preserva o que foi marcado', () => {
    const listas = normalizarChecklists([
      {
        id: 'checklist1',
        titulo: '  Entrevista  ',
        itens: [
          { id: 'item00001', texto: '  Assinatura  ', feito: true },
          { id: 'item00002', texto: '   ', feito: true },
        ],
      },
    ]);
    expect(listas).toEqual([
      {
        id: 'checklist1',
        titulo: 'Entrevista',
        itens: [{ id: 'item00001', texto: 'Assinatura', feito: true }],
      },
    ]);
  });
});

describe('permissão de demandas internas', () => {
  it('espalha visualizar/editar antigo em cadastrar, editar e excluir de cada aba', () => {
    const permissoes = normalizeRhPermissions({
      demandasInternas: { view: true, edit: false },
    });
    expect(permissoes.demandasInternas.abas.quadros).toEqual({
      view: true,
      create: false,
      edit: false,
      delete: false,
    });
    expect(permissoes.demandasInternas.abas.cards.delete).toBe(false);
    expect(permissoes.routes.find((rota) => rota.url === '/demandas-internas')).toMatchObject({
      canView: true,
      canEdit: false,
    });
    expect(canViewRoute(permissoes, '/demandas-internas')).toBe(true);
    expect(canEditRoute(permissoes, '/demandas-internas')).toBe(false);
    expect(granularPermissionFallback(permissoes, '/demandas-internas', 'edit')).toBe(false);
  });

  it('quem podia editar continua podendo cadastrar, editar e excluir em todas as abas', () => {
    const permissoes = normalizeRhPermissions({
      vagas: { view: true, edit: true },
    });
    expect(permissoes.vagas.abas.triagem).toEqual({
      view: true,
      create: true,
      edit: true,
      delete: true,
    });
    expect(canEditRoute(permissoes, '/vagas')).toBe(true);
  });

  it('separa o comentário confidencial do desligamento das categorias de comentário', () => {
    const herdado = normalizeRhPermissions({
      organico: { comentarios: { view: true, edit: false } },
    });
    expect(herdado.organico.comentarioConfidencialDesligamento).toBe(true);

    const separado = normalizeRhPermissions({
      organico: {
        comentarios: { view: true, edit: true },
        comentarioConfidencialDesligamento: false,
      },
    });
    expect(separado.organico.comentarios.view).toBe(true);
    expect(separado.organico.comentarioConfidencialDesligamento).toBe(false);
  });
});
