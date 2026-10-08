/**
 * Recorrente: compra nos 6 meses anteriores ao mês/início do período.
 * Reativado: já comprou antes dessa janela, sem compra nos 6 meses.
 * Novo: primeira compra naquele mês (ou no período, no card).
 */

export type TipoClientePainel = 'recorrente' | 'reativado' | 'novo';

export type PedidoRecorrencia = {
  clienteId?: number;
  cliente: string;
  emissao: string;
};

export type HistoricoClientePainel = {
  clienteId: number;
  cliente: string;
  primeiraEmissao: string;
  ultimaEmissaoAntesPeriodo: string | null;
};

export type MesClientesRecorrentes = {
  mes: string;
  clientes: number;
  recorrentes: number;
  reativados: number;
  novos: number;
  pct: number;
};

export type ResumoClientesRecorrentes = {
  pct: number;
  clientes: number;
  recorrentes: number;
  reativados: number;
  novos: number;
  janelaInicio: string;
  janelaFim: string;
  porMes: MesClientesRecorrentes[];
};

function menosMeses(ymd: string, meses: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim().slice(0, 10));
  if (!m) return ymd;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const base = new Date(ano, mes - 1 - meses, 1);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const dt = new Date(base.getFullYear(), base.getMonth(), Math.min(dia, ultimoDia));
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function diaAnterior(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim().slice(0, 10));
  if (!m) return ymd;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  dt.setDate(dt.getDate() - 1);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

export function chaveClientePainel(clienteId: number | undefined, cliente: string): string | null {
  const id = Math.trunc(Number(clienteId) || 0);
  if (id > 0) return `id:${id}`;
  const nome = String(cliente ?? '').trim().toUpperCase();
  if (!nome) return null;
  return `nome:${nome}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function ymdValido(s: string | null | undefined): string | null {
  const v = String(s ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function maxYmd(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function minYmd(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

export function labelTipoCliente(tipo: TipoClientePainel): 'Recorrente' | 'Reativado' | 'Novo' {
  if (tipo === 'recorrente') return 'Recorrente';
  if (tipo === 'reativado') return 'Reativado';
  return 'Novo';
}

export function classificarClienteNaReferencia(
  primeiraEmissao: string | null,
  ultimaAntes: string | null,
  referencia: string
): TipoClientePainel {
  const primeira = ymdValido(primeiraEmissao);
  const janelaInicio = menosMeses(referencia, 6);
  if (!primeira || primeira >= referencia) return 'novo';
  const ultima = ymdValido(ultimaAntes);
  if (ultima && ultima >= janelaInicio && ultima < referencia) return 'recorrente';
  return 'reativado';
}

function indiceHistorico(historico: HistoricoClientePainel[]): Map<string, HistoricoClientePainel> {
  const map = new Map<string, HistoricoClientePainel>();
  for (const h of historico) {
    const id = Math.trunc(Number(h.clienteId) || 0);
    if (id > 0) map.set(`id:${id}`, h);
    const nome = String(h.cliente ?? '').trim().toUpperCase();
    if (nome) map.set(`nome:${nome}`, h);
  }
  return map;
}

function historicoDoCliente(
  histMap: Map<string, HistoricoClientePainel>,
  clienteId: number | undefined,
  cliente: string
): HistoricoClientePainel | undefined {
  const id = Math.trunc(Number(clienteId) || 0);
  const nome = String(cliente ?? '').trim().toUpperCase();
  if (id > 0) {
    const byId = histMap.get(`id:${id}`);
    if (byId) return byId;
  }
  if (nome) return histMap.get(`nome:${nome}`);
  return undefined;
}

function comprasPorCliente(pedidos: PedidoRecorrencia[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of pedidos) {
    const chave = chaveClientePainel(p.clienteId, p.cliente);
    const emissao = ymdValido(p.emissao);
    if (!chave || !emissao) continue;
    const lista = map.get(chave) ?? [];
    lista.push(emissao);
    map.set(chave, lista);
  }
  for (const lista of map.values()) lista.sort();
  return map;
}

function primeiraEmissaoCliente(
  chave: string,
  hist: HistoricoClientePainel | undefined,
  compras: string[]
): string | null {
  const minPeriodo = compras[0] ?? null;
  return minYmd(ymdValido(hist?.primeiraEmissao), minPeriodo);
}

function ultimaAntesReferencia(
  hist: HistoricoClientePainel | undefined,
  compras: string[],
  referencia: string
): string | null {
  let ultima = ymdValido(hist?.ultimaEmissaoAntesPeriodo);
  if (ultima && ultima >= referencia) ultima = null;
  for (const e of compras) {
    if (e < referencia) ultima = maxYmd(ultima, e);
  }
  return ultima;
}

export function criarClassificadorPedidos(
  pedidos: PedidoRecorrencia[],
  historico: HistoricoClientePainel[] = []
): (p: PedidoRecorrencia) => TipoClientePainel {
  const histMap = indiceHistorico(historico);
  const comprasMap = comprasPorCliente(pedidos);
  return (p: PedidoRecorrencia): TipoClientePainel => {
    const chave = chaveClientePainel(p.clienteId, p.cliente);
    const emissao = ymdValido(p.emissao);
    if (!chave || !emissao) return 'novo';
    const ref = `${emissao.slice(0, 7)}-01`;
    const hist = historicoDoCliente(histMap, p.clienteId, p.cliente);
    const compras = comprasMap.get(chave) ?? [emissao];
    const primeira = primeiraEmissaoCliente(chave, hist, compras);
    const ultima = ultimaAntesReferencia(hist, compras, ref);
    return classificarClienteNaReferencia(primeira, ultima, ref);
  };
}

export function resumirClientesRecorrentes(
  pedidos: PedidoRecorrencia[],
  dataInicio: string,
  dataFim: string,
  historico: HistoricoClientePainel[] = []
): ResumoClientesRecorrentes {
  const inicioPeriodo = String(dataInicio ?? '').trim().slice(0, 10);
  const fimPeriodo = String(dataFim ?? '').trim().slice(0, 10);
  const janelaInicio = inicioPeriodo ? menosMeses(inicioPeriodo, 6) : '';
  const janelaFim = inicioPeriodo ? diaAnterior(inicioPeriodo) : '';
  const vazio: ResumoClientesRecorrentes = {
    pct: 0,
    clientes: 0,
    recorrentes: 0,
    reativados: 0,
    novos: 0,
    janelaInicio,
    janelaFim,
    porMes: [],
  };
  if (!inicioPeriodo) return vazio;

  const histMap = indiceHistorico(historico);
  const comprasMap = comprasPorCliente(
    pedidos.filter((p) => {
      const e = ymdValido(p.emissao);
      return Boolean(e && e >= inicioPeriodo && e <= fimPeriodo);
    })
  );

  const tipoNoPeriodo = new Map<string, TipoClientePainel>();
  const mesMap = new Map<
    string,
    { clientes: Set<string>; recorrentes: Set<string>; reativados: Set<string>; novos: Set<string> }
  >();

  for (const [chave, compras] of comprasMap) {
    const hist = histMap.get(chave);
    const primeira = primeiraEmissaoCliente(chave, hist, compras);
    const tipoCard = classificarClienteNaReferencia(
      primeira,
      ultimaAntesReferencia(hist, [], inicioPeriodo),
      inicioPeriodo
    );
    tipoNoPeriodo.set(chave, tipoCard);

    const meses = new Set(compras.map((e) => e.slice(0, 7)));
    for (const mes of meses) {
      const ref = `${mes}-01`;
      const tipoMes = classificarClienteNaReferencia(
        primeira,
        ultimaAntesReferencia(hist, compras, ref),
        ref
      );
      const bucket =
        mesMap.get(mes) ?? {
          clientes: new Set<string>(),
          recorrentes: new Set<string>(),
          reativados: new Set<string>(),
          novos: new Set<string>(),
        };
      bucket.clientes.add(chave);
      if (tipoMes === 'recorrente') bucket.recorrentes.add(chave);
      else if (tipoMes === 'reativado') bucket.reativados.add(chave);
      else bucket.novos.add(chave);
      mesMap.set(mes, bucket);
    }
  }

  let recorrentes = 0;
  let reativados = 0;
  let novos = 0;
  for (const tipo of tipoNoPeriodo.values()) {
    if (tipo === 'recorrente') recorrentes += 1;
    else if (tipo === 'reativado') reativados += 1;
    else novos += 1;
  }
  const clientes = tipoNoPeriodo.size;

  const porMes = [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      const n = v.clientes.size;
      const r = v.recorrentes.size;
      return {
        mes,
        clientes: n,
        recorrentes: r,
        reativados: v.reativados.size,
        novos: v.novos.size,
        pct: n ? round1((r / n) * 100) : 0,
      };
    });

  return {
    pct: clientes ? round1((recorrentes / clientes) * 100) : 0,
    clientes,
    recorrentes,
    reativados,
    novos,
    janelaInicio,
    janelaFim,
    porMes,
  };
}
