/**
 * Integração Secullum Ponto Web (Integração Externa).
 *
 * Fluxo:
 *  1. Autentica em https://autenticador.secullum.com.br/token (grant_type=password) → access_token (~1h).
 *  2. Lê Funcionarios, FuncionariosAfastamentos e MotivosDemissao na API de Integração Externa.
 *  3. Normaliza para o formato consumido pelo módulo RH (SecullumFuncionario), com datas em ISO (YYYY-MM-DD).
 *
 * O token é mantido em cache em memória até ~1min antes de expirar, evitando reautenticar a cada request.
 * Somente leitura: nenhuma escrita é feita na Secullum.
 */

const AUTH_URL = 'https://autenticador.secullum.com.br/token';
const API_BASE = 'https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna';

/** Formato normalizado consumido pelo frontend do RH (api-client.ts → SecullumFuncionario). */
export interface SecullumFuncionario {
  numeroFolha: string;
  nome: string;
  empresaId: number | null;
  empresaNome: string;
  desligado: boolean;
  demissao: string;
  motivoDemissao: string;
  statusFuncionario: string;
  statusDetalhado: string;
  cpf: string;
  rg: string;
  pis: string;
  nascimento: string;
  admissao: string;
  cargo: string;
  setor: string;
  area: string;
  telefone: string;
  telefoneEmergencial: string;
  sexo: string;
  ctps: string;
  endereco: string;
}

interface SecullumConfig {
  username: string;
  password: string;
  clientId: string;
}

function getConfig(): SecullumConfig | null {
  const username = process.env.SECULLUM_USERNAME?.trim();
  const password = process.env.SECULLUM_PASSWORD?.trim();
  const clientId = process.env.SECULLUM_CLIENT_ID?.trim();
  if (!username || !password || !clientId) return null;
  return { username, password, clientId };
}

export function isSecullumEnabled(): boolean {
  return getConfig() !== null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(cfg: SecullumConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const body = new URLSearchParams({
    grant_type: 'password',
    username: cfg.username,
    password: cfg.password,
    client_id: cfg.clientId,
  });

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Falha ao autenticar na Secullum (HTTP ${res.status}). ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Secullum não retornou access_token.');
  const ttlMs = Math.max(60, (json.expires_in ?? 3600) - 60) * 1000;
  cachedToken = { value: json.access_token, expiresAt: now + ttlMs };
  return json.access_token;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Secullum ${path} falhou (HTTP ${res.status}). ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// --- Tipos crus da Secullum (apenas os campos usados) ---
interface RawEmpresa {
  Id?: number;
  Nome?: string;
}
interface RawDescricao {
  Id?: number;
  Descricao?: string;
}
interface RawFuncionario {
  Nome?: string;
  NumeroFolha?: string;
  NumeroIdentificador?: string;
  NumeroPis?: string;
  Carteira?: string;
  Endereco?: string;
  Bairro?: string;
  Uf?: string;
  Cep?: string;
  Telefone?: string;
  Celular?: string;
  Rg?: string;
  Cpf?: string;
  Nascimento?: string | null;
  Masculino?: boolean;
  Admissao?: string | null;
  Demissao?: string | null;
  EmpresaId?: number;
  Empresa?: RawEmpresa | null;
  Departamento?: RawDescricao | null;
  Funcao?: RawDescricao | null;
  Estrutura?: RawDescricao | null;
  Cidade?: RawDescricao | null;
  MotivoDemissaoId?: number | null;
}
interface RawAfastamento {
  NumeroFolha?: string;
  Inicio?: string | null;
  Fim?: string | null;
  Motivo?: string;
  JustificativaNome?: string;
}

/** "1986-10-27T00:00:00" → "1986-10-27". Vazio para nulos/invalidos. */
function toIsoDate(raw?: string | null): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : '';
}

/** "1986-10-27" → "27/10/1986" (para textos de situação trabalhista). */
function isoToBr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function limpar(v?: string | null): string {
  return String(v ?? '').trim();
}

/** Endereço consolidado a partir das partes da Secullum. */
function montarEndereco(f: RawFuncionario): string {
  const partes = [
    limpar(f.Endereco),
    limpar(f.Bairro),
    limpar(f.Cidade?.Descricao),
    limpar(f.Uf),
    limpar(f.Cep),
  ].filter((p) => p !== '');
  return partes.join(', ');
}

/** Afastamento vigente hoje para a matrícula (se houver). */
function afastamentoVigente(
  afastamentos: RawAfastamento[],
  numeroFolha: string,
): RawAfastamento | undefined {
  const hoje = toIsoDate(new Date().toISOString());
  return afastamentos.find((a) => {
    if (limpar(a.NumeroFolha) !== numeroFolha) return false;
    const ini = toIsoDate(a.Inicio);
    const fim = toIsoDate(a.Fim);
    if (!ini) return false;
    if (ini > hoje) return false;
    if (fim && fim < hoje) return false;
    return true;
  });
}

/** Afastamento cuja justificativa indica férias (ex.: JustificativaNome "FÉRIAS"). */
function afastamentoEhFerias(af: RawAfastamento): boolean {
  const texto = `${limpar(af.JustificativaNome)} ${limpar(af.Motivo)}`
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return texto.includes('FERIAS');
}

function mapFuncionario(
  f: RawFuncionario,
  motivosById: Map<number, string>,
  afastamentos: RawAfastamento[],
): SecullumFuncionario {
  const numeroFolha = limpar(f.NumeroFolha) || limpar(f.NumeroIdentificador);
  const demissaoIso = toIsoDate(f.Demissao);
  const desligado = demissaoIso !== '';
  const motivoDemissao =
    f.MotivoDemissaoId != null ? limpar(motivosById.get(f.MotivoDemissaoId)) : '';

  let statusFuncionario = 'Ativo';
  let statusDetalhado = 'Ativo';
  if (desligado) {
    statusFuncionario = 'Desligado';
    statusDetalhado = `Desligado em ${isoToBr(demissaoIso)}${motivoDemissao ? ` - ${motivoDemissao}` : ''}`;
  } else {
    const af = afastamentoVigente(afastamentos, numeroFolha);
    if (af) {
      const detalhe = limpar(af.JustificativaNome) || limpar(af.Motivo);
      if (afastamentoEhFerias(af)) {
        statusFuncionario = 'Férias';
        statusDetalhado = detalhe && detalhe.toUpperCase() !== 'FÉRIAS' ? `Férias - ${detalhe}` : 'Férias';
      } else {
        statusFuncionario = 'Afastado';
        statusDetalhado = detalhe ? `Afastado - ${detalhe}` : 'Afastado';
      }
    }
  }

  const telefone = limpar(f.Telefone) || limpar(f.Celular);

  return {
    numeroFolha,
    nome: limpar(f.Nome),
    empresaId: f.EmpresaId ?? f.Empresa?.Id ?? null,
    empresaNome: limpar(f.Empresa?.Nome),
    desligado,
    demissao: demissaoIso,
    motivoDemissao,
    statusFuncionario,
    statusDetalhado,
    cpf: limpar(f.Cpf),
    rg: limpar(f.Rg),
    pis: limpar(f.NumeroPis),
    nascimento: toIsoDate(f.Nascimento),
    admissao: toIsoDate(f.Admissao),
    cargo: limpar(f.Funcao?.Descricao),
    setor: limpar(f.Departamento?.Descricao),
    area: limpar(f.Estrutura?.Descricao),
    telefone,
    telefoneEmergencial: '',
    sexo: f.Masculino === true ? 'Masculino' : f.Masculino === false ? 'Feminino' : '',
    ctps: limpar(f.Carteira),
    endereco: montarEndereco(f),
  };
}

/**
 * Busca e normaliza os funcionários da Secullum.
 * Lança erro se a integração não estiver configurada ou se a API falhar.
 */
export async function fetchSecullumFuncionarios(): Promise<SecullumFuncionario[]> {
  const cfg = getConfig();
  if (!cfg) {
    throw new Error('Integração Secullum não configurada (defina SECULLUM_USERNAME, SECULLUM_PASSWORD e SECULLUM_CLIENT_ID).');
  }
  const token = await getAccessToken(cfg);

  // A Secullum rejeita dataFim muito distante (ex.: 2100) com HTTP 400; usa hoje+4 anos.
  const dataFim = `${new Date().getFullYear() + 4}-12-31`;
  const [funcionariosRaw, motivosRaw, afastamentosRaw] = await Promise.all([
    apiGet<RawFuncionario[]>('Funcionarios', token),
    apiGet<RawDescricao[]>('MotivosDemissao', token).catch(() => [] as RawDescricao[]),
    apiGet<RawAfastamento[]>(
      `FuncionariosAfastamentos?dataInicio=2000-01-01&dataFim=${dataFim}`,
      token,
    ).catch((err) => {
      console.error('[secullum] Falha ao buscar FuncionariosAfastamentos:', err);
      return [] as RawAfastamento[];
    }),
  ]);

  const motivosById = new Map<number, string>();
  for (const m of motivosRaw) {
    if (m.Id != null) motivosById.set(m.Id, limpar(m.Descricao));
  }

  const funcionarios = Array.isArray(funcionariosRaw) ? funcionariosRaw : [];
  const afastamentos = Array.isArray(afastamentosRaw) ? afastamentosRaw : [];

  return funcionarios
    .map((f) => mapFuncionario(f, motivosById, afastamentos))
    .filter((f) => f.numeroFolha !== '');
}
