/**
 * Grava a primeira vez que o Double Check lê uma NF vinculada divergente do pedido.
 * O retrato permanece se o conferente desfizer o vínculo.
 */
import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import {
  type DoubleCheckInComparativoLinha,
} from './doubleCheckInRepository.js';
import {
  classificarNaturezaDivergencia,
  observacaoNaturezaDivergencia,
  type NaturezaDivergencia,
} from '../services/doubleCheckInNatureza.js';
import { SEM_COMPRADOR } from './gestaoEntradasComprador.js';
import {
  DOUBLE_CHECKIN_CAMPOS,
  type DoubleCheckInCampoComparativo,
} from './doubleCheckInLocalRepository.js';

const CAMPOS_LINHA = [
  { campo: 'valor_unitario' as const, flag: 'divergValorUnitario' as const },
  { campo: 'qtde' as const, flag: 'divergQtde' as const },
  { campo: 'ipi' as const, flag: 'divergIpi' as const },
  { campo: 'condicao_pagamento' as const, flag: 'divergCondicaoPagamento' as const },
];

export type CompradorItemPedido = {
  idPedidoCompra: number;
  nomePedidoCompra: string;
  nomeComprador: string;
};

function chaveSnapshot(item: {
  idDocumentoEstoque: number;
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: string;
}): string {
  return `${item.idDocumentoEstoque}:${item.idItemDocumentoEstoque}:${item.idItemPedidoCompra}:${item.campo}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Comprador da cotação que originou o item do pedido. */
export async function buscarCompradorPorItemPedido(
  idsItemPedido: number[]
): Promise<Map<number, CompradorItemPedido>> {
  const map = new Map<number, CompradorItemPedido>();
  const ids = [...new Set(idsItemPedido.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0 || !isNomusEnabled()) return map;
  const pool = getNomusPool();
  if (!pool) return map;

  for (const parte of chunk(ids, 400)) {
    const ph = parte.map(() => '?').join(', ');
    const sql = `
SELECT
  ipc.id AS idItemPedidoCompra,
  pc.id AS idPedidoCompra,
  pc.nome AS nomePedidoCompra,
  COALESCE(
    NULLIF(TRIM(u.nome), ''),
    NULLIF(TRIM(f.nome), ''),
    NULLIF(TRIM(p.nome), ''),
    (
      SELECT COALESCE(NULLIF(TRIM(uc.nome), ''), NULLIF(TRIM(fc.nome), ''), NULLIF(TRIM(pcot.nome), ''))
      FROM solicitacaocompraitempedidocompra scipc
      JOIN solicitacaocompra_itemcotacaocompra scicc
        ON scicc.idSolicitacaoCompra = scipc.idSolicitacaoCompra
      JOIN itemcotacaocompra icc ON icc.id = scicc.idItemCotacaoCompra
      JOIN cotacaocompra c ON c.id = icc.idCotacaoCompra
      LEFT JOIN usuario uc ON uc.id = c.idComprador
      LEFT JOIN funcionario fc ON fc.id = uc.idFuncionario
      LEFT JOIN pessoa pcot ON pcot.id = c.idComprador
      WHERE scipc.idItemPedidoCompra = ipc.id
        AND COALESCE(NULLIF(TRIM(uc.nome), ''), NULLIF(TRIM(fc.nome), ''), NULLIF(TRIM(pcot.nome), '')) IS NOT NULL
      ORDER BY c.id
      LIMIT 1
    )
  ) AS nomeComprador
FROM itempedidocompra ipc
JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
LEFT JOIN usuario u ON u.id = pc.idComprador
LEFT JOIN funcionario f ON f.id = u.idFuncionario
LEFT JOIN pessoa p ON p.id = pc.idComprador
WHERE ipc.id IN (${ph})
`.trim();
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, parte);
    for (const row of Array.isArray(rows) ? rows : []) {
      const idItem = Number(row.idItemPedidoCompra);
      const idPedido = Number(row.idPedidoCompra);
      if (!Number.isFinite(idItem) || idItem <= 0 || !Number.isFinite(idPedido) || idPedido <= 0) continue;
      const nomePedido = String(row.nomePedidoCompra ?? '').trim();
      const nomeComprador = String(row.nomeComprador ?? '').trim();
      map.set(idItem, {
        idPedidoCompra: Math.trunc(idPedido),
        nomePedidoCompra: nomePedido || `PC ${Math.trunc(idPedido)}`,
        nomeComprador: nomeComprador || SEM_COMPRADOR,
      });
    }
  }
  return map;
}

/**
 * Insere só o que ainda não foi apontado. Falha de gravação não interrompe a consulta.
 */
export async function registrarDivergenciasApontadas(
  linhasPorDocumento: Map<number, DoubleCheckInComparativoLinha[]>
): Promise<void> {
  try {
    type Candidato = {
      idDocumentoEstoque: number;
      idItemDocumentoEstoque: number;
      idItemPedidoCompra: number;
      idPedidoCompra: number;
      nomePedidoCompra: string;
      campo: string;
      natureza: string;
      retratoJson: string;
    };
    const porChave = new Map<string, Candidato>();
    for (const [idDocumento, linhas] of linhasPorDocumento) {
      if (!Number.isFinite(idDocumento) || idDocumento <= 0) continue;
      for (const linha of linhas) {
        if (linha.idPedidoCompra == null || linha.idPedidoCompra <= 0) continue;
        if (linha.idItemPedidoCompra <= 0 || linha.idItemDocumentoEstoque <= 0) continue;
        for (const spec of CAMPOS_LINHA) {
          if (!linha[spec.flag]) continue;
          const candidato: Candidato = {
            idDocumentoEstoque: idDocumento,
            idItemDocumentoEstoque: linha.idItemDocumentoEstoque,
            idItemPedidoCompra: linha.idItemPedidoCompra,
            idPedidoCompra: linha.idPedidoCompra,
            nomePedidoCompra: linha.nomePedidoCompra?.trim() || `PC ${linha.idPedidoCompra}`,
            campo: spec.campo,
            natureza: classificarNaturezaDivergencia({ linha, campo: spec.campo }),
            retratoJson: JSON.stringify(linha),
          };
          porChave.set(chaveSnapshot(candidato), candidato);
        }
      }
    }
    const candidatos = [...porChave.values()];
    if (candidatos.length === 0) return;

    const idsDoc = [...new Set(candidatos.map((item) => item.idDocumentoEstoque))];
    const existentes = new Set<string>();
    for (const parte of chunk(idsDoc, 800)) {
      const rows = await prisma.doubleCheckInDivergenciaApontada.findMany({
        where: { idDocumentoEstoque: { in: parte } },
        select: {
          idDocumentoEstoque: true,
          idItemDocumentoEstoque: true,
          idItemPedidoCompra: true,
          campo: true,
        },
      });
      for (const row of rows) existentes.add(chaveSnapshot(row));
    }
    const novos = candidatos.filter((item) => !existentes.has(chaveSnapshot(item)));
    if (novos.length === 0) return;

    let compradores = new Map<number, CompradorItemPedido>();
    try {
      compradores = await buscarCompradorPorItemPedido(novos.map((item) => item.idItemPedidoCompra));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[divergenciaApontada] comprador:', msg);
    }

    await prisma.doubleCheckInDivergenciaApontada.createMany({
      data: novos.map((item) => {
        const comprador = compradores.get(item.idItemPedidoCompra);
        return {
          idDocumentoEstoque: item.idDocumentoEstoque,
          idItemDocumentoEstoque: item.idItemDocumentoEstoque,
          idItemPedidoCompra: item.idItemPedidoCompra,
          idPedidoCompra: comprador?.idPedidoCompra ?? item.idPedidoCompra,
          nomePedidoCompra: comprador?.nomePedidoCompra || item.nomePedidoCompra,
          nomeComprador: comprador?.nomeComprador ?? SEM_COMPRADOR,
          campo: item.campo,
          natureza: item.natureza,
          retratoJson: item.retratoJson,
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[divergenciaApontada] registrar:', msg);
  }
}

const LABEL_CAMPO_LEITURA: Record<string, string> = {
  valor_unitario: 'valor unitário',
  qtde: 'quantidade',
  ipi: 'IPI',
  condicao_pagamento: 'condição de pagamento',
};

export type LinhaPrimeiraLeitura = DoubleCheckInComparativoLinha & {
  naturezaDivergencias: Partial<Record<DoubleCheckInCampoComparativo, NaturezaDivergencia>>;
  observacaoNaturezaDivergencias: Partial<Record<DoubleCheckInCampoComparativo, string>>;
};

function campoValido(campo: string): campo is DoubleCheckInCampoComparativo {
  return (DOUBLE_CHECKIN_CAMPOS as readonly string[]).includes(campo);
}

function lerRetrato(raw: string | null): DoubleCheckInComparativoLinha | null {
  if (!raw) return null;
  try {
    const valor = JSON.parse(raw) as Partial<DoubleCheckInComparativoLinha>;
    if (!valor || typeof valor !== 'object') return null;
    if (!Number.isFinite(Number(valor.idItemDocumentoEstoque))) return null;
    if (!Number.isFinite(Number(valor.idItemPedidoCompra))) return null;
    return valor as DoubleCheckInComparativoLinha;
  } catch {
    return null;
  }
}

function comNaturezaDaLeitura(
  linha: DoubleCheckInComparativoLinha,
  naturezas: Map<string, string>
): LinhaPrimeiraLeitura {
  const naturezaDivergencias: LinhaPrimeiraLeitura['naturezaDivergencias'] = {};
  const observacaoNaturezaDivergencias: LinhaPrimeiraLeitura['observacaoNaturezaDivergencias'] = {};
  for (const campo of DOUBLE_CHECKIN_CAMPOS) {
    const flag =
      campo === 'valor_unitario'
        ? linha.divergValorUnitario
        : campo === 'qtde'
          ? linha.divergQtde
          : campo === 'ipi'
            ? linha.divergIpi
            : linha.divergCondicaoPagamento;
    if (!flag) continue;
    const gravada = naturezas.get(campo);
    naturezaDivergencias[campo] =
      gravada === 'benigna' || gravada === 'real'
        ? gravada
        : classificarNaturezaDivergencia({ linha, campo });
    const obs = observacaoNaturezaDivergencia({ linha, campo });
    if (obs) observacaoNaturezaDivergencias[campo] = obs;
  }
  return { ...linha, naturezaDivergencias, observacaoNaturezaDivergencias };
}

/** Comparativo gravado na primeira leitura. Leituras antigas só informam quantas divergências houve. */
export async function carregarRetratoPrimeiraLeitura(idDocumento: number): Promise<{
  origem: 'retrato' | 'nao_gravada';
  aviso: string;
  linhas: LinhaPrimeiraLeitura[];
  erro?: string;
}> {
  const snaps = await prisma.doubleCheckInDivergenciaApontada.findMany({
    where: { idDocumentoEstoque: idDocumento },
    orderBy: { apontadoEm: 'asc' },
  });
  if (snaps.length === 0) {
    return {
      origem: 'retrato',
      aviso: 'Não há primeira leitura gravada para este documento.',
      linhas: [],
    };
  }

  const porVinculo = new Map<string, typeof snaps>();
  for (const snap of snaps) {
    const chave = `${snap.idItemDocumentoEstoque}:${snap.idItemPedidoCompra}`;
    const lista = porVinculo.get(chave) ?? [];
    lista.push(snap);
    porVinculo.set(chave, lista);
  }

  const campos = [...new Set(snaps.map((snap) => snap.campo).filter(campoValido))];
  const nomes = campos.map((campo) => LABEL_CAMPO_LEITURA[campo] ?? campo);
  const listaCampos =
    nomes.length <= 1 ? (nomes[0] ?? 'divergência') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

  const linhas: LinhaPrimeiraLeitura[] = [];
  const semRetrato: { idItemDocumentoEstoque: number; idItemPedidoCompra: number }[] = [];
  for (const grupo of porVinculo.values()) {
    const retrato = lerRetrato(grupo.find((snap) => snap.retratoJson)?.retratoJson ?? null);
    const naturezas = new Map(grupo.map((snap) => [snap.campo, snap.natureza]));
    if (retrato) {
      linhas.push(comNaturezaDaLeitura(retrato, naturezas));
      continue;
    }
    const base = grupo[0]!;
    semRetrato.push({
      idItemDocumentoEstoque: base.idItemDocumentoEstoque,
      idItemPedidoCompra: base.idItemPedidoCompra,
    });
  }

  if (semRetrato.length === 0) {
    return {
      origem: 'retrato',
      aviso: `Comparação gravada na primeira leitura. ${campos.length === 1 ? 'Divergiu' : 'Divergiram'}: ${listaCampos}.`,
      linhas,
    };
  }

  const qtde = snaps.filter((snap) => !snap.retratoJson).length;
  const camposNaoGravados = [
    ...new Set(snaps.filter((snap) => !snap.retratoJson).map((snap) => snap.campo).filter(campoValido)),
  ];
  const nomesNaoGravados = camposNaoGravados.map((campo) => LABEL_CAMPO_LEITURA[campo] ?? campo);
  const listaNaoGravada =
    nomesNaoGravados.length <= 1
      ? (nomesNaoGravados[0] ?? 'divergência')
      : `${nomesNaoGravados.slice(0, -1).join(', ')} e ${nomesNaoGravados.at(-1)}`;
  const textoQtde = qtde === 1 ? 'houve 1 divergência' : `houve ${qtde} divergências`;
  const aviso = `Sabemos que ${textoQtde} na primeira leitura (${listaNaoGravada}), mas ${qtde === 1 ? 'ela não foi gravada' : 'elas não foram gravadas'}. Nos documentos novos nessa situação, as divergências da primeira leitura ficam gravadas.`;
  if (linhas.length === 0) {
    return { origem: 'nao_gravada', aviso, linhas: [] };
  }
  return {
    origem: 'retrato',
    aviso,
    linhas,
  };
}
