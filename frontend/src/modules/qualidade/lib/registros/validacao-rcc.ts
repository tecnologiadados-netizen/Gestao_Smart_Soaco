import type { RccDados } from "@qualidade/types/rcc";
import type { RncItemProduto } from "@qualidade/types/rnc";

export interface ValidacaoRccResult {
  valido: boolean;
  erros: Partial<Record<keyof RccDados, string>>;
}

function itemComPedido(item: RncItemProduto): boolean {
  return Boolean(
    (item.pedidoId.trim() || item.pedidoNumero.trim()) &&
      (item.codigoProduto.trim() || item.produto.trim())
  );
}

function itemLivre(item: RncItemProduto): boolean {
  return Boolean(item.codigoProduto.trim() && item.produto.trim());
}

function respostaSimNao(valor: string): boolean {
  return valor === "Sim" || valor === "Não";
}

function quantidadeInformada(valor: string): boolean {
  const qtde = Number(String(valor).replace(",", "."));
  return Boolean(valor.trim()) && Number.isFinite(qtde) && qtde > 0;
}

function servicoPreenchido(linha: { texto?: string; lista1?: string; lista2?: string }): boolean {
  return Boolean(linha.texto?.trim() || linha.lista1?.trim() || linha.lista2?.trim());
}

export function validarRcc(
  rcc: RccDados,
  opcoes?: { origemNomus?: boolean }
): ValidacaoRccResult {
  const erros: Partial<Record<keyof RccDados, string>> = {};

  if (!rcc.dataRegistroReclamacao.trim()) {
    erros.dataRegistroReclamacao = "Informe a data de registro da reclamação.";
  }
  if (!respostaSimNao(rcc.feedbackClienteEnviado)) {
    erros.feedbackClienteEnviado = "Informe se a reclamação foi feita pelo cliente.";
  }
  if (!respostaSimNao(rcc.possuiNumeroSerie)) {
    erros.possuiNumeroSerie = "Informe se o produto possui número de série.";
  } else if (rcc.possuiNumeroSerie === "Sim" && !rcc.numeroSerieLoteProduto.replace(/\D/g, "").trim()) {
    erros.numeroSerieLoteProduto = "Informe o número de série ou lote.";
  }
  if (!respostaSimNao(rcc.produtoNossaFabricacao)) {
    erros.produtoNossaFabricacao = "Informe se o produto é de nossa fabricação.";
  }
  if (!respostaSimNao(rcc.produtoDentroGarantia)) {
    erros.produtoDentroGarantia = "Informe se o produto está dentro da garantia.";
  }
  const reclamacaoPeloCliente = rcc.feedbackClienteEnviado === "Sim";
  const clienteNaSecao =
    reclamacaoPeloCliente && (opcoes?.origemNomus || rcc.temPedidoVenda !== "sim");
  if (clienteNaSecao && !rcc.nomeClienteConsumidor.trim()) {
    erros.nomeClienteConsumidor = "Informe o nome do cliente.";
  }
  if (clienteNaSecao && !rcc.telefone.trim()) {
    erros.telefone = "Informe o telefone do cliente.";
  }
  if (clienteNaSecao && !rcc.cidade.trim()) {
    erros.cidade = "Informe a cidade do cliente.";
  }
  if (clienteNaSecao && rcc.clienteDoRevendedor && !rcc.nomeRevendedor.trim()) {
    erros.nomeRevendedor = "Informe o nome do revendedor.";
  }
  if (opcoes?.origemNomus) {
    if (!rcc.produto.trim()) {
      erros.produto = "Informe o produto.";
    }
  } else if (rcc.temPedidoVenda !== "sim" && rcc.temPedidoVenda !== "nao") {
    erros.temPedidoVenda = "Informe se há pedido de venda emitido.";
  } else if (rcc.temPedidoVenda === "sim") {
    if (!(rcc.itensProduto ?? []).some(itemComPedido)) {
      erros.itensProduto = "Informe o pedido de venda e o item.";
    }
  } else if (!(rcc.itensProduto ?? []).some(itemLivre)) {
    erros.itensProduto = "Informe o código e a descrição do produto.";
  }
  if (!rcc.descricaoReclamacao.trim()) {
    erros.descricaoReclamacao = "Descreva a reclamação.";
  }
  const linhasComTexto = (rcc.linhasReclamacao ?? []).filter((linha) => linha.texto.trim());
  if (linhasComTexto.some((linha) => !linha.lista.trim())) {
    erros.reclamacao1 = "Categorize a reclamação.";
  }

  const encerrando = Boolean(rcc.dataFechamento.trim());
  if (encerrando && !respostaSimNao(rcc.problemaSolucionado)) {
    erros.problemaSolucionado = "Informe se o problema foi solucionado.";
  }
  if (rcc.problemaSolucionado === "Sim" && !encerrando) {
    erros.dataFechamento = "Informe a data de fechamento da reclamação.";
  }
  if (encerrando && linhasComTexto.some((linha) => !respostaSimNao(linha.aceita))) {
    erros.reclamacaoAceita = "Para encerrar, informe se a reclamação foi aceita.";
  }
  if (encerrando && linhasComTexto.some((linha) => !(linha.causa ?? "").trim())) {
    erros.causaProblema = "Para encerrar, informe a causa do problema.";
  }

  const linhasServico = rcc.linhasServico ?? [];
  const houveAssistencia = Boolean(
    rcc.responsavelAssistencia ||
      rcc.funcionarioSolicitado.trim() ||
      rcc.servicoRealizado.trim() ||
      linhasServico.some(servicoPreenchido)
  );
  if (encerrando && houveAssistencia) {
    if (!rcc.responsavelAssistencia && !opcoes?.origemNomus) {
      erros.responsavelAssistencia = "Para encerrar, informe o responsável pela assistência.";
    }
    if (!rcc.funcionarioSolicitado.trim()) {
      erros.funcionarioSolicitado = "Para encerrar, informe o funcionário da assistência.";
    }
    if (!rcc.servicoRealizado.trim() && !linhasServico.some(servicoPreenchido)) {
      erros.servicoRealizado = "Para encerrar, informe o serviço realizado.";
    }
  }

  if (opcoes?.origemNomus) {
    if (!quantidadeInformada(rcc.quantidade) && !erros.quantidade) {
      erros.quantidade = "Informe a quantidade.";
    }
  } else if (rcc.temPedidoVenda === "sim" || rcc.temPedidoVenda === "nao") {
    const linhasProduto = (rcc.itensProduto ?? []).filter(
      rcc.temPedidoVenda === "sim" ? itemComPedido : itemLivre
    );
    if (linhasProduto.some((item) => !quantidadeInformada(item.quantidade)) && !erros.quantidade) {
      erros.quantidade = "Informe a quantidade.";
    }
  }

  if (rcc.temPedidoVenda === "sim") {
    const acima = (rcc.itensProduto ?? []).find((item) => {
      const qtde = Number(String(item.quantidade).replace(",", "."));
      const max = Number(String(item.quantidadeMaxima).replace(",", "."));
      return (
        item.quantidade.trim() &&
        Number.isFinite(qtde) &&
        Number.isFinite(max) &&
        max > 0 &&
        qtde > max
      );
    });
    if (acima) {
      erros.quantidade = `A quantidade não pode passar de ${acima.quantidadeMaxima}, que é o que foi vendido.`;
    }
  }

  return {
    valido: Object.keys(erros).length === 0,
    erros,
  };
}

export function inferirStatusRcc(
  rcc: RccDados
): "aberto" | "em_tratamento" | "encerrado" {
  if (rcc.dataFechamento.trim()) return "encerrado";
  if (
    rcc.servicoRealizado.trim() ||
    rcc.servicoRealizado1.trim() ||
    rcc.causaProblema.trim()
  ) {
    return "em_tratamento";
  }
  return "aberto";
}
