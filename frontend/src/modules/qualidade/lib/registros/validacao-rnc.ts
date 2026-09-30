import { RNC_TIPO_OCORRENCIA_OUTRO } from "@qualidade/lib/registros/constants";
import { anexoTemArquivo } from "@qualidade/types/registro-anexo";
import type { RncDados, RncItemProduto } from "@qualidade/types/rnc";

export interface ValidacaoRncResult {
  valido: boolean;
  erros: Partial<Record<keyof RncDados, string>>;
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

export function validarRnc(
  rnc: RncDados,
  opcoes?: { origemNomus?: boolean }
): ValidacaoRncResult {
  const erros: Partial<Record<keyof RncDados, string>> = {};
  const finalizada = rnc.statusRnc === "finalizada";

  if (!rnc.dataOcorrencia.trim()) {
    erros.dataOcorrencia = "Informe a data da ocorrência.";
  }
  if (!rnc.tipoAcao.trim()) {
    erros.tipoAcao = "Selecione o tipo de ação.";
  }
  if (
    !rnc.tipoOcorrencia.trim() ||
    rnc.tipoOcorrencia.trim() === RNC_TIPO_OCORRENCIA_OUTRO
  ) {
    erros.tipoOcorrencia = "Informe o tipo de ocorrência.";
  }
  if (!rnc.setorOcorrencia.trim()) {
    erros.setorOcorrencia = "Selecione o setor de ocorrência.";
  }
  if (!rnc.descricaoOcorrencia.trim()) {
    erros.descricaoOcorrencia = "Descreva a ocorrência.";
  }
  if (!rnc.setorDeteccao.trim()) {
    erros.setorDeteccao = "Selecione o setor de detecção.";
  }
  if (!rnc.responsavel.trim()) {
    erros.responsavel = "Informe o responsável.";
  }
  if (!rnc.acaoImediata.trim()) {
    erros.acaoImediata = "Selecione a ação imediata.";
  }
  if (!rnc.descricaoAcaoImediata.trim()) {
    erros.descricaoAcaoImediata = "Descreva a ação imediata.";
  }
  if (!rnc.responsavelAcaoImediata.trim()) {
    erros.responsavelAcaoImediata = "Informe o responsável pela ação imediata.";
  }
  if (!rnc.prazoExecucao.trim()) {
    erros.prazoExecucao = "Informe o prazo de execução.";
  }

  const tipoProdutoBloqueado =
    !opcoes?.origemNomus &&
    (rnc.itensProduto ?? []).some((item) => item.codigoProduto.trim());

  if (opcoes?.origemNomus) {
    if (!rnc.codigoProduto.trim()) {
      erros.codigoProduto = "Informe o código do produto.";
    }
    if (!rnc.produto.trim()) {
      erros.produto = "Informe a descrição do produto.";
    }
  } else if (rnc.temPedidoVenda !== "sim" && rnc.temPedidoVenda !== "nao") {
    erros.temPedidoVenda = "Informe se há pedido de venda emitido.";
  } else if (rnc.temPedidoVenda === "sim") {
    if (!(rnc.itensProduto ?? []).some(itemComPedido)) {
      erros.itensProduto = "Informe o pedido de venda e o item.";
    }
  } else if (!(rnc.itensProduto ?? []).some(itemLivre)) {
    erros.itensProduto = "Informe o código e a descrição do produto.";
  }

  if (
    !tipoProdutoBloqueado &&
    (opcoes?.origemNomus || rnc.temPedidoVenda === "sim" || rnc.temPedidoVenda === "nao") &&
    !rnc.tipoProduto.trim()
  ) {
    erros.tipoProduto = "Informe o tipo de produto.";
  }

  if (finalizada && !rnc.dataFechamento.trim()) {
    erros.dataFechamento = "Informe a data de fechamento.";
  }
  if (finalizada && !rnc.causa.trim()) {
    erros.causa = "Informe a causa raiz.";
  }
  if (finalizada && !rnc.resolucaoNaoConformidade.trim()) {
    erros.resolucaoNaoConformidade = "Informe a resolução da não conformidade.";
  }
  if (finalizada && !rnc.analiseEficaz.trim()) {
    erros.analiseEficaz = "Informe se a análise foi eficaz.";
  }
  if (finalizada && !(rnc.anexos ?? []).some((anexo) => anexoTemArquivo(anexo))) {
    erros.anexos = "Anexe pelo menos uma evidência.";
  }

  if (rnc.temPedidoVenda === "sim") {
    const acima = (rnc.itensProduto ?? []).find((item) => {
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

export function inferirStatusRnc(rnc: RncDados): "aberto" | "em_tratamento" | "encerrado" {
  if (rnc.statusRnc === "finalizada") return "encerrado";
  if (rnc.statusRnc === "em_andamento") return "em_tratamento";
  if (rnc.dataFechamento.trim()) return "encerrado";
  if (
    rnc.resolucaoNaoConformidade.trim() ||
    rnc.causa.trim() ||
    (rnc.registrarPlanoAcao && rnc.porques.some((porque) => porque.trim())) ||
    (rnc.inserirAcoesApartadas &&
      rnc.acoesApartadas.some((acao) => acao.acao.trim()))
  ) {
    return "em_tratamento";
  }
  return "aberto";
}
