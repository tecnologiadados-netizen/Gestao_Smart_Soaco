/**
 * Importa registros internos SGQ a partir de pastas de migração
 * (1 planilha de cadastro + arquivos de ocorrência).
 *
 * Uso:
 *   npx tsx scripts/import-sgq-registros-internos.ts --pasta "C:\...\Análise de Riscos e Oportunidades" --dry-run
 *   npx tsx scripts/import-sgq-registros-internos.ts --pasta "C:\...\Análise de Riscos e Oportunidades"
 *   npx tsx scripts/import-sgq-registros-internos.ts --pasta "..." --force
 *
 * Planilha esperada (arquivo .xlsx sem data no nome):
 *   Cabeçalho: Código | Título | Processo | Responsável pelo cadastro | Retenção | Localização
 *   1 linha = 1 ficha (origem registro, vigente, versão 00).
 *
 * Demais arquivos na pasta:
 *   "{código} {título do anexo} {dd-MM-yyyy}.xlsx"
 *   Arquivo do mesmo código SEM data = modelo da ficha.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { prisma } from '../src/config/prisma.js';
import { ensureSgqCatalogosSeed } from '../src/data/qualidadeRepository.js';
import { saveQualidadeAnexo } from '../src/utils/qualidadeUpload.js';

type PessoaResolvida = {
  valor: string;
  vinculado: boolean;
  original: string;
};

type LinhaCadastro = {
  codigo: string;
  titulo: string;
  processo: string;
  responsavel: string;
  retencao: string;
  localizacao: string;
};

type OcorrenciaArquivo = {
  codigo: string;
  titulo: string;
  dataOcorrencia: string;
  filePath: string;
  fileName: string;
  aviso?: string;
};

type ModeloArquivo = {
  codigo: string;
  filePath: string;
  fileName: string;
};

type FichaImport = {
  linha: LinhaCadastro;
  codigoExibicao: string;
  modelo: ModeloArquivo | null;
  ocorrencias: OcorrenciaArquivo[];
  planilha: string;
  pasta: string;
};

const EXT_OCORRENCIA = new Set([
  '.pdf',
  '.xlsx',
  '.xls',
  '.docx',
  '.doc',
  '.pptx',
  '.ppt',
  '.png',
  '.jpg',
  '.jpeg',
]);

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  const pastaIdx = argv.indexOf('--pasta');
  const pasta =
    pastaIdx >= 0 && argv[pastaIdx + 1]
      ? path.resolve(argv[pastaIdx + 1]!)
      : '';
  return { dryRun, force, pasta };
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cellStr(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function headerIndex(headers: string[], ...aliases: string[]): number {
  const normalized = headers.map((h) => normalizeKey(h));
  for (const alias of aliases) {
    const key = normalizeKey(alias);
    const idx = normalized.indexOf(key);
    if (idx >= 0) return idx;
  }
  return -1;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isIgnorado(fileName: string): boolean {
  if (!fileName || fileName.startsWith('~$')) return true;
  if (fileName.toLowerCase() === 'desktop.ini') return true;
  return /\.(crdownload|tmp|partial)$/i.test(fileName);
}

function listFiles(pasta: string): string[] {
  if (!fs.existsSync(pasta)) return [];
  return fs.readdirSync(pasta).filter((f) => {
    if (isIgnorado(f)) return false;
    const full = path.join(pasta, f);
    return fs.statSync(full).isFile();
  });
}

function listDirs(pasta: string): string[] {
  return fs.readdirSync(pasta).filter((f) => {
    if (f.startsWith('.')) return false;
    return fs.statSync(path.join(pasta, f)).isDirectory();
  });
}

function ymdValido(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function formatYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function extrairDataDoNome(stem: string): {
  data: string;
  resto: string;
  aviso?: string;
} | null {
  const trimmed = stem.trim();

  const dmy = trimmed.match(/^(.*?)[\s._-]*(\d{2})[-./](\d{2})[-./](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[2]);
    const m = Number(dmy[3]);
    const y = Number(dmy[4]);
    if (ymdValido(y, m, d)) {
      return { data: formatYmd(y, m, d), resto: (dmy[1] ?? '').trim() };
    }
  }

  const ymd = trimmed.match(/^(.*?)[\s._-]*(\d{4})[-./](\d{2})[-./](\d{2})$/);
  if (ymd) {
    const y = Number(ymd[2]);
    const m = Number(ymd[3]);
    const d = Number(ymd[4]);
    if (ymdValido(y, m, d)) {
      return { data: formatYmd(y, m, d), resto: (ymd[1] ?? '').trim() };
    }
  }

  // 15-032025 (hífen do dia/mês ausente)
  const broken = trimmed.match(/^(.*?)[\s._-]*(\d{2})[-./](\d{2})(\d{4})$/);
  if (broken) {
    const d = Number(broken[2]);
    const m = Number(broken[3]);
    const y = Number(broken[4]);
    if (ymdValido(y, m, d)) {
      return {
        data: formatYmd(y, m, d),
        resto: (broken[1] ?? '').trim(),
        aviso: `data no nome estava malformada; interpretada como ${formatYmd(y, m, d)}`,
      };
    }
  }

  return null;
}

function codigoNoInicio(stem: string, codigo: string): string | null {
  const re = new RegExp(`^${escapeRegex(codigo)}(?:\\s+|[-_]|$)`, 'i');
  if (!re.test(stem.trim())) return null;
  return stem.trim().slice(codigo.length).replace(/^[\s._-]+/, '').trim();
}

function parseRetencao(raw: string): {
  retencao?: string;
  retencaoValor?: number;
  retencaoUnidade?: 'anos' | 'meses';
} {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return {};
  const match = t.match(/^(\d+)\s*(anos?|ano|meses|mês|mes)$/i);
  if (!match) {
    return { retencao: raw.trim() };
  }
  const valor = Number.parseInt(match[1]!, 10);
  const unidade: 'anos' | 'meses' = match[2]!.startsWith('ano')
    ? 'anos'
    : 'meses';
  const label =
    unidade === 'meses'
      ? valor === 1
        ? '1 mês'
        : `${valor} meses`
      : valor === 1
        ? '1 ano'
        : `${valor} anos`;
  return { retencao: label, retencaoValor: valor, retencaoUnidade: unidade };
}

function detectMime(filePath: string): { mimeType: string; arquivoNome: string } {
  const arquivoNome = path.basename(filePath);
  const ext = path.extname(arquivoNome).toLowerCase();
  const mimeByExt: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return {
    mimeType: mimeByExt[ext] ?? 'application/octet-stream',
    arquivoNome,
  };
}

function readPlanilhaCadastro(filePath: string): LinhaCadastro[] {
  const wb = XLSX.readFile(filePath);
  const out: LinhaCadastro[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      sheet,
      { header: 1, defval: null, raw: true }
    ) as unknown[][];

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = (rows[i] ?? []).map((c) => cellStr(c));
      if (headerIndex(row, 'Codigo', 'Código') >= 0) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx < 0) continue;

    const headers = (rows[headerRowIdx] ?? []).map((c) => cellStr(c));
    const iCodigo = headerIndex(headers, 'Codigo', 'Código');
    const iTitulo = headerIndex(headers, 'Titulo', 'Título', 'Nome', 'Nome do documento');
    const iProcesso = headerIndex(
      headers,
      'Processo',
      'Setor',
      'Documento referente ao setor'
    );
    const iResp = headerIndex(
      headers,
      'Responsável pelo cadastro',
      'Responsavel pelo cadastro',
      'Responsável',
      'Responsavel'
    );
    const iRet = headerIndex(headers, 'Retenção', 'Retencao', 'Prazo de retenção');
    const iLoc = headerIndex(headers, 'Localização', 'Localizacao', 'Local');

    if (iCodigo < 0 || iTitulo < 0) continue;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const codigo = cellStr(row[iCodigo]);
      const titulo = cellStr(row[iTitulo]);
      if (!codigo || !titulo) continue;
      out.push({
        codigo: codigo.replace(/:\d{2}$/, '').trim(),
        titulo,
        processo: iProcesso >= 0 ? cellStr(row[iProcesso]) : '',
        responsavel: iResp >= 0 ? cellStr(row[iResp]) : '',
        retencao: iRet >= 0 ? cellStr(row[iRet]) : '',
        localizacao: iLoc >= 0 ? cellStr(row[iLoc]) : '',
      });
    }
  }

  return out;
}

function ehPlanilhaCadastro(filePath: string, fileName: string): boolean {
  if (!/\.xlsx$/i.test(fileName)) return false;
  const stem = fileName.replace(/\.[^.]+$/, '');
  if (extrairDataDoNome(stem)) return false;
  try {
    return readPlanilhaCadastro(filePath).length > 0;
  } catch {
    return false;
  }
}

function pastaTemPlanilhaCadastro(pasta: string): boolean {
  return listFiles(pasta).some((f) => ehPlanilhaCadastro(path.join(pasta, f), f));
}

function resolverPastasTrabalho(pasta: string): string[] {
  if (pastaTemPlanilhaCadastro(pasta)) return [pasta];
  const hits = listDirs(pasta)
    .map((d) => path.join(pasta, d))
    .filter((d) => pastaTemPlanilhaCadastro(d));
  return hits.length ? hits : [pasta];
}

function classificarArquivos(
  pasta: string,
  linhas: LinhaCadastro[],
  planilhaNomes: Set<string>
): {
  ocorrencias: OcorrenciaArquivo[];
  modelos: ModeloArquivo[];
  orfaos: string[];
} {
  const codes = [...new Set(linhas.map((l) => l.codigo))].sort(
    (a, b) => b.length - a.length
  );
  const ocorrencias: OcorrenciaArquivo[] = [];
  const modelos: ModeloArquivo[] = [];
  const orfaos: string[] = [];

  for (const fileName of listFiles(pasta)) {
    if (planilhaNomes.has(fileName)) continue;
    const ext = path.extname(fileName).toLowerCase();
    if (!EXT_OCORRENCIA.has(ext)) {
      orfaos.push(fileName);
      continue;
    }
    const stem = fileName.slice(0, -ext.length);
    const codigo = codes.find((c) => codigoNoInicio(stem, c) != null);
    if (!codigo) {
      orfaos.push(fileName);
      continue;
    }
    const semCodigo = codigoNoInicio(stem, codigo) ?? '';
    const parsedDate = extrairDataDoNome(semCodigo || stem);
    if (!parsedDate) {
      const tituloLivre = semCodigo.trim();
      const pareceModelo =
        !tituloLivre || /modelo|template|formulario|formulário/i.test(tituloLivre);
      if (pareceModelo) {
        modelos.push({
          codigo,
          filePath: path.join(pasta, fileName),
          fileName,
        });
      } else {
        orfaos.push(fileName);
      }
      continue;
    }
    const titulo = parsedDate.resto.trim() || semCodigo.trim() || fileName;
    ocorrencias.push({
      codigo,
      titulo,
      dataOcorrencia: parsedDate.data,
      filePath: path.join(pasta, fileName),
      fileName,
      aviso: parsedDate.aviso,
    });
  }

  ocorrencias.sort((a, b) => {
    const byDate = b.dataOcorrencia.localeCompare(a.dataOcorrencia);
    if (byDate !== 0) return byDate;
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });

  return { ocorrencias, modelos, orfaos };
}

function discoverFichas(pasta: string): {
  fichas: FichaImport[];
  orfaos: string[];
} {
  const files = listFiles(pasta);
  const planilhas = files.filter((f) =>
    ehPlanilhaCadastro(path.join(pasta, f), f)
  );
  const linhas: LinhaCadastro[] = [];
  let planilhaPath = '';
  const planilhaNomes = new Set<string>();

  for (const xlsx of planilhas) {
    const full = path.join(pasta, xlsx);
    const fromFile = readPlanilhaCadastro(full);
    if (!fromFile.length) continue;
    planilhaNomes.add(xlsx);
    planilhaPath = full;
    linhas.push(...fromFile);
  }

  const { ocorrencias, modelos, orfaos } = classificarArquivos(
    pasta,
    linhas,
    planilhaNomes
  );

  const fichas: FichaImport[] = linhas.map((linha) => ({
    linha,
    codigoExibicao: `${linha.codigo}:00`,
    modelo: modelos.find((m) => m.codigo === linha.codigo) ?? null,
    ocorrencias: ocorrencias.filter((o) => o.codigo === linha.codigo),
    planilha: planilhaPath,
    pasta,
  }));

  return { fichas, orfaos };
}

type UserRow = { login: string; nome: string | null };

function buildUserResolver(users: UserRow[]) {
  const byLogin = new Map<string, string>();
  const byNormLogin = new Map<string, string>();
  const byNormNome = new Map<string, string>();

  for (const u of users) {
    byLogin.set(u.login.toLowerCase(), u.login);
    byNormLogin.set(normalizeKey(u.login), u.login);
    if (u.nome) {
      const nk = normalizeKey(u.nome);
      if (nk && !byNormNome.has(nk)) byNormNome.set(nk, u.login);
    }
  }

  return function resolvePessoa(raw: string): PessoaResolvida {
    const original = raw.trim();
    if (!original) return { valor: '', vinculado: false, original: '' };
    const lower = original.toLowerCase();
    if (byLogin.has(lower)) {
      return { valor: byLogin.get(lower)!, vinculado: true, original };
    }
    const nk = normalizeKey(original);
    if (byNormLogin.has(nk)) {
      return { valor: byNormLogin.get(nk)!, vinculado: true, original };
    }
    if (byNormNome.has(nk)) {
      return { valor: byNormNome.get(nk)!, vinculado: true, original };
    }
    return { valor: original, vinculado: false, original };
  };
}

function fmtPessoa(p: PessoaResolvida): string {
  if (!p.original) return '—';
  return p.vinculado
    ? `${p.original} → ${p.valor}`
    : `${p.original} (nome livre)`;
}

async function resolveSetorUidByNome(nome: string): Promise<string> {
  const trimmed = nome.trim();
  if (!trimmed) return '';
  const setores = await prisma.sgqSetor.findMany();
  const nk = normalizeKey(trimmed);
  const hit = setores.find((s) => normalizeKey(s.nome) === nk);
  return hit?.uid ?? '';
}

async function resolveTipoReUid(): Promise<string> {
  const tipo = await prisma.sgqTipoDocumento.findUnique({
    where: { sigla: 'RE' },
  });
  return tipo?.uid ?? '';
}

async function importFicha(
  ficha: FichaImport,
  resolvePessoa: (raw: string) => PessoaResolvida,
  tipoUid: string,
  opts: { dryRun: boolean; force: boolean }
) {
  const codigoAtual = ficha.codigoExibicao;
  const candidatos = await prisma.sgqDocumento.findMany({
    where: {
      OR: [
        { codigo: codigoAtual },
        { codigo: ficha.linha.codigo },
        { codigo: { startsWith: `${ficha.linha.codigo}:` } },
      ],
    },
  });
  const existingAny =
    candidatos.find((d) => {
      const base = d.codigo.replace(/:\d{2}$/, '');
      return base === ficha.linha.codigo;
    }) ?? null;

  if (existingAny && !opts.force) {
    console.log(
      `  [skip] ${codigoAtual} já existe (uid=${existingAny.uid}, codigo=${existingAny.codigo}). Use --force para sobrescrever.`
    );
    return { skipped: true };
  }

  const responsavel = resolvePessoa(ficha.linha.responsavel);
  const setorUid = await resolveSetorUidByNome(ficha.linha.processo);
  const retencao = parseRetencao(ficha.linha.retencao);

  console.log(`  ficha ${codigoAtual} — ${ficha.linha.titulo}`);
  console.log(
    `    processo: ${ficha.linha.processo || '—'} → ${
      setorUid ? 'setor vinculado' : 'não encontrado (fica vazio)'
    }`
  );
  console.log(`    responsável: ${fmtPessoa(responsavel)}`);
  console.log(`    retenção: ${retencao.retencao || '—'}`);
  console.log(
    `    modelo: ${ficha.modelo ? ficha.modelo.fileName : '(nenhum)'}`
  );
  console.log(`    ocorrências: ${ficha.ocorrencias.length}`);
  for (const o of ficha.ocorrencias) {
    console.log(
      `      - ${o.dataOcorrencia}  ${o.titulo}${o.aviso ? `  [aviso: ${o.aviso}]` : ''}`
    );
  }

  if (opts.dryRun) {
    return { skipped: false, dryRun: true };
  }

  const now = new Date().toISOString();
  const docUid =
    existingAny?.uid ??
    `doc-reg-${normalizeKey(ficha.linha.codigo) || 'x'}-${randomUUID().slice(0, 8)}`;

  const ocorrenciasMeta = ficha.ocorrencias.map((o) => {
    const ocorrenciaId = `ocr-mig-${randomUUID()}`;
    return { ...o, ocorrenciaId };
  });

  const anexosSalvos: Array<{
    nome: string;
    storagePath: string;
    ocorrenciaId: string;
  }> = [];

  for (const o of ocorrenciasMeta) {
    const meta = detectMime(o.filePath);
    const buf = fs.readFileSync(o.filePath);
    const savedFile = saveQualidadeAnexo(`documentos/${docUid}/ocorrencias`, {
      fileName: meta.arquivoNome,
      mimeType: meta.mimeType,
      contentBase64: buf.toString('base64'),
    });
    anexosSalvos.push({
      nome: o.titulo,
      storagePath: savedFile.storagePath,
      ocorrenciaId: o.ocorrenciaId,
    });
  }

  let modeloNome: string | null = null;
  let modeloStoragePath: string | null = null;
  let modeloMimeType: string | null = null;
  if (ficha.modelo) {
    const meta = detectMime(ficha.modelo.filePath);
    const buf = fs.readFileSync(ficha.modelo.filePath);
    const savedFile = saveQualidadeAnexo(`documentos/${docUid}`, {
      fileName: meta.arquivoNome,
      mimeType: meta.mimeType,
      contentBase64: buf.toString('base64'),
    });
    modeloNome = meta.arquivoNome;
    modeloStoragePath = savedFile.storagePath;
    modeloMimeType = savedFile.mimeType;
  }

  const externoRegistro = {
    unidadeTodos: true,
    distribuicaoEletronica: true,
    distribuicaoFisica: false,
    avisarAntesAtivo: false,
    avisarAntesDias: 30,
    associarDocumentos: false,
    documentosAssociadosIds: [] as string[],
    permissaoAcesso: 'todos' as const,
    ...retencao,
    ...(modeloNome
      ? {
          modelo: {
            nome: modeloNome,
            ...(modeloStoragePath ? { storagePath: modeloStoragePath } : {}),
          },
        }
      : {}),
    ocorrencias: ocorrenciasMeta.map((o) => ({
      id: o.ocorrenciaId,
      nome: o.titulo,
      dataOcorrencia: o.dataOcorrencia,
      criadoEm: now,
      storagePath: anexosSalvos.find((a) => a.ocorrenciaId === o.ocorrenciaId)
        ?.storagePath,
    })),
  };

  const permissoes = {
    avisoPublicacaoEmailIds: [] as string[],
    baixarArquivoIds: [] as string[],
    imprimirArquivoIds: [] as string[],
    copiasDistribuidasIds: [] as string[],
    consultarTodos: true,
    consultarIds: [] as string[],
  };

  const saved = await prisma.sgqDocumento.upsert({
    where: { uid: docUid },
    create: {
      uid: docUid,
      codigo: codigoAtual,
      titulo: ficha.linha.titulo,
      origem: 'registro',
      status: 'vigente',
      tipoUid: tipoUid || existingAny?.tipoUid || '',
      setorUid: setorUid || existingAny?.setorUid || '',
      versaoAtual: '00',
      localizacao: ficha.linha.localizacao || null,
      permissoesJson: JSON.stringify(permissoes),
      externoRegistroJson: JSON.stringify(externoRegistro),
      criadoPorLogin: responsavel.valor || 'migracao',
      statusAtualizadoEm: now,
    },
    update: {
      codigo: codigoAtual,
      titulo: ficha.linha.titulo,
      origem: 'registro',
      status: 'vigente',
      versaoAtual: '00',
      tipoUid: tipoUid || existingAny?.tipoUid || '',
      setorUid: setorUid || existingAny?.setorUid || '',
      localizacao: ficha.linha.localizacao || existingAny?.localizacao || null,
      permissoesJson: JSON.stringify(permissoes),
      externoRegistroJson: JSON.stringify(externoRegistro),
    },
  });

  const existingVer = await prisma.sgqDocumentoVersao.findFirst({
    where: { documentoId: saved.id, versao: '00' },
  });
  const verUid =
    existingVer?.uid ??
    `ver-reg-${normalizeKey(ficha.linha.codigo) || 'x'}-00-${randomUUID().slice(0, 8)}`;

  await prisma.sgqDocumentoVersao.upsert({
    where: { uid: verUid },
    create: {
      uid: verUid,
      documentoId: saved.id,
      versao: '00',
      elaboradorLogin: responsavel.valor || null,
      dataElaboracao: now,
      dataAprovacao: now,
      observacoes: 'Importado na migração de registros internos',
      arquivoNome: modeloNome,
      arquivoStoragePath: modeloStoragePath,
      arquivoMimeType: modeloMimeType,
      arquivoAtualizadoEm: now,
      anexosJson: JSON.stringify(anexosSalvos),
    },
    update: {
      elaboradorLogin: responsavel.valor || existingVer?.elaboradorLogin || null,
      observacoes: 'Importado na migração de registros internos',
      arquivoNome: modeloNome,
      arquivoStoragePath: modeloStoragePath,
      arquivoMimeType: modeloMimeType,
      arquivoAtualizadoEm: now,
      anexosJson: JSON.stringify(anexosSalvos),
    },
  });

  console.log(`    gravado uid=${saved.uid}`);
  return { skipped: false, dryRun: false, uid: saved.uid };
}

async function main() {
  const { dryRun, force, pasta } = parseArgs(process.argv.slice(2));
  if (!pasta) {
    console.error(
      'Uso: npx tsx scripts/import-sgq-registros-internos.ts --pasta "<caminho>" [--dry-run] [--force]'
    );
    process.exit(1);
  }
  if (!fs.existsSync(pasta) || !fs.statSync(pasta).isDirectory()) {
    console.error(`Pasta não encontrada: ${pasta}`);
    process.exit(1);
  }

  const pastas = resolverPastasTrabalho(pasta);
  console.log(`Pasta: ${pasta}`);
  if (pastas.length === 1 && pastas[0] !== pasta) {
    console.log(`Subpasta com planilha: ${pastas[0]}`);
  }
  console.log(
    `Modo: ${dryRun ? 'DRY-RUN (não grava)' : 'APLICAR'}${force ? ' + FORCE' : ''}`
  );

  await ensureSgqCatalogosSeed();

  const todasFichas: FichaImport[] = [];
  const todosOrfaos: string[] = [];
  for (const p of pastas) {
    const { fichas, orfaos } = discoverFichas(p);
    todasFichas.push(...fichas);
    todosOrfaos.push(...orfaos.map((o) => (pastas.length > 1 ? `${path.basename(p)}/${o}` : o)));
  }

  if (!todasFichas.length) {
    console.error('Nenhuma planilha/ficha de registro encontrada na pasta.');
    process.exit(1);
  }

  console.log(`Fichas encontradas: ${todasFichas.length}`);
  if (todosOrfaos.length) {
    console.warn(`Arquivos órfãos (${todosOrfaos.length}):`);
    for (const o of todosOrfaos) console.warn(`  - ${o}`);
  }

  const users = await prisma.usuario.findMany({
    select: { login: true, nome: true },
  });
  const resolvePessoa = buildUserResolver(users);
  const tipoUid = await resolveTipoReUid();
  if (!tipoUid) {
    console.warn('[aviso] tipo RE não encontrado no catálogo.');
  }

  let imported = 0;
  let skipped = 0;
  for (const ficha of todasFichas) {
    console.log(
      `\n=== ${ficha.codigoExibicao} (${path.basename(ficha.planilha || ficha.pasta)}) ===`
    );
    const result = await importFicha(ficha, resolvePessoa, tipoUid, {
      dryRun,
      force,
    });
    if (result.skipped) skipped += 1;
    else imported += 1;
  }

  console.log(
    `\nConcluído. processados=${imported} skip=${skipped} orfaos=${todosOrfaos.length} dryRun=${dryRun}`
  );
  if (dryRun) {
    console.log('Nada foi gravado. Remova --dry-run para importar de verdade.');
  } else {
    console.log(
      'Abra Qualidade → Documentos → Consulta → guia Registros e atualize a página.'
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
