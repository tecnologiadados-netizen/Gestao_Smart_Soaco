/**
 * Códigos de permissão do sistema.
 * Para cada menu: .ver = apenas visualizar; .editar (ou .gerenciar) = todas as funcionalidades.
 */
export const PERMISSOES = {
  DASHBOARD_VER: 'dashboard.ver',
  PEDIDOS_VER: 'pedidos.ver',
  PEDIDOS_EDITAR: 'pedidos.editar',
  COMUNICACAO_VER: 'comunicacao.ver',
  HEATMAP_VER: 'heatmap.ver',
  COMPRAS_VER: 'compras.ver',
  COMPRAS_EDITAR: 'compras.editar',
  /** Pendências compras — editar prioridade fixa do Comprador 1. */
  COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1: 'compras.pendencias.prioridade.comprador_1',
  /** Pendências compras — editar prioridade fixa do Comprador 2. */
  COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2: 'compras.pendencias.prioridade.comprador_2',
  /** Pendências compras — editar prioridade fixa do Comprador 3. */
  COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3: 'compras.pendencias.prioridade.comprador_3',
  /** Lista na finalização da coleta pedidos já recebidos (status 1) e cotações nos últimos 180 dias. */
  COMPRAS_VINCULO_FINALIZACAO_AMPLIADO: 'compras.vinculo_finalizacao.ampliado',
  PRECIFICACAO_VER: 'precificacao.ver',
  PRECIFICACAO_GERAR: 'precificacao.gerar',
  COMERCIAL_VER: 'comercial.ver',
  COMERCIAL_PAINEL_VER: 'comercial.painel.ver',
  QUALIDADE_VER: 'qualidade.ver',
  RELATORIOS_VER: 'relatorios.ver',
  INTEGRACAO_VER: 'integracao.ver',
  INTEGRACAO_EDITAR: 'integracao.editar',
  FINANCEIRO_VER: 'financeiro.ver',
  FINANCEIRO_RESUMO_VER: 'financeiro.resumo.ver',
  FINANCEIRO_DRE_VER: 'financeiro.dre.ver',
  FINANCEIRO_DFC_VER: 'financeiro.dfc.ver',
  FINANCEIRO_PAINEL_COMERCIAL_VER: 'financeiro.painel_comercial.ver',
  FINANCEIRO_RENEGOCIACAO_CONTRATOS_VER: 'financeiro.renegociacao_contratos.ver',
  FINANCEIRO_CRM_VER: 'financeiro.crm.ver',
  FINANCEIRO_CRM_EMPRESA_VER: 'financeiro.crm.empresa.ver',
  FINANCEIRO_CRM_CLIENTE_VER: 'financeiro.crm.cliente.ver',

  // Logística / Cubagem
  LOGISTICA_VER: 'logistica.ver',
  LOGISTICA_TOTAL: 'logistica.total',
  LOGISTICA_CUBAGEM_VER: 'logistica.cubagem.ver',
  LOGISTICA_CUBAGEM_EDITAR: 'logistica.cubagem.editar',

  // Fluxos Decisórios (mapas mentais)
  FLUXOS_VER: 'fluxos.ver',
  FLUXOS_EDITAR: 'fluxos.editar',

  // --- Novos códigos (enforcement real) ---
  // PCP (Gerenciador de Pedidos)
  PCP_VER_TELA: 'pcp.ver',
  PCP_EXPORTAR_XLSX: 'pcp.exportar_xlsx',
  PCP_EXPORTAR_GRADE: 'pcp.exportar_grade',
  PCP_IMPORTAR_XLSX: 'pcp.importar_xlsx',
  PCP_AJUSTAR_PREVISAO: 'pcp.ajustar_previsao',
  PCP_MOTIVO_CRIAR: 'pcp.motivo.criar',
  PCP_MOTIVO_EDITAR: 'pcp.motivo.editar',
  PCP_MOTIVO_EXCLUIR: 'pcp.motivo.excluir',
  PCP_TOTAL: 'pcp.total',
  PCP_CONSULTA_ESTOQUE_VER: 'pcp.consulta_estoque.ver',
  PCP_REGRAS_ENTREGA_VER: 'pcp.regras_entrega.ver',
  PCP_REGRAS_ENTREGA_EDITAR: 'pcp.regras_entrega.editar',
  PCP_PAINEL_GERENCIAL_VER: 'pcp.painel_gerencial.ver',
  PCP_PAINEL_TV_VER: 'pcp.painel_tv.ver',
  PCP_PAINEL_METAS_EDITAR: 'pcp.painel_metas.editar',

  // Usuários / Grupos de usuários
  USUARIOS_TELA_VER: 'usuarios.tela.ver',
  USUARIOS_CRIAR: 'usuarios.criar',
  USUARIOS_EDITAR: 'usuarios.editar',
  USUARIOS_SENHA_ALTERAR: 'usuarios.senha.alterar',
  USUARIOS_INATIVAR: 'usuarios.inativar',
  USUARIOS_EXCLUIR: 'usuarios.excluir',
  USUARIOS_TOTAL: 'usuarios.total',

  GRUPOS_TELA_VER: 'grupos.tela.ver',
  GRUPOS_CRIAR: 'grupos.criar',
  GRUPOS_EDITAR: 'grupos.editar',
  GRUPOS_INATIVAR: 'grupos.inativar',
  GRUPOS_EXCLUIR: 'grupos.excluir',
  GRUPOS_TOTAL: 'grupos.total',

  // COMUNICAÇÃO INTERNA (Comunicação PD)
  COMUNICACAO_TELA_VER: 'comunicacao.tela.ver',
  COMUNICACAO_NOVO_PEDIDO: 'comunicacao.novo_pedido',
  COMUNICACAO_HISTORICO_VER: 'comunicacao.historico.ver',
  COMUNICACAO_ATUALIZAR_CARD: 'comunicacao.atualizar_card',
  COMUNICACAO_EDITAR_RESPONSAVEL_CARD: 'comunicacao.editar_responsavel_card',
  COMUNICACAO_TAG_CONTROLAR: 'comunicacao.tag.controlar',
  COMUNICACAO_TAG_VISUALIZAR: 'comunicacao.tag.visualizar',
  /** Aparece no @ do autocomplete de comentários (Comunicação PD). */
  COMUNICACAO_COMENTARIOS_PERMITIR_MENCAO: 'comunicacao.comentarios.permitir_mencao',
  COMUNICACAO_TOTAL: 'comunicacao.total',

  // Suporte (chamados internos)
  SUPORTE_CHAMADOS_VER: 'suporte.chamados.ver',
  SUPORTE_CHAMADOS_CRIAR: 'suporte.chamados.criar',
  SUPORTE_CHAMADOS_RESPONDER: 'suporte.chamados.responder',
  SUPORTE_CHAMADOS_VER_TODOS: 'suporte.chamados.ver_todos',
  SUPORTE_CHAMADOS_ALTERAR_STATUS: 'suporte.chamados.alterar_status',
  SUPORTE_CONFIGURAR: 'suporte.configurar',

  // Sistema (rotas antes restritas ao login master)
  SISTEMA_WHATSAPP: 'sistema.whatsapp',
  SISTEMA_EMAIL: 'sistema.email',
  SISTEMA_SITUACAO_API: 'sistema.situacao_api',

  // Grupo Master (acesso total configurável pela UI)
  USUARIOS_GRUPO_MASTER_ATRIBUIR: 'usuarios.grupo_master.atribuir',
  USUARIOS_GRUPO_MASTER_REMOVER: 'usuarios.grupo_master.remover',
  GRUPOS_MASTER_EDITAR: 'grupos.master.editar',

  // Permissão legado (mantida para compatibilidade)
  USUARIOS_GERENCIAR: 'usuarios.gerenciar',
} as const;

export type CodigoPermissao = (typeof PERMISSOES)[keyof typeof PERMISSOES];

export const TODAS_PERMISSOES: CodigoPermissao[] = [
  PERMISSOES.DASHBOARD_VER,
  PERMISSOES.PEDIDOS_VER,
  PERMISSOES.PEDIDOS_EDITAR,
  PERMISSOES.COMUNICACAO_VER,
  PERMISSOES.HEATMAP_VER,
  PERMISSOES.COMPRAS_VER,
  PERMISSOES.COMPRAS_EDITAR,
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1,
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2,
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3,
  PERMISSOES.COMPRAS_VINCULO_FINALIZACAO_AMPLIADO,
  PERMISSOES.PRECIFICACAO_VER,
  PERMISSOES.PRECIFICACAO_GERAR,
  PERMISSOES.COMERCIAL_VER,
  PERMISSOES.COMERCIAL_PAINEL_VER,
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.RELATORIOS_VER,
  PERMISSOES.INTEGRACAO_VER,
  PERMISSOES.INTEGRACAO_EDITAR,
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_RESUMO_VER,
  PERMISSOES.FINANCEIRO_DRE_VER,
  PERMISSOES.FINANCEIRO_DFC_VER,
  PERMISSOES.FINANCEIRO_PAINEL_COMERCIAL_VER,
  PERMISSOES.FINANCEIRO_RENEGOCIACAO_CONTRATOS_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_EMPRESA_VER,
  PERMISSOES.FINANCEIRO_CRM_CLIENTE_VER,
  PERMISSOES.LOGISTICA_VER,
  PERMISSOES.LOGISTICA_TOTAL,
  PERMISSOES.LOGISTICA_CUBAGEM_VER,
  PERMISSOES.LOGISTICA_CUBAGEM_EDITAR,
  PERMISSOES.FLUXOS_VER,
  PERMISSOES.FLUXOS_EDITAR,

  // PCP
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.PCP_EXPORTAR_XLSX,
  PERMISSOES.PCP_EXPORTAR_GRADE,
  PERMISSOES.PCP_IMPORTAR_XLSX,
  PERMISSOES.PCP_AJUSTAR_PREVISAO,
  PERMISSOES.PCP_MOTIVO_CRIAR,
  PERMISSOES.PCP_MOTIVO_EDITAR,
  PERMISSOES.PCP_MOTIVO_EXCLUIR,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PCP_CONSULTA_ESTOQUE_VER,
  PERMISSOES.PCP_REGRAS_ENTREGA_VER,
  PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR,
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,

  // Usuários / Grupos
  PERMISSOES.USUARIOS_TELA_VER,
  PERMISSOES.USUARIOS_CRIAR,
  PERMISSOES.USUARIOS_EDITAR,
  PERMISSOES.USUARIOS_SENHA_ALTERAR,
  PERMISSOES.USUARIOS_INATIVAR,
  PERMISSOES.USUARIOS_EXCLUIR,
  PERMISSOES.USUARIOS_TOTAL,
  PERMISSOES.GRUPOS_TELA_VER,
  PERMISSOES.GRUPOS_CRIAR,
  PERMISSOES.GRUPOS_EDITAR,
  PERMISSOES.GRUPOS_INATIVAR,
  PERMISSOES.GRUPOS_EXCLUIR,
  PERMISSOES.GRUPOS_TOTAL,

  // Comunicação PD
  PERMISSOES.COMUNICACAO_TELA_VER,
  PERMISSOES.COMUNICACAO_NOVO_PEDIDO,
  PERMISSOES.COMUNICACAO_HISTORICO_VER,
  PERMISSOES.COMUNICACAO_ATUALIZAR_CARD,
  PERMISSOES.COMUNICACAO_EDITAR_RESPONSAVEL_CARD,
  PERMISSOES.COMUNICACAO_TAG_CONTROLAR,
  PERMISSOES.COMUNICACAO_TAG_VISUALIZAR,
  PERMISSOES.COMUNICACAO_COMENTARIOS_PERMITIR_MENCAO,
  PERMISSOES.COMUNICACAO_TOTAL,

  // Suporte
  PERMISSOES.SUPORTE_CHAMADOS_VER,
  PERMISSOES.SUPORTE_CHAMADOS_CRIAR,
  PERMISSOES.SUPORTE_CHAMADOS_RESPONDER,
  PERMISSOES.SUPORTE_CHAMADOS_VER_TODOS,
  PERMISSOES.SUPORTE_CHAMADOS_ALTERAR_STATUS,
  PERMISSOES.SUPORTE_CONFIGURAR,

  PERMISSOES.SISTEMA_WHATSAPP,
  PERMISSOES.SISTEMA_EMAIL,
  PERMISSOES.SISTEMA_SITUACAO_API,
  PERMISSOES.USUARIOS_GRUPO_MASTER_ATRIBUIR,
  PERMISSOES.USUARIOS_GRUPO_MASTER_REMOVER,
  PERMISSOES.GRUPOS_MASTER_EDITAR,

  // legado
  PERMISSOES.USUARIOS_GERENCIAR,
];

export const LABELS_PERMISSOES: Record<CodigoPermissao, string> = {
  [PERMISSOES.DASHBOARD_VER]: 'Ver Dashboard',
  [PERMISSOES.PEDIDOS_VER]: 'Ver Comunicação interna (Comunicação PD) e Pedidos',
  [PERMISSOES.PEDIDOS_EDITAR]: 'Editar previsões (MRP/MPP) e Comunicação PD',
  [PERMISSOES.COMUNICACAO_VER]: 'Ver Comunicação interna (Comunicação PD)',
  [PERMISSOES.HEATMAP_VER]: 'Ver Roteirizador',
  [PERMISSOES.COMPRAS_VER]: 'Ver Compras (Coletas de preços)',
  [PERMISSOES.COMPRAS_EDITAR]: 'Todas as funcionalidades (Compras)',
  [PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1]:
    'Pendências compras — editar prioridade fixa (Comprador 1) — por usuário',
  [PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2]:
    'Pendências compras — editar prioridade fixa (Comprador 2) — por usuário',
  [PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3]:
    'Pendências compras — editar prioridade fixa (Comprador 3) — por usuário',
  [PERMISSOES.COMPRAS_VINCULO_FINALIZACAO_AMPLIADO]:
    'Compras: vincular finalização a pedidos já recebidos / lista ampliada (últimos 180 dias)',
  [PERMISSOES.PRECIFICACAO_VER]: 'Visualizar Precificação',
  [PERMISSOES.PRECIFICACAO_GERAR]: 'Gerar precificação',
  [PERMISSOES.COMERCIAL_VER]: 'Ver Comercial',
  [PERMISSOES.COMERCIAL_PAINEL_VER]: 'Painel Comercial',
  [PERMISSOES.QUALIDADE_VER]: 'Ver Qualidade',
  [PERMISSOES.RELATORIOS_VER]: 'Ver Relatórios',
  [PERMISSOES.INTEGRACAO_VER]: 'Ver Integração',
  [PERMISSOES.INTEGRACAO_EDITAR]: 'Todas as funcionalidades (Integração)',
  [PERMISSOES.FINANCEIRO_VER]: 'Todas as funcionalidades (Financeiro)',
  [PERMISSOES.FINANCEIRO_RESUMO_VER]: 'Resumo Financeiro',
  [PERMISSOES.FINANCEIRO_DRE_VER]: 'DRE',
  [PERMISSOES.FINANCEIRO_DFC_VER]: 'DFC',
  [PERMISSOES.FINANCEIRO_PAINEL_COMERCIAL_VER]: 'Painel Financeiro-Comercial',
  [PERMISSOES.FINANCEIRO_RENEGOCIACAO_CONTRATOS_VER]: 'Simulação de Renegociação',
  [PERMISSOES.FINANCEIRO_CRM_VER]: 'CRM Financeiro (Receber/Pagar) — acesso completo (ambas as guias)',
  [PERMISSOES.FINANCEIRO_CRM_EMPRESA_VER]: 'CRM Financeiro — guia "Situação geral da empresa"',
  [PERMISSOES.FINANCEIRO_CRM_CLIENTE_VER]: 'CRM Financeiro — guia "Análise de crédito por cliente"',
  [PERMISSOES.LOGISTICA_VER]: 'Ver Logística',
  [PERMISSOES.LOGISTICA_TOTAL]: 'Logística — permissão total',
  [PERMISSOES.LOGISTICA_CUBAGEM_VER]: 'Cubagem — visualizar',
  [PERMISSOES.LOGISTICA_CUBAGEM_EDITAR]: 'Cubagem — editar cadastros',
  [PERMISSOES.FLUXOS_VER]: 'Ver Fluxos Decisórios (mapas mentais)',
  [PERMISSOES.FLUXOS_EDITAR]: 'Editar e excluir mapas mentais',

  // PCP
  [PERMISSOES.PCP_VER_TELA]: 'Visualizar tela de gerenciador de pedidos',
  [PERMISSOES.PCP_EXPORTAR_XLSX]: 'exportar xlsx',
  [PERMISSOES.PCP_EXPORTAR_GRADE]: 'exportar grade',
  [PERMISSOES.PCP_IMPORTAR_XLSX]: 'importar xlsx',
  [PERMISSOES.PCP_AJUSTAR_PREVISAO]: 'Ajustar previsão',
  [PERMISSOES.PCP_MOTIVO_EDITAR]: 'Editar motivo',
  [PERMISSOES.PCP_MOTIVO_EXCLUIR]: 'Excluir motivo',
  [PERMISSOES.PCP_MOTIVO_CRIAR]: 'Criar novo motivo',
  [PERMISSOES.PCP_TOTAL]: 'Permissão total',
  [PERMISSOES.PCP_CONSULTA_ESTOQUE_VER]: 'Consulta de Estoque (PCP)',
  [PERMISSOES.PCP_REGRAS_ENTREGA_VER]: 'Regras data de entrega — visualizar',
  [PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR]: 'Regras data de entrega — editar',
  [PERMISSOES.PCP_PAINEL_GERENCIAL_VER]: 'Painel Metas — Painel Gerencial',
  [PERMISSOES.PCP_PAINEL_TV_VER]: 'Painel Metas — Painel TV',
  [PERMISSOES.PCP_PAINEL_METAS_EDITAR]: 'Painel Metas — cadastrar/editar metas',

  // Usuários
  [PERMISSOES.USUARIOS_TELA_VER]: 'Visualizar tela de usuários',
  [PERMISSOES.USUARIOS_CRIAR]: 'Criar usuário',
  [PERMISSOES.USUARIOS_EDITAR]: 'Editar usuário',
  [PERMISSOES.USUARIOS_SENHA_ALTERAR]: 'Alterar senha de usuário',
  [PERMISSOES.USUARIOS_INATIVAR]: 'Inativar usuário',
  [PERMISSOES.USUARIOS_EXCLUIR]: 'Excluir usuário',
  [PERMISSOES.USUARIOS_TOTAL]: 'Permissão total',

  // Grupos
  [PERMISSOES.GRUPOS_TELA_VER]: 'Visualizar tela de grupos de usuários',
  [PERMISSOES.GRUPOS_CRIAR]: 'Criar grupos de usuários',
  [PERMISSOES.GRUPOS_EDITAR]: 'Editar grupos de usuários',
  [PERMISSOES.GRUPOS_INATIVAR]: 'Inativar grupos de usuários',
  [PERMISSOES.GRUPOS_EXCLUIR]: 'Excluir grupos de usuários',
  [PERMISSOES.GRUPOS_TOTAL]: 'Permissão total',

  // Comunicação PD
  [PERMISSOES.COMUNICACAO_TELA_VER]: 'Visualizar tela de Comunicação PD',
  [PERMISSOES.COMUNICACAO_NOVO_PEDIDO]: 'Adicionar novo pedido (novo card)',
  [PERMISSOES.COMUNICACAO_HISTORICO_VER]: 'Ver histórico',
  [PERMISSOES.COMUNICACAO_ATUALIZAR_CARD]: 'Atualizar card',
  [PERMISSOES.COMUNICACAO_EDITAR_RESPONSAVEL_CARD]: 'Editar responsável pelo card',
  [PERMISSOES.COMUNICACAO_TAG_CONTROLAR]: 'Permitir habilitar card como disponível/indisponível',
  [PERMISSOES.COMUNICACAO_TAG_VISUALIZAR]: 'Permitir visualizar card como disponível/indisponível',
  [PERMISSOES.COMUNICACAO_COMENTARIOS_PERMITIR_MENCAO]: 'Permite ser marcado nos comentários',
  [PERMISSOES.COMUNICACAO_TOTAL]: 'Permissão total',

  // Suporte
  [PERMISSOES.SUPORTE_CHAMADOS_VER]: 'Suporte: visualizar chamados (lista e detalhe)',
  [PERMISSOES.SUPORTE_CHAMADOS_CRIAR]: 'Suporte: abrir novo chamado',
  [PERMISSOES.SUPORTE_CHAMADOS_RESPONDER]: 'Suporte: enviar mensagens no chamado',
  [PERMISSOES.SUPORTE_CHAMADOS_VER_TODOS]: 'Suporte: ver chamados de todos os usuários',
  [PERMISSOES.SUPORTE_CHAMADOS_ALTERAR_STATUS]: 'Suporte: alterar status do chamado',
  [PERMISSOES.SUPORTE_CONFIGURAR]: 'Suporte: configurações (catálogo, campos da abertura)',

  [PERMISSOES.SISTEMA_WHATSAPP]: 'Acessar integração WhatsApp',
  [PERMISSOES.SISTEMA_EMAIL]: 'Configurar credencial de e-mail (Gmail)',
  [PERMISSOES.SISTEMA_SITUACAO_API]: 'Acessar situação da API',
  [PERMISSOES.USUARIOS_GRUPO_MASTER_ATRIBUIR]: 'Atribuir usuários ao grupo Master',
  [PERMISSOES.USUARIOS_GRUPO_MASTER_REMOVER]: 'Remover usuários do grupo Master',
  [PERMISSOES.GRUPOS_MASTER_EDITAR]: 'Editar configurações do grupo Master',

  // legado
  [PERMISSOES.USUARIOS_GERENCIAR]: 'Gerenciar usuários e grupos',
};
