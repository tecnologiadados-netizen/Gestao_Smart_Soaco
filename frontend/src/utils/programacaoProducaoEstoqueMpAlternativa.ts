import {
  fetchBobinasProgramacaoPorCodigos,
  fetchEstoqueBobinaSetores,
} from '../api/programacaoProducao';
import type {
  EstoqueMpAlternativaDetalheItem,
  LinhaProgramacaoProducao,
} from '../components/programacao-producao/types';
import {
  normalizarCodMp,
  validarBobinasAlternativasLinha,
} from './programacaoProducaoBobinaAlternativa';

export { validarBobinasAlternativasLinha } from './programacaoProducaoBobinaAlternativa';

export function codigosAlternativasUnicos(linha: LinhaProgramacaoProducao): string[] {
  const list = linha.bobinas_alternativas ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of list) {
    const c = b.cod?.trim();
    if (!c) continue;
    const norm = normalizarCodMp(c);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(c);
  }
  return out;
}

/** Chave estável para re-hidratar estoque quando alternativas mudam. */
export function estoqueMpAlternativaHydrateKey(linha: LinhaProgramacaoProducao): string {
  return codigosAlternativasUnicos(linha)
    .map(normalizarCodMp)
    .sort()
    .join('|');
}

const SETOR_GALPAO_BOBINA = 19;
const SETOR_MP_PROCESSADA = 20;

export async function estoqueSaldosBobinaMpAlternativa(idBobina: number): Promise<{
  saldoGalpaoBobina: number;
  saldoMpProcessada: number;
  saldoTotal: number;
}> {
  const { setores } = await fetchEstoqueBobinaSetores(idBobina);
  let saldoGalpaoBobina = 0;
  let saldoMpProcessada = 0;
  for (const s of setores) {
    if (s.id_setor === SETOR_GALPAO_BOBINA) saldoGalpaoBobina += s.saldo;
    if (s.id_setor === SETOR_MP_PROCESSADA) saldoMpProcessada += s.saldo;
  }
  return {
    saldoGalpaoBobina,
    saldoMpProcessada,
    saldoTotal: saldoGalpaoBobina + saldoMpProcessada,
  };
}

export async function hydrateEstoqueMpAlternativaLinha(
  linha: LinhaProgramacaoProducao
): Promise<LinhaProgramacaoProducao> {
  const erroVal = validarBobinasAlternativasLinha(linha);
  if (erroVal) {
    return {
      ...linha,
      estoque_mp_alternativa: null,
      estoque_mp_alternativa_erro: erroVal,
      estoque_mp_alternativa_detalhe: [],
      id_bobina_alternativa: null,
    };
  }

  const codsUnicos = codigosAlternativasUnicos(linha);
  if (!codsUnicos.length) {
    return {
      ...linha,
      estoque_mp_alternativa: null,
      estoque_mp_alternativa_erro: null,
      estoque_mp_alternativa_detalhe: [],
      id_bobina_alternativa: null,
    };
  }

  try {
    const { data } = await fetchBobinasProgramacaoPorCodigos(codsUnicos);
    const porCod = new Map(data.map((d) => [normalizarCodMp(d.codigo.trim()), d]));

    const detalhe: EstoqueMpAlternativaDetalheItem[] = [];
    let total = 0;

    for (const cod of codsUnicos) {
      const found = porCod.get(normalizarCodMp(cod));
      const id = found?.id ?? null;
      const desc =
        found?.descricao?.trim() ||
        linha.bobinas_alternativas?.find((b) => normalizarCodMp(b.cod.trim()) === normalizarCodMp(cod))
          ?.descricao?.trim() ||
        null;
      let saldoGalpaoBobina = 0;
      let saldoMpProcessada = 0;
      let saldoTotal = 0;
      if (id) {
        const saldos = await estoqueSaldosBobinaMpAlternativa(id);
        saldoGalpaoBobina = saldos.saldoGalpaoBobina;
        saldoMpProcessada = saldos.saldoMpProcessada;
        saldoTotal = saldos.saldoTotal;
      }
      total += saldoTotal;
      detalhe.push({
        cod,
        descricao: desc,
        saldoGalpaoBobina,
        saldoMpProcessada,
        saldoTotal,
      });
    }

    return {
      ...linha,
      estoque_mp_alternativa: total,
      estoque_mp_alternativa_erro: null,
      estoque_mp_alternativa_detalhe: detalhe,
      id_bobina_alternativa: null,
    };
  } catch {
    return {
      ...linha,
      estoque_mp_alternativa: null,
      estoque_mp_alternativa_erro: 'Erro ao consultar estoque das bobinas alternativas.',
      estoque_mp_alternativa_detalhe: [],
      id_bobina_alternativa: null,
    };
  }
}

export async function hydrateEstoqueMpAlternativaLinhas(
  linhas: LinhaProgramacaoProducao[]
): Promise<LinhaProgramacaoProducao[]> {
  return Promise.all(linhas.map((l) => hydrateEstoqueMpAlternativaLinha(l)));
}
