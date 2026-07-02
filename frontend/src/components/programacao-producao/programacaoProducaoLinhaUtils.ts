import type {
  DadosProgramacaoProducaoV1,
  LinhaProgramacaoProducao,
  ProgramacaoProducaoGradeRowApi,
} from './types';
import { ESTOQUE_PROCESSO_VAZIO, QTDE_PRODUZIR_VAZIO } from './programacaoProducaoCalculos';
import type { QtdeProduzir } from './types';
import { migrarQtdeProduzirLegado } from '../../utils/programacaoProducaoRoteiros';
import {
  aplicarDescricaoSimplificadaCatalogo,
  aplicarDescricoesSimplificadasNasLinhas,
  descricaoSimplificadaDoCatalogo,
} from '../../utils/programacaoProducaoDescricaoSimplificada';
import { aplicarGrupoProdutoCatalogo, grupoProdutoDoCatalogo } from '../../utils/programacaoProducaoGrupoProduto';
import {
  aplicarBobinasAlternativasCatalogo,
  aplicarBobinasAlternativasNasLinhas,
  CATALOGO_BOBINAS_ALTERNATIVAS_V,
  normalizarBobinasAlternativasLinha,
  syncBobinaAlternativaDisplay,
  validarBobinasAlternativasLinha,
} from '../../utils/programacaoProducaoBobinaAlternativa';
import {
  normalizarOrdensProducaoLinha,
  validarOrdensProducaoNasLinhas,
} from '../../utils/programacaoProducaoOpsNomus';

/** Garante estrutura de roteiros ao reabrir snapshot (inclui migração perfiladeira/manual). */
export function normalizarQtdeProduzirLinha(raw: unknown): QtdeProduzir {
  if (raw == null) return { ...QTDE_PRODUZIR_VAZIO };
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return migrarQtdeProduzirLegado({ perfiladeira: raw, manual: 0 });
  }
  if (typeof raw === 'object') return migrarQtdeProduzirLegado(raw);
  return { ...QTDE_PRODUZIR_VAZIO };
}

function aplicarCatalogosLinha(linha: LinhaProgramacaoProducao): LinhaProgramacaoProducao {
  return aplicarBobinasAlternativasCatalogo(
    aplicarGrupoProdutoCatalogo(aplicarDescricaoSimplificadaCatalogo(linha))
  );
}

export function linhaVaziaFromGrade(row: ProgramacaoProducaoGradeRowApi): LinhaProgramacaoProducao {
  const linha: LinhaProgramacaoProducao = {
    idComponente: row.id_componente,
    idBobina: row.id_bobina,
    cod_componente: row.cod_componente,
    descricao_componente: row.descricao_componente,
    peso_unitario_bobina: row.peso_unitario_bobina,
    estoque_atual_componente: row.estoque_atual_componente,
    empenho_componente: row.empenho_componente,
    venda_media_componente: row.venda_media_componente,
    cod_bobina: row.cod_bobina,
    descricao_bobina: row.descricao_bobina,
    estoque_atual_bobina: row.estoque_atual_bobina,
    kg_bobina_necessario: row.kg_bobina_necessario,
    saldo_projetado: row.saldo_projetado,
    cobertura_meses: row.cobertura_meses,
    descricao_simplificada: descricaoSimplificadaDoCatalogo(row.cod_componente),
    grupo_produto: grupoProdutoDoCatalogo(row.cod_componente),
    bobinas_alternativas: [],
    cod_bobina_alternativa: null,
    descricao_bobina_alternativa: null,
    estoque_em_processo: { ...ESTOQUE_PROCESSO_VAZIO },
    sequencia: null,
    qtde_produzir: { ...QTDE_PRODUZIR_VAZIO },
    ordem_producao_nomus: null,
    observacao: null,
  };
  return syncBobinaAlternativaDisplay(aplicarCatalogosLinha(linha));
}

export function dadosFromGradeRows(
  rows: ProgramacaoProducaoGradeRowApi[],
  snapshotEm?: string
): DadosProgramacaoProducaoV1 {
  return {
    versao: 1,
    geradoEm: new Date().toISOString(),
    snapshotEm: snapshotEm ?? new Date().toISOString(),
    catalogBobinasV: CATALOGO_BOBINAS_ALTERNATIVAS_V,
    linhas: rows.map(linhaVaziaFromGrade),
  };
}

/** Atualiza colunas Nomus; preserva edições do usuário por idComponente. */
export function mergeDadosComGrade(
  atual: DadosProgramacaoProducaoV1,
  rows: ProgramacaoProducaoGradeRowApi[]
): DadosProgramacaoProducaoV1 {
  const porId = new Map(atual.linhas.map((l) => [l.idComponente, l]));
  const linhas: LinhaProgramacaoProducao[] = rows.map((row) => {
    const prev = porId.get(row.id_componente);
    const nomus = linhaVaziaFromGrade(row);
    if (!prev) return nomus;
    const descPrev = prev.descricao_simplificada?.trim()
      ? prev.descricao_simplificada
      : nomus.descricao_simplificada;
    const grupoPrev = prev.grupo_produto?.trim() ? prev.grupo_produto : nomus.grupo_produto;
    const bobinas = prev.bobinas_alternativas?.length
      ? prev.bobinas_alternativas
      : nomus.bobinas_alternativas;
    return syncBobinaAlternativaDisplay({
      ...nomus,
      descricao_simplificada: descPrev,
      grupo_produto: grupoPrev,
      bobinas_alternativas: bobinas,
      estoque_em_processo: prev.estoque_em_processo ?? nomus.estoque_em_processo,
      sequencia: prev.sequencia,
      qtde_produzir: prev.qtde_produzir ?? nomus.qtde_produzir,
      ordens_producao_nomus: prev.ordens_producao_nomus ?? nomus.ordens_producao_nomus,
      ordem_producao_nomus: prev.ordem_producao_nomus,
      observacao: prev.observacao,
    });
  });
  return {
    versao: 1,
    geradoEm: new Date().toISOString(),
    linhas,
  };
}

export function parseDadosProgramacao(raw: unknown): DadosProgramacaoProducaoV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.versao !== 1 || !Array.isArray(d.linhas)) return null;
  const catalogBobinasV =
    typeof d.catalogBobinasV === 'number' ? d.catalogBobinasV : 0;
  const forceCatalog = catalogBobinasV < CATALOGO_BOBINAS_ALTERNATIVAS_V;
  return {
    versao: 1,
    geradoEm: typeof d.geradoEm === 'string' ? d.geradoEm : new Date().toISOString(),
    snapshotEm: typeof d.snapshotEm === 'string' ? d.snapshotEm : undefined,
    catalogBobinasV: CATALOGO_BOBINAS_ALTERNATIVAS_V,
    linhas: aplicarBobinasAlternativasNasLinhas(
      aplicarDescricoesSimplificadasNasLinhas(d.linhas as LinhaProgramacaoProducao[]).map((l) =>
        normalizarOrdensProducaoLinha(
          aplicarGrupoProdutoCatalogo({
            ...l,
            qtde_produzir: normalizarQtdeProduzirLinha(l.qtde_produzir),
          })
        )
      ),
      { forceCatalog }
    ),
  };
}

export function validarDadosParaSave(
  dados: DadosProgramacaoProducaoV1,
  opts?: { somenteOpsNomus?: boolean }
): string | null {
  if (!dados.linhas.length) return 'A programação precisa ter ao menos uma linha na grade.';
  if (opts?.somenteOpsNomus) {
    return validarOrdensProducaoNasLinhas(dados.linhas);
  }
  for (const l of dados.linhas) {
    const ep = l.estoque_em_processo;
    if (ep) {
      const vals = [ep.perfiladeira, ep.corteDobra, ep.solda, ep.pintura, ep.montagem];
      if (vals.some((v) => v < 0 || !Number.isFinite(v))) {
        return `Estoque em processo inválido no componente ${l.cod_componente}.`;
      }
    }
    const qp = l.qtde_produzir;
    if (qp?.roteiros?.length) {
      for (const r of qp.roteiros) {
        if (r.qtde < 0 || !Number.isFinite(r.qtde)) {
          return `Qtde produzir inválida no componente ${l.cod_componente}.`;
        }
      }
    }
    const errBobinas = validarBobinasAlternativasLinha(l);
    if (errBobinas) {
      return `${l.cod_componente}: ${errBobinas}`;
    }
  }
  const errOps = validarOrdensProducaoNasLinhas(dados.linhas);
  if (errOps) return errOps;
  return null;
}
