/**
 * Observação interna do Diário: casa a planilha com o título e grava no SQLite local.
 * A chave estável é origem + código do título, para o texto continuar aparecendo
 * quando a conta entrar de novo em outro período.
 */

import { prisma } from '../config/prisma.js';
import { queryDiarioContasPagar, type DiarioContaPagarLinha } from './diarioContasPagarRepository.js';

export const ANOTACAO_MAX = 1000;
const IMPORT_MAX_LINHAS = 5000;
const IMPORT_MAX_DIAS = 400;

export interface PlanilhaAnotacaoLinha {
  classificacao: string;
  vencimento: string;
  empresa: string;
  conta: string;
  forma: string;
  pessoa: string;
  descricao: string;
  comentarios: string;
  pedido: string;
  saldo: number;
  observacao: string;
}

export interface ImportacaoAnotacaoResultado {
  gravados: number;
  ignoradosVazios: number;
  semCorrespondencia: number;
  ambiguos: number;
  amostrasSem: string[];
}

type CampoPlanilha =
  | 'classificacao'
  | 'vencimento'
  | 'empresa'
  | 'conta'
  | 'forma'
  | 'pessoa'
  | 'descricao'
  | 'comentarios'
  | 'pedido'
  | 'saldo'
  | 'observacao';

const ALIAS_COLUNA: Record<string, CampoPlanilha> = {
  classificacao: 'classificacao',
  vencimento: 'vencimento',
  empresa: 'empresa',
  conta: 'conta',
  forma: 'forma',
  pessoa: 'pessoa',
  descricao: 'descricao',
  comentarios: 'comentarios',
  'pedido de compra': 'pedido',
  pedido: 'pedido',
  'saldo a pagar': 'saldo',
  saldo: 'saldo',
  observacao: 'observacao',
};

export function normTextoAnotacao(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–]/g, ' ')
    .replace(/-{3,}/g, ' ')
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function normEmpresa(valor: string | null | undefined): string {
  return normTextoAnotacao(valor).replace(/^\d+\s*-\s*/, '');
}

function saldoCentavos(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round(valor * 100);
}

function chavePartes(partes: {
  plano: string;
  vencimento: string;
  empresa: string;
  conta: string;
  forma: string;
  pessoa: string;
  descricao: string;
  comentarios: string;
  pedido: string;
  saldo: number;
}): string {
  return [
    normTextoAnotacao(partes.plano),
    partes.vencimento,
    normEmpresa(partes.empresa),
    normTextoAnotacao(partes.conta),
    normTextoAnotacao(partes.forma),
    normTextoAnotacao(partes.pessoa),
    normTextoAnotacao(partes.descricao),
    normTextoAnotacao(partes.comentarios),
    normTextoAnotacao(partes.pedido),
    String(saldoCentavos(partes.saldo)),
  ].join('\u001f');
}

function chavePlanilha(
  linha: PlanilhaAnotacaoLinha,
  modo: 'completa' | 'semNotas' | 'semEmpresa' | 'identidade' | 'pessoaData',
): string {
  if (modo === 'pessoaData') return [linha.vencimento, normTextoAnotacao(linha.pessoa)].join('\u001f');
  if (modo === 'identidade') {
    return [linha.vencimento, normTextoAnotacao(linha.pessoa), String(saldoCentavos(linha.saldo))].join('\u001f');
  }
  return chavePartes({
    plano: linha.classificacao,
    vencimento: linha.vencimento,
    empresa: modo === 'semEmpresa' ? '' : linha.empresa,
    conta: linha.conta,
    forma: linha.forma,
    pessoa: linha.pessoa,
    descricao: linha.descricao,
    comentarios: modo === 'completa' ? linha.comentarios : '',
    pedido: modo === 'completa' ? linha.pedido : '',
    saldo: linha.saldo,
  });
}

function empresaTitulo(linha: DiarioContaPagarLinha): string {
  return linha.filial?.trim() || linha.empresa?.trim() || '';
}

function chaveTitulo(
  linha: DiarioContaPagarLinha,
  modo: 'completa' | 'semNotas' | 'semEmpresa' | 'identidade' | 'pessoaData',
): string {
  if (modo === 'pessoaData') return [linha.dataVencimento ?? '', normTextoAnotacao(linha.fornecedor)].join('\u001f');
  if (modo === 'identidade') {
    return [linha.dataVencimento ?? '', normTextoAnotacao(linha.fornecedor), String(saldoCentavos(linha.saldo))].join('\u001f');
  }
  return chavePartes({
    plano: linha.planoContas ?? '',
    vencimento: linha.dataVencimento ?? '',
    empresa: modo === 'semEmpresa' ? '' : empresaTitulo(linha),
    conta: linha.contaBancaria ?? '',
    forma: linha.formaPagamento ?? '',
    pessoa: linha.fornecedor ?? '',
    descricao: linha.descricao ?? '',
    comentarios: modo === 'completa' ? (linha.observacao ?? '') : '',
    pedido: modo === 'completa' ? (linha.pedidoCompra ?? '') : '',
    saldo: linha.saldo,
  });
}

function indice(
  linhas: DiarioContaPagarLinha[],
  modo: 'completa' | 'semNotas' | 'semEmpresa' | 'identidade' | 'pessoaData',
): Map<string, DiarioContaPagarLinha[]> {
  const map = new Map<string, DiarioContaPagarLinha[]>();
  for (const linha of linhas) {
    if (!(linha.codigo > 0)) continue;
    const chave = chaveTitulo(linha, modo);
    const lista = map.get(chave);
    if (lista) lista.push(linha);
    else map.set(chave, [linha]);
  }
  return map;
}

function resumoLinha(linha: PlanilhaAnotacaoLinha): string {
  const pessoa = normTextoAnotacao(linha.pessoa) || 'sem pessoa';
  const saldo = saldoCentavos(linha.saldo) / 100;
  return `${linha.vencimento} · ${pessoa} · ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export function casarPlanilhaComTitulos(
  planilha: PlanilhaAnotacaoLinha[],
  titulos: DiarioContaPagarLinha[],
): ImportacaoAnotacaoResultado & { pares: Array<{ origem: 'Shop9' | 'Nomus'; codigo: number; texto: string }> } {
  const completa = indice(titulos, 'completa');
  const semNotas = indice(titulos, 'semNotas');
  const semEmpresa = indice(titulos, 'semEmpresa');
  const identidade = indice(titulos, 'identidade');
  const pessoaData = indice(titulos, 'pessoaData');
  const usados = new Set<string>();
  const pares: Array<{ origem: 'Shop9' | 'Nomus'; codigo: number; texto: string }> = [];
  let ignoradosVazios = 0;
  let semCorrespondencia = 0;
  let ambiguos = 0;
  const amostrasSem: string[] = [];

  for (const linha of planilha) {
    const texto = linha.observacao.trim();
    if (!texto) {
      ignoradosVazios += 1;
      continue;
    }
    const modos = ['completa', 'semNotas', 'semEmpresa', 'identidade', 'pessoaData'] as const;
    let escolhido: DiarioContaPagarLinha | null = null;
    let ambiguo = false;
    for (const modo of modos) {
      const mapa =
        modo === 'completa'
          ? completa
          : modo === 'semNotas'
            ? semNotas
            : modo === 'semEmpresa'
              ? semEmpresa
              : modo === 'identidade'
                ? identidade
                : pessoaData;
      const achados = (mapa.get(chavePlanilha(linha, modo)) ?? []).filter(
        (t) => !usados.has(`${t.origem}:${t.codigo}`),
      );
      const unicos = new Map<string, DiarioContaPagarLinha>();
      for (const titulo of achados) unicos.set(`${titulo.origem}:${titulo.codigo}`, titulo);
      if (unicos.size === 1) {
        escolhido = [...unicos.values()][0];
        break;
      }
      if (unicos.size > 1) {
        ambiguo = true;
        break;
      }
    }
    if (!escolhido) {
      if (ambiguo) ambiguos += 1;
      else {
        semCorrespondencia += 1;
        if (amostrasSem.length < 8) amostrasSem.push(resumoLinha(linha));
      }
      continue;
    }
    usados.add(`${escolhido.origem}:${escolhido.codigo}`);
    pares.push({ origem: escolhido.origem, codigo: escolhido.codigo, texto: texto.slice(0, ANOTACAO_MAX) });
  }

  return { gravados: pares.length, ignoradosVazios, semCorrespondencia, ambiguos, amostrasSem, pares };
}

function parseSaldo(valor: string): number {
  const t = valor.trim();
  if (!t) return 0;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const br = t.replace(/\./g, '').replace(',', '.');
  const n = Number(br);
  return Number.isFinite(n) ? n : NaN;
}

function parseData(valor: string): string | null {
  const t = valor.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

export function lerMatrizPlanilha(matriz: unknown): PlanilhaAnotacaoLinha[] {
  if (!Array.isArray(matriz) || matriz.length === 0) {
    throw new Error('A planilha não tem linhas.');
  }
  if (matriz.length > IMPORT_MAX_LINHAS) {
    throw new Error(`A planilha passa de ${IMPORT_MAX_LINHAS} linhas.`);
  }
  const linhas = matriz.map((row) => {
    if (!Array.isArray(row)) return [] as string[];
    return row.map((cell) => (cell == null ? '' : String(cell)));
  });
  let header = -1;
  let mapa = new Map<CampoPlanilha, number>();
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const tentativa = new Map<CampoPlanilha, number>();
    linhas[i].forEach((cell, col) => {
      const nome = normTextoAnotacao(cell).toLocaleLowerCase('pt-BR');
      const campo = ALIAS_COLUNA[nome];
      if (campo && !tentativa.has(campo)) tentativa.set(campo, col);
    });
    if (tentativa.has('observacao') && (tentativa.has('pessoa') || tentativa.has('saldo'))) {
      header = i;
      mapa = tentativa;
      break;
    }
  }
  if (header < 0) {
    throw new Error('Não encontrei a coluna Observação na planilha.');
  }
  const saida: PlanilhaAnotacaoLinha[] = [];
  for (let i = header + 1; i < linhas.length; i++) {
    const row = linhas[i];
    const pegar = (campo: CampoPlanilha) => {
      const col = mapa.get(campo);
      return col == null ? '' : (row[col] ?? '').trim();
    };
    const observacao = pegar('observacao');
    const pessoa = pegar('pessoa');
    const classificacao = pegar('classificacao');
    if (!observacao && !pessoa && !classificacao) continue;
    const vencimento = parseData(pegar('vencimento'));
    if (!vencimento) continue;
    const saldo = parseSaldo(pegar('saldo'));
    if (!Number.isFinite(saldo)) continue;
    saida.push({
      classificacao,
      vencimento,
      empresa: pegar('empresa'),
      conta: pegar('conta'),
      forma: pegar('forma'),
      pessoa,
      descricao: pegar('descricao'),
      comentarios: pegar('comentarios'),
      pedido: pegar('pedido'),
      saldo,
      observacao,
    });
  }
  return saida;
}

function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return IMPORT_MAX_DIAS + 1;
  return Math.round((b - a) / 86_400_000);
}

export async function aplicarAnotacoesDiario(linhas: DiarioContaPagarLinha[]): Promise<void> {
  if (linhas.length === 0) return;
  try {
    const rows = await prisma.diarioAnotacao.findMany({
      select: { origem: true, codigo: true, texto: true },
    });
    const porChave = new Map(rows.map((r) => [`${r.origem}:${r.codigo}`, r.texto]));
    for (const linha of linhas) {
      linha.anotacao = porChave.get(`${linha.origem}:${linha.codigo}`) ?? null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[diarioAnotacao] leitura:', msg);
    for (const linha of linhas) linha.anotacao = null;
  }
}

export async function salvarAnotacaoDiario(input: {
  origem: 'Nomus' | 'Shop9';
  codigo: number;
  texto: string;
  usuario: string;
}): Promise<{ texto: string | null }> {
  const texto = input.texto.trim();
  if (texto.length > ANOTACAO_MAX) {
    throw new Error(`A observação pode ter no máximo ${ANOTACAO_MAX} caracteres.`);
  }
  if (!texto) {
    await prisma.diarioAnotacao.deleteMany({
      where: { origem: input.origem, codigo: input.codigo },
    });
    return { texto: null };
  }
  await prisma.diarioAnotacao.upsert({
    where: { origem_codigo: { origem: input.origem, codigo: input.codigo } },
    create: {
      origem: input.origem,
      codigo: input.codigo,
      texto,
      usuario: input.usuario,
    },
    update: { texto, usuario: input.usuario },
  });
  return { texto };
}

export async function importarAnotacoesDiario(input: {
  matriz: unknown;
  usuario: string;
}): Promise<ImportacaoAnotacaoResultado> {
  const planilha = lerMatrizPlanilha(input.matriz);
  if (planilha.length === 0) {
    throw new Error('Nenhuma linha com vencimento e observação foi lida.');
  }
  const datas = planilha.map((l) => l.vencimento).sort();
  const dataInicio = datas[0];
  const dataFim = datas[datas.length - 1];
  if (diasEntre(dataInicio, dataFim) > IMPORT_MAX_DIAS) {
    throw new Error('O intervalo de vencimento da planilha é grande demais para importar de uma vez.');
  }
  const diario = await queryDiarioContasPagar({ dataInicio, dataFim });
  if (diario.linhas.length === 0 && (diario.erroNomus || diario.erroShop9)) {
    throw new Error(diario.erroNomus || diario.erroShop9 || 'Não foi possível ler as contas a pagar.');
  }
  const casamento = casarPlanilhaComTitulos(planilha, diario.linhas);
  if (casamento.pares.length > 0) {
    await prisma.$transaction(
      casamento.pares.map((par) =>
        prisma.diarioAnotacao.upsert({
          where: { origem_codigo: { origem: par.origem, codigo: par.codigo } },
          create: {
            origem: par.origem,
            codigo: par.codigo,
            texto: par.texto,
            usuario: input.usuario,
          },
          update: { texto: par.texto, usuario: input.usuario },
        }),
      ),
    );
  }
  return {
    gravados: casamento.pares.length,
    ignoradosVazios: casamento.ignoradosVazios,
    semCorrespondencia: casamento.semCorrespondencia,
    ambiguos: casamento.ambiguos,
    amostrasSem: casamento.amostrasSem,
  };
}
