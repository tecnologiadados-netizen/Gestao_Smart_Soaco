import type { SequenciamentoCarradaAgregada } from '../../api/sequenciamentoCarradas';

/** Separador interno usado na chave (cod + carrada). */
const KEY_SEP = '\x1e';

/** Campo ausente (undefined) = usar baseline; string vazia = usuário limpou explicitamente. */
export type SimEntry = { dataProducao?: string; dataEntrega?: string };

export function getField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return '';
}

export function getNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

/** Normaliza qualquer valor de data (ISO, Date, YYYY-MM-DD) para 'YYYY-MM-DD' (ou '' se inválido). */
export function toISODate(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Data de hoje em 'YYYY-MM-DD' (local). */
export function hojeISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function carradaKey(cod: string, carrada: string): string {
  return `${cod}${KEY_SEP}${carrada}`;
}

/** cod/carrada de uma linha do snapshot (mesma regra da agregação: RM||'—', Observacoes||'Sem Rota'). */
export function linhaCodCarrada(row: Record<string, unknown>): { cod: string; carrada: string } {
  const cod = getField(row, ['RM', 'rm']) || '—';
  const carrada = getField(row, ['Observacoes', 'Observacoes ', 'Observações']) || 'Sem Rota';
  return { cod, carrada };
}

export function linhaCarradaKey(row: Record<string, unknown>): string {
  const { cod, carrada } = linhaCodCarrada(row);
  return carradaKey(cod, carrada);
}

export function carradaKeyDe(c: SequenciamentoCarradaAgregada): string {
  return carradaKey(c.cod, c.carrada);
}

export type CarradaBaseline = {
  dataEntrega: string;
  dataProducao: string;
  dataEntregaDivergente: boolean;
  dataProducaoDivergente: boolean;
};

/**
 * Valores comuns por carrada, derivados das linhas do snapshot:
 *  - dataEntrega  = previsao_entrega_atualizada comum (vazio se divergente entre pedidos).
 *  - dataProducao = data_producao comum (vazio se divergente/inexistente).
 */
export function computarBaselines(linhas: Record<string, unknown>[]): Map<string, CarradaBaseline> {
  const acc = new Map<string, { entrega: Set<string>; producao: Set<string> }>();
  for (const row of linhas) {
    const key = linhaCarradaKey(row);
    let cur = acc.get(key);
    if (!cur) {
      cur = { entrega: new Set(), producao: new Set() };
      acc.set(key, cur);
    }
    const entrega = toISODate(row['previsao_entrega_atualizada'] ?? row['previsao_entrega']);
    if (entrega) cur.entrega.add(entrega);
    const producao = toISODate(row['data_producao']);
    cur.producao.add(producao); // inclui '' para detectar divergência com preenchidos
  }
  const out = new Map<string, CarradaBaseline>();
  for (const [key, v] of acc) {
    const entregas = [...v.entrega];
    const producoesPreenchidas = [...v.producao].filter((x) => x !== '');
    out.set(key, {
      dataEntrega: entregas.length === 1 ? entregas[0]! : '',
      dataProducao: producoesPreenchidas.length === 1 && v.producao.size === 1 ? producoesPreenchidas[0]! : '',
      dataEntregaDivergente: entregas.length > 1,
      dataProducaoDivergente: v.producao.size > 1,
    });
  }
  return out;
}

/** Valor efetivo (simulação sobrepõe baseline). */
export function valorEfetivo(
  sim: Map<string, SimEntry>,
  baseline: Map<string, CarradaBaseline>,
  key: string,
  campo: 'dataProducao' | 'dataEntrega'
): string {
  const s = sim.get(key);
  if (s && s[campo] !== undefined && s[campo] !== '') return s[campo];
  // Um valor vazio explícito na simulação também sobrepõe (usuário limpou o campo).
  if (s && s[campo] === '') return '';
  const b = baseline.get(key);
  return b ? b[campo] : '';
}

/** Verdadeiro se há qualquer diferença entre o valor simulado e o baseline da carrada. */
export function carradaAlterada(
  sim: Map<string, SimEntry>,
  baseline: Map<string, CarradaBaseline>,
  key: string
): boolean {
  const s = sim.get(key);
  if (!s) return false;
  const b = baseline.get(key);
  const baseEntrega = b?.dataEntrega ?? '';
  const baseProducao = b?.dataProducao ?? '';
  const entregaAlterada = s.dataEntrega !== undefined && s.dataEntrega !== baseEntrega;
  const producaoAlterada = s.dataProducao !== undefined && s.dataProducao !== baseProducao;
  return entregaAlterada || producaoAlterada;
}

export type PedidoAlterado = {
  idPedido: string;
  rota: string;
  pd: string;
  cliente: string;
  cod: string;
  descricao: string;
  qtdePendenteReal: number;
  previsaoAnterior: string;
  previsaoNova: string;
};

/**
 * Pedidos (linhas) cuja Data de entrega simulada difere da previsão atual — exigem motivo.
 * Uma carrada é considerada só se tiver dataEntrega simulada preenchida e diferente do baseline.
 */
export function computarPedidosComEntregaAlterada(
  linhas: Record<string, unknown>[],
  sim: Map<string, SimEntry>,
  baseline: Map<string, CarradaBaseline>
): PedidoAlterado[] {
  const out: PedidoAlterado[] = [];
  for (const row of linhas) {
    const key = linhaCarradaKey(row);
    const s = sim.get(key);
    if (!s || s.dataEntrega === undefined) continue;
    const baseEntrega = baseline.get(key)?.dataEntrega ?? '';
    const nova = s.dataEntrega;
    if (!nova || nova === baseEntrega) continue;
    const atual = toISODate(row['previsao_entrega_atualizada'] ?? row['previsao_entrega']);
    if (nova === atual) continue; // sem mudança efetiva neste pedido
    const idPedido = getField(row, ['id_pedido', 'idChave']);
    if (!idPedido) continue;
    const { carrada } = linhaCodCarrada(row);
    out.push({
      idPedido,
      rota: carrada,
      pd: getField(row, ['PD', 'pd']) || '—',
      cliente: getField(row, ['Cliente', 'cliente']),
      cod: getField(row, ['Cod', 'cod']),
      descricao: getField(row, ['Descricao do produto', 'Descrição do produto']),
      qtdePendenteReal: getNumber(row, ['Qtde Pendente Real', 'qtde pendente real']),
      previsaoAnterior: atual,
      previsaoNova: nova,
    });
  }
  return out;
}

/** Itens (id_pedido + data) para gravar Data de produção — todas as linhas de carradas com data de produção simulada. */
export function computarItensDataProducao(
  linhas: Record<string, unknown>[],
  sim: Map<string, SimEntry>,
  baseline: Map<string, CarradaBaseline>
): { id_pedido: string; data_producao: string }[] {
  const out: { id_pedido: string; data_producao: string }[] = [];
  for (const row of linhas) {
    const key = linhaCarradaKey(row);
    const s = sim.get(key);
    if (!s || s.dataProducao === undefined || s.dataProducao === '') continue;
    const baseProducao = baseline.get(key)?.dataProducao ?? '';
    if (s.dataProducao === baseProducao) continue;
    const idPedido = getField(row, ['id_pedido', 'idChave']);
    if (!idPedido) continue;
    out.push({ id_pedido: idPedido, data_producao: s.dataProducao });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Calendário de produção (pivô Setor x Data de produção)
// ---------------------------------------------------------------------------

export type CalendarioCelulaDetalhe = {
  setor: string;
  data: string;
  tipoF: string;
  pd: string;
  qtde: number;
};

export type CalendarioDados = {
  datas: string[];
  setores: string[];
  /** valores[setor][data] = soma de Qtde Pendente Real. */
  valores: Map<string, Map<string, number>>;
  totalPorData: Map<string, number>;
  totalPorSetor: Map<string, number>;
  totalGeral: number;
  /** Linhas base para drill-down (setor + data + tipoF + pd + qtde). */
  detalhes: CalendarioCelulaDetalhe[];
};

/** Data de produção efetiva de uma linha (simulação sobrepõe data_producao do snapshot). */
function dataProducaoDaLinha(
  row: Record<string, unknown>,
  sim: Map<string, SimEntry>,
  baseline: Map<string, CarradaBaseline>
): string {
  const key = linhaCarradaKey(row);
  return valorEfetivo(sim, baseline, key, 'dataProducao');
}

export function computarCalendarioProducao(
  linhas: Record<string, unknown>[],
  sim: Map<string, SimEntry>,
  baseline: Map<string, CarradaBaseline>
): CalendarioDados {
  const valores = new Map<string, Map<string, number>>();
  const totalPorData = new Map<string, number>();
  const totalPorSetor = new Map<string, number>();
  const datasSet = new Set<string>();
  const setoresSet = new Set<string>();
  const detalhes: CalendarioCelulaDetalhe[] = [];
  let totalGeral = 0;

  for (const row of linhas) {
    const data = dataProducaoDaLinha(row, sim, baseline);
    if (!data) continue; // só entram no calendário linhas com data de produção definida
    const setor = getField(row, ['Setor de Producao', 'Setor de produção']) || '(vazio)';
    const qtde = getNumber(row, ['Qtde Pendente Real', 'qtde pendente real']);
    if (qtde === 0) continue;
    const tipoF = getField(row, ['tipoF', 'TipoF', 'tipo_f']) || '(vazio)';
    const pd = getField(row, ['PD', 'pd']) || '—';

    datasSet.add(data);
    setoresSet.add(setor);

    let porData = valores.get(setor);
    if (!porData) {
      porData = new Map<string, number>();
      valores.set(setor, porData);
    }
    porData.set(data, (porData.get(data) ?? 0) + qtde);
    totalPorData.set(data, (totalPorData.get(data) ?? 0) + qtde);
    totalPorSetor.set(setor, (totalPorSetor.get(setor) ?? 0) + qtde);
    totalGeral += qtde;

    detalhes.push({ setor, data, tipoF, pd, qtde });
  }

  const datas = [...datasSet].sort();
  const setores = [...setoresSet].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  return { datas, setores, valores, totalPorData, totalPorSetor, totalGeral, detalhes };
}

/** Formata 'YYYY-MM-DD' como "quarta-feira, 1 de julho de 2026". */
export function formatDataExtenso(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Formata 'YYYY-MM-DD' como dd/mm/aaaa. */
export function formatDataCurta(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatQtdeInt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}
