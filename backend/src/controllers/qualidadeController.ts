import type { Request, Response } from 'express';
import { enviarNotificacaoPorTipo } from '../services/whatsappNotificacaoService.js';
import {
  ensureRccCadastroClienteWhatsappTipo,
  montarMensagemCorrecaoCadastroCliente,
  RCC_CADASTRO_CLIENTE_WA_CODE,
} from '../config/rccCadastroClienteAlerta.js';
import {
  buscarClientesNomus,
  buscarDocumentosEntradaNomus,
  buscarFornecedoresNomus,
  buscarItensPedidoVendaAtendidosNomus,
  buscarNotasFiscaisPedidoVendaNomus,
  buscarPedidosVendaNomus,
  buscarPessoasNomus,
  buscarIdPessoaNomusPorNome,
  buscarProdutosNomus,
  buscarRncPainelNomus,
  buscarSetorProducaoPorProduto,
} from '../data/qualidadeNomusRepository.js';
import {
  getQualidadeBootstrap,
  importRegistrosFromJson,
  listOrganicoColaboradoresParaRnc,
  listQualidadeResponsaveis,
  syncQualidadeAvaliacoes,
  syncQualidadeCalibrations,
  syncQualidadeConfig,
  syncQualidadeDocuments,
  syncQualidadeOpcoesLista,
  syncQualidadeRegistros,
  deleteQualidadeRegistro,
  tipoQualidadeRegistro,
  deleteQualidadeDocumento,
  deleteQualidadeEquipamento,
  documentosQuePassamAObsoleto,
  equipamentosComAtivoAlterado,
  opcoesListaRemoveValor,
  listReclamacoesProduto,
  criarReclamacaoProduto,
  atualizarReclamacaoProduto,
  excluirReclamacaoProduto,
  listCausasProblema,
  criarCausaProblema,
  atualizarCausaProblema,
  excluirCausaProblema,
  listServicosRealizados,
  criarServicoRealizado,
  atualizarServicoRealizado,
  excluirServicoRealizado,
} from '../data/qualidadeRepository.js';
import { getPermissoesUsuario } from '../middleware/requirePermission.js';
import { temConfigQualidade, temExcluirConfigQualidade, temExcluirRegistroQualidade, temImportarRegistrosQualidade, temInativarCalibracoesQualidade, temInativarDocumentosQualidade, temRegistroQualidade } from '../utils/qualidadePermissoes.js';
import { gerarRccPdfBuffer, gerarRncPdfBuffer } from '../services/qualidadePdfService.js';
import { ensureQualidadePreviewPdf } from '../services/sgq/sgqOfficeToPdf.js';

const CLIENTES_SEARCH_LIMIT = 80;
const PRODUTOS_SEARCH_LIMIT = 100;
const FORNECEDORES_SEARCH_LIMIT = 100;
const PEDIDOS_VENDA_SEARCH_LIMIT = 50;
const PESSOAS_SEARCH_LIMIT = 100;
const DOCUMENTOS_ENTRADA_SEARCH_LIMIT = 100;

function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  return Math.min(Math.max(Number(raw) || fallback, 1), max);
}

function userLogin(req: Request): string {
  return req.user?.login ?? 'sistema';
}

export async function getQualidadeClientes(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    const limit = parseLimit(typeof req.query.limit === 'string' ? req.query.limit : undefined, 30, CLIENTES_SEARCH_LIMIT);
    const result = await buscarClientesNomus({ q, id, limit });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar clientes.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeProdutos(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const codigo = typeof req.query.codigo === 'string' ? req.query.codigo : undefined;
    const pedidoId =
      typeof req.query.pedidoId === 'string' ? req.query.pedidoId : undefined;
    const somenteAcabadoIntermediario = req.query.escopo === 'acabado-intermediario';
    const limit = parseLimit(typeof req.query.limit === 'string' ? req.query.limit : undefined, 40, PRODUTOS_SEARCH_LIMIT);
    const result = await buscarProdutosNomus({
      q,
      codigo,
      pedidoId,
      somenteAcabadoIntermediario,
      limit,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar produtos.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadePedidosVenda(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const somenteAtendidos = req.query.somenteAtendidos === '1';
    const limit = parseLimit(
      typeof req.query.limit === 'string' ? req.query.limit : undefined,
      20,
      PEDIDOS_VENDA_SEARCH_LIMIT
    );
    const result = await buscarPedidosVendaNomus({ q, limit, somenteAtendidos });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar pedidos de venda.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeItensPedidoVenda(req: Request, res: Response): Promise<void> {
  try {
    const pedidoId = typeof req.params.pedidoId === 'string' ? req.params.pedidoId : '';
    const result = await buscarItensPedidoVendaAtendidosNomus(pedidoId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar itens do pedido.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeNotasFiscaisPedidoVenda(req: Request, res: Response): Promise<void> {
  try {
    const pedidoId = typeof req.params.pedidoId === 'string' ? req.params.pedidoId : '';
    const result = await buscarNotasFiscaisPedidoVendaNomus(pedidoId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar a nota fiscal do pedido.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeFornecedores(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = parseLimit(
      typeof req.query.limit === 'string' ? req.query.limit : undefined,
      40,
      FORNECEDORES_SEARCH_LIMIT
    );
    const result = await buscarFornecedoresNomus({ q, limit });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar fornecedores.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadePessoas(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = parseLimit(
      typeof req.query.limit === 'string' ? req.query.limit : undefined,
      40,
      PESSOAS_SEARCH_LIMIT
    );
    const funcionarios =
      req.query.funcionarios === '1' || req.query.funcionarios === 'true';
    const parceiros = req.query.parceiros === '1' || req.query.parceiros === 'true';
    const result = await buscarPessoasNomus({
      q,
      limit,
      apenasFuncionarios: funcionarios,
      apenasParceiros: parceiros,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar pessoas.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeDocumentosEntrada(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const fornecedorId =
      typeof req.query.fornecedorId === 'string' ? req.query.fornecedorId.trim() : '';
    if (!fornecedorId) {
      res.status(400).json({ error: 'Informe fornecedorId.' });
      return;
    }

    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = parseLimit(
      typeof req.query.limit === 'string' ? req.query.limit : undefined,
      40,
      DOCUMENTOS_ENTRADA_SEARCH_LIMIT
    );
    const result = await buscarDocumentosEntradaNomus({ fornecedorId, q, limit });
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao buscar documentos de entrada.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeRncPainel(_req: Request, res: Response): Promise<void> {
  try {
    const result = await buscarRncPainelNomus();
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar painel de RNC.';
    res.status(500).json({ error: message });
  }
}

interface RncPdfBody {
  registro?: { tipo?: string; rnc?: unknown };
}

interface RccPdfBody {
  versao?: 'cliente' | 'empresa';
  registro?: { tipo?: string; rcc?: unknown };
}

export async function postQualidadeRncPdf(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as RncPdfBody;
    const registro = body?.registro;
    if (!registro || registro.tipo !== 'rnc' || !registro.rnc) {
      res.status(400).json({ error: 'Registro RNC inválido para geração do PDF.' });
      return;
    }
    const pdfBuffer = await gerarRncPdfBuffer(registro);
    const codigo =
      (registro as { codigoDocumento?: string; numero?: string }).codigoDocumento ??
      (registro as { numero?: string }).numero ??
      'relatorio';
    const filename = `RNC_${String(codigo).replace(/[^\w.-]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o PDF do RNC.';
    res.status(500).json({ error: message });
  }
}

export async function postQualidadeRccPdf(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as RccPdfBody;
    const registro = body?.registro;
    const versao = body?.versao === 'empresa' ? 'empresa' : 'cliente';
    if (!registro || registro.tipo !== 'rcc' || !registro.rcc) {
      res.status(400).json({ error: 'Registro RCC inválido para geração do PDF.' });
      return;
    }
    const pdfBuffer = await gerarRccPdfBuffer(registro, versao);
    const codigo =
      (registro as { codigoDocumento?: string; numero?: string }).codigoDocumento ??
      (registro as { numero?: string }).numero ??
      'relatorio';
    const sufixo = versao === 'cliente' ? 'Cliente' : 'Empresa';
    const filename = `RCC_${String(codigo).replace(/[^\w.-]+/g, '_')}_${sufixo}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o PDF do RCC.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeBootstrapHandler(_req: Request, res: Response): Promise<void> {
  try {
    const data = await getQualidadeBootstrap();
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar dados do módulo Qualidade.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeOrganicoColaboradoresHandler(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const colaboradores = await listOrganicoColaboradoresParaRnc();
    res.json({ colaboradores });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao listar o orgânico.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeResponsaveisHandler(_req: Request, res: Response): Promise<void> {
  try {
    const users = await listQualidadeResponsaveis();
    res.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao listar responsáveis.';
    res.status(500).json({ error: message });
  }
}

export async function putQualidadeConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    let body: unknown = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body) as Record<string, unknown>;
      } catch {
        res.status(400).json({ error: 'Corpo da requisição inválido.' });
        return;
      }
    }
    const payload = body as { departments?: unknown; documentTypes?: unknown };
    const perms = await getPermissoesUsuario(userLogin(req));
    const podeSetores = temConfigQualidade(perms, 'setores');
    const podeCategorias = temConfigQualidade(perms, 'categorias');
    if (!podeSetores && !podeCategorias) {
      res.status(403).json({ error: 'Sem permissão para esta configuração.' });
      return;
    }
    await syncQualidadeConfig({
      departments: (podeSetores && Array.isArray(payload.departments) ? payload.departments : []) as Array<{
        id?: string;
        nome: string;
      }>,
      documentTypes: (podeCategorias && Array.isArray(payload.documentTypes) ? payload.documentTypes : []) as Array<{
        id?: string;
        nome: string;
        sigla: string;
      }>,
    });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar configurações.';
    res.status(500).json({ error: message });
  }
}

export async function putQualidadeRegistrosHandler(req: Request, res: Response): Promise<void> {
  try {
    const registros = (Array.isArray(req.body?.registros) ? req.body.registros : []) as Array<
      Record<string, unknown>
    >;
    const perms = await getPermissoesUsuario(userLogin(req));
    const permitidos = registros.filter((reg) => {
      const tipo = String(reg.tipo ?? '');
      return tipo && temRegistroQualidade(perms, tipo);
    });
    if (registros.length > 0 && permitidos.length === 0) {
      res.status(403).json({ error: 'Sem permissão para este tipo de registro.' });
      return;
    }
    const numeros = await syncQualidadeRegistros(permitidos, userLogin(req));
    res.json({ ok: true, numeros });
  } catch (error) {
    console.error('[qualidade] falha ao salvar registros:', error);
    res.status(500).json({
      error: 'Não foi possível salvar o registro. Tente novamente.',
    });
  }
}

export async function deleteQualidadeRegistroHandler(req: Request, res: Response): Promise<void> {
  try {
    const uid = typeof req.params.uid === 'string' ? req.params.uid.trim() : '';
    if (!uid) {
      res.status(400).json({ error: 'Registro inválido.' });
      return;
    }
    const tipo = await tipoQualidadeRegistro(uid);
    if (!tipo) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    const perms = await getPermissoesUsuario(userLogin(req));
    if (!temExcluirRegistroQualidade(perms, tipo)) {
      res.status(403).json({ error: 'Sem permissão para excluir este registro.' });
      return;
    }
    const removed = await deleteQualidadeRegistro(uid);
    if (!removed) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir registro.';
    res.status(500).json({ error: message });
  }
}

export async function putQualidadeDocumentsHandler(req: Request, res: Response): Promise<void> {
  try {
    // Body inválido/vazio (ex.: JSON > limite 80MB) chega como {} — não tratar como sucesso.
    if (!req.body || typeof req.body !== 'object' || !Array.isArray(req.body.documents)) {
      res.status(400).json({
        error:
          'Payload de documentos inválido ou incompleto (possível estouro do limite de upload). Nenhum documento foi alterado.',
      });
      return;
    }
    const perms = await getPermissoesUsuario(userLogin(req));
    if (
      await documentosQuePassamAObsoleto(req.body.documents) &&
      !temInativarDocumentosQualidade(perms)
    ) {
      res.status(403).json({ error: 'Sem permissão para inativar documentos.' });
      return;
    }
    await syncQualidadeDocuments({
      documents: req.body.documents,
      versions: Array.isArray(req.body.versions) ? req.body.versions : [],
      tasks: Array.isArray(req.body.tasks) ? req.body.tasks : [],
      validadeAlertas: Array.isArray(req.body.validadeAlertas)
        ? req.body.validadeAlertas
        : [],
      revalidacoes: Array.isArray(req.body.revalidacoes) ? req.body.revalidacoes : [],
      criadoPorLogin: userLogin(req),
    });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar documentos.';
    res.status(500).json({ error: message });
  }
}

export async function deleteQualidadeDocumentHandler(req: Request, res: Response): Promise<void> {
  try {
    const uid = typeof req.params.uid === 'string' ? req.params.uid.trim() : '';
    if (!uid) {
      res.status(400).json({ error: 'Documento inválido.' });
      return;
    }
    const removed = await deleteQualidadeDocumento(uid);
    if (!removed) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir documento.';
    res.status(500).json({ error: message });
  }
}

export async function putQualidadeCalibrationsHandler(req: Request, res: Response): Promise<void> {
  try {
    // Body inválido/vazio (ex.: JSON > limite) chega como {} — não tratar como wipe intencional.
    if (!req.body || typeof req.body !== 'object' || !Array.isArray(req.body.equipment)) {
      res.status(400).json({
        error: 'Payload de calibrações inválido ou incompleto. Nenhum equipamento foi alterado.',
      });
      return;
    }
    const perms = await getPermissoesUsuario(userLogin(req));
    if (
      await equipamentosComAtivoAlterado(req.body.equipment) &&
      !temInativarCalibracoesQualidade(perms)
    ) {
      res.status(403).json({ error: 'Sem permissão para inativar equipamentos.' });
      return;
    }
    await syncQualidadeCalibrations({
      equipment: req.body.equipment,
      calibrationRecords: Array.isArray(req.body.calibrationRecords)
        ? req.body.calibrationRecords
        : [],
      verificationRecords: Array.isArray(req.body.verificationRecords)
        ? req.body.verificationRecords
        : [],
      tasks: Array.isArray(req.body.tasks) ? req.body.tasks : [],
    });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar calibrações.';
    res.status(500).json({ error: message });
  }
}

export async function deleteQualidadeEquipamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const uid = typeof req.params.uid === 'string' ? req.params.uid.trim() : '';
    if (!uid) {
      res.status(400).json({ error: 'Equipamento inválido.' });
      return;
    }
    const removed = await deleteQualidadeEquipamento(uid);
    if (!removed) {
      res.status(404).json({ error: 'Equipamento não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir equipamento.';
    res.status(500).json({ error: message });
  }
}

export async function putQualidadeAvaliacoesHandler(req: Request, res: Response): Promise<void> {
  try {
    const avaliacoes = Array.isArray(req.body?.avaliacoes) ? req.body.avaliacoes : [];
    await syncQualidadeAvaliacoes(avaliacoes);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar avaliações.';
    res.status(500).json({ error: message });
  }
}

export async function putQualidadeOpcoesListaHandler(req: Request, res: Response): Promise<void> {
  try {
    const opcoes =
      req.body?.opcoes && typeof req.body.opcoes === 'object' ? req.body.opcoes : {};
    const perms = await getPermissoesUsuario(userLogin(req));
    if (!temConfigQualidade(perms, 'enderecamento')) {
      res.status(403).json({ error: 'Sem permissão para endereçamento.' });
      return;
    }
    if (
      (await opcoesListaRemoveValor(opcoes as Record<string, unknown>)) &&
      !temExcluirConfigQualidade(perms, 'enderecamento')
    ) {
      res.status(403).json({ error: 'Sem permissão para excluir endereçamento.' });
      return;
    }
    await syncQualidadeOpcoesLista(opcoes);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar opções de lista.';
    res.status(500).json({ error: message });
  }
}

export async function postQualidadeRegistrosImportHandler(req: Request, res: Response): Promise<void> {
  try {
    const registros = (Array.isArray(req.body?.registros) ? req.body.registros : []) as Array<
      Record<string, unknown>
    >;
    const perms = await getPermissoesUsuario(userLogin(req));
    if (!temImportarRegistrosQualidade(perms)) {
      res.status(403).json({ error: 'Sem permissão para importar registros.' });
      return;
    }
    const permitidos = registros.filter((reg) => {
      const tipo = String(reg.tipo ?? '');
      return tipo && temRegistroQualidade(perms, tipo);
    });
    if (registros.length > 0 && permitidos.length === 0) {
      res.status(403).json({ error: 'Sem permissão para este tipo de registro.' });
      return;
    }
    const result = await importRegistrosFromJson(permitidos, userLogin(req));
    res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao importar registros.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeSetorProducaoProduto(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await buscarSetorProducaoPorProduto(q);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar o setor de produção.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeReclamacoesProduto(_req: Request, res: Response): Promise<void> {
  const reclamacoes = await listReclamacoesProduto();
  res.json({ reclamacoes });
}

export async function postQualidadeReclamacaoProduto(req: Request, res: Response): Promise<void> {
  try {
    const exemplo = req.body?.exemplo;
    const reclamacao = await criarReclamacaoProduto({
      descricao: String(req.body?.descricao ?? ''),
      setorProducao: String(req.body?.setorProducao ?? ''),
      exemplo:
        exemplo && typeof exemplo === 'object'
          ? {
              codigo: String((exemplo as { codigo?: unknown }).codigo ?? ''),
              descricao: String((exemplo as { descricao?: unknown }).descricao ?? ''),
            }
          : null,
    });
    res.status(201).json({ reclamacao });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao cadastrar reclamação.';
    res.status(400).json({ error: message });
  }
}

export async function putQualidadeReclamacaoProduto(req: Request, res: Response): Promise<void> {
  try {
    const uid = String(req.params.uid ?? '');
    const exemplo = req.body?.exemplo;
    const reclamacao = await atualizarReclamacaoProduto(uid, {
      descricao: String(req.body?.descricao ?? ''),
      setorProducao: String(req.body?.setorProducao ?? ''),
      exemplo:
        exemplo && typeof exemplo === 'object'
          ? {
              codigo: String((exemplo as { codigo?: unknown }).codigo ?? ''),
              descricao: String((exemplo as { descricao?: unknown }).descricao ?? ''),
            }
          : null,
    });
    if (!reclamacao) {
      res.status(404).json({ error: 'Reclamação não encontrada.' });
      return;
    }
    res.json({ reclamacao });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar reclamação.';
    res.status(400).json({ error: message });
  }
}

export async function deleteQualidadeReclamacaoProduto(req: Request, res: Response): Promise<void> {
  const uid = String(req.params.uid ?? '');
  const ok = await excluirReclamacaoProduto(uid);
  if (!ok) {
    res.status(404).json({ error: 'Reclamação não encontrada.' });
    return;
  }
  res.json({ ok: true });
}

function solucoesDoBody(body: { solucoes?: unknown }): { descricao: string; servico: string }[] {
  if (!Array.isArray(body.solucoes)) return [];
  return body.solucoes.map((item) => {
    if (typeof item === 'string') return { descricao: item, servico: '' };
    if (!item || typeof item !== 'object') return { descricao: '', servico: '' };
    const linha = item as { descricao?: unknown; servico?: unknown };
    return {
      descricao: String(linha.descricao ?? ''),
      servico: String(linha.servico ?? ''),
    };
  });
}

function exemploDoBody(body: { exemplo?: unknown }): { codigo: string; descricao: string } | null {
  const exemplo = body.exemplo;
  if (!exemplo || typeof exemplo !== 'object') return null;
  return {
    codigo: String((exemplo as { codigo?: unknown }).codigo ?? ''),
    descricao: String((exemplo as { descricao?: unknown }).descricao ?? ''),
  };
}

export async function getQualidadeCausasProblema(_req: Request, res: Response): Promise<void> {
  const causas = await listCausasProblema();
  res.json({ causas });
}

export async function postQualidadeCausaProblema(req: Request, res: Response): Promise<void> {
  try {
    const causa = await criarCausaProblema({
      descricao: String(req.body?.descricao ?? ''),
      setorProducao: String(req.body?.setorProducao ?? ''),
      exemplo: exemploDoBody(req.body ?? {}),
      solucoes: solucoesDoBody(req.body ?? {}),
    });
    res.status(201).json({ causa });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao cadastrar a causa do problema.';
    res.status(400).json({ error: message });
  }
}

export async function putQualidadeCausaProblema(req: Request, res: Response): Promise<void> {
  try {
    const uid = String(req.params.uid ?? '');
    const causa = await atualizarCausaProblema(uid, {
      descricao: String(req.body?.descricao ?? ''),
      setorProducao: String(req.body?.setorProducao ?? ''),
      exemplo: exemploDoBody(req.body ?? {}),
      solucoes: solucoesDoBody(req.body ?? {}),
    });
    if (!causa) {
      res.status(404).json({ error: 'Causa do problema não encontrada.' });
      return;
    }
    res.json({ causa });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar a causa do problema.';
    res.status(400).json({ error: message });
  }
}

export async function deleteQualidadeCausaProblema(req: Request, res: Response): Promise<void> {
  const uid = String(req.params.uid ?? '');
  const ok = await excluirCausaProblema(uid);
  if (!ok) {
    res.status(404).json({ error: 'Causa do problema não encontrada.' });
    return;
  }
  res.json({ ok: true });
}

export async function getQualidadeServicosRealizados(_req: Request, res: Response): Promise<void> {
  const servicos = await listServicosRealizados();
  res.json({ servicos });
}

export async function postQualidadeServicoRealizado(req: Request, res: Response): Promise<void> {
  try {
    const servico = await criarServicoRealizado({
      descricao: String(req.body?.descricao ?? ''),
      setorProducao: String(req.body?.setorProducao ?? ''),
      exemplo: exemploDoBody(req.body ?? {}),
    });
    res.status(201).json({ servico });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao cadastrar o serviço realizado.';
    res.status(400).json({ error: message });
  }
}

export async function putQualidadeServicoRealizado(req: Request, res: Response): Promise<void> {
  try {
    const uid = String(req.params.uid ?? '');
    const servico = await atualizarServicoRealizado(uid, {
      descricao: String(req.body?.descricao ?? ''),
      setorProducao: String(req.body?.setorProducao ?? ''),
      exemplo: exemploDoBody(req.body ?? {}),
    });
    if (!servico) {
      res.status(404).json({ error: 'Serviço realizado não encontrado.' });
      return;
    }
    res.json({ servico });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar o serviço realizado.';
    res.status(400).json({ error: message });
  }
}

export async function deleteQualidadeServicoRealizado(req: Request, res: Response): Promise<void> {
  const uid = String(req.params.uid ?? '');
  const ok = await excluirServicoRealizado(uid);
  if (!ok) {
    res.status(404).json({ error: 'Serviço realizado não encontrado.' });
    return;
  }
  res.json({ ok: true });
}

export async function postQualidadeAlertaCadastroCliente(req: Request, res: Response): Promise<void> {
  try {
    const nomePessoa = typeof req.body?.nomePessoa === 'string' ? req.body.nomePessoa.trim() : '';
    let codigoPessoa = typeof req.body?.codigoPessoa === 'string' ? req.body.codigoPessoa.trim() : '';
    const observacao = typeof req.body?.observacao === 'string' ? req.body.observacao.trim().slice(0, 500) : '';
    const brutos = Array.isArray(req.body?.campos) ? req.body.campos : [];
    const campos = brutos
      .map((item: { rotulo?: unknown; valor?: unknown }) => ({
        rotulo: typeof item?.rotulo === 'string' ? item.rotulo.trim().slice(0, 80) : '',
        valor: typeof item?.valor === 'string' ? item.valor.trim().slice(0, 300) : '',
      }))
      .filter((item: { rotulo: string }) => item.rotulo)
      .slice(0, 8);
    if (campos.length === 0) {
      res.json({ enviado: false, mensagem: 'Nenhum dado para incluir no alerta.' });
      return;
    }
    if (!codigoPessoa && nomePessoa) {
      codigoPessoa = await buscarIdPessoaNomusPorNome(nomePessoa);
    }
    await ensureRccCadastroClienteWhatsappTipo();
    const texto = montarMensagemCorrecaoCadastroCliente({
      nomePessoa,
      codigoPessoa,
      campos,
      observacao,
    });
    const { enviados, erros } = await enviarNotificacaoPorTipo(RCC_CADASTRO_CLIENTE_WA_CODE, texto, {
      forcarEnvio: true,
    });
    if (enviados > 0) {
      res.json({
        enviado: true,
        mensagem: 'Alerta enviado ao destinatário configurado em Integração → SMS.',
        codigoPessoa,
      });
      return;
    }
    console.error('[qualidade] alerta cadastro cliente não enviado', erros.join(' | '));
    res.json({
      enviado: false,
      mensagem: 'Não foi possível enviar o alerta agora. Tente novamente em instantes.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar o alerta de cadastro.';
    console.error('[qualidade] alerta cadastro cliente', message);
    res.status(500).json({ error: 'Não foi possível enviar o alerta agora. Tente novamente em instantes.' });
  }
}

export async function getQualidadeArquivoPreviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const src = typeof req.query.src === 'string' ? req.query.src.trim() : '';
    if (!src.startsWith('/uploads/qualidade/')) {
      res.status(400).json({ error: 'Arquivo inválido.' });
      return;
    }
    const url = await ensureQualidadePreviewPdf(src);
    res.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao preparar visualização.';
    res.status(500).json({ error: message });
  }
}
