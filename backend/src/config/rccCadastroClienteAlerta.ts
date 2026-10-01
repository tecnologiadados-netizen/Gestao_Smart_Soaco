/**
 * Tipo SMS (Integração → SMS) quando a RCC corrige um dado do cliente vindo do Nomus.
 */

import { prisma } from './prisma.js';

export const RCC_CADASTRO_CLIENTE_WA_CODE = 'rcc_correcao_cadastro_cliente';

const LABEL = 'RCC — correção de cadastro de pessoa';
const DESCRICAO =
  'Enviada quando a RCC corrige nome, cidade, estado, contato, telefone, bairro ou endereço do cliente consumidor em relação ao que veio do Nomus. ' +
  'O destinatário deve ajustar o cadastro da pessoa para a próxima reclamação. Configure usuários ou grupo nesta aba.';

export async function ensureRccCadastroClienteWhatsappTipo(): Promise<{ id: number; code: string }> {
  const existing = await prisma.whatsappNotificacaoTipo.findUnique({
    where: { code: RCC_CADASTRO_CLIENTE_WA_CODE },
    select: { id: true, code: true },
  });
  if (existing) return existing;

  const created = await prisma.whatsappNotificacaoTipo.create({
    data: {
      code: RCC_CADASTRO_CLIENTE_WA_CODE,
      label: LABEL,
      descricao: DESCRICAO,
      ativo: true,
      sortOrder: 82,
      fonteMensagem: 'evento',
      modoDisparo: 'evento',
    },
    select: { id: true, code: true },
  });
  return created;
}

export function montarMensagemCorrecaoCadastroCliente(input: {
  nomePessoa: string;
  codigoPessoa: string;
  campos: Array<{ rotulo: string; valor: string }>;
  observacao?: string;
}): string {
  const linhas = input.campos.map((campo) => `- ${campo.rotulo}: ${campo.valor}`);
  const observacao = (input.observacao ?? '').trim();
  const partes = [
    'Setor comercial, segue uma solicitação de inclusão no cadastro de pessoa no sistema Nomus.',
    '',
    `Pessoa: ${input.nomePessoa.trim() || '(não informada)'}`,
    `Código: ${input.codigoPessoa.trim() || '(não informado)'}`,
    '',
    'Dados a incluir:',
    ...linhas,
  ];
  if (observacao) {
    partes.push('', 'Observação:', observacao);
  }
  return partes.join('\n');
}
