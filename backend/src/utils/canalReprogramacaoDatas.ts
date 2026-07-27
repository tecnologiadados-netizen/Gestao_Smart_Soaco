/**
 * Matriz de canais para alteração de datas (espelho do frontend).
 * Classificação: TipoF OU Observações/rota.
 */
import { isCarradaRota, normalizeRotaNameStr } from './rotaCarrada.js';

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
  return n.includes('retirada') || n.startsWith('1-retirada') || n.startsWith('2-retirada');
}

function isEntregaGrandeTeresinaTexto(n: string): boolean {
  if (n.startsWith('3-entrega')) return true;
  return n.includes('entrega') && n.includes('grande') && n.includes('teresina');
}

function isInserirRomaneioTexto(n: string): boolean {
  return n.includes('inserir em romaneio') || n.startsWith('4-inserir');
}

export function classificarCategoriaReprogramacao(row: Record<string, unknown>): CategoriaReprogramacaoDatas {
  const tipof = String(row['TipoF'] ?? row['tipoF'] ?? '').trim();
  const rota = String(
    row['Observacoes'] ?? row['Observações'] ?? row['Rota'] ?? row['rota'] ?? row['delivery_method'] ?? ''
  ).trim();
  const textos = [tipof, rota].filter(Boolean).map(norm);
  if (textos.some(isRequisicaoTexto)) return 'requisicao';
  if (textos.some(isRetiradaTexto)) return 'retirada';
  if (textos.some(isEntregaGrandeTeresinaTexto)) return 'entrega_grande_teresina';
  if (textos.some(isInserirRomaneioTexto)) return 'inserir_romaneio';
  if (textos.some((n) => n.includes('carradas')) || isCarradaRota(rota)) return 'carrada';
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
