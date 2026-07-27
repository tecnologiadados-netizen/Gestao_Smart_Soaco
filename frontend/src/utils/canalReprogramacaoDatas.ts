/**
 * Matriz de canais para alteração de datas (previsão / produção):
 * - Requisição → Gerenciador (Reprogramar)
 * - Retirada / Entrega Grande Teresina → Comunicação PD
 * - Inserir em Romaneio / Carradas (ROTA …) → Calendário de produção
 *
 * Classificação: TipoF OU Observações/rota (se qualquer um bater).
 */
import {
  isCarradaRota,
  normalizePdLabelForCompare,
  normalizeRotaNameStr,
  rotaFromPedidoRow,
} from './rotaCarrada';

export type CanalReprogramacaoDatas = 'gerenciador' | 'comunicacao_pd' | 'calendario';

export type CategoriaReprogramacaoDatas =
  | 'requisicao'
  | 'retirada'
  | 'entrega_grande_teresina'
  | 'inserir_romaneio'
  | 'carrada'
  | 'outro';

function norm(texto: string): string {
  return normalizeRotaNameStr(texto);
}

function isRequisicaoTexto(n: string): boolean {
  return n.includes('requisicao') || n.startsWith('5-requisicao');
}

function isRetiradaTexto(n: string): boolean {
  return (
    n.includes('retirada') ||
    n.startsWith('1-retirada') ||
    n.startsWith('2-retirada')
  );
}

function isEntregaGrandeTeresinaTexto(n: string): boolean {
  if (n.startsWith('3-entrega')) return true;
  // "entrega grande teresina" / "entrega em grande teresina"
  return n.includes('entrega') && n.includes('grande') && n.includes('teresina');
}

function isInserirRomaneioTexto(n: string): boolean {
  return n.includes('inserir em romaneio') || n.startsWith('4-inserir');
}

export function tipofFromPedidoRow(row: Record<string, unknown>): string {
  return String(row['TipoF'] ?? row['tipoF'] ?? '').trim();
}

/** Textos candidatos (TipoF + Observações) para classificação. */
export function textosClassificacaoPedido(row: Record<string, unknown>): string[] {
  const tipof = tipofFromPedidoRow(row);
  const rota = rotaFromPedidoRow(row);
  return [tipof, rota].filter((s) => s.trim() !== '');
}

export function classificarCategoriaReprogramacao(row: Record<string, unknown>): CategoriaReprogramacaoDatas {
  const textos = textosClassificacaoPedido(row).map(norm);
  if (textos.some(isRequisicaoTexto)) return 'requisicao';
  if (textos.some(isRetiradaTexto)) return 'retirada';
  if (textos.some(isEntregaGrandeTeresinaTexto)) return 'entrega_grande_teresina';
  if (textos.some(isInserirRomaneioTexto)) return 'inserir_romaneio';
  // Carrada: TipoF "carradas" ou Observações começando com "ROTA "
  if (textos.some((n) => n.includes('carradas')) || isCarradaRota(rotaFromPedidoRow(row))) {
    return 'carrada';
  }
  return 'outro';
}

export function canalPermitidoParaCategoria(cat: CategoriaReprogramacaoDatas): CanalReprogramacaoDatas | null {
  switch (cat) {
    case 'requisicao':
      return 'gerenciador';
    case 'retirada':
    case 'entrega_grande_teresina':
      return 'comunicacao_pd';
    case 'inserir_romaneio':
    case 'carrada':
      return 'calendario';
    default:
      return null;
  }
}

export function canalPermitidoPedido(row: Record<string, unknown>): CanalReprogramacaoDatas | null {
  return canalPermitidoParaCategoria(classificarCategoriaReprogramacao(row));
}

export function pedidoElegivelReprogramarGerenciador(row: Record<string, unknown>): boolean {
  return canalPermitidoPedido(row) === 'gerenciador';
}

export function pedidoPermiteAlterarDatasComunicacao(row: Record<string, unknown>): boolean {
  return canalPermitidoPedido(row) === 'comunicacao_pd';
}

/** Calendário pode reprogramar: Carrada ou Inserir em Romaneio. */
export function pedidoPermiteAlterarDatasCalendario(row: Record<string, unknown>): boolean {
  return canalPermitidoPedido(row) === 'calendario';
}

/** Rota/nome de carrada no sequenciamento (sem TipoF da linha). */
export function rotaPermiteAlterarDatasCalendario(rota: string): boolean {
  const n = norm(rota);
  if (!n) return false;
  if (isRequisicaoTexto(n) || isRetiradaTexto(n) || isEntregaGrandeTeresinaTexto(n)) return false;
  if (isInserirRomaneioTexto(n)) return true;
  if (isCarradaRota(rota) || n.includes('carradas')) return true;
  return false;
}

export function mensagemCanalDatasPedido(row: Record<string, unknown>): string {
  const canal = canalPermitidoPedido(row);
  switch (canal) {
    case 'gerenciador':
      return 'Altere as datas pelo Gerenciador de Pedidos (Reprogramar).';
    case 'comunicacao_pd':
      return 'Altere as datas pela Comunicação PD.';
    case 'calendario':
      return 'Altere as datas pelo Calendário de produção (Sequenciamento).';
    default:
      return 'Este pedido não permite alteração de datas por este canal.';
  }
}

export function pdLabelFromPedidoRow(row: Record<string, unknown>): string {
  return normalizePdLabelForCompare(String(row['PD'] ?? row['pd'] ?? '').trim());
}

/** YYYY-MM-DD de hoje (fuso local). */
export function hojeIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Valida datas de reprogramação.
 * - previsão ≥ produção (quando ambas informadas)
 * - cada data informada ≥ hoje
 */
export function validarDatasReprogramacao(opts: {
  previsaoIso?: string | null;
  producaoIso?: string | null;
  exigirNaoAnteriorHoje?: boolean;
}): string | null {
  const previsao = String(opts.previsaoIso ?? '').trim().slice(0, 10);
  const producao = String(opts.producaoIso ?? '').trim().slice(0, 10);
  const exigirHoje = opts.exigirNaoAnteriorHoje !== false;
  const hoje = hojeIsoLocal();

  if (exigirHoje) {
    if (producao && producao < hoje) {
      return 'A data de produção não pode ser anterior à data de hoje.';
    }
    if (previsao && previsao < hoje) {
      return 'A data de previsão não pode ser anterior à data de hoje.';
    }
  }
  if (previsao && producao && previsao < producao) {
    return 'A nova data de previsão não pode ser anterior à data de produção.';
  }
  return null;
}
