import { obterPontoSerieMes } from './crmInadimplentePainelService.js';
import {
  dataCivilFortaleza,
  decidirFechamentoMesAnterior,
  mesAnteriorDe,
  obterRetratoMes,
  promoverRetratoOficial,
  upsertRetratoTrabalho,
  gravarRetratoOficial,
} from './crmInadimplenciaRetrato.js';

export type ResultadoRetratoInadimplencia = {
  mesAtual: string;
  mesAnterior: string;
  trabalho: 'gravado' | 'pulado_erro' | 'pulado_oficial';
  fechamento: string;
  erros: string[];
};

export async function rodarRetratoInadimplencia(agora = new Date()): Promise<ResultadoRetratoInadimplencia> {
  const { mes: mesAtual, dia } = dataCivilFortaleza(agora);
  const mesAnterior = mesAnteriorDe(mesAtual);
  const erros: string[] = [];
  let trabalho: ResultadoRetratoInadimplencia['trabalho'] = 'pulado_erro';
  let fechamento = 'nao_avaliado';

  const prev = await obterRetratoMes(mesAnterior);
  const decisao = decidirFechamentoMesAnterior({
    existe: Boolean(prev),
    oficial: Boolean(prev?.oficial),
    diaDoMesAtual: dia,
  });

  if (decisao.acao === 'ignorar') {
    fechamento = 'ja_oficial';
  } else if (decisao.acao === 'adiar') {
    fechamento = 'adiado_fora_da_janela';
  } else if (decisao.acao === 'promover') {
    const live = await obterPontoSerieMes(mesAnterior);
    erros.push(...live.erros);
    if (live.confiavel) {
      await upsertRetratoTrabalho(live.ponto, agora);
      await promoverRetratoOficial(mesAnterior, dia > 1);
      fechamento = dia > 1 ? 'promovido_com_refresh_atrasado' : 'promovido_com_refresh';
    } else {
      await promoverRetratoOficial(mesAnterior, true);
      fechamento = 'promovido_foto_anterior_erp_indisponivel';
    }
  } else if (decisao.acao === 'capturar_vivo') {
    const live = await obterPontoSerieMes(mesAnterior);
    erros.push(...live.erros);
    if (!live.confiavel) {
      fechamento = 'captura_oficial_adiada_erp_indisponivel';
    } else {
      const gravou = await gravarRetratoOficial(live.ponto, { atrasado: decisao.atrasado, agora });
      fechamento = gravou
        ? decisao.atrasado
          ? 'captura_oficial_atrasada'
          : 'captura_oficial_virada'
        : 'ja_oficial';
    }
  }

  const atual = await obterRetratoMes(mesAtual);
  if (atual?.oficial) {
    trabalho = 'pulado_oficial';
  } else {
    const liveAtual = await obterPontoSerieMes(mesAtual);
    erros.push(...liveAtual.erros);
    if (!liveAtual.confiavel) {
      trabalho = 'pulado_erro';
    } else {
      await upsertRetratoTrabalho(liveAtual.ponto, agora);
      trabalho = 'gravado';
    }
  }

  return { mesAtual, mesAnterior, trabalho, fechamento, erros: [...new Set(erros)] };
}
