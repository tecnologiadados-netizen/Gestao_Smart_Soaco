import type { RegistroAnexo } from "@qualidade/types/registro-anexo";
import { normalizarRegistroAnexos } from "@qualidade/types/registro-anexo";

export type RncAcaoStatus = "cancelada" | "concluida" | "reprogramada";

/** Status escolhido no formulário da RNC. */
export type RncStatusFormulario = "em_andamento" | "finalizada";

/** Resposta da pergunta "Tem pedido de venda emitido?". */
export type RncPedidoVendaResposta = "sim" | "nao" | "";

export interface RncItemProduto {
  id: string;
  pedidoId: string;
  pedidoNumero: string;
  itemPedidoId: string;
  codigoProduto: string;
  produto: string;
  grupoProduto: string;
  tipoProduto: string;
  quantidade: string;
  /** Teto quando o item vem de um pedido: quantidade vendida. */
  quantidadeMaxima: string;
  /** NF-e do pedido desta linha (número/série). */
  notaFiscal: string;
}

export interface RncAcaoApartada {
  id: string;
  acao: string;
  responsavel: string;
  prazoExecucao: string;
  status: RncAcaoStatus | "";
}

export interface RncDados {
  codigoDocumento: string;
  /** Código do item no ERP (ex.: PA 10005, MP 6861). */
  codigoProduto: string;
  /** sim = itens vindos de pedido atendido; nao = código livre; vazio = ainda não respondido. */
  temPedidoVenda: RncPedidoVendaResposta;
  itensProduto: RncItemProduto[];
  loteSerie: string;
  numeroOrdemProducao: string;
  dataOcorrencia: string;
  tipoAcao: string;
  tipoOcorrencia: string;
  setorOcorrencia: string;
  grupoProduto: string;
  produto: string;
  tipoProduto: string;
  descricaoOcorrencia: string;
  setorDeteccao: string;
  responsavel: string;
  acaoImediata: string;
  descricaoAcaoImediata: string;
  responsavelAcaoImediata: string;
  notaFiscal: string;
  analiseProblema: string;
  quantidade: string;
  resolucaoNaoConformidade: string;
  registrarPlanoAcao: boolean;
  /** Cinco porquês do plano de ação (1° a 5°). */
  porques: string[];
  causa: string;
  /** Em andamento ou finalizada. A data de fechamento só vale quando finalizada. */
  statusRnc: RncStatusFormulario;
  dataFechamento: string;
  usuarioCriacao: string;
  prazoExecucao: string;
  inserirAcoesApartadas: boolean;
  acoesApartadas: RncAcaoApartada[];
  /** @deprecated Mantido para registros antigos — use acoesApartadas */
  acaoCorretiva2: string;
  responsavelAcao2: string;
  prazoAcao2: string;
  acaoCorretiva3: string;
  responsavelAcao3: string;
  prazoAcao3: string;
  analiseEficaz: string;
  anexos: RegistroAnexo[];
}

export type RncDadosInput = RncDados;

export function criarRncItemProdutoVazio(): RncItemProduto {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    pedidoId: "",
    pedidoNumero: "",
    itemPedidoId: "",
    codigoProduto: "",
    produto: "",
    grupoProduto: "",
    tipoProduto: "",
    quantidade: "",
    quantidadeMaxima: "",
    notaFiscal: "",
  };
}

/** Notas distintas, na ordem das linhas. Várias NF-e do mesmo pedido ficam separadas por vírgula. */
export function notasFiscaisDistintas(itens: RncItemProduto[]): string {
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const item of itens) {
    for (const parte of item.notaFiscal.split(",")) {
      const nota = parte.trim();
      if (!nota || vistas.has(nota)) continue;
      vistas.add(nota);
      lista.push(nota);
    }
  }
  return lista.join(", ");
}

export function criarRncAcaoApartadaVazia(): RncAcaoApartada {
  return {
    id: `acao-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    acao: "",
    responsavel: "",
    prazoExecucao: "",
    status: "",
  };
}

export function criarPorquesVazios(): string[] {
  return ["", "", "", "", ""];
}

function normalizarListaPorques(porques: unknown): string[] {
  if (!Array.isArray(porques)) return criarPorquesVazios();
  return [...porques.map((item) => String(item ?? "").trim()), "", "", "", "", ""].slice(
    0,
    5
  );
}

function normalizarAcoesApartadas(
  merged: RncDados
): Pick<RncDados, "inserirAcoesApartadas" | "acoesApartadas"> {
  if (Array.isArray(merged.acoesApartadas) && merged.acoesApartadas.length > 0) {
    return {
      inserirAcoesApartadas: Boolean(merged.inserirAcoesApartadas),
      acoesApartadas: merged.acoesApartadas.map((item, index) => ({
        id: item.id || `acao-legado-${index}`,
        acao: item.acao ?? "",
        responsavel: item.responsavel ?? "",
        prazoExecucao: item.prazoExecucao ?? "",
        status: item.status ?? "",
      })),
    };
  }

  const acoesLegadas: RncAcaoApartada[] = [];
  if (
    merged.acaoCorretiva2.trim() ||
    merged.responsavelAcao2.trim() ||
    merged.prazoAcao2.trim()
  ) {
    acoesLegadas.push({
      id: "acao-legado-1",
      acao: merged.acaoCorretiva2,
      responsavel: merged.responsavelAcao2,
      prazoExecucao: merged.prazoAcao2,
      status: "",
    });
  }
  if (
    merged.acaoCorretiva3.trim() ||
    merged.responsavelAcao3.trim() ||
    merged.prazoAcao3.trim()
  ) {
    acoesLegadas.push({
      id: "acao-legado-2",
      acao: merged.acaoCorretiva3,
      responsavel: merged.responsavelAcao3,
      prazoExecucao: merged.prazoAcao3,
      status: "",
    });
  }

  if (acoesLegadas.length > 0) {
    return {
      inserirAcoesApartadas: true,
      acoesApartadas: acoesLegadas,
    };
  }

  return {
    inserirAcoesApartadas: Boolean(merged.inserirAcoesApartadas),
    acoesApartadas: [],
  };
}

function normalizarPlanoAcao(
  merged: RncDados
): Pick<RncDados, "registrarPlanoAcao" | "porques"> {
  const porquesInformados = normalizarListaPorques(merged.porques);
  if (porquesInformados.some((item) => item.trim())) {
    return {
      registrarPlanoAcao: Boolean(merged.registrarPlanoAcao),
      porques: porquesInformados,
    };
  }

  const linhas = merged.causa
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (linhas.length >= 2) {
    return {
      registrarPlanoAcao: true,
      porques: normalizarListaPorques(linhas),
    };
  }

  return {
    registrarPlanoAcao: Boolean(merged.registrarPlanoAcao),
    porques: criarPorquesVazios(),
  };
}

function normalizarStatusRnc(
  dados: Partial<RncDados> & Record<string, unknown>,
  merged: RncDados
): Pick<RncDados, "statusRnc" | "dataFechamento"> {
  const informado = dados.statusRnc;
  if (informado === "em_andamento") {
    return { statusRnc: "em_andamento", dataFechamento: "" };
  }
  if (informado === "finalizada") {
    return {
      statusRnc: "finalizada",
      dataFechamento: merged.dataFechamento ?? "",
    };
  }
  if (merged.dataFechamento.trim()) {
    return {
      statusRnc: "finalizada",
      dataFechamento: merged.dataFechamento,
    };
  }
  return { statusRnc: "em_andamento", dataFechamento: "" };
}

function normalizarItemProduto(item: Partial<RncItemProduto>, index: number): RncItemProduto {
  return {
    id: item.id || `item-legado-${index}`,
    pedidoId: item.pedidoId ?? "",
    pedidoNumero: item.pedidoNumero ?? "",
    itemPedidoId: item.itemPedidoId ?? "",
    codigoProduto: item.codigoProduto ?? "",
    produto: item.produto ?? "",
    grupoProduto: item.grupoProduto ?? "",
    tipoProduto: item.tipoProduto ?? "",
    quantidade: item.quantidade ?? "",
    quantidadeMaxima: item.quantidadeMaxima ?? "",
    notaFiscal: item.notaFiscal ?? "",
  };
}

function textoItens(itens: RncItemProduto[], campo: "codigoProduto" | "produto" | "quantidade"): string {
  return itens
    .map((item) => item[campo].trim())
    .filter(Boolean)
    .join("; ");
}

function normalizarItensProduto(
  dados: Partial<RncDados> & Record<string, unknown>,
  merged: RncDados
): Pick<
  RncDados,
  "temPedidoVenda" | "itensProduto" | "codigoProduto" | "produto" | "quantidade" | "notaFiscal"
> {
  const informado = dados.temPedidoVenda;
  const explicito = informado === "sim" || informado === "nao";
  let temPedidoVenda: RncPedidoVendaResposta = explicito ? informado : "";

  const itensInformados = Array.isArray(dados.itensProduto)
    ? dados.itensProduto.map((item, index) => normalizarItemProduto(item, index))
    : [];

  let itens = itensInformados;
  if (
    !explicito &&
    itens.length === 0 &&
    (merged.codigoProduto.trim() || merged.produto.trim() || merged.quantidade.trim())
  ) {
    temPedidoVenda = "nao";
    itens = [
      {
        ...criarRncItemProdutoVazio(),
        id: "item-legado",
        codigoProduto: merged.codigoProduto,
        produto: merged.produto,
        grupoProduto: merged.grupoProduto,
        tipoProduto: merged.tipoProduto,
        quantidade: merged.quantidade,
      },
    ];
  }

  if (explicito && itens.length === 0) {
    itens = [criarRncItemProdutoVazio()];
  }

  if (temPedidoVenda === "sim" && merged.notaFiscal.trim()) {
    const pedidos = new Set(itens.map((item) => item.pedidoId.trim()).filter(Boolean));
    if (pedidos.size <= 1 && itens.every((item) => !item.notaFiscal.trim())) {
      const nota = merged.notaFiscal.trim();
      itens = itens.map((item) => (item.pedidoId.trim() ? { ...item, notaFiscal: nota } : item));
    }
  }

  const sincronizarLegado = explicito || itens.length > 0;
  const notaFiscal =
    temPedidoVenda === "sim"
      ? notasFiscaisDistintas(itens) || merged.notaFiscal
      : temPedidoVenda === "nao"
        ? ""
        : merged.notaFiscal;
  return {
    temPedidoVenda,
    itensProduto: itens,
    codigoProduto: sincronizarLegado ? textoItens(itens, "codigoProduto") : merged.codigoProduto,
    produto: sincronizarLegado ? textoItens(itens, "produto") : merged.produto,
    quantidade: sincronizarLegado ? textoItens(itens, "quantidade") : merged.quantidade,
    notaFiscal,
  };
}

/** Converte registros antigos (ação 2/3 fixas) para a tabela dinâmica. */
export function normalizarRncDados(
  dados: Partial<RncDados> & Record<string, unknown>,
  opcoes?: { manterAnexosVazios?: boolean }
): RncDados {
  const merged = { ...criarRncDadosVazio(), ...dados } as RncDados;
  return {
    ...merged,
    ...normalizarAcoesApartadas(merged),
    ...normalizarPlanoAcao(merged),
    ...normalizarStatusRnc(dados, merged),
    ...normalizarItensProduto(dados, merged),
    analiseEficaz: normalizarSimNao(merged.analiseEficaz),
    anexos: normalizarRegistroAnexos(merged.anexos, {
      manterVazios: opcoes?.manterAnexosVazios,
    }),
  };
}

function normalizarSimNao(valor: string): string {
  const texto = valor
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (texto === "sim") return "Sim";
  if (texto === "nao") return "Não";
  return valor.trim();
}

export function sincronizarAcoesApartadasLegado(dados: RncDados): RncDados {
  const acoes = dados.inserirAcoesApartadas ? dados.acoesApartadas : [];
  return {
    ...dados,
    acaoCorretiva2: acoes[0]?.acao ?? "",
    responsavelAcao2: acoes[0]?.responsavel ?? "",
    prazoAcao2: acoes[0]?.prazoExecucao ?? "",
    acaoCorretiva3: acoes[1]?.acao ?? "",
    responsavelAcao3: acoes[1]?.responsavel ?? "",
    prazoAcao3: acoes[1]?.prazoExecucao ?? "",
  };
}

export function criarRncDadosVazio(codigoDocumento = ""): RncDados {
  return {
    codigoDocumento,
    codigoProduto: "",
    temPedidoVenda: "",
    itensProduto: [],
    loteSerie: "",
    numeroOrdemProducao: "",
    dataOcorrencia: "",
    tipoAcao: "",
    tipoOcorrencia: "",
    setorOcorrencia: "",
    grupoProduto: "",
    produto: "",
    tipoProduto: "",
    descricaoOcorrencia: "",
    setorDeteccao: "",
    responsavel: "",
    acaoImediata: "",
    descricaoAcaoImediata: "",
    responsavelAcaoImediata: "",
    notaFiscal: "",
    analiseProblema: "",
    quantidade: "",
    resolucaoNaoConformidade: "",
    registrarPlanoAcao: false,
    porques: criarPorquesVazios(),
    causa: "",
    statusRnc: "em_andamento",
    dataFechamento: "",
    usuarioCriacao: "",
    prazoExecucao: "",
    inserirAcoesApartadas: false,
    acoesApartadas: [],
    acaoCorretiva2: "",
    responsavelAcao2: "",
    prazoAcao2: "",
    acaoCorretiva3: "",
    responsavelAcao3: "",
    prazoAcao3: "",
    analiseEficaz: "",
    anexos: [],
  };
}

export function isoParaInputDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function inputDateParaIso(date: string): string {
  if (!date) return "";
  return `${date}T12:00:00.000Z`;
}

/** Data local de hoje, no mesmo formato ISO usado pelos campos de data da RNC. */
export function dataLocalHojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return inputDateParaIso(`${agora.getFullYear()}-${mes}-${dia}`);
}
