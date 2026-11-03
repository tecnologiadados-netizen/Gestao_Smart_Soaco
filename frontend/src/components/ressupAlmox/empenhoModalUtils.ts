import type { RessupEmpenhoPedidoLinha } from '../../api/compras';
import { cmpPedidosEmpenho } from '../../utils/empenhoPrioridadePedido';

export const RUPTURA_ROW_CLASS =
  'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/50';

export const RUPTURA_CELL_CLASS = 'text-red-700 dark:text-red-300';

export type LinhaEmpenhoSaldoProjetado = RessupEmpenhoPedidoLinha & {
  saldoProjetado: number;
  ruptura: boolean;
};

/** Data de produção ASC → carrada → pedido ASC (mesma regra do backend). */
export function ordenarLinhasEmpenho(linhas: RessupEmpenhoPedidoLinha[]): RessupEmpenhoPedidoLinha[] {
  return [...linhas].sort((a, b) =>
    cmpPedidosEmpenho(
      { pedido: a.pedido, dataEntrega: a.dataEntrega, rota: a.rota ?? '' },
      { pedido: b.pedido, dataEntrega: b.dataEntrega, rota: b.rota ?? '' }
    )
  );
}

/**
 * Saldo projetado em cascata: estoque atual − Emp Bruto de cada linha (ordem do backend).
 * Marca ruptura na primeira linha em que saldo ≤ 0 com bruto > 0.
 */
export function calcularSaldoProjetadoPorPedido(
  linhas: RessupEmpenhoPedidoLinha[],
  saldoAtual: number
): LinhaEmpenhoSaldoProjetado[] {
  let running = saldoAtual;
  let rupturaMarcada = false;
  return linhas.map((l) => {
    const bruto = Number(l.bruto) || 0;
    running = Math.round((running - bruto) * 100) / 100;
    const ruptura = !rupturaMarcada && running <= 0 && bruto > 0;
    if (ruptura) rupturaMarcada = true;
    return { ...l, saldoProjetado: running, ruptura };
  });
}

/** Chegada de PC pendente na cascata do empenho (mesma lista da coluna Pedido compra). */
export type PedidoCompraCascataEntrada = {
  pedidoCompra: string;
  qtde: number;
  /** `dd/mm/yyyy`, ISO ou vazio. */
  dataEntrega: string | null;
};

export type ClassePedidoCompraCascata = 'atraso' | 'a_receber';

export type LinhaCascataEmpenho =
  | (LinhaEmpenhoSaldoProjetado & { tipo: 'empenho' })
  | {
      tipo: 'pc';
      classe: ClassePedidoCompraCascata;
      pedido: string;
      dataEntrega: string | null;
      rota: string;
      /** Quantidade que chega (não entra no total de empenho bruto). */
      bruto: number;
      saldoProjetado: number;
      ruptura: false;
    };

/** Data local `yyyy-mm-dd` para classificar atraso × a receber. */
export function hojeIsoLocal(agora = new Date()): string {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Aceita ISO ou `dd/mm/yyyy`. Retorna `yyyy-mm-dd` ou null. */
export function dataParaIso(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const t = String(valor).trim();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/**
 * Sem data ou entrega anterior a hoje = em atraso.
 * Entrega hoje ou futura = a receber.
 */
export function classificarPedidoCompraCascata(
  dataEntrega: string | null | undefined,
  hojeIso: string
): ClassePedidoCompraCascata {
  const iso = dataParaIso(dataEntrega);
  if (!iso || iso < hojeIso) return 'atraso';
  return 'a_receber';
}

function rotuloClassePc(classe: ClassePedidoCompraCascata): string {
  return classe === 'atraso' ? 'Chegada PC · Em atraso' : 'Chegada PC · A receber';
}

/**
 * Intercala a chegada de cada PC na cascata de saída do empenho.
 * A ordem dos empenhos permanece a do backend. No mesmo dia, a chegada entra antes da saída.
 * PC sem data (atraso) ocupa o dia de hoje. Com o toggle desligado, a linha some e a quantidade
 * não entra no saldo projetado da cascata. O total de empenho bruto não muda.
 */
export function montarCascataEmpenhoComPedidosCompra(opts: {
  linhas: RessupEmpenhoPedidoLinha[];
  pedidosCompra: PedidoCompraCascataEntrada[];
  saldoAtual: number;
  considerarAtraso: boolean;
  considerarAReceber: boolean;
  hojeIso?: string;
}): LinhaCascataEmpenho[] {
  const hoje = opts.hojeIso ?? hojeIsoLocal();
  const pcs = opts.pedidosCompra
    .map((p) => {
      const qtde = Number(p.qtde) || 0;
      if (qtde <= 0) return null;
      const classe = classificarPedidoCompraCascata(p.dataEntrega, hoje);
      if (classe === 'atraso' && !opts.considerarAtraso) return null;
      if (classe === 'a_receber' && !opts.considerarAReceber) return null;
      const iso = dataParaIso(p.dataEntrega);
      return {
        classe,
        pedido: p.pedidoCompra?.trim() || '—',
        dataEntrega: p.dataEntrega,
        /** Sem data: considera disponível a partir de hoje. */
        dataOrdem: iso ?? hoje,
        qtde,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => {
      if (a.dataOrdem !== b.dataOrdem) return a.dataOrdem < b.dataOrdem ? -1 : 1;
      return a.pedido.localeCompare(b.pedido, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

  type Passo =
    | { tipo: 'empenho'; linha: RessupEmpenhoPedidoLinha }
    | { tipo: 'pc'; pc: (typeof pcs)[number] };

  const passos: Passo[] = [];
  let iPc = 0;
  for (const linha of opts.linhas) {
    const dataEmp = dataParaIso(linha.dataEntrega) ?? '9999-99-99';
    while (iPc < pcs.length && pcs[iPc].dataOrdem <= dataEmp) {
      passos.push({ tipo: 'pc', pc: pcs[iPc] });
      iPc += 1;
    }
    passos.push({ tipo: 'empenho', linha });
  }
  while (iPc < pcs.length) {
    passos.push({ tipo: 'pc', pc: pcs[iPc] });
    iPc += 1;
  }

  let running = opts.saldoAtual;
  let rupturaMarcada = false;
  return passos.map((passo) => {
    if (passo.tipo === 'pc') {
      running = Math.round((running + passo.pc.qtde) * 100) / 100;
      return {
        tipo: 'pc',
        classe: passo.pc.classe,
        pedido: passo.pc.pedido,
        dataEntrega: passo.pc.dataEntrega,
        rota: rotuloClassePc(passo.pc.classe),
        bruto: passo.pc.qtde,
        saldoProjetado: running,
        ruptura: false as const,
      };
    }
    const bruto = Number(passo.linha.bruto) || 0;
    running = Math.round((running - bruto) * 100) / 100;
    const ruptura = !rupturaMarcada && running <= 0 && bruto > 0;
    if (ruptura) rupturaMarcada = true;
    return { ...passo.linha, tipo: 'empenho' as const, saldoProjetado: running, ruptura };
  });
}

/** Texto da dica do empenho líquido (grade / Qtde Emp). */
export const DICA_EMPENHO_LIQ_GRADE =
  'Valor da grade equivale a max(0, empenho bruto − estoque em PA).';

/** Texto da dica da coluna Estoque atual (Consulta de Estoque). */
export const DICA_ESTOQUE_ATUAL_GRADE =
  'Total do saldo de estoque do somatório dos setores parametrizados. Para itens que fazem parte da BOM e estão no setor de PA compondo o produto pai, tal quantidade não está sendo somada ao estoque atual, visto que essa quantidade já está sendo considerada para resultar no empenho líquido.';

/** Setores de produto acabado (PRODUTOS ACABADOS / equivalente). */
export const SETORES_ESTOQUE_PA = [5, 24] as const;

export function isSetorEstoquePa(idSetor: number): boolean {
  return (SETORES_ESTOQUE_PA as readonly number[]).includes(idSetor);
}

/**
 * Tip do card Estoque em PA no Empenho (estoque×BOM em unidades do componente).
 * Abatido integralmente do empenho bruto (piso 0) para obter o empenho líquido.
 */
export const DICA_ESTOQUE_PA =
  'Estoque de produtos acabados convertido em unidades do componente via BOM (setores 5 e 24). Subtraído do empenho bruto para obter o empenho líquido (mínimo 0).';

/** Tip do card Estoque em PA no modal Estoque atual (saldo próprio nos setores 5/24). */
export const DICA_ESTOQUE_PA_SALDO =
  'Estoque de produtos acabados (setores 5 e 24).';
