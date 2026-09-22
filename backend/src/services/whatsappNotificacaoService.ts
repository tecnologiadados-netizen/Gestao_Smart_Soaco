/**
 * Montagem e envio de notificações WhatsApp configuráveis (Integração → SMS).
 */

import { delayEntreDestinatariosMs, sendWhatsAppTextTo } from './evolutionApi.js';
import { obterDadosFaturamentoDiario, obterDadosFaturamentoDiarioLinhas } from '../data/faturamentoDiarioRepository.js';
import { montarMensagemFaturamentoDiario } from './faturamentoDiarioMensagem.js';
import { montarMensagemFaturamentoDiarioLinhas } from './faturamentoDiarioLinhasMensagem.js';
import { obterDadosPedidosEntregaVencida } from '../data/pedidosRepository.js';
import { montarMensagemPedidosEntregaVencida } from './pedidosEntregaVencidaMensagem.js';
import { executarSqlSeguro } from '../data/whatsappNotificacaoNomusRepository.js';
import { buscarTipoPorCode } from '../data/whatsappNotificacaoRepository.js';
import { prisma } from '../config/prisma.js';
import {
  isSgqAlertaBuilder,
  SGQ_ALERTA_CALIBRACAO_CODE,
  SGQ_ALERTA_VALIDADE_CODE,
} from '../config/sgqAlertasNotificacao.js';
import {
  executarAlertaSgqCalibracao,
  executarAlertaSgqValidade,
  montarDigestWhatsAppSgqCalibracao,
  montarDigestWhatsAppSgqValidade,
} from './sgq/sgqEmailNotificacaoService.js';
import {
  comExecucaoRegistrada,
  type OrigemNotificacao,
  type TentativaInput,
} from './notificacaoExecucaoService.js';
import {
  normalizarDestinoEnvioWhatsApp,
  normalizarJidGrupoWhatsApp,
} from '../utils/whatsappDestino.js';

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

async function gerarMensagemFaturamentoDiarioLinhasBuilder(): Promise<string> {
  const result = await obterDadosFaturamentoDiarioLinhas();
  if (result.erro || !result.dados) {
    throw new Error(result.erro ?? 'Erro ao obter faturamento por linha.');
  }
  return montarMensagemFaturamentoDiarioLinhas(result.dados);
}

async function gerarMensagemPedidosEntregaVencidaBuilder(): Promise<string> {
  const dados = await obterDadosPedidosEntregaVencida();
  return montarMensagemPedidosEntregaVencida(dados);
}

const BUILDERS: Record<string, () => Promise<string>> = {
  faturamento_diario: gerarMensagemFaturamentoDiarioBuilder,
  faturamento_diario_linhas: gerarMensagemFaturamentoDiarioLinhasBuilder,
  pedidos_entrega_vencida: gerarMensagemPedidosEntregaVencidaBuilder,
  [SGQ_ALERTA_VALIDADE_CODE]: () => montarDigestWhatsAppSgqValidade(prisma),
  [SGQ_ALERTA_CALIBRACAO_CODE]: () => montarDigestWhatsAppSgqCalibracao(prisma),
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
  const d = normalizarDestinoEnvioWhatsApp(raw);
  if (!d || normalizarJidGrupoWhatsApp(d)) return null;
  return d;
}

type DestinoWhatsApp = { numero: string; usuarioId: number | null };

export function listarDestinosWhatsApp(tipo: TipoComDestinatarios): DestinoWhatsApp[] {
  const byNumero = new Map<string, DestinoWhatsApp>();
  for (const d of tipo.destinatarios) {
    if (!d.usuario.ativo) continue;
    const n = normalizarTelefone(d.usuario.telefone);
    if (!n) continue;
    if (!byNumero.has(n)) {
      byNumero.set(n, { numero: n, usuarioId: d.usuarioId });
    }
  }
  const grupos = (tipo as { grupos?: { jid: string }[] }).grupos ?? [];
  for (const g of grupos) {
    const jid = normalizarJidGrupoWhatsApp(g.jid);
    if (!jid) continue;
    if (!byNumero.has(jid)) {
      byNumero.set(jid, { numero: jid, usuarioId: null });
    }
  }
  return [...byNumero.values()];
}

export function listarNumerosDestinatarios(tipo: TipoComDestinatarios): string[] {
  return listarDestinosWhatsApp(tipo).map((d) => d.numero);
}

function enviarTextoWhatsApp(
  numero: string,
  texto: string,
  _tipo: TipoComDestinatarios
): Promise<{ ok: boolean; error?: string; dryRun?: boolean }> {
  return sendWhatsAppTextTo(numero, texto);
}

export async function enviarParaDestinatarios(
  tipo: TipoComDestinatarios,
  texto: string
): Promise<{ enviados: number; erros: string[]; tentativas: TentativaInput[]; dryRuns: number }> {
  const destinos = listarDestinosWhatsApp(tipo);
  if (destinos.length === 0) {
    console.warn(
      `[whatsappNotificacao] Tipo "${tipo.code}": nenhum destinatário (usuário com telefone ou grupo) válido.`
    );
    return { enviados: 0, erros: [], tentativas: [], dryRuns: 0 };
  }

  const delayMs = delayEntreDestinatariosMs();
  let enviados = 0;
  let dryRuns = 0;
  const erros: string[] = [];
  const tentativas: TentativaInput[] = [];

  for (let i = 0; i < destinos.length; i++) {
    const dest = destinos[i]!;
    const result = await enviarTextoWhatsApp(dest.numero, texto, tipo);
    if (result.ok) {
      if (result.dryRun) dryRuns++;
      else enviados++;
      tentativas.push({
        canal: 'whatsapp',
        destinatario: dest.numero,
        usuarioId: dest.usuarioId,
        ok: true,
        dryRun: Boolean(result.dryRun),
      });
    } else {
      const erro = result.error ?? 'erro';
      erros.push(`${dest.numero}: ${erro}`);
      tentativas.push({
        canal: 'whatsapp',
        destinatario: dest.numero,
        usuarioId: dest.usuarioId,
        ok: false,
        erro,
      });
    }
    if (i < destinos.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  if (dryRuns > 0) {
    console.warn(
      `[whatsappNotificacao] Tipo "${tipo.code}": ${dryRuns} envio(s) em dry-run (NOTIFICACOES_ENVIO_HABILITADO≠true).`
    );
  }
  return { enviados, erros, tentativas, dryRuns };
}

export async function enviarNotificacaoPorTipo(code: string, texto: string): Promise<void> {
  const tipo = await buscarTipoPorCode(code);
  if (!tipo || !tipo.ativo) return;
  if (tipo.fonteMensagem !== 'evento') {
    console.warn(`[whatsappNotificacao] enviarNotificacaoPorTipo("${code}") ignorado: fonteMensagem=${tipo.fonteMensagem}`);
    return;
  }

  await comExecucaoRegistrada(
    { canal: 'whatsapp', tipoCode: tipo.code, tipoId: tipo.id, origem: 'evento' },
    async () => {
      const { enviados, erros, tentativas, dryRuns } = await enviarParaDestinatarios(tipo, texto);
      if (tentativas.length === 0) {
        return {
          result: undefined as void,
          forcarSkipped: true,
          resumo: 'Nenhum destinatário com telefone válido',
          metadados: { enviados: 0, erros: 0, dryRuns: 0 },
          tentativas: [],
        };
      }
      return {
        result: undefined as void,
        tentativas,
        metadados: { enviados, erros: erros.length, dryRuns },
      };
    }
  );
}

export function listarLoginsDestinatariosWhatsApp(tipo: TipoComDestinatarios): string[] {
  return [
    ...new Set(
      tipo.destinatarios
        .filter((d) => d.usuario.ativo)
        .map((d) => d.usuario.login.trim())
        .filter(Boolean)
    ),
  ];
}

export async function executarNotificacaoAgendada(
  code: string,
  origem: OrigemNotificacao = 'cron'
): Promise<void> {
  const tipo = await buscarTipoPorCode(code);
  if (!tipo || !tipo.ativo) return;

  await comExecucaoRegistrada(
    { canal: 'whatsapp', tipoCode: tipo.code, tipoId: tipo.id, origem },
    async () => {
      try {
        const builderCode = tipo.builderCode?.trim() || tipo.code;
        if (isSgqAlertaBuilder(builderCode)) {
          const extraLogins = listarLoginsDestinatariosWhatsApp(tipo);
          const extraTelefones = listarDestinosWhatsApp(tipo).map((d) => d.numero);
          const opts = {
            canal: 'whatsapp' as const,
            extraLogins,
            extraTelefones,
          };
          const result =
            builderCode === SGQ_ALERTA_VALIDADE_CODE
              ? await executarAlertaSgqValidade(prisma, opts)
              : await executarAlertaSgqCalibracao(prisma, opts);

          console.log(
            `[whatsappNotificacaoCron] "${code}": ${result.enviados} envio(s), ${result.ignorados} ignorado(s).`
          );
          if (result.erros.length > 0) {
            console.error(`[whatsappNotificacaoCron] "${code}" erros:`, result.erros.join('; '));
          }

          if (result.enviados === 0 && result.erros.length === 0) {
            return {
              result: undefined as void,
              forcarSkipped: true,
              resumo:
                result.ignorados > 0
                  ? `Sem disparo (${result.ignorados} ignorado(s) por dedup)`
                  : 'Sem disparo (nenhum alerta pendente)',
              tentativas: [],
              metadados: { enviados: 0, ignorados: result.ignorados, erros: 0 },
            };
          }

          const tentativas: TentativaInput[] = [];
          if (result.enviados > 0) {
            tentativas.push({
              canal: 'whatsapp',
              destinatario: 'sgq-cadeia',
              ok: true,
            });
          }
          for (const erro of result.erros) {
            tentativas.push({
              canal: 'whatsapp',
              destinatario: erro.split(':')[0]?.trim() || '—',
              ok: false,
              erro,
            });
          }

          return {
            result: undefined as void,
            tentativas,
            metadados: {
              enviados: result.enviados,
              ignorados: result.ignorados,
              erros: result.erros.length,
            },
          };
        }

        const mensagem = await gerarMensagemDoTipo(tipo);
        const { enviados, erros, tentativas, dryRuns } = await enviarParaDestinatarios(tipo, mensagem);
        console.log(`[whatsappNotificacaoCron] "${code}": ${enviados} envio(s).`);
        if (erros.length > 0) console.error(`[whatsappNotificacaoCron] "${code}" erros:`, erros.join('; '));

        if (tentativas.length === 0) {
          return {
            result: undefined as void,
            forcarSkipped: true,
            resumo: 'Nenhum destinatário com telefone válido',
            metadados: { enviados: 0, erros: 0, dryRuns: 0 },
            tentativas: [],
          };
        }
        return {
          result: undefined as void,
          tentativas,
          metadados: { enviados, erros: erros.length, dryRuns },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[whatsappNotificacaoCron] "${code}":`, msg);
        const skipped =
          /não retornou linhas|sem conteúdo|nenhum/i.test(msg) ||
          /SQL não retornou/i.test(msg);
        return {
          result: undefined as void,
          status: skipped ? 'skipped' : 'failed',
          forcarSkipped: skipped,
          erroMensagem: msg,
          resumo: skipped ? 'Sem disparo' : 'Falha na execução',
          tentativas: [],
        };
      }
    }
  );
}

export async function testarEnvioTipo(tipoId: number, usuarioId: number): Promise<void> {
  const { buscarTipoPorId } = await import('../data/whatsappNotificacaoRepository.js');
  const tipo = await buscarTipoPorId(tipoId);
  if (!tipo) throw new Error('Tipo não encontrado.');

  const dest = tipo.destinatarios.find((d) => d.usuarioId === usuarioId);
  if (!dest) throw new Error('Usuário não é destinatário deste tipo.');
  const numero = normalizarTelefone(dest.usuario.telefone);
  if (!numero) throw new Error('Usuário sem telefone válido.');

  await comExecucaoRegistrada(
    { canal: 'whatsapp', tipoCode: tipo.code, tipoId: tipo.id, origem: 'teste' },
    async () => {
      const mensagem =
        tipo.fonteMensagem === 'evento'
          ? `[Teste] Mensagem automática: ${tipo.label}`
          : await gerarMensagemDoTipo(tipo);

      const result = await enviarTextoWhatsApp(numero, mensagem, tipo);
      if (!result.ok) {
        throw new Error(result.error ?? 'Erro ao enviar WhatsApp.');
      }
      return {
        result: undefined as void,
        tentativas: [
          {
            canal: 'whatsapp' as const,
            destinatario: numero,
            usuarioId,
            ok: true,
            dryRun: Boolean(result.dryRun),
          },
        ],
        metadados: { teste: true, dryRun: Boolean(result.dryRun) },
      };
    }
  );
}
