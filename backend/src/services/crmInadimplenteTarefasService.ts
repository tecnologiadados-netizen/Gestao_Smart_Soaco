import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/prisma.js';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import {
  buildAgendamentosNomusExistemQuery,
  buildContasAtrasoInadimplenteQuery,
  buildDatasPagamentoNomusPorIdsQuery,
  buildSucessorAgendamentoNomusQuery,
} from '../data/crmFinanceiro/crmQueries.js';
import { nomusQuery } from '../data/crmFinanceiro/nomusQuery.js';
import { EMPRESAS_PAINEL, getEmpresaPainelNome } from '../data/crmFinanceiro/empresaConfig.js';
import {
  DFC_NOMUS_EMPRESA_ACO,
  DFC_NOMUS_EMPRESA_MOVEIS,
  DFC_NOMUS_EMPRESA_REFRIGERACAO,
  DFC_NOMUS_EMPRESA_RN_MARQUES,
  resolverIdEmpresaDfc,
} from '../data/dfcShop9Empresa.js';
import { isNomusEnabled } from '../config/nomusDb.js';
import { criarMatcherTextoLivre } from '../utils/textoLivreBusca.js';
import { formatDataContatoBr } from '../utils/parseObsInadimplente.js';
import {
  listarUsuariosParaDestinatarioPendencia,
  type UsuarioDestinatarioPendencia,
} from './crmCreditoPendenciasService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_SHOP9 = readFileSync(
  join(__dirname, '../data/sql/crmShop9Inadimplentes.sql'),
  'utf-8',
);

const DFC_ID_PARA_CRM: Record<number, number> = {
  [DFC_NOMUS_EMPRESA_ACO]: 1,
  [DFC_NOMUS_EMPRESA_MOVEIS]: 2,
  [DFC_NOMUS_EMPRESA_RN_MARQUES]: 3,
  [DFC_NOMUS_EMPRESA_REFRIGERACAO]: 5,
};

export type StatusTarefaInadimplente = 'aberta' | 'em_contato' | 'concluida';

export type TituloInadimplenteFonte = {
  origem: 'nomus' | 'shop9';
  codigoConta: string;
  clienteNome: string;
  empresaId: number | null;
  empresaNome: string | null;
  banco: string | null;
  tipo: string | null;
  vencimento: string | null;
  valor: number;
  diasAtraso: number;
  nfPd: string | null;
  descricao: string | null;
};

export type TarefaInadimplenteDto = {
  id: number;
  origem: string;
  codigoConta: string;
  clienteNome: string;
  clienteChave: string;
  empresaId: number | null;
  empresaNome: string | null;
  banco: string | null;
  tipo: string | null;
  vencimento: string | null;
  pagamento: string | null;
  dataBaixa: string | null;
  valor: number;
  diasAtraso: number;
  nfPd: string | null;
  descricao: string | null;
  vendedor: string | null;
  status: string;
  responsavelUsuarioId: number | null;
  responsavelNome: string | null;
  responsavelLogin: string | null;
  contatosCount: number;
  concluidaEm: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ContatoTarefaDto = {
  id: number;
  tarefaId: number;
  dataContato: string | null;
  dataContatoBr: string | null;
  texto: string;
  origem: string;
  criadoPorLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClienteContatoErp = {
  email: string | null;
  telefone: string | null;
};

export type SyncTarefasResumo = {
  fontes: number;
  criadas: number;
  atualizadas: number;
  concluidas: number;
  erros: string[];
};

function normalizarClienteChave(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toYmd(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function idsNumericos(codigos: string[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const c of codigos) {
    const n = Number(String(c).trim());
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function fatiar<T>(arr: T[], tamanho: number): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < arr.length; i += tamanho) partes.push(arr.slice(i, i + tamanho));
  return partes;
}

type DatasBaixaRecebimento = {
  dataBaixa: string | null;
  dataRecebimento: string | null;
};

async function listarDatasPagamentoNomus(codigos: string[]): Promise<Map<string, DatasBaixaRecebimento>> {
  const map = new Map<string, DatasBaixaRecebimento>();
  const ids = idsNumericos(codigos);
  if (ids.length === 0 || !isNomusEnabled()) return map;
  try {
    for (const chunk of fatiar(ids, 400)) {
      const q = buildDatasPagamentoNomusPorIdsQuery(chunk);
      const rows = await nomusQuery<{
        codigo: unknown;
        dataBaixa: unknown;
        dataRecebimento: unknown;
      }>(q.sql, q.params);
      for (const r of rows) {
        map.set(String(r.codigo), {
          dataBaixa: toYmd(r.dataBaixa),
          dataRecebimento: toYmd(r.dataRecebimento),
        });
      }
    }
  } catch {
    return map;
  }
  return map;
}

async function listarDatasPagamentoShop9(codigos: string[]): Promise<Map<string, DatasBaixaRecebimento>> {
  const map = new Map<string, DatasBaixaRecebimento>();
  const ids = idsNumericos(codigos);
  if (ids.length === 0 || !isShop9Enabled()) return map;
  try {
    const pool = await getShop9Pool();
    if (!pool) return map;
    for (const chunk of fatiar(ids, 400)) {
      const result = await pool.request().query(`
        SELECT
          fc.Ordem AS codigoConta,
          CAST(fc.Data_Quitacao AS DATE) AS dataBaixa,
          CAST(fc.Data_Quitacao AS DATE) AS dataRecebimento
        FROM Financeiro_Contas fc
        WHERE fc.Ordem IN (${chunk.join(',')})
      `);
      for (const r of (result.recordset ?? []) as Record<string, unknown>[]) {
        const ymd = toYmd(r.dataBaixa ?? r.dataRecebimento);
        map.set(String(r.codigoConta), {
          dataBaixa: ymd,
          dataRecebimento: ymd,
        });
      }
    }
  } catch {
    return map;
  }
  return map;
}

async function mapearDatasPagamentoErp(
  itens: { origem: string; codigoConta: string }[],
): Promise<Map<string, DatasBaixaRecebimento>> {
  const out = new Map<string, DatasBaixaRecebimento>();
  const nomus = itens.filter((i) => i.origem === 'nomus').map((i) => i.codigoConta);
  const shop9 = itens.filter((i) => i.origem === 'shop9').map((i) => i.codigoConta);
  const [nMap, sMap] = await Promise.all([
    listarDatasPagamentoNomus(nomus),
    listarDatasPagamentoShop9(shop9),
  ]);
  for (const [codigo, datas] of nMap) out.set(`nomus:${codigo}`, datas);
  for (const [codigo, datas] of sMap) out.set(`shop9:${codigo}`, datas);
  return out;
}

async function listarIdsNomusExistentes(codigos: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = idsNumericos(codigos);
  if (ids.length === 0 || !isNomusEnabled()) return out;
  for (const chunk of fatiar(ids, 400)) {
    const q = buildAgendamentosNomusExistemQuery(chunk);
    const rows = await nomusQuery<{ codigo: unknown }>(q.sql, q.params);
    for (const r of rows) out.add(String(r.codigo));
  }
  return out;
}

async function listarIdsShop9Existentes(codigos: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = idsNumericos(codigos);
  if (ids.length === 0 || !isShop9Enabled()) return out;
  const pool = await getShop9Pool();
  if (!pool) return out;
  for (const chunk of fatiar(ids, 400)) {
    const result = await pool.request().query(`
      SELECT fc.Ordem AS codigoConta
      FROM Financeiro_Contas fc
      WHERE fc.Ordem IN (${chunk.join(',')})
    `);
    for (const r of (result.recordset ?? []) as Record<string, unknown>[]) {
      out.add(String(r.codigoConta));
    }
  }
  return out;
}

async function mapearIdsExistentesErp(
  itens: { origem: string; codigoConta: string }[],
): Promise<Set<string>> {
  const nomus = itens.filter((i) => i.origem === 'nomus').map((i) => i.codigoConta);
  const shop9 = itens.filter((i) => i.origem === 'shop9').map((i) => i.codigoConta);
  const [nSet, sSet] = await Promise.all([
    listarIdsNomusExistentes(nomus),
    listarIdsShop9Existentes(shop9),
  ]);
  const out = new Set<string>();
  for (const codigo of nSet) out.add(`nomus:${codigo}`);
  for (const codigo of sSet) out.add(`shop9:${codigo}`);
  return out;
}

function chaveNegocioTarefa(row: {
  clienteChave: string;
  empresaId: number | null;
  vencimento: string | null;
  valor: number;
}): string {
  return `${row.clienteChave}|${row.empresaId ?? ''}|${row.vencimento ?? ''}|${row.valor.toFixed(2)}`;
}

async function moverContatosTarefa(deId: number, paraId: number): Promise<void> {
  if (deId === paraId) return;
  await prisma.crmInadimplenteTarefaContato.updateMany({
    where: { tarefaId: deId },
    data: { tarefaId: paraId },
  });
}

async function mesclarOuRetargetNomus(
  origem: { id: number; codigoConta: string },
  novoCodigo: string,
): Promise<{ id: number; codigoConta: string }> {
  if (origem.codigoConta === novoCodigo) return origem;
  const destino = await prisma.crmInadimplenteTarefa.findUnique({
    where: { origem_codigoConta: { origem: 'nomus', codigoConta: novoCodigo } },
  });
  if (destino && destino.id !== origem.id) {
    await moverContatosTarefa(origem.id, destino.id);
    await prisma.crmInadimplenteTarefa.delete({ where: { id: origem.id } });
    return { id: destino.id, codigoConta: destino.codigoConta };
  }
  await prisma.crmInadimplenteTarefa.update({
    where: { id: origem.id },
    data: { codigoConta: novoCodigo },
  });
  return { id: origem.id, codigoConta: novoCodigo };
}

async function buscarSucessorNomus(row: {
  clienteNome: string;
  vencimento: string | null;
  valor: number;
  empresaNome: string | null;
}): Promise<string | null> {
  if (!row.vencimento || !isNomusEnabled()) return null;
  const q = buildSucessorAgendamentoNomusQuery({
    pessoa: row.clienteNome,
    vencimentoYmd: row.vencimento,
    valor: row.valor,
    empresaNome: row.empresaNome,
  });
  const rows = await nomusQuery<{ codigo: unknown }>(q.sql, q.params);
  const codigo = rows[0]?.codigo;
  return codigo == null ? null : String(codigo);
}

async function concluirTarefasComDatas(
  itens: { id: number; origem: string; codigoConta: string }[],
  agora: Date,
  erros: string[],
): Promise<number> {
  const unicos = new Map<number, { id: number; origem: string; codigoConta: string }>();
  for (const item of itens) unicos.set(item.id, item);
  const lista = [...unicos.values()];
  for (const row of lista) {
    await prisma.crmInadimplenteTarefa.update({
      where: { id: row.id },
      data: { status: 'concluida', concluidaEm: agora, lastSeenAt: agora },
    });
  }
  try {
    const datasPagamento = await mapearDatasPagamentoErp(lista);
    for (const row of lista) {
      const datas = datasPagamento.get(`${row.origem}:${row.codigoConta}`);
      if (!datas) continue;
      await prisma.crmInadimplenteTarefa.update({
        where: { id: row.id },
        data: {
          pagamento: datas.dataRecebimento,
          dataBaixa: datas.dataBaixa,
        },
      });
    }
  } catch (e) {
    erros.push(`ERP (datas de baixa): ${e instanceof Error ? e.message : String(e)}`);
  }
  return lista.length;
}

/** Une duplicatas Nomus (id antigo × id atual) e conclui o que já não está em aberto. */
async function reconciliarTarefasNomus(
  vistos: Set<string>,
  agora: Date,
  erros: string[],
  podeConcluirForaDaFila: boolean,
): Promise<number> {
  const locais = await prisma.crmInadimplenteTarefa.findMany({ where: { origem: 'nomus' } });
  if (locais.length === 0) return 0;

  const grupos = new Map<string, typeof locais>();
  for (const row of locais) {
    const chave = chaveNegocioTarefa(row);
    const arr = grupos.get(chave) ?? [];
    arr.push(row);
    grupos.set(chave, arr);
  }

  let existentesGrupo = new Set<string>();
  try {
    existentesGrupo = await listarIdsNomusExistentes(locais.map((r) => r.codigoConta));
  } catch (e) {
    erros.push(`Nomus (existência): ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }

  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const naFila = grupo.filter((g) => vistos.has(`nomus:${g.codigoConta}`));
    const vivos = grupo.filter((g) => existentesGrupo.has(g.codigoConta));
    const ordena = (a: (typeof grupo)[number], b: (typeof grupo)[number]) =>
      (Number(b.codigoConta) || 0) - (Number(a.codigoConta) || 0);
    const winner = [...naFila].sort(ordena)[0] ?? [...vivos].sort(ordena)[0] ?? [...grupo].sort(ordena)[0];
    if (!winner) continue;
    for (const loser of grupo) {
      if (loser.id === winner.id) continue;
      await moverContatosTarefa(loser.id, winner.id);
      await prisma.crmInadimplenteTarefa.delete({ where: { id: loser.id } });
    }
  }

  const restantes = await prisma.crmInadimplenteTarefa.findMany({ where: { origem: 'nomus' } });
  const fora = restantes.filter((r) => !vistos.has(`nomus:${r.codigoConta}`));
  let existentes = existentesGrupo;
  try {
    existentes = await listarIdsNomusExistentes(fora.map((r) => r.codigoConta));
  } catch (e) {
    erros.push(`Nomus (existência 2): ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }

  const paraConcluir: { id: number; origem: string; codigoConta: string }[] = [];
  for (const row of fora) {
    if (existentes.has(row.codigoConta)) {
      if (podeConcluirForaDaFila) {
        paraConcluir.push({ id: row.id, origem: 'nomus', codigoConta: row.codigoConta });
      }
      continue;
    }
    try {
      const sucessor = await buscarSucessorNomus(row);
      if (sucessor && sucessor !== row.codigoConta) {
        const vivo = await mesclarOuRetargetNomus(row, sucessor);
        if (podeConcluirForaDaFila && !vistos.has(`nomus:${vivo.codigoConta}`)) {
          paraConcluir.push({ id: vivo.id, origem: 'nomus', codigoConta: vivo.codigoConta });
        }
      } else {
        await prisma.crmInadimplenteTarefa.delete({ where: { id: row.id } });
      }
    } catch (e) {
      erros.push(`Nomus sucessor ${row.codigoConta}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!podeConcluirForaDaFila) return 0;
  return concluirTarefasComDatas(paraConcluir, agora, erros);
}

function mapEmpresaCrm(id: number | null, nome: string | null): {
  empresaId: number | null;
  empresaNome: string | null;
} {
  if (id != null && EMPRESAS_PAINEL.some((e) => e.id === id)) {
    return { empresaId: id, empresaNome: getEmpresaPainelNome(id) ?? nome };
  }
  const n = (nome ?? '').trim().toUpperCase();
  const byName = EMPRESAS_PAINEL.find((e) => e.nome.toUpperCase() === n);
  if (byName) return { empresaId: byName.id, empresaNome: byName.nome };
  return { empresaId: id, empresaNome: nome };
}

async function listarTitulosNomus(): Promise<{ titulos: TituloInadimplenteFonte[]; erro?: string }> {
  if (!isNomusEnabled()) return { titulos: [], erro: 'Nomus não configurado' };
  try {
    const q = buildContasAtrasoInadimplenteQuery();
    const rows = await nomusQuery<Record<string, unknown>>(q.sql, q.params);
    const titulos: TituloInadimplenteFonte[] = [];
    for (const r of rows) {
      const cliente = String(r.pessoa ?? '').trim();
      if (!cliente) continue;
      const emp = mapEmpresaCrm(
        r.empresaId != null ? Number(r.empresaId) : null,
        r.empresa != null ? String(r.empresa) : null,
      );
      titulos.push({
        origem: 'nomus',
        codigoConta: String(r.codigo ?? ''),
        clienteNome: cliente,
        empresaId: emp.empresaId,
        empresaNome: emp.empresaNome,
        banco: r.contaBancaria != null ? String(r.contaBancaria) : null,
        tipo: r.formaPagamento != null ? String(r.formaPagamento) : null,
        vencimento: toYmd(r.dataVencimento),
        valor: Math.abs(toNum(r.valorSaldo)),
        diasAtraso: Math.max(0, Math.trunc(toNum(r.diasAtraso))),
        nfPd: r.nfeOrigem != null ? String(r.nfeOrigem) : null,
        descricao: r.descricao != null ? String(r.descricao) : null,
      });
    }
    return { titulos: titulos.filter((t) => t.codigoConta && t.valor > 0) };
  } catch (e) {
    return { titulos: [], erro: e instanceof Error ? e.message : String(e) };
  }
}

async function listarTitulosShop9(): Promise<{ titulos: TituloInadimplenteFonte[]; erro?: string }> {
  if (!isShop9Enabled()) return { titulos: [], erro: 'Shop9 não configurado' };
  try {
    const pool = await getShop9Pool();
    if (!pool) return { titulos: [], erro: 'Shop9: falha ao conectar' };
    const result = await pool.request().query(SQL_SHOP9);
    const raw = (result.recordset ?? []) as Record<string, unknown>[];
    const titulos: TituloInadimplenteFonte[] = [];
    for (const r of raw) {
      const cliente = String(r.clienteNome ?? r.clienteFantasia ?? '').trim();
      if (!cliente) continue;
      const dfcId = resolverIdEmpresaDfc({
        empresa: r.nomeFilial != null ? String(r.nomeFilial) : null,
        centrocusto: r.centrocusto != null ? String(r.centrocusto) : null,
        nomeFilial: r.nomeFilial != null ? String(r.nomeFilial) : null,
        ordemFilial: toNum(r.ordemFilial),
      });
      const crmId = dfcId != null ? DFC_ID_PARA_CRM[dfcId] ?? null : null;
      const emp = mapEmpresaCrm(crmId, crmId != null ? getEmpresaPainelNome(crmId) : null);
      titulos.push({
        origem: 'shop9',
        codigoConta: String(r.codigoConta ?? ''),
        clienteNome: cliente,
        empresaId: emp.empresaId,
        empresaNome: emp.empresaNome,
        banco: r.banco != null ? String(r.banco) : null,
        tipo: r.tipoConta != null ? String(r.tipoConta) : 'Receber',
        vencimento: toYmd(r.dataVencimento),
        valor: Math.abs(toNum(r.valorSaldo)),
        diasAtraso: Math.max(0, Math.trunc(toNum(r.diasAtraso))),
        nfPd: null,
        descricao: r.descricao != null ? String(r.descricao) : null,
      });
    }
    return { titulos: titulos.filter((t) => t.codigoConta && t.valor > 0) };
  } catch (e) {
    return { titulos: [], erro: e instanceof Error ? e.message : String(e) };
  }
}

async function nomesResponsaveis(ids: number[]): Promise<Map<number, { nome: string | null; login: string }>> {
  const map = new Map<number, { nome: string | null; login: string }>();
  if (ids.length === 0) return map;
  const rows = await prisma.usuario.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, nome: true, login: true },
  });
  for (const u of rows) map.set(u.id, { nome: u.nome, login: u.login });
  return map;
}

function mapTarefa(
  row: {
    id: number;
    origem: string;
    codigoConta: string;
    clienteNome: string;
    clienteChave: string;
    empresaId: number | null;
    empresaNome: string | null;
    banco: string | null;
    tipo: string | null;
    vencimento: string | null;
    pagamento: string | null;
    dataBaixa: string | null;
    valor: number;
    diasAtraso: number;
    nfPd: string | null;
    descricao: string | null;
    vendedor: string | null;
    status: string;
    responsavelUsuarioId: number | null;
    concluidaEm: Date | null;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
    _count?: { contatos: number };
  },
  resp: Map<number, { nome: string | null; login: string }>,
): TarefaInadimplenteDto {
  const u = row.responsavelUsuarioId != null ? resp.get(row.responsavelUsuarioId) : undefined;
  return {
    id: row.id,
    origem: row.origem,
    codigoConta: row.codigoConta,
    clienteNome: row.clienteNome,
    clienteChave: row.clienteChave,
    empresaId: row.empresaId,
    empresaNome: row.empresaNome,
    banco: row.banco,
    tipo: row.tipo,
    vencimento: row.vencimento,
    pagamento: row.pagamento,
    dataBaixa: row.dataBaixa,
    valor: row.valor,
    diasAtraso: row.diasAtraso,
    nfPd: row.nfPd,
    descricao: row.descricao,
    vendedor: row.vendedor,
    status: row.status,
    responsavelUsuarioId: row.responsavelUsuarioId,
    responsavelNome: u?.nome ?? null,
    responsavelLogin: u?.login ?? null,
    contatosCount: row._count?.contatos ?? 0,
    concluidaEm: row.concluidaEm ? row.concluidaEm.toISOString() : null,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function obterConfigResponsavel(): Promise<{
  responsavelUsuarioId: number | null;
  responsavel: UsuarioDestinatarioPendencia | null;
  usuarios: UsuarioDestinatarioPendencia[];
  updatedAt: string | null;
  updatedByLogin: string | null;
}> {
  const [cfg, usuarios] = await Promise.all([
    prisma.crmInadimplenteTarefaConfig.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }),
    listarUsuariosParaDestinatarioPendencia(prisma),
  ]);
  const responsavel =
    cfg.responsavelUsuarioId != null
      ? usuarios.find((u) => u.id === cfg.responsavelUsuarioId) ?? null
      : null;
  return {
    responsavelUsuarioId: cfg.responsavelUsuarioId,
    responsavel,
    usuarios,
    updatedAt: cfg.updatedAt.toISOString(),
    updatedByLogin: cfg.updatedByLogin,
  };
}

export async function salvarConfigResponsavel(
  usuarioId: number | null,
  login: string | null,
): Promise<{
  responsavelUsuarioId: number | null;
  responsavel: UsuarioDestinatarioPendencia | null;
  usuarios: UsuarioDestinatarioPendencia[];
  updatedAt: string | null;
  updatedByLogin: string | null;
}> {
  if (usuarioId != null) {
    const u = await prisma.usuario.findFirst({ where: { id: usuarioId, ativo: true } });
    if (!u) throw new Error('Usuário responsável inválido ou inativo.');
  }
  await prisma.crmInadimplenteTarefaConfig.upsert({
    where: { id: 1 },
    create: { id: 1, responsavelUsuarioId: usuarioId, updatedByLogin: login },
    update: { responsavelUsuarioId: usuarioId, updatedByLogin: login },
  });
  return obterConfigResponsavel();
}

export async function sincronizarTarefasInadimplentes(): Promise<SyncTarefasResumo> {
  const agora = new Date();
  const erros: string[] = [];
  const [nomus, shop9, cfg] = await Promise.all([
    listarTitulosNomus(),
    listarTitulosShop9(),
    prisma.crmInadimplenteTarefaConfig.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }),
  ]);
  if (nomus.erro) erros.push(`Nomus: ${nomus.erro}`);
  if (shop9.erro) erros.push(`Shop9: ${shop9.erro}`);

  const titulos = [...nomus.titulos, ...shop9.titulos];
  const nomusOk = !nomus.erro;
  const shop9Ok = !shop9.erro;
  const vistos = new Set<string>();
  let criadas = 0;
  let atualizadas = 0;

  for (const t of titulos) {
    const key = `${t.origem}:${t.codigoConta}`;
    vistos.add(key);
    const existente = await prisma.crmInadimplenteTarefa.findUnique({
      where: { origem_codigoConta: { origem: t.origem, codigoConta: t.codigoConta } },
    });
    const dataBase = {
      clienteNome: t.clienteNome,
      clienteChave: normalizarClienteChave(t.clienteNome),
      empresaId: t.empresaId,
      empresaNome: t.empresaNome,
      banco: t.banco,
      tipo: t.tipo,
      vencimento: t.vencimento,
      pagamento: null,
      dataBaixa: null,
      valor: t.valor,
      diasAtraso: t.diasAtraso,
      nfPd: t.nfPd,
      descricao: t.descricao,
      lastSeenAt: agora,
    };
    if (!existente) {
      await prisma.crmInadimplenteTarefa.create({
        data: {
          origem: t.origem,
          codigoConta: t.codigoConta,
          ...dataBase,
          status: 'aberta',
          responsavelUsuarioId: cfg.responsavelUsuarioId,
        },
      });
      criadas++;
      continue;
    }
    const reabre = existente.status === 'concluida';
    await prisma.crmInadimplenteTarefa.update({
      where: { id: existente.id },
      data: {
        ...dataBase,
        ...(reabre
          ? {
              status: 'aberta',
              concluidaEm: null,
              responsavelUsuarioId: existente.responsavelUsuarioId ?? cfg.responsavelUsuarioId,
            }
          : {}),
      },
    });
    atualizadas++;
  }

  const abertasShop9 = await prisma.crmInadimplenteTarefa.findMany({
    where: { status: { not: 'concluida' }, origem: 'shop9' },
    select: { id: true, origem: true, codigoConta: true },
  });
  const paraConcluirShop9 = abertasShop9.filter((row) => {
    if (!shop9Ok) return false;
    return !vistos.has(`${row.origem}:${row.codigoConta}`);
  });

  let existentesShop9 = new Set<string>();
  try {
    existentesShop9 = await mapearIdsExistentesErp(paraConcluirShop9);
  } catch (e) {
    erros.push(`Shop9 (existência): ${e instanceof Error ? e.message : String(e)}`);
    existentesShop9 = new Set(paraConcluirShop9.map((r) => `${r.origem}:${r.codigoConta}`));
  }
  const fantasmasShop9 = paraConcluirShop9.filter(
    (row) => !existentesShop9.has(`${row.origem}:${row.codigoConta}`),
  );
  const baixadosShop9 = paraConcluirShop9.filter((row) =>
    existentesShop9.has(`${row.origem}:${row.codigoConta}`),
  );
  for (const row of fantasmasShop9) {
    await prisma.crmInadimplenteTarefa.delete({ where: { id: row.id } });
  }

  const concluidasShop9 = await concluirTarefasComDatas(baixadosShop9, agora, erros);
  const concluidasNomus = await reconciliarTarefasNomus(vistos, agora, erros, nomusOk);

  return {
    fontes: titulos.length,
    criadas,
    atualizadas,
    concluidas: concluidasShop9 + concluidasNomus,
    erros,
  };
}

export async function listarTarefasInadimplentes(opts?: {
  q?: string;
  status?: string;
  sync?: boolean;
}): Promise<{ data: TarefaInadimplenteDto[]; sync: SyncTarefasResumo | null }> {
  let sync: SyncTarefasResumo | null = null;
  const vazia = (await prisma.crmInadimplenteTarefa.count()) === 0;
  if (opts?.sync || vazia) {
    sync = await sincronizarTarefasInadimplentes();
  }

  const status = opts?.status?.trim();
  const rows = await prisma.crmInadimplenteTarefa.findMany({
    where: status && status !== 'todas' ? { status } : undefined,
    include: { _count: { select: { contatos: true } } },
    orderBy: [{ status: 'asc' }, { vencimento: 'asc' }, { id: 'asc' }],
  });
  const resp = await nomesResponsaveis(
    rows.map((r) => r.responsavelUsuarioId).filter((id): id is number => id != null),
  );
  let data = rows.map((r) => mapTarefa(r, resp));
  const q = opts?.q?.trim();
  if (q) {
    const match = criarMatcherTextoLivre(q);
    data = data.filter(
      (r) =>
        match(r.clienteNome) ||
        match(r.empresaNome ?? '') ||
        match(r.banco ?? '') ||
        match(r.codigoConta) ||
        match(r.nfPd ?? '') ||
        match(r.responsavelNome ?? '') ||
        match(r.responsavelLogin ?? ''),
    );
  }
  return { data, sync };
}

export async function atualizarTarefaInadimplente(
  id: number,
  patch: { status?: StatusTarefaInadimplente; responsavelUsuarioId?: number | null },
): Promise<TarefaInadimplenteDto | null> {
  const existing = await prisma.crmInadimplenteTarefa.findUnique({
    where: { id },
    include: { _count: { select: { contatos: true } } },
  });
  if (!existing) return null;
  if (patch.responsavelUsuarioId != null) {
    const u = await prisma.usuario.findFirst({
      where: { id: patch.responsavelUsuarioId, ativo: true },
    });
    if (!u) throw new Error('Usuário responsável inválido ou inativo.');
  }
  const status = patch.status;
  const row = await prisma.crmInadimplenteTarefa.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(status === 'concluida' ? { concluidaEm: new Date() } : {}),
      ...(status && status !== 'concluida' ? { concluidaEm: null } : {}),
      ...(patch.responsavelUsuarioId !== undefined
        ? { responsavelUsuarioId: patch.responsavelUsuarioId }
        : {}),
    },
    include: { _count: { select: { contatos: true } } },
  });
  const resp = await nomesResponsaveis(
    row.responsavelUsuarioId != null ? [row.responsavelUsuarioId] : [],
  );
  return mapTarefa(row, resp);
}

function mapContato(row: {
  id: number;
  tarefaId: number;
  dataContato: Date | null;
  texto: string;
  origem: string;
  criadoPorLogin: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ContatoTarefaDto {
  return {
    id: row.id,
    tarefaId: row.tarefaId,
    dataContato: row.dataContato ? row.dataContato.toISOString() : null,
    dataContatoBr: formatDataContatoBr(row.dataContato),
    texto: row.texto,
    origem: row.origem,
    criadoPorLogin: row.criadoPorLogin,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function formatarTelefoneBr(raw: unknown): string | null {
  let d = soDigitos(raw);
  if (!d) return null;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d.length >= 8 ? d : null;
}

function montarTelefonePartes(ddd: unknown, prefixo: unknown, numero: unknown): string | null {
  let n = soDigitos(numero);
  if (n.length < 8) return null;
  const d = soDigitos(ddd).slice(-2);
  const p = soDigitos(prefixo);
  if (n.length <= 9) {
    if (p && p.length <= 2 && !n.startsWith(p)) n = p + n;
    if (d.length === 2 && !n.startsWith(d)) n = d + n;
  }
  return formatarTelefoneBr(n);
}

function juntarTelefones(...partes: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const parte of partes) {
    for (const pedaco of String(parte ?? '').split(/[·;/|,]+/)) {
      const fmt = formatarTelefoneBr(pedaco) ?? montarTelefonePartes('', '', pedaco);
      if (!fmt) continue;
      const k = soDigitos(fmt);
      if (k.length < 8 || seen.has(k)) continue;
      seen.add(k);
      out.push(fmt);
    }
  }
  return out.length ? out.join(' · ') : null;
}

function juntarContatos(...partes: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const parte of partes) {
    for (const pedaco of String(parte ?? '').split(/[;/|,]+/)) {
      const t = pedaco.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out.length ? out.join(' · ') : null;
}

type NomusSchemaContato = {
  pessoaCols: Set<string>;
  contatoCols: Set<string>;
  temPessoaContato: boolean;
  temTelefone: boolean;
  endereco: { table: string; idCol: string; emailCol: string | null; telCol: string | null } | null;
};

let nomusSchemaContato: NomusSchemaContato | null = null;

async function tabelasNomus(nomes: string[]): Promise<Set<string>> {
  if (nomes.length === 0) return new Set();
  const ph = nomes.map(() => '?').join(',');
  const rows = await nomusQuery<{ TABLE_NAME: string }>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${ph})`,
    nomes,
  );
  return new Set(rows.map((r) => String(r.TABLE_NAME)));
}

async function colunasNomus(tabela: string): Promise<Set<string>> {
  const rows = await nomusQuery<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabela],
  );
  return new Set(rows.map((r) => String(r.COLUMN_NAME)));
}

function colNomus(cols: Set<string>, candidatos: string[]): string | null {
  const lower = new Map([...cols].map((c) => [c.toLowerCase(), c]));
  for (const cand of candidatos) {
    const hit = lower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

async function schemaContatoNomus(): Promise<NomusSchemaContato> {
  if (nomusSchemaContato) return nomusSchemaContato;
  const tabelas = await tabelasNomus([
    'pessoa',
    'telefone',
    'contato',
    'pessoa_contato',
    'endereco',
    'enderecopessoa',
    'pessoa_endereco',
  ]);
  const pessoaCols = tabelas.has('pessoa') ? await colunasNomus('pessoa') : new Set<string>();
  const contatoCols = tabelas.has('contato') ? await colunasNomus('contato') : new Set<string>();
  let endereco: NomusSchemaContato['endereco'] = null;
  for (const table of ['endereco', 'enderecopessoa', 'pessoa_endereco']) {
    if (!tabelas.has(table)) continue;
    const cols = await colunasNomus(table);
    const idCol = colNomus(cols, ['idPessoa', 'idEntidade', 'idParceiro']);
    if (!idCol) continue;
    endereco = {
      table,
      idCol,
      emailCol: colNomus(cols, ['email']),
      telCol: colNomus(cols, ['telefone', 'fone', 'numeroTelefone']),
    };
    break;
  }
  nomusSchemaContato = {
    pessoaCols,
    contatoCols,
    temPessoaContato: tabelas.has('pessoa_contato') && tabelas.has('contato'),
    temTelefone: tabelas.has('telefone'),
    endereco,
  };
  return nomusSchemaContato;
}

async function buscarContatoNomus(
  clienteNome: string,
  codigoConta?: string,
): Promise<ClienteContatoErp> {
  const nome = clienteNome.trim();
  if (!isNomusEnabled()) return { email: null, telefone: null };
  const schema = await schemaContatoNomus();

  const emails: Array<string | null> = [];
  const fones: Array<string | null> = [];

  const contaId = Number(codigoConta);
  let pessoaId: number | null = null;
  if (Number.isFinite(contaId) && contaId > 0) {
    const af = await nomusQuery<{ idPessoa: number | null }>(
      `SELECT af.idPessoa AS idPessoa FROM agendamentofinanceiro af WHERE af.id = ? LIMIT 1`,
      [contaId],
    );
    const id = af[0]?.idPessoa != null ? Number(af[0].idPessoa) : NaN;
    if (Number.isFinite(id) && id > 0) pessoaId = id;
  }

  const colEmailPes = colNomus(schema.pessoaCols, ['email']);
  const colTelPes = colNomus(schema.pessoaCols, ['telefone', 'fone']);
  const colDddPes = colNomus(schema.pessoaCols, ['DDD', 'ddd']);
  const selectPes = [
    'pes.id AS id',
    colEmailPes ? `NULLIF(TRIM(pes.\`${colEmailPes}\`), '') AS email` : 'NULL AS email',
    colTelPes
      ? `NULLIF(TRIM(CONCAT(${
          colDddPes
            ? `IF(pes.\`${colDddPes}\` IS NULL OR TRIM(pes.\`${colDddPes}\`) = '', '', CONCAT('(', TRIM(pes.\`${colDddPes}\`), ') '))`
            : `''`
        }, pes.\`${colTelPes}\`)), '') AS telefonePes`
      : 'NULL AS telefonePes',
  ].join(', ');

  const pesRows = pessoaId
    ? await nomusQuery<{ id: number; email: string | null; telefonePes: string | null }>(
        `SELECT ${selectPes} FROM pessoa pes WHERE pes.id = ? LIMIT 1`,
        [pessoaId],
      )
    : nome
      ? await nomusQuery<{ id: number; email: string | null; telefonePes: string | null }>(
          `SELECT ${selectPes} FROM pessoa pes
           WHERE pes.nome = ? OR pes.nomeRazaoSocial = ?
           ORDER BY pes.ativo DESC, pes.id ASC
           LIMIT 1`,
          [nome, nome],
        )
      : [];
  const pes = pesRows[0];
  if (!pes?.id) return { email: null, telefone: null };
  pessoaId = Number(pes.id);
  emails.push(pes.email);
  fones.push(pes.telefonePes);

  if (schema.temTelefone) {
    const telsPessoa = await nomusQuery<Record<string, unknown>>(
      `SELECT t.*
       FROM telefone t
       WHERE t.idEntidade = ?
         AND t.discriminador = 'P'
         AND TRIM(IFNULL(t.numero, '')) <> ''
       ORDER BY t.telefonePrincipal DESC, t.id ASC
       LIMIT 12`,
      [pessoaId],
    );
    for (const r of telsPessoa) fones.push(...telefonesDeLinhaErp(r));
  }

  if (schema.temPessoaContato) {
    const emailCols = ['email_1', 'email_2', 'email_3', 'email_4', 'email_5', 'email1', 'email']
      .map((c) => colNomus(schema.contatoCols, [c]))
      .filter((c, i, arr): c is string => Boolean(c) && arr.indexOf(c) === i);
    const colAtivoContato = colNomus(schema.contatoCols, ['ativo']);
    const ativoClause = colAtivoContato ? `AND IFNULL(c.\`${colAtivoContato}\`, 1) = 1` : '';
    const extraEmailSelect = emailCols.length
      ? `, ${emailCols.map((c) => `NULLIF(TRIM(c.\`${c}\`), '') AS \`${c}\``).join(', ')}`
      : '';
    const contatos = await nomusQuery<{ id: number } & Record<string, string | null>>(
      `SELECT c.id AS id${extraEmailSelect}
       FROM pessoa_contato pc
       INNER JOIN contato c ON c.id = pc.idContato
       WHERE pc.idParceiro = ?
         ${ativoClause}
       ORDER BY c.id ASC
       LIMIT 20`,
      [pessoaId],
    );
    const idsContato: number[] = [];
    for (const c of contatos) {
      idsContato.push(Number(c.id));
      for (const col of emailCols) emails.push(c[col]);
    }
    if (schema.temTelefone && idsContato.length > 0) {
      const ph = idsContato.map(() => '?').join(',');
      const telsC = await nomusQuery<Record<string, unknown>>(
        `SELECT t.*
         FROM telefone t
         WHERE t.discriminador = 'C'
           AND t.idEntidade IN (${ph})
           AND TRIM(IFNULL(t.numero, '')) <> ''
         ORDER BY t.telefonePrincipal DESC, t.id ASC
         LIMIT 20`,
        idsContato,
      );
      for (const r of telsC) fones.push(...telefonesDeLinhaErp(r));
    }
  }

  if (schema.endereco && (schema.endereco.emailCol || schema.endereco.telCol)) {
    const e = schema.endereco;
    const parts = [
      e.emailCol ? `NULLIF(TRIM(en.\`${e.emailCol}\`), '') AS email` : 'NULL AS email',
      e.telCol ? `NULLIF(TRIM(en.\`${e.telCol}\`), '') AS telefone` : 'NULL AS telefone',
    ];
    const ativo = (await colunasNomus(e.table)).has('ativo') ? 'AND IFNULL(en.ativo, 1) = 1' : '';
    const endRows = await nomusQuery<{ email: string | null; telefone: string | null }>(
      `SELECT ${parts.join(', ')}
       FROM \`${e.table}\` en
       WHERE en.\`${e.idCol}\` = ?
         ${ativo}
       LIMIT 12`,
      [pessoaId],
    );
    for (const r of endRows) {
      emails.push(r.email);
      fones.push(r.telefone);
    }
  }

  return {
    email: juntarContatos(...emails),
    telefone: juntarTelefones(...fones),
  };
}

let shop9SchemaContato: {
  contatoTable: string | null;
  contatoFkCols: string[];
} | null = null;

function nomePareceContatoShop9(col: string): 'email' | 'fone' | null {
  const n = col.toLowerCase().replace(/[\s_]/g, '');
  if (
    n === 'contato' ||
    n === 'nome' ||
    n === 'fantasia' ||
    n.includes('obs') ||
    n.includes('tipo') ||
    n.includes('envia') ||
    n.includes('recebe') ||
    n.includes('ativo') ||
    n.includes('principal') ||
    n.includes('whats') ||
    n.endsWith('ide') ||
    n.includes('ordem')
  ) {
    return null;
  }
  if (/email/.test(n) || n.includes('mail')) return 'email';
  if (/fone|telefone|celular|fax/.test(n)) return 'fone';
  return null;
}

function valorEhFlagBooleana(raw: unknown): boolean {
  if (typeof raw === 'boolean') return true;
  if (raw === 0 || raw === 1) return true;
  const t = String(raw ?? '').trim().toLowerCase();
  return t === 'true' || t === 'false' || t === '0' || t === '1';
}

function valorCol(row: Record<string, unknown>, ...candidatos: string[]): unknown {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(k.toLowerCase().replace(/[\s_]/g, ''), v);
  }
  for (const c of candidatos) {
    const hit = map.get(c.toLowerCase().replace(/[\s_]/g, ''));
    if (hit != null && String(hit).trim() !== '' && !valorEhFlagBooleana(hit)) return hit;
  }
  return '';
}

function telefonesDeLinhaErp(row: Record<string, unknown>): string[] {
  const grupos: Array<{ ddd: string[]; pref: string[]; num: string[] }> = [
    {
      ddd: ['ddd', 'ddd1', 'dddfone', 'dddtelefone', 'dddtel'],
      pref: ['prefixo', 'prefixofone', 'nono', 'nonodigito'],
      num: ['fone', 'telefone', 'tel', 'fone1', 'telefone1', 'numero'],
    },
    {
      ddd: ['ddd2', 'dddfone2', 'dddtelefone2'],
      pref: ['prefixo2'],
      num: ['fone2', 'telefone2', 'tel2'],
    },
    {
      ddd: ['dddcel', 'dddcelular', 'dddcel1'],
      pref: ['prefixocel'],
      num: ['celular', 'cel', 'cel1'],
    },
    { ddd: ['dddfax'], pref: [], num: ['fax'] },
  ];
  const out: string[] = [];
  const used = new Set<string>();
  for (const g of grupos) {
    const num = valorCol(row, ...g.num);
    const nd = soDigitos(num);
    if (nd.length < 8 || used.has(nd)) continue;
    used.add(nd);
    const fmt = montarTelefonePartes(valorCol(row, ...g.ddd), valorCol(row, ...g.pref), num);
    if (fmt) out.push(fmt);
  }
  return out;
}

function coletarContatoDeRow(row: Record<string, unknown> | undefined): {
  emails: string[];
  fones: string[];
} {
  const emails: string[] = [];
  if (!row) return { emails, fones: [] };
  for (const [col, raw] of Object.entries(row)) {
    if (raw == null || valorEhFlagBooleana(raw)) continue;
    if (nomePareceContatoShop9(col) !== 'email') continue;
    const t = String(raw).trim();
    if (t.includes('@')) emails.push(t);
  }
  return { emails, fones: telefonesDeLinhaErp(row) };
}

async function schemaContatoShop9(pool: NonNullable<Awaited<ReturnType<typeof getShop9Pool>>>): Promise<{
  contatoTable: string | null;
  contatoFkCols: string[];
}> {
  if (shop9SchemaContato) return shop9SchemaContato;
  const tabs = await pool.request().query<{ name: string }>(`
    SELECT t.name
    FROM sys.tables t
    WHERE t.name IN ('Cli_For_Contato', 'Cli_For_Contatos', 'CliFor_Contato')
  `);
  const contatoTable = tabs.recordset[0]?.name ?? null;
  const contatoFkCols: string[] = [];
  if (contatoTable) {
    const cols = await pool.request().input('tab', contatoTable).query<{ name: string }>(`
      SELECT c.name
      FROM sys.columns c
      INNER JOIN sys.tables t ON t.object_id = c.object_id
      WHERE t.name = @tab
    `);
    for (const c of cols.recordset) {
      const n = String(c.name);
      if (/cli.?for|__ide|ordem_cli/i.test(n)) contatoFkCols.push(n);
    }
  }
  shop9SchemaContato = { contatoTable, contatoFkCols };
  return shop9SchemaContato;
}

async function buscarContatoShop9(
  codigoConta: string,
  clienteNome: string,
): Promise<ClienteContatoErp> {
  if (!isShop9Enabled()) return { email: null, telefone: null };
  const pool = await getShop9Pool();
  if (!pool) return { email: null, telefone: null };

  const emails: string[] = [];
  const fones: string[] = [];
  const ordem = Number(codigoConta);
  const req = pool.request();
  let sql = `
    SELECT TOP 1 cf.*
    FROM Financeiro_Contas fc
    INNER JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
    WHERE fc.Ordem = @ordem
  `;
  if (Number.isFinite(ordem) && ordem > 0) {
    req.input('ordem', ordem);
  } else {
    sql = `
      SELECT TOP 1 cf.*
      FROM Cli_For cf
      WHERE LTRIM(RTRIM(cf.Nome)) = @nome
    `;
    req.input('nome', clienteNome.trim());
  }

  const result = await req.query<Record<string, unknown>>(sql);
  let cf = (result.recordset ?? [])[0];
  if (!cf && Number.isFinite(ordem) && ordem > 0 && clienteNome.trim()) {
    const byName = await pool.request().input('nome', clienteNome.trim()).query<Record<string, unknown>>(`
      SELECT TOP 1 cf.*
      FROM Cli_For cf
      WHERE LTRIM(RTRIM(cf.Nome)) = @nome
    `);
    cf = (byName.recordset ?? [])[0];
  }
  const doCadastro = coletarContatoDeRow(cf);
  emails.push(...doCadastro.emails);
  fones.push(...doCadastro.fones);

  const schema = await schemaContatoShop9(pool);
  if (schema.contatoTable && cf && schema.contatoFkCols.length > 0) {
    const ide = cf.ide ?? cf.Ide ?? cf.IDE ?? cf.Ordem;
    const ordemCf = cf.Ordem ?? ordem;
    const ctcReq = pool.request();
    const wheres: string[] = [];
    schema.contatoFkCols.forEach((col, i) => {
      const p = `fk${i}`;
      const n = col.toLowerCase();
      const val = /ide/.test(n) ? ide : ordemCf;
      if (val == null || val === '') return;
      ctcReq.input(p, val);
      wheres.push(`[${col}] = @${p}`);
    });
    if (wheres.length > 0) {
      const ctc = await ctcReq.query<Record<string, unknown>>(`
        SELECT TOP 20 *
        FROM [${schema.contatoTable}]
        WHERE ${wheres.join(' OR ')}
      `);
      for (const row of ctc.recordset ?? []) {
        const extra = coletarContatoDeRow(row);
        emails.push(...extra.emails);
        fones.push(...extra.fones);
      }
    }
  }

  return {
    email: juntarContatos(...emails),
    telefone: juntarTelefones(...fones),
  };
}

async function buscarContatoClienteErp(tarefa: {
  origem: string;
  codigoConta: string;
  clienteNome: string;
}): Promise<ClienteContatoErp> {
  try {
    if (tarefa.origem === 'shop9') {
      return await buscarContatoShop9(tarefa.codigoConta, tarefa.clienteNome);
    }
    return await buscarContatoNomus(tarefa.clienteNome, tarefa.codigoConta);
  } catch {
    return { email: null, telefone: null };
  }
}

export async function listContatosTarefa(tarefaId: number): Promise<{
  data: ContatoTarefaDto[];
  clienteContato: ClienteContatoErp;
} | null> {
  const existing = await prisma.crmInadimplenteTarefa.findUnique({ where: { id: tarefaId } });
  if (!existing) return null;
  const [rows, clienteContato] = await Promise.all([
    prisma.crmInadimplenteTarefaContato.findMany({
      where: { tarefaId },
      orderBy: [{ dataContato: 'desc' }, { createdAt: 'desc' }],
    }),
    buscarContatoClienteErp(existing),
  ]);
  return { data: rows.map(mapContato), clienteContato };
}

export async function createContatoTarefa(
  tarefaId: number,
  input: { dataContato?: string | null; texto: string },
  login: string | null,
): Promise<ContatoTarefaDto | null> {
  const existing = await prisma.crmInadimplenteTarefa.findUnique({ where: { id: tarefaId } });
  if (!existing) return null;
  const texto = String(input.texto ?? '').trim();
  if (!texto) throw new Error('Informe o texto da tratativa.');
  const dataContato = input.dataContato ? new Date(`${input.dataContato}T12:00:00`) : new Date();
  const row = await prisma.crmInadimplenteTarefaContato.create({
    data: {
      tarefaId,
      dataContato: Number.isNaN(dataContato.getTime()) ? new Date() : dataContato,
      texto,
      origem: 'manual',
      criadoPorLogin: login,
    },
  });
  if (existing.status === 'aberta') {
    await prisma.crmInadimplenteTarefa.update({
      where: { id: tarefaId },
      data: { status: 'em_contato' },
    });
  }
  return mapContato(row);
}

export async function updateContatoTarefa(
  tarefaId: number,
  contatoId: number,
  input: { dataContato?: string | null; texto: string },
): Promise<ContatoTarefaDto | null> {
  const existing = await prisma.crmInadimplenteTarefaContato.findFirst({
    where: { id: contatoId, tarefaId },
  });
  if (!existing) return null;
  const texto = String(input.texto ?? '').trim();
  if (!texto) throw new Error('Informe o texto da tratativa.');
  const dataContato = input.dataContato ? new Date(`${input.dataContato}T12:00:00`) : existing.dataContato;
  const row = await prisma.crmInadimplenteTarefaContato.update({
    where: { id: contatoId },
    data: {
      texto,
      dataContato:
        dataContato && !Number.isNaN(dataContato.getTime()) ? dataContato : existing.dataContato,
    },
  });
  return mapContato(row);
}

export async function deleteContatoTarefa(tarefaId: number, contatoId: number): Promise<boolean> {
  const existing = await prisma.crmInadimplenteTarefaContato.findFirst({
    where: { id: contatoId, tarefaId },
  });
  if (!existing) return false;
  await prisma.crmInadimplenteTarefaContato.delete({ where: { id: contatoId } });
  return true;
}
