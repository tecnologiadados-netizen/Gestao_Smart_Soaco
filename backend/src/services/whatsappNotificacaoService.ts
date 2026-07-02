/**
 * Montagem e envio de notificações WhatsApp configuráveis (Integração → SMS).
 */

import { sendWhatsAppTextTo } from './evolutionApi.js';
import { obterDadosFaturamentoDiario } from '../data/faturamentoDiarioRepository.js';
import { montarMensagemFaturamentoDiario } from './faturamentoDiarioMensagem.js';
import { obterDadosPedidosEntregaVencida } from '../data/pedidosRepository.js';
import { montarMensagemPedidosEntregaVencida } from './pedidosEntregaVencidaMensagem.js';
import { executarSqlSeguro } from '../data/whatsappNotificacaoNomusRepository.js';
import { buscarTipoPorCode } from '../data/whatsappNotificacaoRepository.js';

type TipoComDestinatarios = NonNullable<Awaited<ReturnType<typeof buscarTipoPorCode>>>;

function formatarBRL(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarValorColuna(key: string, val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'number' && /valor|total|liquido|desconto|devoluc/i.test(key)) {
    return formatarBRL(val);
  }
  if (val instanceof Date) {
    return val.toLocaleDateString('pt-BR');
  }
  return String(val);
}

export function montarMensagemPorTemplate(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const k = key.trim();
    const foundKey = Object.keys(row).find((col) => col.toLowerCase() === k.toLowerCase());
    if (!foundKey) return '';
    return formatarValorColuna(foundKey, row[foundKey]);
  });
}

async function gerarMensagemFaturamentoDiarioBuilder(): Promise<string> {
  const result = await obterDadosFaturamentoDiario();
  if (result.erro || !result.dados) {
    throw new Error(result.erro ?? 'Erro ao obter dados de faturamento.');
  }
  return montarMensagemFaturamentoDiario(result.dados);
}

async function gerarMensagemPedidosEntregaVencidaBuilder(): Promise<string> {
  const dados = await obterDadosPedidosEntregaVencida();
  return montarMensagemPedidosEntregaVencida(dados);
}

const BUILDERS: Record<string, () => Promise<string>> = {
  faturamento_diario: gerarMensagemFaturamentoDiarioBuilder,
  pedidos_entrega_vencida: gerarMensagemPedidosEntregaVencidaBuilder,
};

export async function gerarMensagemDoTipo(tipo: TipoComDestinatarios): Promise<string> {
  if (!tipo.ativo) throw new Error('Tipo de mensagem inativo.');

  if (tipo.fonteMensagem === 'sql_template') {
    if (!tipo.sqlNomus || !tipo.templateMensagem) {
      throw new Error('SQL e template são obrigatórios.');
    }
    const rows = await executarSqlSeguro(tipo.sqlNomus);
    if (rows.length === 0) throw new Error('SQL não retornou linhas.');
    return montarMensagemPorTemplate(tipo.templateMensagem, rows[0]!);
  }

  if (tipo.fonteMensagem === 'codigo') {
    const code = tipo.builderCode?.trim();
    if (!code || !BUILDERS[code]) {
      throw new Error(`Builder "${code ?? ''}" não registrado.`);
    }
    return BUILDERS[code]!();
  }

  throw new Error('Tipo evento requer texto informado pelo gatilho.');
}

export async function previewMensagemDoTipo(tipoId: number): Promise<{
  mensagem: string;
  colunas: string[];
  linhasPreview: Record<string, unknown>[];
}> {
  const { buscarTipoPorId } = await import('../data/whatsappNotificacaoRepository.js');
  const tipo = await buscarTipoPorId(tipoId);
  if (!tipo) throw new Error('Tipo não encontrado.');

  if (tipo.fonteMensagem === 'sql_template') {
    if (!tipo.sqlNomus || !tipo.templateMensagem) {
      throw new Error('SQL e template são obrigatórios.');
    }
    const rows = await executarSqlSeguro(tipo.sqlNomus);
    const colunas = rows.length > 0 ? Object.keys(rows[0]!) : [];
    const mensagem = rows.length > 0 ? montarMensagemPorTemplate(tipo.templateMensagem, rows[0]!) : tipo.templateMensagem;
    return { mensagem, colunas, linhasPreview: rows.slice(0, 5) };
  }

  const mensagem = await gerarMensagemDoTipo(tipo);
  return { mensagem, colunas: [], linhasPreview: [] };
}

function normalizarTelefone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function listarNumerosDestinatarios(tipo: TipoComDestinatarios): string[] {
  const nums = new Set<string>();
  for (const d of tipo.destinatarios) {
    if (!d.usuario.ativo) continue;
    const n = normalizarTelefone(d.usuario.telefone);
    if (n) nums.add(n);
  }
  return [...nums];
}

function enviarTextoWhatsApp(
  numero: string,
  texto: string,
  tipo: TipoComDestinatarios
): Promise<{ ok: boolean; error?: string }> {
  return sendWhatsAppTextTo(numero, texto);
}

export async function enviarParaDestinatarios(tipo: TipoComDestinatarios, texto: string): Promise<{ enviados: number; erros: string[] }> {
  const numeros = listarNumerosDestinatarios(tipo);
  if (numeros.length === 0) {
    console.warn(`[whatsappNotificacao] Tipo "${tipo.code}": nenhum destinatário com telefone válido.`);
    return { enviados: 0, erros: [] };
  }

  let enviados = 0;
  const erros: string[] = [];
  for (const numero of numeros) {
    const result = await enviarTextoWhatsApp(numero, texto, tipo);
    if (result.ok) {
      enviados++;
    } else {
      erros.push(`${numero}: ${result.error ?? 'erro'}`);
    }
  }
  return { enviados, erros };
}

export async function enviarNotificacaoPorTipo(code: string, texto: string): Promise<void> {
  const tipo = await buscarTipoPorCode(code);
  if (!tipo || !tipo.ativo) return;
  if (tipo.fonteMensagem !== 'evento') {
    console.warn(`[whatsappNotificacao] enviarNotificacaoPorTipo("${code}") ignorado: fonteMensagem=${tipo.fonteMensagem}`);
    return;
  }
  await enviarParaDestinatarios(tipo, texto);
}

export async function executarNotificacaoAgendada(code: string): Promise<void> {
  const tipo = await buscarTipoPorCode(code);
  if (!tipo || !tipo.ativo) return;
  try {
    const mensagem = await gerarMensagemDoTipo(tipo);
    const { enviados, erros } = await enviarParaDestinatarios(tipo, mensagem);
    console.log(`[whatsappNotificacaoCron] "${code}": ${enviados} envio(s).`);
    if (erros.length > 0) console.error(`[whatsappNotificacaoCron] "${code}" erros:`, erros.join('; '));
  } catch (err) {
    console.error(`[whatsappNotificacaoCron] "${code}":`, err instanceof Error ? err.message : err);
  }
}

export async function testarEnvioTipo(tipoId: number, usuarioId: number): Promise<void> {
  const { buscarTipoPorId } = await import('../data/whatsappNotificacaoRepository.js');
  const tipo = await buscarTipoPorId(tipoId);
  if (!tipo) throw new Error('Tipo não encontrado.');

  const dest = tipo.destinatarios.find((d) => d.usuarioId === usuarioId);
  if (!dest) throw new Error('Usuário não é destinatário deste tipo.');
  const numero = normalizarTelefone(dest.usuario.telefone);
  if (!numero) throw new Error('Usuário sem telefone válido.');

  const mensagem =
    tipo.fonteMensagem === 'evento'
      ? `[Teste] Mensagem automática: ${tipo.label}`
      : await gerarMensagemDoTipo(tipo);

  const result = await enviarTextoWhatsApp(numero, mensagem, tipo);
  if (!result.ok) throw new Error(result.error ?? 'Erro ao enviar WhatsApp.');
}
