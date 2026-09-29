import {
  RCC_ORIGEM_CLIENTE_REVENDEDOR,
  RCC_VENDEDOR_PADRAO,
  origemReclamacaoRcc,
} from "@qualidade/lib/registros/constants";
import type { RegistroAnexo } from "@qualidade/types/registro-anexo";
import { normalizarRegistroAnexos } from "@qualidade/types/registro-anexo";
import {
  criarRncItemProdutoVazio,
  dataLocalHojeIso,
  notasFiscaisDistintas,
  type RncItemProduto,
  type RncPedidoVendaResposta,
} from "@qualidade/types/rnc";

export interface RccLinhaReclamacao {
  id: string;
  texto: string;
  lista: string;
  responsavel: string;
  aceita: string;
  comentario: string;
  causa: string;
  solucao: string;
}

export type RccResponsavelAssistencia = "" | "Funcionário interno" | "Funcionário externo";

export interface RccLinhaServico {
  id: string;
  texto: string;
  lista1: string;
  lista2: string;
  horaSaidaEmpresa: string;
  horaChegadaEmpresa: string;
  horaChegadaCliente: string;
  horaSaidaCliente: string;
  numeroSerieCompressor: string;
  dataConclusaoServico: string;
  dataFechamento: string;
  problemaSolucionado: string;
}

function novoId(prefixo: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function criarRccLinhaServicoVazia(): RccLinhaServico {
  return {
    id: novoId("srv"),
    texto: "",
    lista1: "",
    lista2: "",
    horaSaidaEmpresa: "",
    horaChegadaEmpresa: "",
    horaChegadaCliente: "",
    horaSaidaCliente: "",
    numeroSerieCompressor: "",
    dataConclusaoServico: "",
    dataFechamento: "",
    problemaSolucionado: "",
  };
}

function primeiroPreenchido(valores: string[]): string {
  return valores.map((valor) => valor.trim()).find(Boolean) ?? "";
}

export function legadoDasLinhasServico(linhas: RccLinhaServico[]): Pick<
  RccDados,
  | "servicoRealizado"
  | "servicoRealizado1"
  | "servicoRealizado2"
  | "horaSaidaEmpresa"
  | "horaChegadaEmpresa"
  | "horaChegadaCliente"
  | "horaSaidaCliente"
  | "numeroSerieCompressor"
  | "dataConclusaoServico"
> {
  return {
    servicoRealizado: linhas
      .map((linha) => linha.texto.trim())
      .filter(Boolean)
      .join("\n"),
    servicoRealizado1: [...new Set(linhas.map((linha) => linha.lista1.trim()).filter(Boolean))].join(
      "; "
    ),
    servicoRealizado2: [...new Set(linhas.map((linha) => linha.lista2.trim()).filter(Boolean))].join(
      "; "
    ),
    horaSaidaEmpresa: primeiroPreenchido(linhas.map((linha) => linha.horaSaidaEmpresa)),
    horaChegadaEmpresa: primeiroPreenchido(linhas.map((linha) => linha.horaChegadaEmpresa)),
    horaChegadaCliente: primeiroPreenchido(linhas.map((linha) => linha.horaChegadaCliente)),
    horaSaidaCliente: primeiroPreenchido(linhas.map((linha) => linha.horaSaidaCliente)),
    numeroSerieCompressor: primeiroPreenchido(linhas.map((linha) => linha.numeroSerieCompressor)),
    dataConclusaoServico: primeiroPreenchido(linhas.map((linha) => linha.dataConclusaoServico)),
  };
}

export function criarRccLinhaReclamacaoVazia(): RccLinhaReclamacao {
  return {
    id: novoId("rec"),
    texto: "",
    lista: "",
    responsavel: "",
    aceita: "",
    comentario: "",
    causa: "",
    solucao: "",
  };
}

export function legadoDasLinhasReclamacao(linhas: RccLinhaReclamacao[]): Pick<
  RccDados,
  | "descricaoReclamacao"
  | "reclamacao1"
  | "reclamacao2"
  | "responsavelAnaliseReclamacao"
  | "reclamacaoAceita"
  | "comentario"
  | "causaProblema"
> {
  const descricoes = linhas.map((linha) => linha.texto.trim()).filter(Boolean);
  const reclamacoes = linhas
    .map((linha) => [linha.texto.trim(), linha.lista.trim()].filter(Boolean).join(" — "))
    .filter(Boolean);
  const responsaveis = [
    ...new Set(linhas.map((linha) => linha.responsavel.trim()).filter(Boolean)),
  ];
  const aceitas = [...new Set(linhas.map((linha) => linha.aceita.trim()).filter(Boolean))];
  const comentarios = linhas.map((linha) => (linha.comentario ?? "").trim()).filter(Boolean);
  const causas = [...new Set(linhas.map((linha) => (linha.causa ?? "").trim()).filter(Boolean))];
  return {
    descricaoReclamacao: descricoes.join("\n"),
    reclamacao1: reclamacoes[0] ?? "",
    reclamacao2: reclamacoes.slice(1).join("; "),
    responsavelAnaliseReclamacao: responsaveis.join("; "),
    reclamacaoAceita: aceitas.join("; "),
    comentario: comentarios.join("\n"),
    causaProblema: causas.join("; "),
  };
}

export interface RccDados {
  codigoDocumento: string;
  codigoProduto: string;
  /** sim = itens vindos de pedido atendido; nao = código livre; vazio = ainda não respondido. */
  temPedidoVenda: RncPedidoVendaResposta;
  itensProduto: RncItemProduto[];
  dataRegistroReclamacao: string;
  /** Origem da reclamação: cliente para a indústria, cliente para o revendedor ou feita pela indústria. */
  feedbackClienteEnviado: string;
  cidade: string;
  nomeClienteConsumidor: string;
  contato: string;
  telefone: string;
  bairro: string;
  endereco: string;
  pontoReferencia: string;
  clienteDoRevendedor: boolean;
  nomeRevendedor: string;
  cidadeRevendedor: string;
  estadoRevendedor: string;
  vendedor: string;
  produto: string;
  grupoProduto: string;
  possuiNumeroSerie: string;
  numeroSerieLoteProduto: string;
  dataEmissaoNf: string;
  numeroNf: string;
  numeroPedidoInternoExterno: string;
  produtoNossaFabricacao: string;
  produtoDentroGarantia: string;
  quantidade: string;
  descricaoReclamacao: string;
  analiseCausaQualidade: string;
  comentario: string;
  reclamacao1: string;
  reclamacao2: string;
  responsavelAnaliseReclamacao: string;
  reclamacaoAceita: string;
  linhasReclamacao: RccLinhaReclamacao[];
  responsavelAssistencia: RccResponsavelAssistencia;
  linhasServico: RccLinhaServico[];
  abrirOrdemServico: string;
  servicoRealizado: string;
  servicoRealizado1: string;
  servicoRealizado2: string;
  dataConclusaoServico: string;
  funcionarioSolicitado: string;
  numeroOrdemProducao: string;
  dataAssistencia: string;
  horaSaidaEmpresa: string;
  numeroSerieCompressor: string;
  horaChegadaEmpresa: string;
  horaChegadaCliente: string;
  horaSaidaCliente: string;
  problemaSolucionado: string;
  dataFechamento: string;
  /** Sim mostra data de fechamento e problema solucionado. Não mantém a RCC em aberto. */
  rccFinalizada: string;
  causaProblema: string;
  estado: string;
  usuarioCriacao: string;
  anexos: RegistroAnexo[];
}

export function criarRccDadosVazio(codigoDocumento = ""): RccDados {
  return {
    codigoDocumento,
    codigoProduto: "",
    temPedidoVenda: "",
    itensProduto: [],
    dataRegistroReclamacao: dataLocalHojeIso(),
    feedbackClienteEnviado: "",
    cidade: "",
    nomeClienteConsumidor: "",
    contato: "",
    telefone: "",
    bairro: "",
    endereco: "",
    pontoReferencia: "",
    clienteDoRevendedor: false,
    nomeRevendedor: "",
    cidadeRevendedor: "",
    estadoRevendedor: "",
    vendedor: RCC_VENDEDOR_PADRAO,
    produto: "",
    grupoProduto: "",
    possuiNumeroSerie: "",
    numeroSerieLoteProduto: "",
    dataEmissaoNf: "",
    numeroNf: "",
    numeroPedidoInternoExterno: "",
    produtoNossaFabricacao: "",
    produtoDentroGarantia: "",
    quantidade: "",
    descricaoReclamacao: "",
    analiseCausaQualidade: "",
    comentario: "",
    reclamacao1: "",
    reclamacao2: "",
    responsavelAnaliseReclamacao: "",
    reclamacaoAceita: "",
    linhasReclamacao: [criarRccLinhaReclamacaoVazia()],
    responsavelAssistencia: "",
    linhasServico: [criarRccLinhaServicoVazia()],
    abrirOrdemServico: "",
    servicoRealizado: "",
    servicoRealizado1: "",
    servicoRealizado2: "",
    dataConclusaoServico: "",
    funcionarioSolicitado: "",
    numeroOrdemProducao: "",
    dataAssistencia: "",
    horaSaidaEmpresa: "",
    numeroSerieCompressor: "",
    horaChegadaEmpresa: "",
    horaChegadaCliente: "",
    horaSaidaCliente: "",
    problemaSolucionado: "",
    dataFechamento: "",
    rccFinalizada: "",
    causaProblema: "",
    estado: "",
    usuarioCriacao: "",
    anexos: [],
  };
}

function normalizarItemProduto(item: Partial<RncItemProduto>, index: number): RncItemProduto {
  return {
    ...criarRncItemProdutoVazio(),
    ...item,
    id: item.id || `item-legado-${index}`,
  };
}

function textoItens(
  itens: RncItemProduto[],
  campo: "codigoProduto" | "produto" | "quantidade"
): string {
  return itens
    .map((item) => item[campo].trim())
    .filter(Boolean)
    .join("; ");
}

function dataEmissaoDocumento(itens: RncItemProduto[]): string {
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const item of itens) {
    for (const parte of (item.dataEmissaoNf ?? "").split(",")) {
      const data = parte.trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || vistas.has(data)) continue;
      vistas.add(data);
      lista.push(data);
    }
  }
  if (lista.length === 1) return `${lista[0]}T12:00:00.000Z`;
  return lista
    .map((data) => {
      const [ano, mes, dia] = data.split("-");
      return `${dia}/${mes}/${ano}`;
    })
    .join(", ");
}

function textoDistinto(
  itens: RncItemProduto[],
  campo:
    | "clienteNome"
    | "clienteContato"
    | "clienteEstado"
    | "clienteCidade"
    | "clienteTelefone"
    | "clienteBairro"
    | "clienteEndereco"
): string {
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const item of itens) {
    const valor = (item[campo] ?? "").trim();
    if (!valor || vistas.has(valor)) continue;
    vistas.add(valor);
    lista.push(valor);
  }
  return lista.join("; ");
}

function pedidosDistintos(itens: RncItemProduto[]): string {
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const item of itens) {
    const numero = item.pedidoNumero.trim();
    if (!numero || vistas.has(numero)) continue;
    vistas.add(numero);
    lista.push(numero);
  }
  return lista.join(", ");
}

function normalizarItensProduto(
  dados: Partial<RccDados>,
  merged: RccDados
): Pick<
  RccDados,
  | "temPedidoVenda"
  | "itensProduto"
  | "codigoProduto"
  | "produto"
  | "quantidade"
  | "numeroNf"
  | "numeroPedidoInternoExterno"
  | "dataEmissaoNf"
  | "nomeClienteConsumidor"
  | "contato"
  | "estado"
  | "cidade"
  | "telefone"
  | "bairro"
  | "endereco"
> {
  const informado = dados.temPedidoVenda;
  const explicito = informado === "sim" || informado === "nao";
  let temPedidoVenda: RncPedidoVendaResposta = explicito ? informado : "";

  const itensInformados = Array.isArray(dados.itensProduto)
    ? dados.itensProduto.map((item, index) => normalizarItemProduto(item, index))
    : [];

  let itens = itensInformados;
  if (!explicito && itens.length === 0) {
    const temProduto =
      merged.codigoProduto.trim() || merged.produto.trim() || merged.quantidade.trim();
    const temPedido = merged.numeroPedidoInternoExterno.trim();
    if (temPedido || temProduto) {
      temPedidoVenda = temPedido ? "sim" : "nao";
      itens = [
        {
          ...criarRncItemProdutoVazio(),
          id: "item-legado",
          pedidoNumero: merged.numeroPedidoInternoExterno,
          codigoProduto: merged.codigoProduto,
          produto: merged.produto,
          grupoProduto: merged.grupoProduto,
          quantidade: merged.quantidade,
          notaFiscal: merged.numeroNf,
          dataEmissaoNf: merged.dataEmissaoNf,
          clienteNome: merged.nomeClienteConsumidor,
          clienteContato: merged.contato,
          clienteEstado: merged.estado,
          clienteCidade: merged.cidade,
          clienteTelefone: merged.telefone,
          clienteBairro: merged.bairro,
          clienteEndereco: merged.endereco,
        },
      ];
    }
  }

  if (explicito && itens.length === 0) {
    itens = [criarRncItemProdutoVazio()];
  }

  if (temPedidoVenda === "sim" && merged.numeroNf.trim()) {
    const pedidos = new Set(itens.map((item) => item.pedidoId.trim()).filter(Boolean));
    if (pedidos.size <= 1 && itens.every((item) => !item.notaFiscal.trim())) {
      const nota = merged.numeroNf.trim();
      itens = itens.map((item) =>
        item.pedidoNumero.trim() || item.pedidoId.trim() ? { ...item, notaFiscal: nota } : item
      );
    }
  }

  const sincronizarLegado = explicito || itens.length > 0;
  const numeroNf =
    temPedidoVenda === "sim" ? notasFiscaisDistintas(itens) : merged.numeroNf;
  const numeroPedidoInternoExterno =
    temPedidoVenda === "sim"
      ? pedidosDistintos(itens)
      : merged.numeroPedidoInternoExterno;
  const dataEmissaoNf =
    temPedidoVenda === "sim" || temPedidoVenda === "nao"
      ? dataEmissaoDocumento(itens)
      : merged.dataEmissaoNf;
  const clienteDoPedido =
    temPedidoVenda === "sim"
      ? {
          nomeClienteConsumidor: textoDistinto(itens, "clienteNome"),
          contato: textoDistinto(itens, "clienteContato"),
          estado: textoDistinto(itens, "clienteEstado"),
          cidade: textoDistinto(itens, "clienteCidade"),
          telefone: textoDistinto(itens, "clienteTelefone"),
          bairro: textoDistinto(itens, "clienteBairro"),
          endereco: textoDistinto(itens, "clienteEndereco"),
        }
      : {
          nomeClienteConsumidor: merged.nomeClienteConsumidor,
          contato: merged.contato,
          estado: merged.estado,
          cidade: merged.cidade,
          telefone: merged.telefone,
          bairro: merged.bairro,
          endereco: merged.endereco,
        };

  return {
    temPedidoVenda,
    itensProduto: itens,
    codigoProduto: sincronizarLegado ? textoItens(itens, "codigoProduto") : merged.codigoProduto,
    produto: sincronizarLegado ? textoItens(itens, "produto") : merged.produto,
    quantidade: sincronizarLegado ? textoItens(itens, "quantidade") : merged.quantidade,
    numeroNf,
    numeroPedidoInternoExterno,
    dataEmissaoNf,
    ...clienteDoPedido,
  };
}

function normalizarLinhaReclamacao(
  linha: Partial<RccLinhaReclamacao>,
  index: number
): RccLinhaReclamacao {
  return {
    ...criarRccLinhaReclamacaoVazia(),
    ...linha,
    id: linha.id || `rec-legado-${index}`,
    texto: linha.texto ?? "",
    lista: linha.lista ?? "",
    responsavel: linha.responsavel ?? "",
    aceita: linha.aceita ?? "",
    comentario: linha.comentario ?? "",
    causa: linha.causa ?? "",
    solucao: linha.solucao ?? "",
  };
}

function aplicarAnaliseNaPrimeiraLinha(
  linhas: RccLinhaReclamacao[],
  merged: Pick<RccDados, "descricaoReclamacao" | "comentario" | "causaProblema">
): RccLinhaReclamacao[] {
  if (linhas.length === 0) return linhas;
  let primeira = linhas[0];
  if (!linhas.some((linha) => (linha.texto ?? "").trim()) && merged.descricaoReclamacao.trim()) {
    primeira = { ...primeira, texto: merged.descricaoReclamacao };
  }
  if (!linhas.some((linha) => (linha.comentario ?? "").trim()) && merged.comentario.trim()) {
    primeira = { ...primeira, comentario: merged.comentario };
  }
  if (!linhas.some((linha) => (linha.causa ?? "").trim()) && merged.causaProblema.trim()) {
    primeira = { ...primeira, causa: merged.causaProblema };
  }
  if (primeira === linhas[0]) return linhas;
  return linhas.map((linha, index) => (index === 0 ? primeira : linha));
}

function normalizarLinhasReclamacao(
  dados: Partial<RccDados>,
  merged: RccDados
): RccLinhaReclamacao[] {
  if (Array.isArray(dados.linhasReclamacao) && dados.linhasReclamacao.length > 0) {
    return aplicarAnaliseNaPrimeiraLinha(
      dados.linhasReclamacao.map((linha, index) => normalizarLinhaReclamacao(linha, index)),
      merged
    );
  }

  const linhas: RccLinhaReclamacao[] = [];
  if (
    merged.reclamacao1.trim() ||
    merged.responsavelAnaliseReclamacao.trim() ||
    merged.reclamacaoAceita.trim()
  ) {
    linhas.push({
      ...criarRccLinhaReclamacaoVazia(),
      id: "rec-legado-1",
      lista: merged.reclamacao1,
      responsavel: merged.responsavelAnaliseReclamacao,
      aceita: merged.reclamacaoAceita,
    });
  }
  if (merged.reclamacao2.trim()) {
    linhas.push({
      ...criarRccLinhaReclamacaoVazia(),
      id: "rec-legado-2",
      lista: merged.reclamacao2,
    });
  }
  if (linhas.length === 0) linhas.push(criarRccLinhaReclamacaoVazia());
  return aplicarAnaliseNaPrimeiraLinha(linhas, merged);
}

function normalizarLinhaServico(linha: Partial<RccLinhaServico>, index: number): RccLinhaServico {
  const vazia = criarRccLinhaServicoVazia();
  return {
    ...vazia,
    ...linha,
    id: linha.id || `srv-legado-${index}`,
    texto: linha.texto ?? "",
    lista1: linha.lista1 ?? "",
    lista2: linha.lista2 ?? "",
    horaSaidaEmpresa: linha.horaSaidaEmpresa ?? "",
    horaChegadaEmpresa: linha.horaChegadaEmpresa ?? "",
    horaChegadaCliente: linha.horaChegadaCliente ?? "",
    horaSaidaCliente: linha.horaSaidaCliente ?? "",
    numeroSerieCompressor: (linha.numeroSerieCompressor ?? "").replace(/\D/g, ""),
    dataConclusaoServico: linha.dataConclusaoServico ?? "",
    dataFechamento: linha.dataFechamento ?? "",
    problemaSolucionado: linha.problemaSolucionado ?? "",
  };
}

function normalizarLinhasServico(dados: Partial<RccDados>, merged: RccDados): RccLinhaServico[] {
  if (Array.isArray(dados.linhasServico) && dados.linhasServico.length > 0) {
    return dados.linhasServico.map((linha, index) => normalizarLinhaServico(linha, index));
  }
  const temLegado = [
    merged.servicoRealizado,
    merged.servicoRealizado1,
    merged.servicoRealizado2,
    merged.horaSaidaEmpresa,
    merged.horaChegadaEmpresa,
    merged.horaChegadaCliente,
    merged.horaSaidaCliente,
    merged.numeroSerieCompressor,
    merged.dataConclusaoServico,
    merged.dataFechamento,
    merged.problemaSolucionado,
  ].some((valor) => valor.trim());
  if (!temLegado) return [criarRccLinhaServicoVazia()];
  return [
    {
      ...criarRccLinhaServicoVazia(),
      id: "srv-legado-1",
      texto: merged.servicoRealizado,
      lista1: merged.servicoRealizado1,
      lista2: merged.servicoRealizado2,
      horaSaidaEmpresa: merged.horaSaidaEmpresa,
      horaChegadaEmpresa: merged.horaChegadaEmpresa,
      horaChegadaCliente: merged.horaChegadaCliente,
      horaSaidaCliente: merged.horaSaidaCliente,
      numeroSerieCompressor: merged.numeroSerieCompressor.replace(/\D/g, ""),
      dataConclusaoServico: merged.dataConclusaoServico,
      dataFechamento: merged.dataFechamento,
      problemaSolucionado: merged.problemaSolucionado,
    },
  ];
}

/** Garante campos novos em registros antigos (histórico Nomus / persist). */
export function normalizarRccDados(
  rcc: Partial<RccDados> & Pick<RccDados, "codigoDocumento">,
  opcoes?: { origemNomus?: boolean }
): RccDados {
  const base = criarRccDadosVazio(rcc.codigoDocumento);
  const merged: RccDados = {
    ...base,
    ...rcc,
    vendedor: rcc.vendedor?.trim() || base.vendedor,
    anexos: normalizarRegistroAnexos(rcc.anexos),
    temPedidoVenda: rcc.temPedidoVenda === "sim" || rcc.temPedidoVenda === "nao" ? rcc.temPedidoVenda : "",
    itensProduto: Array.isArray(rcc.itensProduto) ? rcc.itensProduto : [],
    linhasReclamacao: Array.isArray(rcc.linhasReclamacao) ? rcc.linhasReclamacao : [],
    linhasServico: Array.isArray(rcc.linhasServico) ? rcc.linhasServico : [],
    responsavelAssistencia:
      rcc.responsavelAssistencia === "Funcionário interno" ||
      rcc.responsavelAssistencia === "Funcionário externo"
        ? rcc.responsavelAssistencia
        : "",
    numeroSerieLoteProduto: (rcc.numeroSerieLoteProduto ?? "").replace(/\D/g, ""),
    possuiNumeroSerie:
      rcc.possuiNumeroSerie === "Sim" || rcc.possuiNumeroSerie === "Não"
        ? rcc.possuiNumeroSerie
        : (rcc.numeroSerieLoteProduto ?? "").replace(/\D/g, "")
          ? "Sim"
          : "",
  };
  const linhasReclamacao = normalizarLinhasReclamacao(rcc, merged);
  const linhasServico = normalizarLinhasServico(rcc, merged);
  const comLinhasBase: RccDados = {
    ...merged,
    linhasReclamacao,
    ...legadoDasLinhasReclamacao(linhasReclamacao),
    linhasServico,
    ...legadoDasLinhasServico(linhasServico),
  };
  const rccFinalizada =
    rcc.rccFinalizada === "Sim" || rcc.rccFinalizada === "Não"
      ? rcc.rccFinalizada
      : comLinhasBase.dataFechamento.trim() ||
          comLinhasBase.problemaSolucionado === "Sim" ||
          comLinhasBase.problemaSolucionado === "Não"
        ? "Sim"
        : "";
  const origemReclamacao = origemReclamacaoRcc(
    comLinhasBase.feedbackClienteEnviado,
    comLinhasBase.clienteDoRevendedor
  );
  const comLinhas: RccDados = {
    ...comLinhasBase,
    ...(origemReclamacao
      ? {
          feedbackClienteEnviado: origemReclamacao,
          clienteDoRevendedor: origemReclamacao === RCC_ORIGEM_CLIENTE_REVENDEDOR,
        }
      : {}),
    rccFinalizada,
    ...(rccFinalizada === "Não"
      ? { dataFechamento: "", problemaSolucionado: "" }
      : {}),
  };

  if (opcoes?.origemNomus) {
    return comLinhas;
  }

  return {
    ...comLinhas,
    ...normalizarItensProduto(rcc, comLinhas),
  };
}

export { isoParaInputDate, inputDateParaIso } from "@qualidade/types/rnc";
