import { describe, expect, it } from 'vitest';
import {
  formatarQuantidade,
  montarMensagemColetaAprovacaoWhatsApp,
  renderPaginaAprovacaoHtml,
  resultadoDaAnalise,
  type RetratoColetaAprovacao,
} from './coletaAprovacaoLinkService.js';

const retrato: RetratoColetaAprovacao = {
  observacoes: 'Entregar na matriz',
  fornecedores: [
    {
      idPessoa: 10,
      nome: '12.345.678/0001-90 - Aços Ltda',
      condicaoPagamento: '28 dias',
      formaPagamento: 'Boleto',
      valorFrete: null,
      valorFreteTipo: null,
      pedidoMinimo: null,
    },
    {
      idPessoa: 20,
      nome: 'Ferro Norte',
      condicaoPagamento: null,
      formaPagamento: null,
      valorFrete: null,
      valorFreteTipo: null,
      pedidoMinimo: null,
    },
  ],
  produtos: [
    {
      registroId: 7,
      codigo: 'CH-10',
      descricao: 'Chapa',
      unidade: 'KG',
      qtdSolicitada: '80.540000000000000000000000000000',
      qtdeAprovada: 10,
      rejeitado: false,
      precos: [{ idFornecedor: 10, precoNF: 12.5, percIPI: 5, percICMS: 18, precoTotal: 15 }],
      idFornecedorVencedor: 10,
      detalhes: [
        { rotulo: 'Saldo de Estoque', valor: '109,4' },
        { rotulo: 'Qtde Empenhada', valor: '20' },
        { rotulo: 'Último Custo', valor: '11,20' },
        { rotulo: 'Tipo do Produto', valor: 'Matéria prima' },
        { rotulo: 'Grupo do Produto', valor: 'Material comprado' },
      ],
    },
  ],
};

describe('link de aprovação da coleta', () => {
  it('define o status da análise para o portal', () => {
    const item = (qtde: number | null, extra: { rejeitado?: boolean; reavaliacao?: boolean } = {}) => ({
      qtdeAprovada: qtde,
      ...extra,
    });
    expect(resultadoDaAnalise([item(2), item(1)])).toBe('Aprovado Total');
    expect(resultadoDaAnalise([item(2), item(null, { rejeitado: true })])).toBe('Aprovado Parcial');
    expect(resultadoDaAnalise([item(2), item(null, { reavaliacao: true })])).toBe('Reavaliar');
  });

  it('monta a mensagem do WhatsApp com o link no rodapé', () => {
    const texto = montarMensagemColetaAprovacaoWhatsApp({
      coletaId: 42,
      enviadoPor: 'maria',
      qtdProdutos: 1,
      url: 'https://gsmartsoaco.com.br/a/abc',
    });
    expect(texto).toContain('*Coleta de preços para aprovação*');
    expect(texto).toContain('Coleta *#42*');
    expect(texto).toContain('Enviada por maria');
    expect(texto).toContain('1 produto');
    expect(texto.endsWith('https://gsmartsoaco.com.br/a/abc')).toBe(true);
  });

  it('formata a quantidade solicitada sem a cauda de zeros', () => {
    expect(formatarQuantidade('80.540000000000000000000000000000')).toBe('80,54');
    expect(formatarQuantidade('100')).toBe('100');
    expect(formatarQuantidade('1.234,5')).toBe('1.234,5');
  });

  it('mostra um cartão por produto, com Barlow, sem a frase removida', () => {
    const html = renderPaginaAprovacaoHtml({
      tipo: 'aguardando',
      coletaId: 42,
      nome: 'João',
      token: 'tok_abc',
      retrato,
    });
    expect(html).toContain('family=Barlow');
    expect(html).toContain('font-family: Barlow');
    expect(html).toContain('Aguardando João');
    expect(html).toContain('>Finalizar<');
    expect(html).toContain('name="modo" value="finalizar"');
    expect(html).toContain('class="card avaliado"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Recolher');
    expect(html).toContain('10 KG · Aços Ltda · R$ 15,00');
    expect(html).toContain('class="resumo-nome"');
    expect(html).toContain('Chapa');
    expect(html).toContain('grid-template-rows');
    expect(html).toContain('Quantidade solicitada');
    expect(html).toContain('class="qtd-original">80,54');
    expect(html).toContain('value="10"');
    expect(html).toContain('Quantidade aprovada: 10');
    expect(html).toContain('aria-label="Confirmar quantidade"');
    expect(html).not.toContain('Outra quantidade');
    expect(html).toContain('aria-label="Rejeitar esta negociação"');
    expect(html).toContain('aria-label="Reavaliar esta negociação"');
    expect(html).toContain('>Reavaliar<');
    expect(html).toContain('abrirRetorno');
    expect(html).toContain('O que precisa ser feito');
    expect(html).toContain('class="rejeitar"');
    expect(html).toContain('class="motivo"');
    expect(html).toContain('Segure para gravar');
    expect(html).toContain('iniciarGravacao(');
    expect(html).toContain('soltarGravacao()');
    expect(html).toContain('Motivo da rejeição');
    expect(html).toContain('name="motivo"');
    expect(html).toContain('name="modo" value="rejeitar"');
    expect(html).toContain("showModal()");
    expect(html).not.toContain('>Aprovar quantidade solicitada<');
    expect(html).not.toContain('>Aprovar esta quantidade<');
    expect(html).toContain('name="registroId" value="7"');
    expect(html).not.toContain('name="modo" value="solicitada"');
    expect(html).toContain('name="modo" value="informada"');
    expect(html).toContain('name="idFornecedor" value="10" checked');
    expect(html).toContain('value="20"');
    expect(html).not.toContain('value="20" checked');
    expect(html).toContain('Comprar deste');
    expect(html).toContain('Ver informações da coleta');
    expect(html).toContain('class="fechar"');
    expect(html).toContain('Saldo de Estoque');
    expect(html).toContain('Qtde Empenhada');
    expect(html).toContain('Último Custo');
    expect(html).toContain('linha destaque');
    expect(html).toContain('Aços Ltda');
    expect(html).toContain('Preço NF');
    expect(html).toContain('Preço total');
    expect(html).toContain('class="preco-total"');
    expect(html).toContain('R$ 12,50');
    expect(html).toContain('R$ 15,00');
    expect(html).not.toContain('Preços da cotação');
    expect(html).not.toContain('Tipo do Produto');
    expect(html).not.toContain('Grupo do Produto');
    expect(html).not.toContain('só registra a decisão');
    expect(html).not.toContain('name="decisao"');
    expect(html).not.toContain('12.345.678/0001-90');
  });

  it('destaca o fornecedor com o menor preço total', () => {
    const html = renderPaginaAprovacaoHtml({
      tipo: 'aguardando',
      coletaId: 42,
      nome: 'João',
      token: 'tok_abc',
      retrato: {
        ...retrato,
        produtos: [
          {
            ...retrato.produtos[0],
            precos: [
              { idFornecedor: 10, precoNF: 143.93, percIPI: 3.25, percICMS: 22.5, precoTotal: 95.14 },
              { idFornecedor: 20, precoNF: 134.5, percIPI: 0, percICMS: 22.5, precoTotal: 91.8 },
            ],
          },
        ],
      },
    });
    expect(html).toContain('class="forn menor"');
    expect(html).toContain('>Menor preço</span>');
    expect(html).toContain('.forn.menor { background: #e7f6ee;');
    const menor = html.indexOf('class="forn menor"');
    const outro = html.indexOf('class="forn"');
    expect(html.slice(menor, menor + 400)).toContain('Ferro Norte');
    expect(html.slice(outro, outro + 200)).toContain('Aços Ltda');
    expect(html.slice(outro, outro + 200)).not.toContain('Menor preço');
  });

  it('com um único fornecedor já deixa esse marcado', () => {
    const html = renderPaginaAprovacaoHtml({
      tipo: 'aguardando',
      coletaId: 42,
      nome: 'João',
      token: 'tok_abc',
      retrato: {
        ...retrato,
        fornecedores: [retrato.fornecedores[0]],
        produtos: [{ ...retrato.produtos[0], idFornecedorVencedor: null, qtdeAprovada: null }],
      },
    });
    expect(html).toContain('name="idFornecedor" value="10" checked');
    expect(html).not.toContain('Ferro Norte');
    expect(html).toContain('class="card aguardando"');
    expect(html).toContain('Aguardando avaliação');
    expect(html).toContain('.card.aguardando .resumo-status');
    expect(html).toContain('.card.rejeitado .resumo-status');
    expect(html).toContain('.card.reavaliacao .resumo-status');
    expect(html).toContain('.card.avaliado .resumo-status');
    expect(html).toContain('Recolher');
  });

  it('fora de aprovação mostra o cartão sem os botões de gravar quantidade', () => {
    const html = renderPaginaAprovacaoHtml({
      tipo: 'consulta',
      coletaId: 42,
      nome: 'João',
      retrato,
    });
    expect(html).toContain('CH-10');
    expect(html).toContain('Quantidade aprovada: 10');
    expect(html).toContain('family=Barlow');
    expect(html).not.toContain('Aprovar quantidade solicitada');
    expect(html).not.toContain('name="modo"');
    expect(html).not.toContain('>Finalizar<');
    expect(html).not.toContain('só registra a decisão');
  });

  it('aprovação finalizada pelo link não mostra os itens', () => {
    const html = renderPaginaAprovacaoHtml({
      tipo: 'consulta',
      coletaId: 42,
      nome: 'João',
      retrato,
      resultado: 'Aprovado Parcial',
    });
    expect(html).toContain('Aprovação finalizada');
    expect(html).toContain('Aprovado Parcial');
    expect(html).toContain('não aparecem mais neste link');
    expect(html).not.toContain('CH-10');
    expect(html).not.toContain('>Finalizar<');
  });
});
