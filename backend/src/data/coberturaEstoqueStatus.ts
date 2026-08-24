/**
 * Cobertura de Estoque — indicadores v2.
 * Universo: almox secundário; Empenho > 0 é opcional (toggle no painel).
 * Cálculos toleram Empenho = 0 / CM = 0 (visão Sem giro).
 */
import type { ConsultaEstoqueRow } from './consultaEstoqueRepository.js';

/** Régua legada (saldo vs empenho projetado) — mantida na API por compatibilidade. */
export type StatusCoberturaEstoque =
  | 'ruptura_projetada'
  | 'zerado_projetado'
  | 'cobertura_fragil'
  | 'nivelado'
  | 'excesso_parado';

export const STATUS_COBERTURA_ORDEM: StatusCoberturaEstoque[] = [
  'ruptura_projetada',
  'zerado_projetado',
  'cobertura_fragil',
  'nivelado',
  'excesso_parado',
];

export const LABELS_STATUS_COBERTURA: Record<StatusCoberturaEstoque, string> = {
  ruptura_projetada: 'Ruptura projetada',
  zerado_projetado: 'Zerado projetado',
  cobertura_fragil: 'Cobertura frágil',
  nivelado: 'Nivelado',
  excesso_parado: 'Excesso / parado',
};

/** Status operacional do painel v2 (coluna Status + KPIs). */
export type StatusPainelCobertura =
  | 'aguardando_pc'
  | 'ruptura'
  | 'sem_giro'
  | 'sem_historico'
  | 'critico'
  | 'atencao'
  | 'saudavel'
  | 'excesso';

/** Ordem de exibição dos cards KPI. */
export const STATUS_PAINEL_KPI_ORDEM: StatusPainelCobertura[] = [
  'ruptura',
  'aguardando_pc',
  'critico',
  'atencao',
  'saudavel',
  'excesso',
];

/** Ordem de blocos na ordenação padrão da grade. */
export const STATUS_PAINEL_SORT_ORDEM: StatusPainelCobertura[] = [
  'ruptura',
  'aguardando_pc',
  'critico',
  'atencao',
  'excesso',
  'saudavel',
  'sem_giro',
  'sem_historico',
];

export const LABELS_STATUS_PAINEL: Record<StatusPainelCobertura, string> = {
  aguardando_pc: 'Aguardando PC',
  ruptura: 'Ruptura',
  sem_giro: 'Sem giro',
  sem_historico: 'Sem histórico',
  critico: 'Crítico',
  atencao: 'Atenção',
  saudavel: 'Saudável',
  excesso: 'Excesso',
};

export const SUBTITULOS_STATUS_PAINEL: Record<StatusPainelCobertura, string> = {
  aguardando_pc: 'PC cobre o faltante',
  ruptura: 'estoque < empenho',
  sem_giro: 'CM 0 e sem empenho',
  sem_historico: 'CM 0 com empenho/estoque',
  critico: '0 a 0,5 mês',
  atencao: '0,5 a 1 mês',
  saudavel: '1 a 3 meses',
  excesso: 'acima de 3 meses',
};

export type ClasseAtendimento = 'descoberto' | 'parcial' | 'atendido';

export const LABELS_CLASSE_ATENDIMENTO: Record<ClasseAtendimento, string> = {
  descoberto: 'Descoberto',
  parcial: 'Parcial',
  atendido: 'Atendido',
};

/** Barras da distribuição de cobertura (meses) — só itens com CM > 0. */
export type BarraFirme = 'lt0' | '0_05' | '05_1' | '1_2' | '2_3' | '3_6' | 'gt6';

export const BARRAS_FIRME_ORDEM: BarraFirme[] = [
  'lt0',
  '0_05',
  '05_1',
  '1_2',
  '2_3',
  '3_6',
  'gt6',
];

export const LABELS_BARRA_FIRME: Record<BarraFirme, string> = {
  lt0: '< 0',
  '0_05': '0 - 0,5',
  '05_1': '0,5 - 1',
  '1_2': '1 - 2',
  '2_3': '2 - 3',
  '3_6': '3 - 6',
  gt6: '> 6',
};

/** Alias de StatusPainelCobertura para imports existentes. */
export type KpiFirme = StatusPainelCobertura;

export const KPIS_FIRME_ORDEM: StatusPainelCobertura[] = STATUS_PAINEL_KPI_ORDEM;

export const LABELS_KPI_FIRME = LABELS_STATUS_PAINEL;
export const SUBTITULOS_KPI_FIRME = SUBTITULOS_STATUS_PAINEL;

export const BARRA_PARA_KPI: Record<BarraFirme, StatusPainelCobertura> = {
  lt0: 'ruptura',
  '0_05': 'critico',
  '05_1': 'atencao',
  '1_2': 'saudavel',
  '2_3': 'saudavel',
  '3_6': 'excesso',
  gt6: 'excesso',
};

export const KPI_PARA_BARRAS: Partial<Record<StatusPainelCobertura, BarraFirme[]>> = {
  ruptura: ['lt0'],
  critico: ['0_05'],
  atencao: ['05_1'],
  saudavel: ['1_2', '2_3'],
  excesso: ['3_6', 'gt6'],
};

export function classificarCoberturaEstoque(row: {
  saldo: number;
  empenho: number;
  saldoProjetado: number;
}): StatusCoberturaEstoque {
  const saldo = Number(row.saldo) || 0;
  const empenho = Number(row.empenho) || 0;
  const saldoProjetado = Number(row.saldoProjetado) || 0;

  if (saldoProjetado < 0) return 'ruptura_projetada';
  if (saldoProjetado === 0) return 'zerado_projetado';

  if (saldo < empenho) return 'cobertura_fragil';
  if (empenho === 0 && saldo > 0) return 'excesso_parado';
  if (empenho > 0 && saldo / empenho > 3) return 'excesso_parado';
  if (empenho > 0 && saldo >= empenho && saldo / empenho <= 3) return 'nivelado';

  return 'nivelado';
}

/**
 * Cobertura projetada (saldo projetado ÷ CM) — legado Ressup.
 * Ainda usa 0,01 quando CM=0; o painel v2 NÃO usa isso na coluna Cobertura.
 */
export function calcCoberturaMeses(saldoProjetado: number, consumoMedio: number): number {
  const saldo = Number(saldoProjetado);
  let cm = Number(consumoMedio);
  if (!Number.isFinite(saldo) || !Number.isFinite(cm)) return 0;
  if (cm === 0) cm = 0.01;
  return round2(saldo / cm);
}

/**
 * Cobertura em meses v2: (estoque − empenho) ÷ CM.
 * CM ≤ 0 → null (nunca divide por 0 nem por 0,01).
 */
export function calcCoberturaMesesNullable(
  saldo: number,
  empenho: number,
  consumoMedio: number
): number | null {
  const cm = Number(consumoMedio);
  if (!Number.isFinite(cm) || cm <= 0) return null;
  const num = (Number(saldo) || 0) - (Number(empenho) || 0);
  if (!Number.isFinite(num)) return null;
  return round2(num / cm);
}

/** Preferir calcCoberturaMesesNullable — mantém assinatura antiga com 0,01. */
export function calcCoberturaFirme(saldo: number, empenho: number, consumoMedio: number): number {
  return calcCoberturaMeses((Number(saldo) || 0) - (Number(empenho) || 0), consumoMedio);
}

export const COMPRADOR_SEM_CADASTRO = 'A definir';

export function normalizarCompradorPainel(nome: string | null | undefined): string {
  const t = String(nome ?? '').trim();
  return t.length > 0 ? t : COMPRADOR_SEM_CADASTRO;
}

export function calcAtendimento(saldo: number, empenho: number): number | null {
  const emp = Number(empenho) || 0;
  if (emp <= 0) return null;
  const est = Number(saldo) || 0;
  return round4(Math.max(0, est / emp));
}

export function calcFaltante(saldo: number, empenho: number): number {
  return Math.max(0, (Number(empenho) || 0) - (Number(saldo) || 0));
}

export function classificarClasseAtendimento(atendimento: number | null): ClasseAtendimento | null {
  if (atendimento == null) return null;
  if (atendimento === 0) return 'descoberto';
  if (atendimento < 1) return 'parcial';
  return 'atendido';
}

export function classificarBarraFirme(cobertura: number): BarraFirme {
  if (cobertura < 0) return 'lt0';
  if (cobertura < 0.5) return '0_05';
  if (cobertura < 1) return '05_1';
  if (cobertura < 2) return '1_2';
  if (cobertura <= 3) return '2_3';
  if (cobertura < 6) return '3_6';
  return 'gt6';
}

export function classificarKpiFirme(cobertura: number): StatusPainelCobertura {
  return BARRA_PARA_KPI[classificarBarraFirme(cobertura)];
}

/** Status do painel — avalia nesta ordem e para no primeiro match. */
export function classificarStatusPainel(row: {
  saldo: number;
  empenho: number;
  consumoMedio: number;
  pedidoCompra: number;
  cobertura: number | null;
  faltante: number;
}): StatusPainelCobertura {
  const saldo = Number(row.saldo) || 0;
  const empenho = Number(row.empenho) || 0;
  const cm = Number(row.consumoMedio) || 0;
  const pc = Number(row.pedidoCompra) || 0;
  const faltante = Number(row.faltante) || 0;

  if (empenho > 0 && saldo < empenho && pc >= faltante && faltante > 0) return 'aguardando_pc';
  if (empenho > 0 && saldo < empenho) return 'ruptura';
  if (cm <= 0 && empenho === 0 && saldo > 0) return 'sem_giro';
  if (cm <= 0) return 'sem_historico';

  const cob = row.cobertura;
  if (cob == null || !Number.isFinite(cob)) return 'sem_historico';
  if (cob < 0.5) return 'critico';
  if (cob < 1) return 'atencao';
  if (cob <= 3) return 'saudavel';
  return 'excesso';
}

export type PrioridadeAcaoCobertura = 'urgente' | 'atencao' | 'ok';

export type ChaveAcaoCobertura =
  | 'cobrar_pc'
  | 'acelerar_sc_agpag'
  | 'comprar_agora'
  | 'converter_sc'
  | 'abrir_sc_urgente'
  | 'programar_sc'
  | 'suspender_compra'
  | 'bloquear_reposicao'
  | 'avaliar_descarte'
  | 'validar_cadastro'
  | 'sem_acao'
  | 'urgenciar_sc'
  | 'urgenciar_cotacao'
  | 'complementar_compra'
  | 'gerar_sc'
  | 'acelerar_cotacao'
  | 'converter_cotacao'
  | 'antecipar_pc'
  | 'operacao_normal'
  | 'monitorar_projetada_negativa'
  | 'evitar_compra'
  | 'revisar_pipeline';

export type AcaoSugeridaCobertura = {
  chave: ChaveAcaoCobertura;
  texto: string;
  prioridade: PrioridadeAcaoCobertura;
};

export function sugerirAcaoCobertura(row: {
  statusPainel: StatusPainelCobertura;
  solicitacao: number;
  cotacao: number;
  pedidoCompra: number;
}): AcaoSugeridaCobertura {
  const sc = Number(row.solicitacao) || 0;
  const agPag = Number(row.cotacao) || 0;
  const pc = Number(row.pedidoCompra) || 0;
  const abertoScAg = sc + agPag;
  const abertoTudo = sc + agPag + pc;

  switch (row.statusPainel) {
    case 'aguardando_pc':
      return { chave: 'cobrar_pc', texto: 'Cobrar entrega do PC', prioridade: 'urgente' };
    case 'ruptura':
      if (abertoScAg > 0) {
        return { chave: 'acelerar_sc_agpag', texto: 'Acelerar SC/Pré Compra', prioridade: 'urgente' };
      }
      return { chave: 'comprar_agora', texto: 'Comprar AGORA — sem SC/PC', prioridade: 'urgente' };
    case 'critico':
      if (sc > 0) {
        return { chave: 'converter_sc', texto: 'Converter SC em pedido', prioridade: 'atencao' };
      }
      return { chave: 'abrir_sc_urgente', texto: 'Abrir SC urgente', prioridade: 'atencao' };
    case 'atencao':
      return { chave: 'programar_sc', texto: 'Programar SC', prioridade: 'atencao' };
    case 'excesso':
      if (abertoTudo > 0) {
        return { chave: 'suspender_compra', texto: 'Suspender compra em aberto', prioridade: 'ok' };
      }
      return { chave: 'bloquear_reposicao', texto: 'Bloquear reposição', prioridade: 'ok' };
    case 'sem_giro':
      return {
        chave: 'avaliar_descarte',
        texto: 'Avaliar descarte ou uso alternativo',
        prioridade: 'ok',
      };
    case 'sem_historico':
      return {
        chave: 'validar_cadastro',
        texto: 'Validar cadastro / item novo',
        prioridade: 'ok',
      };
    case 'saudavel':
    default:
      return { chave: 'sem_acao', texto: 'Sem ação', prioridade: 'ok' };
  }
}

/** Valor bruto em estoque: saldo × preço (sem descontar empenho nem PC). */
export function calcValorEstoqueBruto(
  saldo: number,
  precoUnitario: number | null | undefined
): number | null {
  if (precoUnitario == null || !Number.isFinite(Number(precoUnitario)) || Number(precoUnitario) <= 0) {
    return null;
  }
  return round2((Number(saldo) || 0) * Number(precoUnitario));
}

export function calcValorFirmeMonetario(
  saldo: number,
  empenho: number,
  precoUnitario: number | null | undefined
): number | null {
  if (precoUnitario == null || !Number.isFinite(Number(precoUnitario)) || Number(precoUnitario) <= 0) {
    return null;
  }
  return round2(((Number(saldo) || 0) - (Number(empenho) || 0)) * Number(precoUnitario));
}

/** Janela padrão do card “sem movimentação”. */
export const DIAS_SEM_MOVIMENTACAO_ESTOQUE = 60;

/**
 * Sem movimentação nos últimos `dias` dias (inclusive o limiar).
 * Sem data registrada → considera sem movimentação.
 */
export function isSemMovimentacaoEstoque(
  ultimaMovimentacao: Date | string | null | undefined,
  dias: number = DIAS_SEM_MOVIMENTACAO_ESTOQUE,
  ref: Date = new Date()
): boolean {
  if (ultimaMovimentacao == null || ultimaMovimentacao === '') return true;
  const raw = ultimaMovimentacao instanceof Date ? ultimaMovimentacao : new Date(ultimaMovimentacao);
  if (!Number.isFinite(raw.getTime())) return true;
  const limite = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  limite.setDate(limite.getDate() - dias);
  const ult = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  return ult <= limite;
}

export type CoberturaEstoqueLinha = ConsultaEstoqueRow & {
  status: StatusCoberturaEstoque;
  consumoMedio: number;
  /** Cobertura em meses (Estoque−Empenho)÷CM; null se CM≤0. */
  cobertura: number | null;
  /** Alias de cobertura. */
  coberturaFirme: number | null;
  /** Cobertura projetada legada (saldo projetado ÷ CM com 0,01). */
  coberturaProjetada: number;
  faixaFirme: BarraFirme | null;
  kpiFirme: StatusPainelCobertura;
  statusPainel: StatusPainelCobertura;
  atendimento: number | null;
  atendimentoExibicao: number | null;
  classeAtendimento: ClasseAtendimento | null;
  faltante: number;
  valorFaltante: number | null;
  comprador: string;
  familiaProduto: string;
  precoUnitario: number | null;
  /** Valor bruto: saldo × preço (sem empenho/PC). */
  valorEstoque: number | null;
  valorFirme: number | null;
  /** Última movimentação no almox secundário (setores 2/19); null se nunca. */
  ultimaMovimentacaoEstoque: string | null;
  /** True se não houve movimentação nos últimos 60 dias (ou nunca). */
  semMovimentacao60d: boolean;
  acaoSugerida: AcaoSugeridaCobertura;
};

export type TotaisFaixaFirme = {
  faixa: BarraFirme;
  label: string;
  itens: number;
  capital: number | null;
};

export type TotaisKpiFirme = {
  kpi: StatusPainelCobertura;
  label: string;
  subtitulo: string;
  itens: number;
  capital: number | null;
};

export type TotaisCompradorCobertura = {
  comprador: string;
  itens: number;
  ruptura: number;
  aguardandoPc: number;
  critico: number;
  atencao: number;
};

export type ConsultaEstoqueRowComCm = ConsultaEstoqueRow & {
  consumoMedio: number;
  comprador?: string;
  precoUnitario?: number | null;
  familiaProduto?: string;
  /** ISO date ou null — última mov. almox secundário. */
  ultimaMovimentacaoEstoque?: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function emptyBarras(): TotaisFaixaFirme[] {
  return BARRAS_FIRME_ORDEM.map((faixa) => ({
    faixa,
    label: LABELS_BARRA_FIRME[faixa],
    itens: 0,
    capital: null,
  }));
}

function emptyKpis(): TotaisKpiFirme[] {
  return STATUS_PAINEL_KPI_ORDEM.map((kpi) => ({
    kpi,
    label: LABELS_STATUS_PAINEL[kpi],
    subtitulo: SUBTITULOS_STATUS_PAINEL[kpi],
    itens: 0,
    capital: null,
  }));
}

function ordemComprador(a: string, b: string): number {
  const rank = (n: string) => {
    const m = /^Comprador\s+(\d+)$/i.exec(n);
    if (m) return Number(m[1]);
    if (n === COMPRADOR_SEM_CADASTRO) return 1000;
    return 100;
  };
  return rank(a) - rank(b) || a.localeCompare(b, 'pt-BR');
}

export function agregarCargaPorComprador(linhas: CoberturaEstoqueLinha[]): TotaisCompradorCobertura[] {
  const map = new Map<string, TotaisCompradorCobertura>();
  for (const row of linhas) {
    const atual = map.get(row.comprador) ?? {
      comprador: row.comprador,
      itens: 0,
      ruptura: 0,
      aguardandoPc: 0,
      critico: 0,
      atencao: 0,
    };
    atual.itens += 1;
    if (row.statusPainel === 'ruptura') atual.ruptura += 1;
    else if (row.statusPainel === 'aguardando_pc') atual.aguardandoPc += 1;
    else if (row.statusPainel === 'critico') atual.critico += 1;
    else if (row.statusPainel === 'atencao') atual.atencao += 1;
    map.set(row.comprador, atual);
  }
  return [...map.values()].sort((a, b) => ordemComprador(a.comprador, b.comprador));
}

function nullsLast(a: number | null | undefined, b: number | null | undefined): number {
  const aN = a == null || !Number.isFinite(a);
  const bN = b == null || !Number.isFinite(b);
  if (aN && bN) return 0;
  if (aN) return 1;
  if (bN) return -1;
  return 0;
}

/** Ordenação padrão v2 por blocos de status (nunca cobertura como critério primário). */
export function compareLinhasPainelV2(a: CoberturaEstoqueLinha, b: CoberturaEstoqueLinha): number {
  const ia = STATUS_PAINEL_SORT_ORDEM.indexOf(a.statusPainel);
  const ib = STATUS_PAINEL_SORT_ORDEM.indexOf(b.statusPainel);
  const ra = ia < 0 ? 999 : ia;
  const rb = ib < 0 ? 999 : ib;
  if (ra !== rb) return ra - rb;

  const st = a.statusPainel;
  if (st === 'ruptura') {
    const n = nullsLast(a.valorFaltante, b.valorFaltante);
    if (n !== 0) return n;
    return (
      (b.valorFaltante ?? -Infinity) - (a.valorFaltante ?? -Infinity) ||
      a.codigo.localeCompare(b.codigo)
    );
  }
  if (st === 'aguardando_pc') {
    return b.faltante - a.faltante || a.codigo.localeCompare(b.codigo);
  }
  if (st === 'critico' || st === 'atencao' || st === 'saudavel') {
    const va =
      a.precoUnitario != null && a.precoUnitario > 0 ? a.consumoMedio * a.precoUnitario : null;
    const vb =
      b.precoUnitario != null && b.precoUnitario > 0 ? b.consumoMedio * b.precoUnitario : null;
    const n = nullsLast(va, vb);
    if (n !== 0) return n;
    return (vb ?? -Infinity) - (va ?? -Infinity) || a.codigo.localeCompare(b.codigo);
  }
  if (st === 'excesso') {
    const va = a.precoUnitario != null && a.precoUnitario > 0 ? a.saldo * a.precoUnitario : null;
    const vb = b.precoUnitario != null && b.precoUnitario > 0 ? b.saldo * b.precoUnitario : null;
    const n = nullsLast(va, vb);
    if (n !== 0) return n;
    return (vb ?? -Infinity) - (va ?? -Infinity) || a.codigo.localeCompare(b.codigo);
  }
  return b.saldo - a.saldo || a.codigo.localeCompare(b.codigo);
}

export function montarLinhaCobertura(r: ConsultaEstoqueRowComCm): CoberturaEstoqueLinha {
  const precoRaw =
    r.precoUnitario != null && Number.isFinite(Number(r.precoUnitario)) && Number(r.precoUnitario) > 0
      ? round4(Number(r.precoUnitario))
      : null;
  const precoUnitario = precoRaw != null && precoRaw > 0 ? precoRaw : null;
  const atendimento = calcAtendimento(r.saldo, r.empenho);
  const atendimentoExibicao = atendimento == null ? null : Math.min(1, atendimento);
  const classeAtendimento = classificarClasseAtendimento(atendimento);
  const faltante = calcFaltante(r.saldo, r.empenho);
  const valorFaltante = precoUnitario != null ? round2(faltante * precoUnitario) : null;
  const cobertura = calcCoberturaMesesNullable(r.saldo, r.empenho, r.consumoMedio);
  const coberturaProjetada = calcCoberturaMeses(r.saldoProjetado, r.consumoMedio);
  const faixaFirme = cobertura != null ? classificarBarraFirme(cobertura) : null;
  const statusPainel = classificarStatusPainel({
    saldo: r.saldo,
    empenho: r.empenho,
    consumoMedio: r.consumoMedio,
    pedidoCompra: r.pedidoCompra,
    cobertura,
    faltante,
  });
  const valorEstoque = calcValorEstoqueBruto(r.saldo, precoUnitario);
  const valorFirme = calcValorFirmeMonetario(r.saldo, r.empenho, precoUnitario);
  const ultimaMovimentacaoEstoque =
    r.ultimaMovimentacaoEstoque != null && String(r.ultimaMovimentacaoEstoque).trim() !== ''
      ? String(r.ultimaMovimentacaoEstoque)
      : null;
  const semMovimentacao60d = isSemMovimentacaoEstoque(ultimaMovimentacaoEstoque);

  return {
    ...r,
    status: classificarCoberturaEstoque(r),
    cobertura,
    coberturaFirme: cobertura,
    coberturaProjetada,
    faixaFirme,
    kpiFirme: statusPainel,
    statusPainel,
    atendimento,
    atendimentoExibicao,
    classeAtendimento,
    faltante,
    valorFaltante,
    comprador: normalizarCompradorPainel(r.comprador),
    familiaProduto: (r.familiaProduto ?? '').trim() || 'Sem família',
    precoUnitario,
    valorEstoque,
    valorFirme,
    ultimaMovimentacaoEstoque,
    semMovimentacao60d,
    acaoSugerida: sugerirAcaoCobertura({
      statusPainel,
      solicitacao: r.solicitacao,
      cotacao: r.cotacao,
      pedidoCompra: r.pedidoCompra,
    }),
  };
}

export function agregarCoberturaEstoque(
  rows: ConsultaEstoqueRowComCm[],
  opts?: { statusFiltro?: StatusCoberturaEstoque | null }
): {
  totalItens: number;
  valorEstoqueTotal: number | null;
  valorFirmeTotal: number | null;
  /** Soma saldo × preço dos itens sem movimentação há ≥ 60 dias. */
  valorEstoqueSemMov60dTotal: number | null;
  kpisFirme: TotaisKpiFirme[];
  barrasFirme: TotaisFaixaFirme[];
  porComprador: TotaisCompradorCobertura[];
  itens: CoberturaEstoqueLinha[];
} {
  const statusFiltro = opts?.statusFiltro ?? null;

  const comStatus: CoberturaEstoqueLinha[] = rows.map(montarLinhaCobertura);

  let valorEstoqueAcc = 0;
  let valorFirmeAcc = 0;
  let valorSemMovAcc = 0;
  let temValorEstoque = false;
  let temValorFirme = false;
  let temValorSemMov = false;
  for (const row of comStatus) {
    if (row.valorEstoque != null) {
      valorEstoqueAcc = round2(valorEstoqueAcc + row.valorEstoque);
      temValorEstoque = true;
      if (row.semMovimentacao60d) {
        valorSemMovAcc = round2(valorSemMovAcc + row.valorEstoque);
        temValorSemMov = true;
      }
    }
    if (row.valorFirme != null) {
      valorFirmeAcc = round2(valorFirmeAcc + row.valorFirme);
      temValorFirme = true;
    }
  }
  const valorEstoqueTotal = temValorEstoque ? valorEstoqueAcc : null;
  const valorFirmeTotal = temValorFirme ? valorFirmeAcc : null;
  const valorEstoqueSemMov60dTotal = temValorSemMov ? valorSemMovAcc : null;

  const barraAcc = new Map<BarraFirme, number>();
  const barraCapitalAcc = new Map<BarraFirme, number>();
  for (const f of BARRAS_FIRME_ORDEM) {
    barraAcc.set(f, 0);
    barraCapitalAcc.set(f, 0);
  }
  for (const row of comStatus) {
    if (row.faixaFirme == null) continue;
    barraAcc.set(row.faixaFirme, (barraAcc.get(row.faixaFirme) ?? 0) + 1);
    if (row.valorFirme != null) {
      barraCapitalAcc.set(
        row.faixaFirme,
        round2((barraCapitalAcc.get(row.faixaFirme) ?? 0) + row.valorFirme)
      );
    }
  }

  const barrasFirme: TotaisFaixaFirme[] = emptyBarras().map((base) => {
    const itens = barraAcc.get(base.faixa) ?? 0;
    const cap = barraCapitalAcc.get(base.faixa) ?? 0;
    const temCapital = comStatus.some(
      (r) => r.faixaFirme === base.faixa && r.valorFirme != null
    );
    return {
      ...base,
      itens,
      capital: temCapital ? cap : null,
    };
  });

  const kpiAcc = new Map<StatusPainelCobertura, number>();
  const kpiCapitalAcc = new Map<StatusPainelCobertura, number>();
  for (const k of STATUS_PAINEL_KPI_ORDEM) {
    kpiAcc.set(k, 0);
    kpiCapitalAcc.set(k, 0);
  }
  for (const row of comStatus) {
    if (STATUS_PAINEL_KPI_ORDEM.includes(row.statusPainel)) {
      kpiAcc.set(row.statusPainel, (kpiAcc.get(row.statusPainel) ?? 0) + 1);
      if (row.valorFirme != null) {
        kpiCapitalAcc.set(
          row.statusPainel,
          round2((kpiCapitalAcc.get(row.statusPainel) ?? 0) + row.valorFirme)
        );
      }
    }
  }

  const kpisFirme: TotaisKpiFirme[] = emptyKpis().map((base) => {
    const itens = kpiAcc.get(base.kpi) ?? 0;
    const temCapital = comStatus.some(
      (r) => r.statusPainel === base.kpi && r.valorFirme != null
    );
    return {
      ...base,
      itens,
      capital: temCapital ? (kpiCapitalAcc.get(base.kpi) ?? 0) : null,
    };
  });

  const itens = statusFiltro
    ? comStatus.filter((r) => r.status === statusFiltro)
    : comStatus;

  return {
    totalItens: comStatus.length,
    valorEstoqueTotal,
    valorFirmeTotal,
    valorEstoqueSemMov60dTotal,
    kpisFirme,
    barrasFirme,
    porComprador: agregarCargaPorComprador(comStatus),
    itens: itens.slice().sort(compareLinhasPainelV2),
  };
}
