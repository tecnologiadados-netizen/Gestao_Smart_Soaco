import { subDays, subMonths, parseISO, isValid } from "date-fns";
import type { FaltaRow, FaltaAlertaRegraRow, FaltaGrupoSintomaCidRow } from "@rh/types/api";
import { resolverGrupoCid } from "@rh/lib/cid-grupos";
import {
  diasPerdidosEquivalentes,
  normalizeText,
  periodoQuantidadeMode,
} from "@rh/pages/FaltasAtestados/faltas-dias-equivalentes";
import type { AusenciaAlertaDetectado } from "@rh/lib/ausencia-inconsistencias/regras-catalogo";
import { buildRegrasMap } from "@rh/lib/ausencia-inconsistencias/regras-catalogo";

export function normalizeMatriculaAusencia(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^0+/, "")
    .toUpperCase();
}

function parseDataIso(value: string): Date | null {
  const s = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  try {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function tipoNorm(tipo: string): string {
  return normalizeText(tipo);
}

function tipoEhDoacaoSangue(tipo: string): boolean {
  const u = tipoNorm(tipo);
  return u.includes("DOACAO") && u.includes("SANGUE");
}

export function tipoEhAtestadoMedico(tipo: string): boolean {
  const u = tipoNorm(tipo);
  return u.includes("ATESTADO") && !u.includes("DECLARACAO");
}

export function tipoEhDeclaracaoComparecimento(tipo: string): boolean {
  const u = tipoNorm(tipo);
  return u.includes("DECLARACAO") && u.includes("COMPARECIMENTO");
}

function diasLinha(row: FaltaRow): number {
  return diasPerdidosEquivalentes(row).value;
}

function filtrarHistorico(
  historico: FaltaRow[],
  matricula: string,
  excluirId: string,
  desde: Date,
  ate: Date,
): FaltaRow[] {
  const mNorm = normalizeMatriculaAusencia(matricula);
  return historico.filter((r) => {
    if (String(r.id) === excluirId) return false;
    if (normalizeMatriculaAusencia(r.matricula) !== mNorm) return false;
    const d = parseDataIso(String(r.data ?? ""));
    if (!d) return false;
    return d >= desde && d <= ate;
  });
}

function somaDias(rows: FaltaRow[]): number {
  return rows.reduce((acc, r) => acc + diasLinha(r), 0);
}

function regraAtiva(map: Map<string, FaltaAlertaRegraRow>, id: string): FaltaAlertaRegraRow | null {
  const r = map.get(id);
  return r?.ativa ? r : null;
}

function pushAlerta(
  out: AusenciaAlertaDetectado[],
  regra: FaltaAlertaRegraRow,
  motivo: string,
  contexto?: Record<string, unknown>,
): void {
  out.push({
    regraId: regra.id,
    titulo: regra.titulo,
    motivo,
    baseLegal: regra.baseLegal,
    severidade: regra.severidadePadrao,
    contexto,
  });
}

export type ValidarAusenciaInput = {
  linha: FaltaRow;
  historico: FaltaRow[];
  regras: FaltaAlertaRegraRow[];
  dataReferencia?: Date;
  gruposSintomas?: FaltaGrupoSintomaCidRow[];
};

export function validarAusenciaLancamento(input: ValidarAusenciaInput): AusenciaAlertaDetectado[] {
  const { linha, historico, regras, gruposSintomas } = input;
  const ref = input.dataReferencia ?? parseDataIso(String(linha.data ?? "")) ?? new Date();
  const map = buildRegrasMap(regras);
  const out: AusenciaAlertaDetectado[] = [];
  const excluirId = String(linha.id);
  const matricula = String(linha.matricula ?? "");
  const tipo = String(linha.tipo ?? "");
  const diasAtual = diasLinha(linha);

  const regraPrevSoma = regraAtiva(map, "prev-soma-60-grupo-cid");
  if (regraPrevSoma && tipoEhAtestadoMedico(tipo) && String(linha.cid ?? "").trim()) {
    const desde = subDays(ref, 60);
    const hist = filtrarHistorico(historico, matricula, excluirId, desde, ref).filter(
      (r) => tipoEhAtestadoMedico(String(r.tipo ?? "")) && String(r.cid ?? "").trim(),
    );
    const grupo = resolverGrupoCid(String(linha.cid ?? ""), gruposSintomas);
    const histGrupo = hist.filter(
      (r) => resolverGrupoCid(String(r.cid ?? ""), gruposSintomas).id === grupo.id,
    );
    const acum = somaDias(histGrupo) + diasAtual;
    if (acum > 15) {
      pushAlerta(
        out,
        regraPrevSoma,
        `Colaborador acumula ${acum.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dia(s) no grupo «${grupo.titulo.slice(0, 80)}…» nos últimos 60 dias (limite: 15). Verificar encaminhamento ao INSS.`,
        { diasAcumulados: acum, limiteDias: 15, grupoCidId: grupo.id, grupoCidTitulo: grupo.titulo },
      );
    }
  }

  const regraDecl = regraAtiva(map, "pol-declaracao-3-dias");
  if (regraDecl && tipoEhDeclaracaoComparecimento(tipo)) {
    const desde = subMonths(ref, 12);
    const hist = filtrarHistorico(historico, matricula, excluirId, desde, ref).filter((r) =>
      tipoEhDeclaracaoComparecimento(String(r.tipo ?? "")),
    );
    const acum = somaDias(hist) + diasAtual;
    if (acum > 3) {
      pushAlerta(
        out,
        regraDecl,
        `Soma de ${acum.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dia(s) em declarações de comparecimento nos últimos 12 meses (limite da política interna: 3).`,
        { diasAcumulados: acum, limiteDias: 3 },
      );
    }
  }

  const regraSangue = regraAtiva(map, "clt-473-iv");
  if (regraSangue && tipoEhDoacaoSangue(tipo)) {
    if (diasAtual > 1) {
      pushAlerta(
        out,
        regraSangue,
        `Doação de sangue lançada com ${diasAtual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dia(s). CLT Art. 473, IV prevê no máximo 1 dia abonado por lançamento.`,
        { diasAtual, limiteDias: 1 },
      );
    }
    const desde = subMonths(ref, 12);
    const hist = filtrarHistorico(historico, matricula, excluirId, desde, ref).filter((r) =>
      tipoEhDoacaoSangue(String(r.tipo ?? "")),
    );
    if (hist.length >= 1) {
      pushAlerta(
        out,
        regraSangue,
        "Já existe lançamento de doação de sangue nos últimos 12 meses. CLT Art. 473, IV permite apenas 1 ausência abonada por período.",
        { ocorrencias: hist.length + 1, limiteOcorrencias: 1 },
      );
    }
  }

  const regraObito = regraAtiva(map, "clt-473-i");
  if (regraObito) {
    const u = tipoNorm(tipo);
    if (u.includes("OBITO") || u.includes("NOJO")) {
      if (diasAtual > 2) {
        pushAlerta(
          out,
          regraObito,
          `Licença por óbito com ${diasAtual} dia(s) — CLT Art. 473, I prevê no máximo 2 dias consecutivos.`,
          { diasAtual, limiteDias: 2 },
        );
      }
    }
  }

  const regraCasamento = regraAtiva(map, "clt-473-ii");
  if (regraCasamento && tipoNorm(tipo).includes("CASAMENTO")) {
    if (diasAtual > 3) {
      pushAlerta(
        out,
        regraCasamento,
        `Licença casamento com ${diasAtual} dia(s) — CLT Art. 473, II prevê no máximo 3 dias consecutivos.`,
        { diasAtual, limiteDias: 3 },
      );
    }
  }

  const regraPaternidade = regraAtiva(map, "clt-473-iii");
  if (regraPaternidade && tipoNorm(tipo).includes("PATERN")) {
    if (diasAtual > 5) {
      pushAlerta(
        out,
        regraPaternidade,
        `Licença paternidade com ${diasAtual} dia(s) — CLT Art. 473, III prevê no máximo 5 dias consecutivos.`,
        { diasAtual, limiteDias: 5 },
      );
    }
  }

  const regraEleitor = regraAtiva(map, "clt-473-v");
  if (regraEleitor && (tipoNorm(tipo).includes("ELEITOR") || tipoNorm(tipo).includes("ALISTAMENTO"))) {
    if (diasAtual > 2) {
      pushAlerta(
        out,
        regraEleitor,
        `Alistamento eleitoral com ${diasAtual} dia(s) — CLT Art. 473, V prevê no máximo 2 dias.`,
        { diasAtual, limiteDias: 2 },
      );
    }
  }

  const regraFilho = regraAtiva(map, "clt-473-xi");
  if (regraFilho) {
    const u = tipoNorm(tipo);
    const matchFilho =
      (u.includes("FILHO") && (u.includes("CONSULTA") || u.includes("ACOMPANHAMENTO") || u.includes("MEDIC")))
      || u.includes("FILHO ATE 6");
    if (matchFilho) {
      const desde = subMonths(ref, 12);
      const hist = filtrarHistorico(historico, matricula, excluirId, desde, ref).filter((r) => {
        const t = tipoNorm(String(r.tipo ?? ""));
        return (
          (t.includes("FILHO") && (t.includes("CONSULTA") || t.includes("ACOMPANHAMENTO") || t.includes("MEDIC")))
          || t.includes("FILHO ATE 6")
        );
      });
      if (hist.length >= 1) {
        pushAlerta(
          out,
          regraFilho,
          "Já existe lançamento de consulta de filho até 6 anos nos últimos 12 meses (CLT Art. 473, XI — 1 dia/ano).",
          { ocorrencias: hist.length + 1 },
        );
      }
    }
  }

  const regraCancer = regraAtiva(map, "clt-473-xii");
  if (regraCancer) {
    const u = tipoNorm(tipo);
    if (
      (u.includes("EXAME") && (u.includes("PREVENTIV") || u.includes("CANCER") || u.includes("HPV")))
      || u.includes("PREVENTIVO CANCER")
    ) {
      const desde = subMonths(ref, 12);
      const hist = filtrarHistorico(historico, matricula, excluirId, desde, ref).filter((r) => {
        const t = tipoNorm(String(r.tipo ?? ""));
        return (
          (t.includes("EXAME") && (t.includes("PREVENTIV") || t.includes("CANCER") || t.includes("HPV")))
          || t.includes("PREVENTIVO CANCER")
        );
      });
      const acum = somaDias(hist) + diasAtual;
      if (acum > 3) {
        pushAlerta(
          out,
          regraCancer,
          `Soma de ${acum.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dia(s) em exames preventivos nos últimos 12 meses (CLT Art. 473, XII — máx. 3).`,
          { diasAcumulados: acum, limiteDias: 3 },
        );
      }
    }
  }

  const regra15 = regraAtiva(map, "prev-15-dias-consecutivos");
  if (regra15 && tipoEhAtestadoMedico(tipo) && diasAtual > 15) {
    pushAlerta(
      out,
      regra15,
      `Atestado com ${diasAtual} dia(s) consecutivos — acima de 15 dias. Verificar encaminhamento ao INSS.`,
      { diasAtual, limiteDias: 15 },
    );
  }

  const regraDeclIntegral = regraAtiva(map, "doc-declaracao-dia-integral");
  if (regraDeclIntegral && tipoNorm(tipo).includes("DECLARACAO")) {
    const modo = periodoQuantidadeMode(String(linha.periodo ?? ""));
    if (modo === "dias" && diasAtual > 1) {
      pushAlerta(
        out,
        regraDeclIntegral,
        `Declaração lançada com período integral e ${diasAtual} dia(s). Declaração costuma abonar apenas horas — verificar documento.`,
        { diasAtual, periodo: linha.periodo },
      );
    }
  }

  const regraDup = regraAtiva(map, "dup-mesmo-dia");
  if (regraDup) {
    const dataIso = String(linha.data ?? "").trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      const dup = historico.filter((r) => {
        if (String(r.id) === excluirId) return false;
        if (normalizeMatriculaAusencia(r.matricula) !== normalizeMatriculaAusencia(matricula)) return false;
        return String(r.data ?? "").trim().slice(0, 10) === dataIso;
      });
      if (dup.length > 0) {
        pushAlerta(
          out,
          regraDup,
          `Colaborador já possui ${dup.length} ausência(s) lançada(s) em ${dataIso}.`,
          { duplicatas: dup.map((r) => ({ id: r.id, tipo: r.tipo })) },
        );
      }
    }
  }

  return out;
}
