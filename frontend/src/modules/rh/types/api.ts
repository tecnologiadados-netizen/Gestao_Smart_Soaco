/**
 * Tipos de dados retornados pela API (Edge Functions).
 * O frontend não conhece nomes de tabelas nem estrutura do banco.
 */

export interface DashboardTurnoverRow {
  month: string;
  value: number;
}

export interface DashboardHeadcountRow {
  sector: string;
  count: number;
}

export interface DashboardCustoSetorRow {
  name: string;
  value: number;
}

export interface DashboardAlerta {
  message: string;
  severity: "red" | "yellow";
  sector: string;
}

export interface DashboardData {
  turnoverData: DashboardTurnoverRow[];
  headcountData: DashboardHeadcountRow[];
  sectorCostData: DashboardCustoSetorRow[];
  alerts: DashboardAlerta[];
}

export interface Colaborador {
  id: string;
  name: string;
  cargo: string;
  setor: string;
  area?: string;
  gestorImediato?: string;
  gestorMediato?: string;
  salario: number;
  admissao: string;
  status: "Ativo" | "Férias" | "Afastado" | "Desligado";
  tempoEmpresa: string;
}

export interface CargoRow {
  cargo: string;
  faixaMin: number | null;
  faixaMax: number | null;
  media: number;
  count: number;
  faixaUpdatedBy?: string | null;
  faixaUpdatedAt?: string | null;
}

export interface CargoInconsistencia {
  matricula: string;
  nome: string;
  cargo: string;
  setor: string;
  area?: string;
  salario: number;
  faixaMin: number;
  faixaMax: number;
  problema: string;
  severity: "red" | "yellow";
}

export interface CargoSalarioSetor {
  setor: string;
  media: number;
}

export interface CargosData {
  cargos: CargoRow[];
  inconsistencias: CargoInconsistencia[];
  salaryBySetor: CargoSalarioSetor[];
  areas: string[];
}

export interface OrganicoRow {
  id: string;
  values: string[];
}

/** Payload para substituir todo o orgânico no banco (campos derivados + linha completa). */
export interface OrganicoReplaceRow {
  matricula: string;
  nome: string;
  cargo: string;
  setor: string;
  area?: string | null;
  lider?: string | null;
  dataAdmissao?: string | null;
  status: "Ativo" | "Férias" | "Afastado" | "Desligado";
  values: string[];
}

export interface OrganicoComentario {
  id: string;
  colaboradorNome: string;
  colaboradorMatricula: string | null;
  comentario: string;
  tipo: "comentario" | "log_alteracao";
  categoria: "geral" | "cargo_trabalho" | "beneficios" | "remuneracao" | "dados_bancarios" | "contrato";
  tagCode: string;
  visibility: "public" | "restricted" | "confidential";
  campoAlterado: string | null;
  valorAnterior: string | null;
  valorAtual: string | null;
  createdBy: string;
  createdAt: string;
}

export interface OrganicoComentarioResumo {
  colaboradorNome: string;
  colaboradorMatricula: string | null;
  total: number;
}

export interface OrganicoFoto {
  colaboradorMatricula: string;
  colaboradorNome: string;
  fotoBase64: string;
  mimeType: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Resumo leve: sem imagem — evita baixar centenas de base64 de uma vez na lista do Orgânico. */
export interface OrganicoFotoResumo {
  colaboradorMatricula: string;
  colaboradorNome: string;
}

/** Pendência de justificativa para alteração CTPS ou cargo (Secullum). */
export interface OrganicoAlteracaoPendente {
  id: string;
  colaboradorMatricula: string;
  colaboradorNome: string;
  setor: string;
  tipo: "ctps" | "cargo";
  campoLabel: string;
  valorAnterior: string;
  valorAtual: string;
  motivo: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  /** Data da alteração na trajetória (YYYY-MM-DD); ausente = dia do registro do motivo. */
  dataReferencia?: string | null;
}

export interface OrganicoTrajetoriaItem {
  id: string;
  colaboradorMatricula: string;
  colaboradorNome: string;
  dataEvento: string;
  tipoEvento: "salario" | "cargo" | "funcao";
  titulo: string;
  descricao: string;
  motivo: string | null;
  origemArquivo: string | null;
  importadoPor: string | null;
  createdAt: string;
}

export interface OrganicoTrajetoriaImportRow {
  matricula: string;
  colaboradorNome: string;
  dataEvento: string;
  tipoEvento: "salario" | "cargo" | "funcao";
  titulo: string;
  descricao: string;
  motivo?: string | null;
  origemArquivo?: string | null;
}

export interface OrganicoTrajetoriaParseResult {
  source: "pdf" | "spreadsheet";
  rows: OrganicoTrajetoriaImportRow[];
  warnings: string[];
  colaboradoresDetectados: number;
  colaboradoresVinculados: number;
  colaboradoresSemMatricula: string[];
}

export interface OrganicoTrajetoriaImportResult {
  ok: boolean;
  inserted: number;
  affectedMatriculas: number;
  skippedRows: number;
  unresolvedCollaborators: string[];
}

export interface FaltaRow {
  id: number | string;
  data: string;
  mesFalta: string;
  matricula: string;
  nomeFuncionario: string;
  endereco: string;
  area: string;
  setor: string;
  lider: string;
  periodo: string;
  qntd: string;
  diasTurno: string;
  tipo: string;
  cid: string;
  localAtendimento: string;
  medicoResponsavel: string;
  /** Texto longo opcional. */
  observacoes: string;
  aprovado: string;
  reprovado: string;
}

/** Payload para gravar faltas/atestados (substitui toda a tabela). `id` opcional: UUID existente; ausente em linhas novas. */
export type FaltaReplaceRow = Omit<FaltaRow, "id"> & { id?: string };

/** Linha de sanção disciplinar (planilha: ID, NOME, TIPO, DATA DA APLICAÇÃO, MÊS, ANO; motivo em `observacoes`, coluna MOTIVO ou OBS). */
export interface SancaoDisciplinarRow {
  id: number | string;
  /** ID / matrícula no modelo Excel. */
  matricula: string;
  nomeFuncionario: string;
  tipo: string;
  /** ISO yyyy-mm-dd; filtro de mês usa este campo. */
  dataAplicacao: string;
  mes: string;
  ano: string;
  /** Motivo da sanção (obrigatório na UI; persistido como texto). */
  observacoes: string;
}

export type SancaoDisciplinarReplaceRow = Omit<SancaoDisciplinarRow, "id">;

/** Item de um cadastro de referência (períodos, tipos ou CIDs — listas independentes). */
export interface FaltaCadastroItem {
  id: string;
  ordem: number;
  valor: string;
  contabilizaIndicadores?: boolean;
  classificacaoIndicador?: "justificada" | "injustificada" | null;
  exibirNoDetalhamento?: boolean;
}

/** Cadastros de referência na aba Faltas e Atestados (listas independentes). */
export interface FaltaCadastrosData {
  periodos: FaltaCadastroItem[];
  tipos: FaltaCadastroItem[];
  cids: FaltaCadastroItem[];
  /** Tipos de sanções disciplinares (aba Sanções / cadastro). */
  tiposSancoes: FaltaCadastroItem[];
  /** Categorias para arquivamento digital de documentos do colaborador. */
  categoriasDocumentos: FaltaCadastroItem[];
  /** Grupos de sintomas (CIDs correlatos para regras de alerta). */
  gruposSintomas?: FaltaGrupoSintomaCidRow[];
}

/** Grupo de sintomas com CIDs correlatos (cadastro operacional). */
export interface FaltaGrupoSintomaCidRow {
  id: string;
  ordem: number;
  titulo: string;
  cids: string[];
}

export type FaltaAlertaBaseLegal = "clt" | "previdenciario" | "politica_interna" | "operacional";

export type FaltaAlertaSeveridade = "alta" | "media" | "baixa";

/** Configuração de uma regra de alerta (guia Regras de alertas). */
export interface FaltaAlertaRegraRow {
  id: string;
  titulo: string;
  descricao: string;
  baseLegal: FaltaAlertaBaseLegal;
  referenciaLegal?: string;
  limiteResumo: string;
  ativa: boolean;
  ordem: number;
  severidadePadrao: FaltaAlertaSeveridade;
  updatedAt?: string;
  updatedBy?: string;
}

/** Log de enquadramento quando uma regra é acionada no lançamento. */
export interface FaltaAlertaEnquadramentoRow {
  id: string;
  regraId: string;
  faltaId: string;
  inconsistenciaId?: string;
  matricula: string;
  nomeFuncionario: string;
  dataAusencia: string;
  tipo: string;
  cid?: string;
  motivo: string;
  contexto?: Record<string, unknown>;
  lancadoPor: string;
  detectadaEm: string;
  /** Espelho do status da inconsistência vinculada (fila de resolução). */
  statusResolucao?: FaltaAusenciaInconsistenciaStatus;
  resolvidaEm?: string;
  resolucaoNotas?: string;
  resolvidoPor?: string;
}

export type FaltaAusenciaInconsistenciaStatus = "pendente" | "em_analise" | "resolvida" | "ignorada";

/** Item na fila operacional de inconsistências (guia Inconsistências). */
export interface FaltaAusenciaInconsistenciaRow {
  id: string;
  faltaId: string;
  enquadramentoId?: string;
  regraId: string;
  titulo: string;
  descricao: string;
  baseLegal: FaltaAlertaBaseLegal;
  severidade: FaltaAlertaSeveridade;
  status: FaltaAusenciaInconsistenciaStatus;
  matricula: string;
  nomeFuncionario: string;
  dataAusencia: string;
  diasAcumulados?: number;
  limiteDias?: number;
  grupoCidId?: string;
  grupoCidTitulo?: string;
  detectadaEm: string;
  resolvidaEm?: string;
  resolucaoNotas?: string;
  resolvidoPor?: string;
  lancadoPor?: string;
}

/** Payload para substituir os cadastros (ordem = índice no array após ordenação no cliente). */
export interface FaltaCadastrosReplacePayload {
  periodos: string[];
  tipos: string[];
  cids: string[];
  tiposSancoes: string[];
  categoriasDocumentos: string[];
  gruposSintomas?: Array<{
    id: string;
    ordem: number;
    titulo: string;
    cids: string[];
  }>;
  tiposRegras?: Array<{
    tipo: string;
    contabilizaIndicadores: boolean;
    classificacaoIndicador: "justificada" | "injustificada" | null;
    exibirNoDetalhamento: boolean;
  }>;
}

