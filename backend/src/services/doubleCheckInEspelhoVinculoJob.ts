/**
 * Grava o espelho da primeira leitura dos documentos novos que já têm pedido vinculado,
 * sem esperar alguém abrir o Double Check.
 * O retrato não é reescrito. Documento que perde o vínculo antes desta leitura não tem o que recuperar.
 */
import { prisma } from '../config/prisma.js';
import {
  listarIdsEntradasRecentesComVinculo,
  queryLinhasComparativoPorDocumentos,
} from '../data/doubleCheckInRepository.js';
import { registrarEspelhoPrimeiraLeitura } from '../data/doubleCheckInDivergenciaApontada.js';
import { DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE_YMD } from './doubleCheckInConferenciaPeriodo.js';

/** Entradas dos últimos 45 dias, nunca antes do início da conferência NF × PC. */
export const JANELA_ESPELHO_VINCULO_DIAS = 45;
/** Cada rodada grava no máximo este tanto, para não segurar o Nomus. O restante fica para a seguinte. */
const MAX_POR_RODADA = 40;

let emAndamento = false;

export function ymdHojeSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

export function ymdMenosDias(ymd: string, dias: number): string {
  const [ano, mes, dia] = ymd.split('-').map(Number);
  const data = new Date(Date.UTC(ano, (mes ?? 1) - 1, dia ?? 1));
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

export function ymdInicioJanelaEspelho(
  hojeYmd: string,
  dias = JANELA_ESPELHO_VINCULO_DIAS
): string {
  const calculado = ymdMenosDias(hojeYmd, dias);
  return calculado < DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE_YMD
    ? DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE_YMD
    : calculado;
}

export function idsSemEspelho(candidatos: number[], jaGravados: Iterable<number>): number[] {
  const ja = new Set(jaGravados);
  return candidatos.filter((id) => Number.isInteger(id) && id > 0 && !ja.has(id));
}

async function idsJaEspelhados(ids: number[]): Promise<Set<number>> {
  const gravados = new Set<number>();
  for (let i = 0; i < ids.length; i += 400) {
    const parte = ids.slice(i, i + 400);
    const rows = await prisma.doubleCheckInEspelhoPrimeiraLeitura.findMany({
      where: { idDocumentoEstoque: { in: parte } },
      select: { idDocumentoEstoque: true },
    });
    for (const row of rows) gravados.add(row.idDocumentoEstoque);
  }
  return gravados;
}

export async function gravarEspelhosVinculosRecentes(): Promise<{
  pulado: boolean;
  candidatos: number;
  semEspelho: number;
  gravados: number;
  erro?: string;
}> {
  if (emAndamento) {
    return { pulado: true, candidatos: 0, semEspelho: 0, gravados: 0 };
  }
  emAndamento = true;
  try {
    const hoje = ymdHojeSaoPaulo();
    const desde = ymdInicioJanelaEspelho(hoje);
    const lista = await listarIdsEntradasRecentesComVinculo(desde, hoje);
    if (lista.erro) {
      console.error('[espelhoVinculo]', lista.erro);
      return { pulado: false, candidatos: 0, semEspelho: 0, gravados: 0, erro: lista.erro };
    }
    const ja = await idsJaEspelhados(lista.ids);
    const faltantes = idsSemEspelho(lista.ids, ja).slice(0, MAX_POR_RODADA);
    if (faltantes.length === 0) {
      return { pulado: false, candidatos: lista.ids.length, semEspelho: 0, gravados: 0 };
    }
    const comparativo = await queryLinhasComparativoPorDocumentos(faltantes);
    if (comparativo.erro) {
      console.error('[espelhoVinculo]', comparativo.erro);
      return {
        pulado: false,
        candidatos: lista.ids.length,
        semEspelho: faltantes.length,
        gravados: 0,
        erro: comparativo.erro,
      };
    }
    await registrarEspelhoPrimeiraLeitura(comparativo.linhasPorDocumento);
    const depois = await idsJaEspelhados(faltantes);
    const gravados = faltantes.filter((id) => depois.has(id)).length;
    if (gravados > 0) {
      console.log(
        `[espelhoVinculo] ${gravados} espelho(s) novo(s) de ${faltantes.length} documento(s) com vínculo, janela ${desde} a ${hoje}.`
      );
    }
    return {
      pulado: false,
      candidatos: lista.ids.length,
      semEspelho: faltantes.length,
      gravados,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[espelhoVinculo]', msg);
    return { pulado: false, candidatos: 0, semEspelho: 0, gravados: 0, erro: msg };
  } finally {
    emAndamento = false;
  }
}
