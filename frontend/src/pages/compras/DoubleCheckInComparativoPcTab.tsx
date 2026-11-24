import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, CircleHelp, Copy, Eye, MessageSquarePlus, X, XCircle } from 'lucide-react';
import {
  addDoubleCheckInComparativoObservacao,
  saveDoubleCheckInComparativoDecisao,
  saveDoubleCheckInSolicitacaoOtimiza,
  type DoubleCheckInCampoComparativo,
  type DoubleCheckInComparativoDecisao,
  type DoubleCheckInComparativoLinha,
  type DoubleCheckInComparativoObsHist,
  type DoubleCheckInJustificativaOpcao,
  type DoubleCheckInSolicitacaoOtimiza,
} from '../../api/compras';
import { contarPendentesComparativoLogica } from '../../utils/doubleCheckInPendencias';
import PagamentoXmlPreEntradaPanel from './PagamentoXmlPreEntradaPanel';

const nfBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const nfBrl4 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const nfNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

const UNIDADES_TONELADA = new Set(['t', 'ton', 'tonelada', 'toneladas']);
const UNIDADES_QUILOGRAMA = new Set([
  'kg',
  'kgs',
  'quilo',
  'quilos',
  'quilograma',
  'quilogramas',
  'kilograma',
  'kilogramas',
]);

function normalizarUnidadeMedida(nome: string | null | undefined): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.\s]+/g, ' ')
    .trim();
}

function tokenUnidadeMedida(nome: string | null | undefined): string {
  const n = normalizarUnidadeMedida(nome);
  return n.split(' ')[0] ?? '';
}

function unidadeEhTonelada(nome: string | null | undefined): boolean {
  const n = normalizarUnidadeMedida(nome);
  return UNIDADES_TONELADA.has(n) || UNIDADES_TONELADA.has(tokenUnidadeMedida(nome));
}

function unidadeEhQuilograma(nome: string | null | undefined): boolean {
  const n = normalizarUnidadeMedida(nome);
  return UNIDADES_QUILOGRAMA.has(n) || UNIDADES_QUILOGRAMA.has(tokenUnidadeMedida(nome));
}

/**
 * Nomus pode converter a quantidade para kg e manter o rótulo "TONELADA".
 * Exibir "2.125 TONELADA" parece 2 mil toneladas — alinhamos ao kg do pedido.
 */
function legendaQtdeNfConvertida(linha: DoubleCheckInComparativoLinha): {
  nf: string;
  nfDetalhe?: string;
  nfTitle?: string;
} | null {
  if (!unidadeEhTonelada(linha.umNF) || !unidadeEhQuilograma(linha.umPC)) return null;
  const qtde = nfNum.format(linha.qtdeNF);
  const umKg = (linha.umPC ?? 'QUILOGRAMA').trim() || 'QUILOGRAMA';
  const umTon = (linha.umNF ?? 'TONELADA').trim() || 'TONELADA';
  return {
    nf: `${qtde} ${umKg}`.trim(),
    nfDetalhe: 'convertido de tonelada',
    nfTitle: `${qtde} ${umKg} · NF original em ${umTon.toLowerCase()}`,
  };
}

/** Mesma leitura do backend: 10 casas na comparação, no mínimo 4 no popup. */
function textoReaisCasasUtilizadas(n: number | null | undefined): string {
  const v = Number(n);
  const valor = Number.isFinite(v) ? Math.round((v + Number.EPSILON) * 1e10) / 1e10 : 0;
  const negativo = valor < 0;
  const abs = Math.abs(valor);
  const [inteiro, fracaoBruta = ''] = abs.toFixed(10).split('.');
  const fracao = fracaoBruta.replace(/0+$/, '').padEnd(4, '0');
  const intFmt = Number(inteiro).toLocaleString('pt-BR');
  return `${negativo ? '−' : ''}R$ ${intFmt},${fracao}`;
}

function fmtAliquotaIpi(n: number | null | undefined): string {
  const v = Number(n);
  return `${nfNum.format(Number.isFinite(v) ? v : 0)}%`;
}

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 w-full';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

type CampoCfg = {
  id: DoubleCheckInCampoComparativo;
  label: string;
  divergKey: keyof DoubleCheckInComparativoLinha;
  kind: 'money' | 'qty' | 'text';
};

const CAMPOS: CampoCfg[] = [
  {
    id: 'valor_unitario',
    label: 'Vl. unitário (líq.)',
    divergKey: 'divergValorUnitario',
    kind: 'money',
  },
  {
    id: 'qtde',
    label: 'Quantidade',
    divergKey: 'divergQtde',
    kind: 'qty',
  },
  {
    id: 'ipi',
    label: 'IPI',
    divergKey: 'divergIpi',
    kind: 'money',
  },
  {
    id: 'condicao_pagamento',
    label: 'Cond. pagamento',
    divergKey: 'divergCondicaoPagamento',
    kind: 'text',
  },
];

const CAMPOS_ITEM = CAMPOS.filter((c) => c.id !== 'condicao_pagamento');
const CAMPO_PAGAMENTO = CAMPOS.find((c) => c.id === 'condicao_pagamento')!;

function nomePedidoLinha(linha: DoubleCheckInComparativoLinha): string {
  return (
    linha.nomePedidoCompra ??
    (linha.idPedidoCompra != null ? `PC ${linha.idPedidoCompra}` : 'Pedido')
  );
}

function contextoDivergencia(
  linha: DoubleCheckInComparativoLinha,
  campo: DoubleCheckInCampoComparativo
): string {
  const label = CAMPOS.find((c) => c.id === campo)?.label ?? campo;
  if (campo === 'condicao_pagamento') return `${label} · ${nomePedidoLinha(linha)}`;
  return `${label} · ${linha.codigoProduto ?? linha.idProduto ?? '—'}`;
}

function chaveDecisao(
  idItemDocumentoEstoque: number,
  idItemPedidoCompra: number,
  campo: string
): string {
  return `${idItemDocumentoEstoque}:${idItemPedidoCompra}:${campo}`;
}

function fmtYmdBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(ymd);
}

function fmtCondicao(
  nome: string | null,
  regra: string | null,
  prazosLabel: string | null | undefined
): { principal: string; detalhe: string | null; prazosClicavel: boolean } {
  const n = (nome ?? '').trim() || '—';
  const r = (regra ?? '').trim();
  const principal = r ? `${n} · ${r}` : n;
  const prazos = (prazosLabel ?? '').trim();
  if (prazos) {
    return { principal, detalhe: `prazos ${prazos}d`, prazosClicavel: true };
  }
  return { principal, detalhe: null, prazosClicavel: false };
}

function descontoUnitario(descontoTotal: number, qtde: number): number {
  if (!(descontoTotal > 0)) return 0;
  if (!(qtde > 0)) return descontoTotal;
  return Math.round((descontoTotal / qtde + Number.EPSILON) * 100) / 100;
}

function fmtUnitarioLinha(
  liquido: number,
  bruto: number,
  descontoTotal: number,
  qtde: number,
  formato: Intl.NumberFormat = nfBrl
): { principal: string; detalhe: string | null } {
  if (descontoTotal > 0) {
    const descUn = descontoUnitario(descontoTotal, qtde);
    return {
      principal: `${formato.format(liquido)} líq.`,
      detalhe: `bruto ${formato.format(bruto)} · −desc. un. ${nfBrl.format(descUn)}`,
    };
  }
  return { principal: formato.format(liquido), detalhe: null };
}

function valoresExibicao(
  linha: DoubleCheckInComparativoLinha,
  c: CampoCfg
): {
  nf: string;
  pc: string;
  nfDetalhe?: string | null;
  pcDetalhe?: string | null;
  nfTitle?: string;
  pcTitle?: string;
  prazosClicavel?: boolean;
} {
  switch (c.id) {
    case 'valor_unitario': {
      if (linha.entradaPorPeso) {
        const nf = fmtUnitarioLinha(
          linha.valorUnitarioNF,
          linha.valorUnitarioBrutoNF,
          linha.descontoNF,
          linha.qtdeNF,
          nfBrl4
        );
        const pc = fmtUnitarioLinha(
          linha.valorUnitarioPC,
          linha.valorUnitarioBrutoPC,
          linha.descontoPC,
          linha.qtdePC,
          nfBrl4
        );
        const convertidaTon = Boolean(linha.unitarioNfConvertidoTonParaKg);
        const nfDetalhe = [nf.detalhe, convertidaTon ? 'convertido de tonelada' : null]
          .filter(Boolean)
          .join(' · ');
        return {
          nf: nf.principal,
          pc: pc.principal,
          nfDetalhe: nfDetalhe || null,
          pcDetalhe: pc.detalhe,
          nfTitle: convertidaTon
            ? `${textoReaisCasasUtilizadas(linha.valorUnitarioNF)} · NF original em R$/tonelada`
            : textoReaisCasasUtilizadas(linha.valorUnitarioNF),
          pcTitle: textoReaisCasasUtilizadas(linha.valorUnitarioPC),
        };
      }
      const nf = fmtUnitarioLinha(
        linha.valorUnitarioNF,
        linha.valorUnitarioBrutoNF,
        linha.descontoNF,
        linha.qtdeNF
      );
      const pc = fmtUnitarioLinha(
        linha.valorUnitarioPC,
        linha.valorUnitarioBrutoPC,
        linha.descontoPC,
        linha.qtdePC
      );
      return { nf: nf.principal, pc: pc.principal, nfDetalhe: nf.detalhe, pcDetalhe: pc.detalhe };
    }
    case 'qtde': {
      const partes = linha.partesQtdePc ?? [];
      const nfConvertida = legendaQtdeNfConvertida(linha);
      if (partes.length > 1 && linha.qtdePcSoma != null) {
        const um = (linha.umPC ?? linha.umNF ?? '').trim();
        const composicao = partes
          .map((parte) => {
            const qtde = nfNum.format(parte.qtde);
            return parte.idItemPedidoCompra === linha.idItemPedidoCompra ? `${qtde} nesta` : qtde;
          })
          .join(' + ');
        return {
          nf: nfConvertida?.nf ?? `${nfNum.format(linha.qtdeNF)} ${linha.umNF ?? ''}`.trim(),
          nfDetalhe: nfConvertida?.nfDetalhe,
          nfTitle: nfConvertida?.nfTitle,
          pc: `${nfNum.format(linha.qtdePcSoma)} ${um}`.trim(),
          pcDetalhe: `soma de ${partes.length} linhas do pedido: ${composicao}`,
        };
      }
      return {
        nf: nfConvertida?.nf ?? `${nfNum.format(linha.qtdeNF)} ${linha.umNF ?? ''}`.trim(),
        nfDetalhe: nfConvertida?.nfDetalhe,
        nfTitle: nfConvertida?.nfTitle,
        pc: `${nfNum.format(linha.qtdePC)} ${linha.umPC ?? ''}`.trim(),
      };
    }
    case 'ipi':
      if (linha.conferenciaIpi === 'percentual') {
        return {
          nf: fmtAliquotaIpi(linha.aliquotaIpiNF),
          pc: fmtAliquotaIpi(linha.aliquotaIpiPC),
        };
      }
      return { nf: nfBrl.format(linha.valorIpiNF), pc: nfBrl.format(linha.valorIpiPC) };
    case 'condicao_pagamento': {
      const nf = fmtCondicao(linha.condicaoPagamentoNF, linha.regraPagamentoNF, linha.prazosLabelNF);
      const pc = fmtCondicao(linha.condicaoPagamentoPC, linha.regraPagamentoPC, linha.prazosLabelPC);
      return {
        nf: nf.principal,
        pc: pc.principal,
        nfDetalhe: nf.detalhe,
        pcDetalhe: pc.detalhe,
        prazosClicavel: nf.prazosClicavel || pc.prazosClicavel,
      };
    }
  }
}

function nomeItemLinha(linha: DoubleCheckInComparativoLinha): string {
  const codigo = (linha.codigoProduto ?? '').trim();
  if (codigo) return codigo;
  if (linha.idProduto != null) return `produto ${linha.idProduto}`;
  return 'item';
}

function pedidoDaAcao(natureza: 'real' | 'benigna' | undefined, ajuste: string): string {
  if (natureza === 'benigna') return `Conferir ${ajuste}.`;
  return `Ajustar ${ajuste}.`;
}

/** "12/15" → "2 parcelas para 12 e 15 dias". "0" → "1 parcela para 0 dias". */
function textoParcelasPrazos(prazosLabel: string | null | undefined): string | null {
  const dias = (prazosLabel ?? '')
    .split('/')
    .map((parte) => parte.trim())
    .filter((parte) => /^\d+$/.test(parte));
  if (dias.length === 0) return null;
  const parcelas = dias.length === 1 ? '1 parcela' : `${dias.length} parcelas`;
  const lista =
    dias.length === 1
      ? dias[0] === '1'
        ? '1 dia'
        : `${dias[0]} dias`
      : dias.length === 2
        ? `${dias[0]} e ${dias[1]} dias`
        : `${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]} dias`;
  return `${parcelas} para ${lista}`;
}

function ladoCondicao(
  prazosLabel: string | null | undefined,
  condicao: string | null | undefined
): string {
  const prazos = textoParcelasPrazos(prazosLabel);
  if (prazos) return prazos;
  const nome = (condicao ?? '').trim();
  return nome || 'sem prazo informado';
}

/** Frase curta de uma divergência (corpo), sem o cabeçalho padrão do Otimiza. */
function fraseDivergencia(
  linha: DoubleCheckInComparativoLinha,
  campo: DoubleCheckInCampoComparativo
): string | null {
  const cfg = CAMPOS.find((c) => c.id === campo);
  if (!cfg || !linha[cfg.divergKey]) return null;
  const vals = valoresExibicao(linha, cfg);
  const natureza = linha.naturezaDivergencias?.[campo];
  const item = nomeItemLinha(linha);
  if (campo === 'ipi') {
    return `IPI do item ${item}: ${vals.nf} na NF e ${vals.pc} no PC. ${pedidoDaAcao(natureza, 'o IPI do item do pedido')}`;
  }
  if (campo === 'qtde') {
    return `Quantidade do item ${item}: ${vals.nf} na NF e ${vals.pc} no PC. ${pedidoDaAcao(natureza, 'a quantidade do item do pedido')}`;
  }
  if (campo === 'valor_unitario') {
    return `Valor unitário do item ${item}: ${vals.nf} na NF e ${vals.pc} no PC. ${pedidoDaAcao(natureza, 'o valor unitário do item do pedido')}`;
  }
  const pc = ladoCondicao(linha.prazosLabelPC, linha.condicaoPagamentoPC);
  const nf = ladoCondicao(linha.prazosLabelNF, linha.condicaoPagamentoNF);
  return `Condição de pagamento (${nomePedidoLinha(linha)}): o PC tem ${pc} e a NF tem ${nf}. ${pedidoDaAcao(natureza, 'a condição de pagamento do pedido')}`;
}

const CABECALHO_SUGESTAO_OTIMIZA =
  'ATENÇÃO: COMPARAR NF X PC COMO UM TODO.\n\nDIVERGÊNCIAS EVIDENTES NO MOMENTO:';

/** Monta o texto pronto para colar no Otimiza, com cabeçalho padrão em caixa alta. */
function formatarSugestaoOtimiza(corpo: string): string {
  const texto = corpo.trim();
  if (!texto) return '';
  return `${CABECALHO_SUGESTAO_OTIMIZA}\n${texto}`;
}

function textoConsolidadoDivergencias(frases: string[]): string {
  if (frases.length === 0) return '';
  const corpo =
    frases.length === 1
      ? frases[0]!
      : frases.map((frase) => `• ${frase}`).join('\n');
  return formatarSugestaoOtimiza(corpo);
}

function historicoDaDecisao(dec: DoubleCheckInComparativoDecisao | undefined): DoubleCheckInComparativoObsHist[] {
  if (!dec) return [];
  if (Array.isArray(dec.historicoObservacoes) && dec.historicoObservacoes.length > 0) {
    return dec.historicoObservacoes;
  }
  const legada = (dec.observacao ?? '').trim();
  if (!legada) return [];
  return [
    {
      id: 0,
      idDocumentoEstoque: dec.idDocumentoEstoque,
      idItemDocumentoEstoque: dec.idItemDocumentoEstoque,
      idItemPedidoCompra: dec.idItemPedidoCompra,
      campo: dec.campo,
      texto: legada,
      usuarioId: dec.usuarioId,
      usuarioLogin: dec.usuarioLogin,
      criadoEm: dec.atualizadoEm,
    },
  ];
}

function fmtDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

type DraftJustif = {
  linha: DoubleCheckInComparativoLinha;
  campo: DoubleCheckInCampoComparativo;
  decisao: 'aceita' | 'recusa';
};

type DraftObs = {
  linha: DoubleCheckInComparativoLinha;
  campo: DoubleCheckInCampoComparativo;
};

type Props = {
  idDocumento: number;
  conferido: boolean;
  somenteLeitura?: boolean;
  /** Evidência pública: mostra os valores e esconde o estado da decisão interna. */
  evidencia?: boolean;
  linhas: DoubleCheckInComparativoLinha[];
  decisoes: DoubleCheckInComparativoDecisao[];
  justificativas: DoubleCheckInJustificativaOpcao[];
  solicitacoesOtimiza: DoubleCheckInSolicitacaoOtimiza[];
  criterios?: Partial<Record<DoubleCheckInCampoComparativo, boolean>>;
  camposLancados?: DoubleCheckInCampoComparativo[];
  loading: boolean;
  erro: string | null;
  onDecisoesChange: (next: DoubleCheckInComparativoDecisao[]) => void;
  onSolicitacoesChange: (next: DoubleCheckInSolicitacaoOtimiza[]) => void;
  onLinhasChange?: (next: DoubleCheckInComparativoLinha[]) => void;
};

export function contarPendentesComparativo(
  linhas: DoubleCheckInComparativoLinha[],
  decisoes: DoubleCheckInComparativoDecisao[]
): number {
  return contarPendentesComparativoLogica(
    linhas,
    decisoes.filter((decisao) => decisao.vigente !== false)
  );
}

export default function DoubleCheckInComparativoPcTab({
  idDocumento,
  conferido,
  somenteLeitura = false,
  evidencia = false,
  linhas,
  decisoes,
  justificativas,
  solicitacoesOtimiza,
  criterios,
  camposLancados = [],
  loading,
  erro,
  onDecisoesChange,
  onSolicitacoesChange,
  onLinhasChange,
}: Props) {
  const campoVisivel = (campo: DoubleCheckInCampoComparativo) =>
    criterios?.[campo] !== false || camposLancados.includes(campo);
  const [textoCopiado, setTextoCopiado] = useState<string | null>(null);
  const [textoModal, setTextoModal] = useState<{
    titulo: string;
    texto: string;
    chave: string;
    contexto?: string;
  } | null>(null);
  const [draft, setDraft] = useState<DraftJustif | null>(null);
  const [opcaoId, setOpcaoId] = useState<number | ''>('');
  const [obs, setObs] = useState('');
  const [numeroOtimiza, setNumeroOtimiza] = useState('');
  const [querInserirOtimiza, setQuerInserirOtimiza] = useState<boolean | null>(null);
  const [numeroGravado, setNumeroGravado] = useState<number | null>(null);
  const [statusGravado, setStatusGravado] = useState<'in_progress' | 'completed' | 'cancelled' | null>(null);
  const [avisoOtimiza, setAvisoOtimiza] = useState<string | null>(null);
  const [aplicouNasDemais, setAplicouNasDemais] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoNumero, setSalvandoNumero] = useState(false);
  const [justErro, setJustErro] = useState<string | null>(null);

  const [draftObs, setDraftObs] = useState<DraftObs | null>(null);
  const [novaObs, setNovaObs] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [obsErro, setObsErro] = useState<string | null>(null);
  const [prazosModalLinha, setPrazosModalLinha] = useState<DoubleCheckInComparativoLinha | null>(null);
  const [ajudaTotaisAberta, setAjudaTotaisAberta] = useState(false);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);

  const totaisVinculos = useMemo(() => {
    const base = linhas[0];
    if (!base) return null;
    if (base.totalVinculosNF == null || base.totalVinculosPC == null) return null;
    const totalNF = Number(base.totalRealNF ?? base.totalVinculosNF);
    const totalPC = Number(base.totalRealPC ?? base.totalVinculosPC);
    const descontoNF = Number(base.descontoVinculosNF ?? 0);
    const descontoPC = Number(base.descontoVinculosPC ?? 0);
    if (![totalNF, totalPC, descontoNF, descontoPC].every((n) => Number.isFinite(n))) return null;
    const totaisIguais = Math.round(totalNF * 100) === Math.round(totalPC * 100);
    return { totalNF, totalPC, descontoNF, descontoPC, totaisIguais };
  }, [linhas]);

  /** Só quando o unitário da NF é maior: aí os totais decidem benigna vs real. */
  const mostraAjudaUnitarioTotais = useMemo(
    () =>
      linhas.some(
        (l) =>
          l.divergValorUnitario &&
          Math.round(Number(l.valorUnitarioNF) * 100) > Math.round(Number(l.valorUnitarioPC) * 100)
      ),
    [linhas]
  );

  const solicitacaoMap = useMemo(() => {
    const m = new Map<string, DoubleCheckInSolicitacaoOtimiza>();
    for (const s of solicitacoesOtimiza) {
      m.set(chaveDecisao(s.idItemDocumentoEstoque, s.idItemPedidoCompra, s.campo), s);
    }
    return m;
  }, [solicitacoesOtimiza]);

  const decisaoMap = useMemo(() => {
    const m = new Map<string, DoubleCheckInComparativoDecisao>();
    for (const d of decisoes) {
      m.set(chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo), d);
    }
    return m;
  }, [decisoes]);

  const qtdeDiverg = useMemo(
    () => linhas.reduce((s, l) => s + (l.temDivergencia ? 1 : 0), 0),
    [linhas]
  );
  const pagamentoXmlPendente = useMemo(
    () => linhas.some((l) => l.pagamentoXmlPendente),
    [linhas]
  );
  const pendentes = useMemo(
    () => (somenteLeitura ? 0 : contarPendentesComparativo(linhas, decisoes)),
    [linhas, decisoes, somenteLeitura]
  );

  /** Cond. pagamento é do documento × pedido, não de cada item. */
  const gruposPagamento = useMemo(() => {
    const porPc = new Map<string, DoubleCheckInComparativoLinha[]>();
    for (const linha of linhas) {
      if (linha.comparaCondicaoPagamento === false) continue;
      const key = String(linha.idPedidoCompra ?? 'sem-pc');
      const lista = porPc.get(key) ?? [];
      lista.push(linha);
      porPc.set(key, lista);
    }
    const grupos = [...porPc.entries()].map(([key, candidatas]) => {
      const comDecisao = candidatas.find((linha) =>
        decisoes.some(
          (d) =>
            d.campo === 'condicao_pagamento' &&
            d.vigente !== false &&
            d.idItemDocumentoEstoque === linha.idItemDocumentoEstoque &&
            d.idItemPedidoCompra === linha.idItemPedidoCompra
        )
      );
      const linha =
        comDecisao ??
        candidatas.find((item) => item.divergCondicaoPagamento) ??
        candidatas[0];
      return { key, linha, nome: nomePedidoLinha(linha) };
    });
    // Link de evidência: só o que realmente diverge (benigna ou real).
    if (evidencia) {
      return grupos.filter((grupo) => Boolean(grupo.linha.divergCondicaoPagamento));
    }
    return grupos;
  }, [linhas, decisoes, evidencia]);

  const linhaPagamentoEditavel = useMemo(
    () =>
      linhas.find(
        (l) =>
          l.origemParcelasNF != null &&
          l.origemParcelasNF !== 'nomus' &&
          l.origemParcelasNF !== 'xml'
      ) ?? null,
    [linhas]
  );

  const frasesDivergencia = useMemo(() => {
    const frases: string[] = [];
    const pagamentoVisto = new Set<string>();
    for (const linha of linhas) {
      for (const campo of CAMPOS_ITEM) {
        if (!campoVisivel(campo.id)) continue;
        const frase = fraseDivergencia(linha, campo.id);
        if (frase) frases.push(frase);
      }
      if (!campoVisivel('condicao_pagamento') || !linha.divergCondicaoPagamento) continue;
      if (linha.comparaCondicaoPagamento === false) continue;
      const chavePc = String(linha.idPedidoCompra ?? 'sem-pc');
      if (pagamentoVisto.has(chavePc)) continue;
      pagamentoVisto.add(chavePc);
      const frase = fraseDivergencia(linha, 'condicao_pagamento');
      if (frase) frases.push(frase);
    }
    return frases;
  }, [linhas, criterios, camposLancados]);
  const textoConsolidado = textoConsolidadoDivergencias(frasesDivergencia);

  const copiarTexto = async (chave: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setTextoCopiado(chave);
      window.setTimeout(() => setTextoCopiado((atual) => (atual === chave ? null : atual)), 2000);
    } catch {
      setTextoCopiado(null);
    }
  };

  const opcoesDoCampo = useMemo(() => {
    if (!draft) return [];
    const lista = justificativas.filter(
      (j) => !j.campos?.length || j.campos.includes(draft.campo)
    );
    return [...lista].sort((a, b) => {
      if (a.codigo === 'outros') return 1;
      if (b.codigo === 'outros') return -1;
      return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'pt-BR');
    });
  }, [draft, justificativas]);

  const abrirJustificativa = (
    linha: DoubleCheckInComparativoLinha,
    campo: DoubleCheckInCampoComparativo,
    decisao: 'aceita' | 'recusa'
  ) => {
    const existente = decisaoMap.get(
      chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo)
    );
    // Após conferida, só permite decidir campos ainda pendentes (ex.: divergência nova).
    if (conferido && existente?.vigente !== false) return;
    const salva = solicitacaoMap.get(
      chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo)
    );
    const benigna = linha.naturezaDivergencias?.[campo] === 'benigna';
    const solicitacaoJaConcluida =
      salva?.status === 'completed' || salva?.status === 'cancelled';
    setDraft({ linha, campo, decisao });
    setOpcaoId(existente?.justificativaOpcaoId ?? '');
    setObs(existente?.observacao ?? '');
    setQuerInserirOtimiza(
      decisao === 'aceita' && benigna && solicitacaoJaConcluida ? true : null
    );
    setNumeroOtimiza(salva != null ? String(salva.numero) : '');
    setNumeroGravado(salva?.numero ?? null);
    setStatusGravado(salva?.status ?? null);
    setAplicouNasDemais(false);
    setJustErro(null);
    setAvisoOtimiza(
      salva?.status === 'in_progress'
        ? `A solicitação ${salva.numero} do Otimiza ainda está em andamento. O número permanece nesta divergência e o aceite continua pendente.`
        : null
    );
  };

  const abrirNovaObservacao = (
    linha: DoubleCheckInComparativoLinha,
    campo: DoubleCheckInCampoComparativo
  ) => {
    if (!conferido) return;
    const existente = decisaoMap.get(
      chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo)
    );
    if (!existente) return;
    setDraftObs({ linha, campo });
    setNovaObs('');
    setObsErro(null);
  };

  const numeroConfereComGravado =
    numeroGravado != null && numeroOtimiza.trim() === String(numeroGravado);
  const solicitacaoConcluida = statusGravado === 'completed' || statusGravado === 'cancelled';
  const divergenciaBenigna =
    draft?.decisao === 'aceita' && draft.linha.naturezaDivergencias?.[draft.campo] === 'benigna';
  const dispensouOtimiza = divergenciaBenigna && querInserirOtimiza === false;
  const aceiteLiberado =
    draft?.decisao !== 'aceita' ||
    dispensouOtimiza ||
    (numeroConfereComGravado && solicitacaoConcluida);
  const justificativaOutros =
    justificativas.find((j) => j.id === opcaoId)?.codigo === 'outros';
  const observacaoObrigatoria =
    (draft?.decisao === 'aceita' && !divergenciaBenigna) || justificativaOutros;

  const outrasDivergenciasAbertas = useMemo(() => {
    if (!draft || draft.decisao !== 'aceita') return 0;
    const atual = chaveDecisao(
      draft.linha.idItemDocumentoEstoque,
      draft.linha.idItemPedidoCompra,
      draft.campo
    );
    let total = 0;
    for (const linha of linhas) {
      for (const c of CAMPOS) {
        if (!linha[c.divergKey]) continue;
        const chave = chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, c.id);
        if (chave === atual) continue;
        const dec = decisaoMap.get(chave);
        if (dec && dec.vigente !== false) continue;
        total += 1;
      }
    }
    return total;
  }, [draft, linhas, decisaoMap]);

  const gravarNumeroOtimiza = async (aplicarNasDemais = false) => {
    if (!draft || draft.decisao !== 'aceita') return;
    if (!/^\d+$/.test(numeroOtimiza.trim())) {
      setJustErro('Informe o número inteiro da solicitação no Otimiza.');
      return;
    }
    const numero = Number(numeroOtimiza.trim());
    if (!Number.isInteger(numero) || numero <= 0) {
      setJustErro('Informe o número inteiro da solicitação no Otimiza.');
      return;
    }
    setSalvandoNumero(true);
    setJustErro(null);
    setAvisoOtimiza(null);
    try {
      const r = await saveDoubleCheckInSolicitacaoOtimiza({
        idDocumento,
        idItemDocumentoEstoque: draft.linha.idItemDocumentoEstoque,
        idItemPedidoCompra: draft.linha.idItemPedidoCompra,
        campo: draft.campo,
        numero,
        aplicarNasDemais,
      });
      if (r.erro || !r.solicitacao) {
        setJustErro(r.erro ?? 'Não foi possível gravar a solicitação.');
        return;
      }
      const aplicadas = [r.solicitacao, ...(r.replicadas ?? [])];
      const keys = new Set(
        aplicadas.map((s) => chaveDecisao(s.idItemDocumentoEstoque, s.idItemPedidoCompra, s.campo))
      );
      onSolicitacoesChange([
        ...solicitacoesOtimiza.filter(
          (s) => !keys.has(chaveDecisao(s.idItemDocumentoEstoque, s.idItemPedidoCompra, s.campo))
        ),
        ...aplicadas,
      ]);
      setNumeroGravado(r.solicitacao.numero);
      setNumeroOtimiza(String(r.solicitacao.numero));
      setStatusGravado(r.solicitacao.status ?? null);
      setAplicouNasDemais(aplicarNasDemais);
      if (!r.concluida) {
        setAvisoOtimiza(
          r.mensagem ??
            `A solicitação ${r.solicitacao.numero} do Otimiza ainda está em andamento. O número ficou registrado nesta divergência e o aceite continua pendente.`
        );
      }
    } finally {
      setSalvandoNumero(false);
    }
  };

  const salvarJustificativa = async () => {
    if (!draft) return;
    if (divergenciaBenigna && querInserirOtimiza == null) {
      setJustErro('Informe se deseja inserir o número da solicitação no Otimiza.');
      return;
    }
    if (draft.decisao === 'aceita' && !aceiteLiberado) {
      setJustErro('Grave o número da solicitação no Otimiza antes de aceitar.');
      return;
    }
    if (!opcaoId) {
      setJustErro('Selecione a justificativa.');
      return;
    }
    if (draft.decisao === 'aceita' && !divergenciaBenigna && !obs.trim()) {
      setJustErro('Informe a observação para aceitar a divergência.');
      return;
    }
    const opcao = justificativas.find((j) => j.id === opcaoId);
    if (opcao?.codigo === 'outros' && !obs.trim()) {
      setJustErro('Informe a observação quando a justificativa for "Outros".');
      return;
    }
    setSalvando(true);
    setJustErro(null);
    try {
      const r = await saveDoubleCheckInComparativoDecisao({
        idDocumento,
        idItemDocumentoEstoque: draft.linha.idItemDocumentoEstoque,
        idItemPedidoCompra: draft.linha.idItemPedidoCompra,
        campo: draft.campo,
        decisao: draft.decisao,
        justificativaOpcaoId: Number(opcaoId),
        observacao: obs.trim() || null,
        dispensarOtimiza: dispensouOtimiza,
      });
      if (r.erro || !r.decisao) {
        setJustErro(r.erro ?? 'Falha ao salvar.');
        return;
      }
      const aplicadas = [r.decisao, ...(r.decisoesReplicadas ?? [])];
      const keys = new Set(
        aplicadas.map((d) =>
          chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo)
        )
      );
      const next = [
        ...decisoes.filter(
          (d) => !keys.has(chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo))
        ),
        ...aplicadas,
      ];
      onDecisoesChange(next);
      setDraft(null);
    } finally {
      setSalvando(false);
    }
  };

  const salvarNovaObservacao = async () => {
    if (!draftObs) return;
    if (!novaObs.trim()) {
      setObsErro('Informe a observação.');
      return;
    }
    setSalvandoObs(true);
    setObsErro(null);
    try {
      const r = await addDoubleCheckInComparativoObservacao({
        idDocumento,
        idItemDocumentoEstoque: draftObs.linha.idItemDocumentoEstoque,
        idItemPedidoCompra: draftObs.linha.idItemPedidoCompra,
        campo: draftObs.campo,
        texto: novaObs.trim(),
      });
      if (r.erro || !r.decisao) {
        setObsErro(r.erro ?? 'Falha ao salvar.');
        return;
      }
      const key = chaveDecisao(
        r.decisao.idItemDocumentoEstoque,
        r.decisao.idItemPedidoCompra,
        r.decisao.campo
      );
      const next = [
        ...decisoes.filter(
          (d) => chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo) !== key
        ),
        r.decisao,
      ];
      onDecisoesChange(next);
      setDraftObs(null);
    } finally {
      setSalvandoObs(false);
    }
  };

  const renderCampoCard = (linha: DoubleCheckInComparativoLinha, c: CampoCfg) => {
    const diverg = Boolean(linha[c.divergKey]);
    const frase = diverg ? fraseDivergencia(linha, c.id) : null;
    const chaveFrase = `${linha.idItemDocumentoEstoque}:${linha.idItemPedidoCompra}:${c.id}`;
    const vals = valoresExibicao(linha, c);
    const dec = decisaoMap.get(
      chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, c.id)
    );
    const decVigente = dec?.vigente === false ? undefined : dec;
    const natureza =
      decVigente &&
      ['arredondamento', 'ipi_reflexo'].includes(decVigente.justificativaCodigo)
        ? 'benigna'
        : linha.naturezaDivergencias?.[c.id];
    const hist = historicoDaDecisao(dec);
    const solicitacaoCampo = solicitacaoMap.get(
      chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, c.id)
    );
    const numeroSolicitacaoOtimiza =
      dec?.numeroSolicitacaoOtimiza ?? solicitacaoCampo?.numero ?? null;
    const otimizaEmAndamento = !decVigente && solicitacaoCampo?.status === 'in_progress';
    return (
      <div
        key={c.id}
        className={`rounded-lg border px-2.5 py-2 ${
          diverg
            ? 'border-amber-400/80 bg-white dark:border-amber-600 dark:bg-slate-900/50'
            : 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
        }`}
      >
        {diverg && numeroSolicitacaoOtimiza != null ? (
          <p
            className={`mb-1 text-[11px] font-bold leading-tight ${
              otimizaEmAndamento
                ? 'text-amber-800 dark:text-amber-200'
                : 'text-sky-800 dark:text-sky-200'
            }`}
            title={
              otimizaEmAndamento
                ? `Solicitação ${numeroSolicitacaoOtimiza} do Otimiza ainda está em andamento`
                : `Solicitação no Otimiza nº ${numeroSolicitacaoOtimiza}`
            }
          >
            Otimiza nº {numeroSolicitacaoOtimiza}
            {otimizaEmAndamento ? ' · em andamento' : ''}
          </p>
        ) : null}
        <div className="mb-1 flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {c.id === 'ipi' && linha.conferenciaIpi === 'percentual' ? 'IPI %' : c.label}
            </span>
            {diverg && natureza ? (
              <span
                className={
                  natureza === 'real'
                    ? 'rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                }
              >
                {natureza === 'real' ? 'Real' : 'Benigna'}
              </span>
            ) : null}
          </div>
          {!diverg ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Igual" />
          ) : decVigente?.decisao === 'aceita' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Aceita" />
          ) : decVigente?.decisao === 'recusa' ? (
            <XCircle className="h-3.5 w-3.5 text-rose-600" aria-label="Recusada" />
          ) : (
            evidencia ? null : (
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
              {somenteLeitura ? 'Sem decisão' : 'Pendente'}
            </span>
            )
          )}
        </div>
        <div className={`space-y-0.5 text-xs ${c.kind === 'text' ? '' : 'tabular-nums'}`}>
          <div className="flex justify-between gap-2">
            <span className="shrink-0 text-slate-400">NF</span>
            <span className="min-w-0 text-right">
              <span
                className="block font-medium text-slate-800 dark:text-slate-100 break-words"
                title={vals.nfTitle ?? vals.nf}
              >
                {vals.nf}
              </span>
              {vals.nfDetalhe ? (
                vals.prazosClicavel ? (
                  <button
                    type="button"
                    className="mt-0.5 block w-full text-right text-[10px] font-semibold text-primary-600 underline decoration-dotted underline-offset-2 hover:text-primary-700 dark:text-primary-400"
                    title="Ver tabela de data base e vencimentos"
                    onClick={() => setPrazosModalLinha(linha)}
                  >
                    {vals.nfDetalhe}
                  </button>
                ) : (
                  <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                    {vals.nfDetalhe}
                  </span>
                )
              ) : null}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="shrink-0 text-slate-400">PC</span>
            <span className="min-w-0 text-right">
              <span
                className="block font-medium text-slate-800 dark:text-slate-100 break-words"
                title={vals.pcTitle ?? vals.pc}
              >
                {vals.pc}
              </span>
              {vals.pcDetalhe ? (
                vals.prazosClicavel ? (
                  <button
                    type="button"
                    className="mt-0.5 block w-full text-right text-[10px] font-semibold text-primary-600 underline decoration-dotted underline-offset-2 hover:text-primary-700 dark:text-primary-400"
                    title="Ver tabela de data base e vencimentos"
                    onClick={() => setPrazosModalLinha(linha)}
                  >
                    {vals.pcDetalhe}
                  </button>
                ) : (
                  <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                    {vals.pcDetalhe}
                  </span>
                )
              ) : null}
            </span>
          </div>
        </div>
        {(() => {
          if (evidencia) return null;
          const obsBenigna =
            diverg && natureza === 'benigna'
              ? linha.observacaoNaturezaDivergencias?.[c.id]?.trim() || null
              : null;
          if (!frase && !obsBenigna) return null;
          const textoSugestao = frase ? formatarSugestaoOtimiza(frase) : '';
          return (
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Ver sugestão de texto"
                aria-label="Ver sugestão de texto"
                onClick={() =>
                  setTextoModal({
                    titulo: `Sugestão — ${
                      c.id === 'ipi' && linha.conferenciaIpi === 'percentual' ? 'IPI %' : c.label
                    }`,
                    texto: textoSugestao,
                    chave: chaveFrase,
                    ...(obsBenigna ? { contexto: obsBenigna } : {}),
                  })
                }
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Texto
              </button>
            </div>
          );
        })()}
        {diverg && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] text-slate-500" title={dec?.justificativaLabel ?? ''}>
                {dec
                  ? `${dec.vigente === false ? 'Anterior' : dec.decisao === 'aceita' ? 'Aceita' : 'Recusada'}: ${dec.justificativaLabel}`
                  : 'Divergente'}
              </span>
              {!somenteLeitura && (!conferido || !decVigente) && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    title={
                      natureza === 'benigna'
                        ? 'Aceitar divergência benigna'
                        : 'Aceitar divergência (exige solicitação concluída no Otimiza)'
                    }
                    className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                    onClick={() => abrirJustificativa(linha, c.id, 'aceita')}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Recusar divergência (com justificativa/observação)"
                    className="rounded p-1 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40"
                    onClick={() => abrirJustificativa(linha, c.id, 'recusa')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {hist.length > 0 && (
              <div className="space-y-1 rounded-md bg-slate-100/80 px-1.5 py-1 dark:bg-slate-800/80">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Observações ({hist.length})
                </div>
                <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
                  {hist.map((h, idx) => (
                    <li
                      key={h.id > 0 ? h.id : `${h.criadoEm}-${idx}-${h.texto.slice(0, 12)}`}
                      className="border-t border-slate-200/70 pt-1 first:border-0 first:pt-0 dark:border-slate-700/70"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[9px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{h.usuarioLogin || '—'}</span>
                        <span>{h.criadoEm ? fmtDataHora(h.criadoEm) : ''}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                        {h.texto}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dec?.vigente === false ? (
              <p className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                Decisão anterior preservada. Aceite ou recuse novamente.
              </p>
            ) : null}
            {conferido && decVigente && (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => abrirNovaObservacao(linha, c.id)}
              >
                <MessageSquarePlus className="h-3 w-3" aria-hidden />
                Nova observação
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500 animate-pulse">Carregando comparativo NF × PC…</p>;
  }
  if (erro) {
    return (
      <p className="text-sm text-rose-600" role="alert">
        {erro}
      </p>
    );
  }
  if (linhas.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Nenhum vínculo item da NF × item de pedido de compra encontrado para este documento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {linhas.length} vínculo(s)
        </span>
        {pagamentoXmlPendente ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            Fatura da NF pendente
          </span>
        ) : null}
        {qtdeDiverg > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {qtdeDiverg} com divergência
          </span>
        ) : pagamentoXmlPendente ? null : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Sem divergências
          </span>
        )}
        {pendentes > 0 && (
          <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
            {pendentes} decisão(ões) pendente(s)
          </span>
        )}
        {[
          ...new Map(
            linhas
              .filter((l) => l.naoGeraContasPagar)
              .map((l) => {
                const tipo = (l.tipoMovimentacao ?? '').trim() || 'Movimentação';
                return [
                  `${l.idTipoMovimentacao ?? tipo}|${l.comparaCondicaoPagamento ? 1 : 0}`,
                  {
                    tipo,
                    compara: l.comparaCondicaoPagamento !== false,
                  },
                ] as const;
              })
          ).values(),
        ].map(({ tipo, compara }) => (
          <span
            key={`${tipo}-${compara ? 'cmp' : 'skip'}`}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            title={
              compara
                ? 'Pré-entrada: a condição informada aqui é a da nota na divergência com o pedido. Não gera financeiro.'
                : 'Essa movimentação não gera contas e a condição de pagamento não entra na comparação.'
            }
          >
            {tipo} (Não gera contas)
          </span>
        ))}
      </div>

      {textoConsolidado && !evidencia ? (
        <section className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/40">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              Texto para o Otimiza
            </h4>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 dark:text-sky-100 dark:hover:bg-sky-900/50"
              title="Ver texto para o Otimiza"
              aria-label="Ver texto para o Otimiza"
              onClick={() =>
                setTextoModal({
                  titulo: 'Texto para o Otimiza',
                  texto: textoConsolidado,
                  chave: 'consolidado',
                })
              }
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Ver
            </button>
          </div>
        </section>
      ) : null}

      {totaisVinculos && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Desconto NF
                </p>
                <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {nfBrl.format(totaisVinculos.descontoNF)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Desconto PC
                </p>
                <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {nfBrl.format(totaisVinculos.descontoPC)}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  title="Valor a pagar: produtos com desconto, mais IPI, ST, frete e demais acréscimos. Se os vínculos cobrem a nota inteira, é o total oficial da NF."
                >
                  Total NF
                </p>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    totaisVinculos.totaisIguais
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {nfBrl.format(totaisVinculos.totalNF)}
                </p>
              </div>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  title="Valor a pagar do pedido: produtos com desconto, mais IPI e ST."
                >
                  Total PC
                </p>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    totaisVinculos.totaisIguais
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {nfBrl.format(totaisVinculos.totalPC)}
                </p>
              </div>
            </div>
            {mostraAjudaUnitarioTotais && (
              <button
                type="button"
                onClick={() => setAjudaTotaisAberta((v) => !v)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                title="Por que o unitário diverge, mas pode ser benigno?"
                aria-label="Por que o unitário diverge, mas pode ser benigno?"
                aria-expanded={ajudaTotaisAberta}
              >
                <CircleHelp className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          {mostraAjudaUnitarioTotais && ajudaTotaisAberta && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                Por que o unitário diverge, mas pode ser benigno?
              </p>
              <p className="mt-1.5">
                Total NF e Total PC são o{' '}
                <strong className="font-semibold text-slate-700 dark:text-slate-200">valor a pagar</strong>:
                produtos com desconto, mais IPI, substituição tributária, frete e demais acréscimos.
                Quando os vínculos cobrem a nota inteira, o Total NF é o valor oficial da NF.
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>
                  Se o <strong className="font-semibold text-slate-700 dark:text-slate-200">preço unitário da NF for maior</strong>,
                  mas o <strong className="font-semibold text-slate-700 dark:text-slate-200">líquido dos produtos</strong> da
                  NF e do pedido forem iguais, a diferença é só a{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">forma do desconto</strong>{' '}
                  (ex.: % no pedido e valor cheio na nota) → <strong className="font-semibold text-emerald-700 dark:text-emerald-300">benigna</strong>.
                  IPI e ST entram no total a pagar e o IPI segue no card próprio.
                </li>
                <li>
                  Se o unitário da NF for maior e o{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">líquido dos produtos não fechar</strong> →{' '}
                  <strong className="font-semibold text-rose-700 dark:text-rose-300">real</strong>.
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {campoVisivel('condicao_pagamento') && gruposPagamento.length > 0 && (
        <section>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Divergência do documento
          </h4>
          <div className="flex flex-wrap items-start gap-2">
            {gruposPagamento.map((grupo) => (
              <div key={grupo.key} className="w-full max-w-xs">
                {gruposPagamento.length > 1 ? (
                  <p className="mb-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400" title={grupo.nome}>
                    {grupo.nome}
                  </p>
                ) : null}
                {renderCampoCard(grupo.linha, CAMPO_PAGAMENTO)}
              </div>
            ))}
            {!somenteLeitura && !evidencia && linhaPagamentoEditavel ? (
              <button
                type="button"
                className={`${btnSecondary} shrink-0`}
                onClick={() => setPagamentoAberto(true)}
              >
                Editar
              </button>
            ) : null}
          </div>
        </section>
      )}

      {pagamentoAberto && linhaPagamentoEditavel && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[10070] flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Editar condição de pagamento"
              onClick={() => setPagamentoAberto(false)}
            >
              <div className="my-auto w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
                <PagamentoXmlPreEntradaPanel
                  idDocumento={idDocumento}
                  linhas={linhas}
                  somenteLeitura={somenteLeitura}
                  evidencia={evidencia}
                  editarAoAbrir
                  onFechar={() => setPagamentoAberto(false)}
                  onLinhasChange={onLinhasChange}
                />
              </div>
            </div>,
            document.body
          )
        : null}

      <div className="space-y-3">
        {linhas.map((linha) => {
          const divergenciaDoItem =
            linha.divergValorUnitario || linha.divergQtde || linha.divergIpi;
          // Link de evidência: esconde itens e campos iguais (sem divergência).
          if (evidencia && !divergenciaDoItem) return null;
          const camposItem = CAMPOS_ITEM.filter(
            (c) =>
              campoVisivel(c.id) && (!evidencia || Boolean(linha[c.divergKey]))
          );
          if (evidencia && camposItem.length === 0) return null;
          return (
          <div
            key={`${linha.idItemDocumentoEstoque}-${linha.idItemPedidoCompra}`}
            className={`rounded-xl border px-3 py-3 ${
              divergenciaDoItem
                ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30'
                : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/40'
            }`}
          >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-800 dark:text-slate-100">
                  {linha.codigoProduto ?? linha.idProduto ?? '—'}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2">
                  {linha.descricaoProduto ?? '—'}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                <div className="font-medium text-slate-700 dark:text-slate-200">
                  {linha.nomePedidoCompra ?? (linha.idPedidoCompra != null ? `PC ${linha.idPedidoCompra}` : 'PC —')}
                </div>
                <div>Item NF #{linha.idItemDocumentoEstoque} · Item PC #{linha.idItemPedidoCompra}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {camposItem.map((c) => renderCampoCard(linha, c))}
            </div>
          </div>
          );
        })}
      </div>

      {draft &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => !salvando && !salvandoNumero && setDraft(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {draft.decisao === 'aceita' ? 'Aceitar divergência' : 'Recusar divergência'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {contextoDivergencia(draft.linha, draft.campo)}
              </p>
              <div className="mt-4 space-y-3">
                {divergenciaBenigna && (
                  <div>
                    <p className={labelClass}>Deseja inserir o número da solicitação no Otimiza?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-pressed={querInserirOtimiza === true}
                        className={
                          querInserirOtimiza === true
                            ? btnPrimary
                            : btnSecondary
                        }
                        onClick={() => {
                          setQuerInserirOtimiza(true);
                          setJustErro(null);
                        }}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        aria-pressed={querInserirOtimiza === false}
                        className={
                          querInserirOtimiza === false
                            ? btnPrimary
                            : btnSecondary
                        }
                        onClick={() => {
                          setQuerInserirOtimiza(false);
                          setJustErro(null);
                        }}
                      >
                        Não
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {querInserirOtimiza === false
                        ? 'O aceite segue sem o número. Informe a justificativa para finalizar. A observação é opcional.'
                        : querInserirOtimiza === true
                          ? 'Informe o número e grave. A solicitação precisa estar concluída no Otimiza.'
                          : 'Divergência benigna: o número é opcional. Escolha Sim ou Não para continuar.'}
                    </p>
                  </div>
                )}
                {draft.decisao === 'aceita' && (!divergenciaBenigna || querInserirOtimiza === true) && (
                  <div>
                    <label className={labelClass}>Nº da solicitação no Otimiza *</label>
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={numeroOtimiza}
                        onChange={(e) => setNumeroOtimiza(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="Número inteiro"
                        autoFocus
                      />
                      <button
                        type="button"
                        className={`${btnPrimary} shrink-0`}
                        disabled={
                          salvandoNumero ||
                          salvando ||
                          !numeroOtimiza.trim() ||
                          (numeroConfereComGravado && solicitacaoConcluida)
                        }
                        onClick={() => void gravarNumeroOtimiza()}
                      >
                        {salvandoNumero
                          ? 'Consultando…'
                          : numeroConfereComGravado && !solicitacaoConcluida
                            ? 'Consultar novamente'
                            : numeroGravado
                              ? 'Atualizar'
                              : 'Gravar'}
                      </button>
                    </div>
                    {avisoOtimiza ? (
                      <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        {avisoOtimiza}
                      </p>
                    ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {aceiteLiberado
                        ? aplicouNasDemais
                          ? `Solicitação ${numeroGravado} concluída no Otimiza e gravada nesta e nas outras divergências em aberto. Agora informe a justificativa.`
                          : `Solicitação ${numeroGravado} concluída no Otimiza. Agora informe a justificativa.`
                        : 'Informe o número da solicitação no Otimiza e grave. Se ela ainda estiver em andamento, o número fica nesta divergência e o aceite continua pendente.'}
                    </p>
                    )}
                    {outrasDivergenciasAbertas > 0 && (
                      <button
                        type="button"
                        className={`${btnSecondary} mt-2 w-full`}
                        disabled={salvandoNumero || salvando || !numeroOtimiza.trim()}
                        onClick={() => void gravarNumeroOtimiza(true)}
                      >
                        {salvandoNumero
                          ? 'Consultando…'
                          : `Vale para as demais divergências (${outrasDivergenciasAbertas})`}
                      </button>
                    )}
                  </div>
                )}
                {aceiteLiberado && (
                <>
                <div>
                  <label className={labelClass}>Justificativa</label>
                  <select
                    className={inputClass}
                    value={opcaoId === '' ? '' : String(opcaoId)}
                    onChange={(e) => setOpcaoId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Selecione…</option>
                    {opcoesDoCampo.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Use Outros só quando nenhum motivo acima couber.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>
                    Observações
                    {observacaoObrigatoria ? ' *' : ''}
                  </label>
                  <textarea
                    className={`${inputClass} min-h-[5rem]`}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder={
                      observacaoObrigatoria
                        ? draft.decisao === 'aceita' && !divergenciaBenigna
                          ? 'Obrigatório para aceitar a divergência'
                          : 'Obrigatório se a justificativa for Outros'
                        : divergenciaBenigna
                          ? 'Opcional na divergência benigna'
                          : 'Opcional'
                    }
                  />
                </div>
                </>
                )}
                {justErro && <p className="text-sm text-rose-600">{justErro}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={salvando}
                  onClick={() => setDraft(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={
                    salvando ||
                    salvandoNumero ||
                    !aceiteLiberado ||
                    !opcaoId ||
                    (observacaoObrigatoria && !obs.trim())
                  }
                  onClick={() => void salvarJustificativa()}
                >
                  {salvando ? 'Salvando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {draftObs &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => !salvandoObs && setDraftObs(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Nova observação
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {contextoDivergencia(draftObs.linha, draftObs.campo)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                A observação será acrescentada ao histórico desta divergência (a decisão não muda).
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelClass}>Observação</label>
                  <textarea
                    className={`${inputClass} min-h-[6rem]`}
                    value={novaObs}
                    onChange={(e) => setNovaObs(e.target.value)}
                    placeholder="Descreva o acompanhamento…"
                    autoFocus
                  />
                </div>
                {obsErro && <p className="text-sm text-rose-600">{obsErro}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={salvandoObs}
                  onClick={() => setDraftObs(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={salvandoObs || !novaObs.trim()}
                  onClick={() => void salvarNovaObservacao()}
                >
                  {salvandoObs ? 'Salvando…' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {textoModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10080] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            aria-label={textoModal.titulo}
            onClick={() => setTextoModal(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {textoModal.titulo}
                </h3>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setTextoModal(null)}
                >
                  Fechar
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {textoModal.contexto ? (
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      Explicação da Benignidade
                    </h4>
                    <p className="mt-1.5 rounded-md bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      {textoModal.contexto}
                    </p>
                  </section>
                ) : null}
                {textoModal.texto ? (
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                      Sugestão de texto para otimiza
                    </h4>
                    <p className="mt-1.5 whitespace-pre-line rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm leading-relaxed text-slate-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-slate-200">
                      {textoModal.texto}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => void copiarTexto(textoModal.chave, textoModal.texto)}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {textoCopiado === textoModal.chave ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}

      {prazosModalLinha &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhe dos prazos de pagamento"
            onClick={() => setPrazosModalLinha(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Prazos de pagamento — NF/DE × PC
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {prazosModalLinha.nomePedidoCompra ??
                      (prazosModalLinha.idPedidoCompra != null
                        ? `PC ${prazosModalLinha.idPedidoCompra}`
                        : 'PC')}{' '}
                    · critério = vencimento − data base
                  </p>
                </div>
                <button type="button" className={btnSecondary} onClick={() => setPrazosModalLinha(null)}>
                  Fechar
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-2 py-2">Parc.</th>
                      <th className="px-2 py-2">Data base NF/DE</th>
                      <th className="px-2 py-2">Venc. NF/DE</th>
                      <th className="px-2 py-2 text-right">Dias NF</th>
                      <th className="px-2 py-2">Data base PC</th>
                      <th className="px-2 py-2">Venc. PC</th>
                      <th className="px-2 py-2 text-right">Dias PC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {(() => {
                      const nf = Array.isArray(prazosModalLinha.parcelasNF)
                        ? prazosModalLinha.parcelasNF
                        : [];
                      const pc = Array.isArray(prazosModalLinha.parcelasPC)
                        ? prazosModalLinha.parcelasPC
                        : [];
                      const n = Math.max(nf.length, pc.length, 1);
                      const rows = [];
                      for (let i = 0; i < n; i++) {
                        const a = nf[i];
                        const b = pc[i];
                        const diasNf = a?.dias ?? null;
                        const diasPc = b?.dias ?? null;
                        const diverg =
                          diasNf != null && diasPc != null && diasNf !== diasPc;
                        rows.push(
                          <tr
                            key={i}
                            className={
                              diverg
                                ? 'bg-amber-50/70 dark:bg-amber-950/30'
                                : undefined
                            }
                          >
                            <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">
                              #{i + 1}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {fmtYmdBr(
                                a?.dataBase ?? prazosModalLinha.dataBaseParcelasNF
                              )}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {fmtYmdBr(a?.dataVencimento)}
                              {a?.valor != null ? (
                                <span className="block text-[10px] font-normal text-slate-500">
                                  {nfBrl.format(a.valor)}
                                  {a.paga === true ? ' · já paga' : a.paga === false ? ' · a vencer' : ''}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums font-semibold">
                              {diasNf != null ? `${diasNf}d` : '—'}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {fmtYmdBr(
                                b?.dataBase ?? prazosModalLinha.dataBaseParcelasPC
                              )}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {fmtYmdBr(b?.dataVencimento)}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums font-semibold">
                              {diasPc != null ? `${diasPc}d` : '—'}
                            </td>
                          </tr>
                        );
                      }
                      if (nf.length === 0 && pc.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                              Nenhuma parcela encontrada no Nomus para este documento/PC.
                            </td>
                          </tr>
                        );
                      }
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Condição: NF{' '}
                <strong>
                  {prazosModalLinha.condicaoPagamentoNF ?? '—'}
                  {prazosModalLinha.regraPagamentoNF
                    ? ` · ${prazosModalLinha.regraPagamentoNF}`
                    : ''}
                </strong>{' '}
                × PC{' '}
                <strong>
                  {prazosModalLinha.condicaoPagamentoPC ?? '—'}
                  {prazosModalLinha.regraPagamentoPC
                    ? ` · ${prazosModalLinha.regraPagamentoPC}`
                    : ''}
                </strong>
                {prazosModalLinha.formaPagamentoNF
                  ? ` · Forma: ${prazosModalLinha.formaPagamentoNF}`
                  : ''}
                . O critério de divergência usa os dias de todas as parcelas (vencimento − data base).
                {prazosModalLinha.origemParcelasNF &&
                prazosModalLinha.origemParcelasNF !== 'nomus'
                  ? ' Na pré-entrada, a data base da NF é a emissão da nota.'
                  : ' Se ambos forem à vista, data base ausente no PC ou no DE não conta como divergência.'}
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
