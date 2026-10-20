/** Número inteiro positivo da solicitação aberta no Otimiza. */
export function numeroSolicitacaoOtimizaValido(valor: unknown): number | null {
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor) || valor <= 0 || valor > 2_147_483_647) return null;
    return valor;
  }
  if (typeof valor !== 'string' || !/^\d+$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) return null;
  return n;
}

const URL_PADRAO =
  'https://eifsophpuwmhebzfznxc.supabase.co/functions/v1/check-request-status';
const STATUS_CONHECIDOS = new Set(['in_progress', 'completed', 'cancelled']);
const CACHE_CONCLUIDA_MS = 45_000;

export type StatusSolicitacaoOtimiza = {
  found: boolean;
  number: number;
  status: 'in_progress' | 'completed' | 'cancelled' | null;
  isCompleted: boolean | null;
  finishedAt: string | null;
};

const cacheConcluida = new Map<number, number>();

function configOtimiza(): { url: string; anonKey: string; apiKey: string } {
  return {
    url: process.env.OTIMIZA_STATUS_URL?.trim() || URL_PADRAO,
    anonKey: process.env.OTIMIZA_SUPABASE_ANON_KEY?.trim() ?? '',
    apiKey: process.env.OTIMIZA_API_KEY?.trim() ?? '',
  };
}

export function interpretarRespostaStatusOtimiza(
  body: unknown,
  numeroPedido: number
): StatusSolicitacaoOtimiza {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const statusBruto = typeof raw.status === 'string' ? raw.status : null;
  const status =
    statusBruto && STATUS_CONHECIDOS.has(statusBruto)
      ? (statusBruto as StatusSolicitacaoOtimiza['status'])
      : null;
  const found = raw.found === true;
  return {
    found,
    number:
      typeof raw.number === 'number' && Number.isInteger(raw.number) ? raw.number : numeroPedido,
    status: found ? status : null,
    isCompleted: typeof raw.isCompleted === 'boolean' ? raw.isCompleted : null,
    finishedAt:
      typeof raw.finishedAt === 'string' && raw.finishedAt.trim() ? raw.finishedAt : null,
  };
}

export type StatusGravadoSolicitacaoOtimiza = 'in_progress' | 'completed' | 'cancelled';

/** Solicitação encontrada e concluída (cancelada também vem concluída no Otimiza). */
export function solicitacaoOtimizaConcluida(status: Pick<StatusSolicitacaoOtimiza, 'found' | 'isCompleted'>): boolean {
  return status.found && status.isCompleted === true;
}

/** null libera o aceite. Texto bloqueia, com a mensagem que o conferente vê. */
export function mensagemBloqueioAceiteOtimiza(status: StatusSolicitacaoOtimiza): string | null {
  if (!status.found) {
    return `A solicitação ${status.number} não existe no Otimiza.`;
  }
  if (status.isCompleted !== true) {
    return `A solicitação ${status.number} do Otimiza ainda está em andamento.`;
  }
  return null;
}

export async function consultarStatusSolicitacaoOtimiza(
  numero: number
): Promise<StatusSolicitacaoOtimiza> {
  const { url, anonKey, apiKey } = configOtimiza();
  if (!anonKey || !apiKey) {
    throw new Error('A consulta ao Otimiza não está configurada. Avise o administrador.');
  }
  const endpoint = `${url}${url.includes('?') ? '&' : '?'}number=${encodeURIComponent(String(numero))}`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error('[otimiza] falha de rede', { numero, motivo: err instanceof Error ? err.name : 'erro' });
    throw new Error('Não foi possível consultar a solicitação no Otimiza. Tente novamente.');
  }
  if (res.status === 429) {
    const retry = res.headers.get('retry-after');
    const segundos = retry && /^\d+$/.test(retry) ? Number(retry) : null;
    throw new Error(
      segundos != null
        ? `O Otimiza limitou as consultas. Aguarde ${segundos} segundos e tente de novo.`
        : 'O Otimiza limitou as consultas. Aguarde um momento e tente de novo.'
    );
  }
  if (res.status === 401 || res.status === 403) {
    console.error('[otimiza] consulta recusada', { numero, status: res.status });
    throw new Error('A consulta ao Otimiza foi recusada. Avise o administrador.');
  }
  if (!res.ok) {
    console.error('[otimiza] consulta falhou', { numero, status: res.status });
    throw new Error('Não foi possível consultar a solicitação no Otimiza. Tente novamente.');
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('Não foi possível consultar a solicitação no Otimiza. Tente novamente.');
  }
  return interpretarRespostaStatusOtimiza(body, numero);
}

/** Consulta o Otimiza e só segue se a solicitação existir e estiver concluída. */
export async function exigirSolicitacaoOtimizaConcluida(numero: number): Promise<void> {
  const ate = cacheConcluida.get(numero);
  if (ate != null && ate > Date.now()) return;
  const status = await consultarStatusSolicitacaoOtimiza(numero);
  const bloqueio = mensagemBloqueioAceiteOtimiza(status);
  if (bloqueio) throw new Error(bloqueio);
  cacheConcluida.set(numero, Date.now() + CACHE_CONCLUIDA_MS);
}
