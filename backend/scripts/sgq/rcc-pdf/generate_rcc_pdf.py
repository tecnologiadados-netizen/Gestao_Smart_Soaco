#!/usr/bin/env python3
"""Preenche o modelo Word do RCC e gera PDF (cliente ou empresa)."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from docx import Document

SCRIPT_DIR = Path(__file__).resolve().parent
SGQ_DIR = SCRIPT_DIR.parent
if str(SGQ_DIR) not in sys.path:
    sys.path.insert(0, str(SGQ_DIR))
from docx_cells import definir_celula

TEMPLATES_DIR = SCRIPT_DIR / "templates"

VENDEDOR_PADRAO = "SO AÇO INDUSTRIAL LTDA - SO MOVEIS LTDA"

STATUS_LABELS = {
    "aberto": "Aberto",
    "em_tratamento": "Em andamento",
    "encerrado": "Fechado",
}


def normalizar_texto(texto: str) -> str:
    """Corrige caracteres quebrados vindos do histórico ERP/Nomus."""
    if not texto:
        return texto
    correcoes = (
        ("BALC\u00c3O", "BALCÃO"),
        ("BALC\u00c3o", "Balcão"),
        ("SERVI\u00c3O", "SERVIÇO"),
        ("Servi\u00c3o", "Serviço"),
        ("servi\u00c3o", "serviço"),
        ("N\u00c3O", "NÃO"),
        ("n\u00c3o", "não"),
    )
    for errado, certo in correcoes:
        texto = texto.replace(errado, certo)
    return texto


def valor_campo(valor: Any) -> str:
    if valor is None:
        return ""
    return normalizar_texto(str(valor).strip())


def formatar_data(valor: Any) -> str:
    texto = valor_campo(valor)
    if not texto:
        return ""
    try:
        if texto.endswith("Z"):
            texto = texto[:-1] + "+00:00"
        data = datetime.fromisoformat(texto)
        return data.strftime("%d/%m/%Y")
    except ValueError:
        return texto


def formatar_hora(valor: Any) -> str:
    texto = valor_campo(valor)
    if not texto:
        return ""
    if len(texto) >= 5 and ":" in texto:
        return texto[:5]
    return texto


def nome_revendedor(rcc: dict[str, Any]) -> str:
    if rcc.get("clienteDoRevendedor"):
        return valor_campo(rcc.get("nomeRevendedor"))
    return valor_campo(rcc.get("vendedor")) or VENDEDOR_PADRAO


def causa_problema(rcc: dict[str, Any]) -> str:
    """Causa informada em cada linha da reclamação."""
    linhas = rcc.get("linhasReclamacao")
    causas: list[str] = []
    if isinstance(linhas, list):
        for linha in linhas:
            if not isinstance(linha, dict):
                continue
            causa = valor_campo(linha.get("causa"))
            if causa and causa not in causas:
                causas.append(causa)
    if causas:
        return "; ".join(causas)
    return valor_campo(rcc.get("causaProblema"))


def tipo_reclamacao(rcc: dict[str, Any]) -> str:
    """Só a categoria (Categorize a reclamação), sem a descrição da linha."""
    linhas = rcc.get("linhasReclamacao")
    categorias: list[str] = []
    if isinstance(linhas, list):
        for linha in linhas:
            if not isinstance(linha, dict):
                continue
            categoria = valor_campo(linha.get("lista"))
            if categoria and categoria not in categorias:
                categorias.append(categoria)
    if categorias:
        return "; ".join(categorias)

    def so_categoria(valor: str) -> str:
        if " — " in valor:
            return valor.rsplit(" — ", 1)[-1].strip()
        return valor

    legado = valor_campo(rcc.get("reclamacao1") or rcc.get("reclamacao2"))
    partes = [so_categoria(trecho.strip()) for trecho in legado.split(";") if trecho.strip()]
    unicas = []
    for parte in partes:
        if parte and parte not in unicas:
            unicas.append(parte)
    return "; ".join(unicas)


def juntar_codigo_descricao(codigo: str, descricao: str) -> str:
    if codigo and descricao:
        if descricao.upper().startswith(codigo.upper()):
            return descricao
        return f"{codigo} - {descricao}"
    return descricao or codigo


def itens_produto(rcc: dict[str, Any]) -> list[dict[str, Any]]:
    itens = rcc.get("itensProduto")
    if not isinstance(itens, list):
        return []
    return [item for item in itens if isinstance(item, dict)]


def enumerar_por_produto(valores: list[str], rotulo: str) -> str:
    """Um produto fica como está. Vários viram linhas numeradas, com espaço entre elas."""
    textos = [valor_campo(valor) for valor in valores]
    if len(textos) <= 1:
        return textos[0] if textos else ""
    if not any(textos):
        return ""
    blocos = [f"{indice}° {rotulo}: {texto}" for indice, texto in enumerate(textos, start=1)]
    return "\n\n".join(blocos)


def formatar_datas_item(valor: Any) -> str:
    texto = valor_campo(valor)
    if not texto:
        return ""
    partes = [parte.strip() for parte in texto.split(",") if parte.strip()]
    return ", ".join(formatar_data(parte) for parte in partes)


def texto_produto_item(item: dict[str, Any], incluir_codigo: bool) -> str:
    descricao = valor_campo(item.get("produto"))
    if not incluir_codigo:
        return descricao
    return juntar_codigo_descricao(valor_campo(item.get("codigoProduto")), descricao)


def produto_com_codigo(rcc: dict[str, Any]) -> str:
    """Código e descrição no mesmo texto, sem repetir o código quando ele já está na descrição."""
    partes = [texto_produto_item(item, True) for item in itens_produto(rcc)]
    partes = [parte for parte in partes if parte]
    if partes:
        return "; ".join(partes)
    return juntar_codigo_descricao(
        valor_campo(rcc.get("codigoProduto")),
        valor_campo(rcc.get("produto")),
    )


def campo_por_produto(valores: list[str], legado: str, rotulo: str) -> str:
    if any(valor_campo(valor) for valor in valores):
        return enumerar_por_produto(valores, rotulo)
    return legado


def aplicar_identificacao_produtos(
    campos: dict[str, str], rcc: dict[str, Any], versao: str
) -> None:
    """Numera produto, quantidade, NF, emissão e pedido quando há mais de um item."""
    itens = itens_produto(rcc)
    if len(itens) <= 1:
        if versao == "cliente":
            campos["produto"] = produto_com_codigo(rcc)
        return

    incluir_codigo = versao == "cliente"
    campos["produto"] = enumerar_por_produto(
        [texto_produto_item(item, incluir_codigo) for item in itens],
        "Produto",
    )
    campos["quantidade"] = campo_por_produto(
        [valor_campo(item.get("quantidade")) for item in itens],
        campos["quantidade"],
        "produto",
    )
    campos["nota_fiscal"] = campo_por_produto(
        [valor_campo(item.get("notaFiscal")) for item in itens],
        campos["nota_fiscal"],
        "produto",
    )
    campos["data_nf"] = campo_por_produto(
        [formatar_datas_item(item.get("dataEmissaoNf")) for item in itens],
        campos["data_nf"],
        "produto",
    )
    campos["pedido"] = campo_por_produto(
        [valor_campo(item.get("pedidoNumero")) for item in itens],
        campos["pedido"],
        "produto",
    )


def servicos_realizados(rcc: dict[str, Any]) -> str:
    partes = [
        valor_campo(rcc.get("servicoRealizado")),
        valor_campo(rcc.get("servicoRealizado1")),
        valor_campo(rcc.get("servicoRealizado2")),
    ]
    return " · ".join(p for p in partes if p)


def montar_campos(payload: dict[str, Any]) -> dict[str, str]:
    registro = payload.get("registro") or {}
    rcc = registro.get("rcc") or {}
    codigo = valor_campo(
        registro.get("codigoDocumento")
        or rcc.get("codigoDocumento")
        or registro.get("numero")
    )
    status = STATUS_LABELS.get(
        valor_campo(registro.get("status")), valor_campo(registro.get("status"))
    )

    cidade = valor_campo(rcc.get("cidade"))
    estado = valor_campo(rcc.get("estado"))
    if cidade and estado and estado not in cidade:
        cidade = f"{cidade}-{estado}"

    return {
        "numero_reclamacao": codigo,
        "data_registro": formatar_data(rcc.get("dataRegistroReclamacao")),
        "data_fechamento": formatar_data(rcc.get("dataFechamento")),
        "status": status,
        "nome_consumidor": valor_campo(rcc.get("nomeClienteConsumidor")),
        "nome_revendedor": nome_revendedor(rcc),
        "contato": valor_campo(rcc.get("contato")),
        "cidade": cidade,
        "telefone": valor_campo(rcc.get("telefone")),
        "bairro": valor_campo(rcc.get("bairro")),
        "endereco": valor_campo(rcc.get("endereco")),
        "ponto_referencia": valor_campo(rcc.get("pontoReferencia")),
        "produto": valor_campo(rcc.get("produto")),
        "serie_lote": valor_campo(rcc.get("numeroSerieLoteProduto")),
        "data_nf": formatar_data(rcc.get("dataEmissaoNf")),
        "nota_fiscal": valor_campo(rcc.get("numeroNf")),
        "quantidade": valor_campo(rcc.get("quantidade")),
        "pedido": valor_campo(rcc.get("numeroPedidoInternoExterno")),
        "tipo_reclamacao": tipo_reclamacao(rcc),
        "causa_problema": causa_problema(rcc),
        "descricao_reclamacao": valor_campo(rcc.get("descricaoReclamacao")),
        "reclamacao_aceita": valor_campo(rcc.get("reclamacaoAceita")),
        "dentro_garantia": valor_campo(rcc.get("produtoDentroGarantia")),
        "abrir_os": valor_campo(rcc.get("abrirOrdemServico")),
        "comentario": valor_campo(rcc.get("comentario")),
        "responsavel_analise": valor_campo(rcc.get("usuarioCriacao")),
        "ordem_producao": valor_campo(rcc.get("numeroOrdemProducao")),
        "data_assistencia": formatar_data(rcc.get("dataAssistencia")),
        "funcionario": valor_campo(rcc.get("funcionarioSolicitado")),
        "hora_saida_empresa": formatar_hora(rcc.get("horaSaidaEmpresa")),
        "serie_compressor": valor_campo(rcc.get("numeroSerieCompressor")),
        "hora_chegada_empresa": formatar_hora(rcc.get("horaChegadaEmpresa")),
        "servico_realizado": servicos_realizados(rcc),
        "problema_solucionado": valor_campo(rcc.get("problemaSolucionado")),
        "data_conclusao": formatar_data(rcc.get("dataFechamento")),
        "hora_chegada_cliente": formatar_hora(rcc.get("horaChegadaCliente")),
        "hora_saida_cliente": formatar_hora(rcc.get("horaSaidaCliente")),
    }


def preencher_cliente(table, campos: dict[str, str]) -> None:
    definir_celula(table, 1, 1, campos["numero_reclamacao"])
    definir_celula(table, 1, 7, campos["data_registro"])
    definir_celula(table, 1, 13, campos["data_fechamento"])
    definir_celula(table, 1, 18, campos["status"])
    definir_celula(table, 3, 1, campos["nome_consumidor"])
    definir_celula(table, 3, 16, campos["nome_revendedor"])
    definir_celula(table, 4, 1, campos["contato"])
    definir_celula(table, 4, 13, campos["cidade"])
    definir_celula(table, 5, 1, campos["telefone"])
    definir_celula(table, 5, 13, campos["bairro"])
    definir_celula(table, 6, 1, campos["endereco"])
    definir_celula(table, 6, 13, campos["ponto_referencia"])
    definir_celula(table, 8, 3, campos["produto"])
    definir_celula(table, 8, 15, campos["serie_lote"])
    definir_celula(table, 9, 3, campos["data_nf"])
    definir_celula(table, 9, 15, campos["nota_fiscal"])
    definir_celula(table, 10, 3, campos["quantidade"])
    definir_celula(table, 10, 15, campos["pedido"])
    definir_celula(table, 12, 8, campos["tipo_reclamacao"])
    definir_celula(table, 14, 0, campos["descricao_reclamacao"])
    definir_celula(table, 16, 2, campos["reclamacao_aceita"])
    definir_celula(table, 16, 8, campos["dentro_garantia"])
    definir_celula(table, 16, 17, campos["abrir_os"])
    definir_celula(table, 17, 2, campos["responsavel_analise"])
    definir_celula(table, 19, 4, campos["hora_chegada_cliente"])
    definir_celula(table, 19, 14, campos["hora_saida_cliente"])


def preencher_empresa(table, campos: dict[str, str]) -> None:
    definir_celula(table, 1, 1, campos["numero_reclamacao"])
    definir_celula(table, 1, 5, campos["data_registro"])
    definir_celula(table, 1, 12, campos["data_fechamento"])
    definir_celula(table, 1, 18, campos["status"])
    definir_celula(table, 3, 1, campos["nome_consumidor"])
    definir_celula(table, 3, 14, campos["nome_revendedor"])
    definir_celula(table, 4, 1, campos["contato"])
    definir_celula(table, 4, 12, campos["cidade"])
    definir_celula(table, 5, 1, campos["telefone"])
    definir_celula(table, 5, 12, campos["bairro"])
    definir_celula(table, 6, 1, campos["endereco"])
    definir_celula(table, 6, 12, campos["ponto_referencia"])
    definir_celula(table, 8, 3, campos["produto"])
    definir_celula(table, 8, 15, campos["serie_lote"])
    definir_celula(table, 9, 3, campos["data_nf"])
    definir_celula(table, 9, 15, campos["nota_fiscal"])
    definir_celula(table, 10, 3, campos["quantidade"])
    definir_celula(table, 10, 15, campos["pedido"])
    definir_celula(table, 12, 3, campos["tipo_reclamacao"])
    definir_celula(table, 12, 13, campos["causa_problema"])
    definir_celula(table, 14, 0, campos["descricao_reclamacao"])
    definir_celula(table, 16, 0, campos["comentario"])
    definir_celula(table, 19, 4, campos["funcionario"])
    definir_celula(table, 19, 16, campos["hora_saida_empresa"])
    definir_celula(table, 20, 4, campos["serie_compressor"])
    definir_celula(table, 20, 16, campos["hora_chegada_empresa"])
    definir_celula(table, 22, 4, campos["servico_realizado"])
    definir_celula(table, 23, 4, campos["problema_solucionado"])
    definir_celula(table, 23, 17, campos["data_conclusao"])
    definir_celula(table, 24, 4, campos["hora_chegada_cliente"])
    definir_celula(table, 24, 17, campos["hora_saida_cliente"])


def preencher_documento(versao: str, campos: dict[str, str]) -> Document:
    template_name = "cliente.docx" if versao == "cliente" else "empresa.docx"
    template_path = TEMPLATES_DIR / template_name
    if not template_path.exists():
        raise FileNotFoundError(f"Modelo não encontrado: {template_path}")

    doc = Document(template_path)
    if not doc.tables:
        raise ValueError("O modelo não contém tabelas.")

    table = doc.tables[0]
    if versao == "cliente":
        preencher_cliente(table, campos)
    else:
        preencher_empresa(table, campos)
    return doc


def converter_para_pdf(docx_path: Path, pdf_path: Path) -> None:
    from docx_to_pdf import converter_docx_para_pdf

    converter_docx_para_pdf(str(docx_path), str(pdf_path))


def gerar_pdf(payload: dict[str, Any], output_path: Path) -> None:
    versao = valor_campo(payload.get("versao")).lower()
    if versao not in {"cliente", "empresa"}:
        raise ValueError("Versão inválida. Use 'cliente' ou 'empresa'.")

    campos = montar_campos(payload)
    registro = payload.get("registro") or {}
    rcc = registro.get("rcc") if isinstance(registro, dict) else {}
    aplicar_identificacao_produtos(campos, rcc if isinstance(rcc, dict) else {}, versao)
    doc = preencher_documento(versao, campos)

    with tempfile.TemporaryDirectory() as tmp_dir:
        docx_path = Path(tmp_dir) / "rcc_preenchido.docx"
        doc.save(docx_path)
        converter_para_pdf(docx_path, output_path)

    rnc_pdf_dir = SCRIPT_DIR.parent / "rnc-pdf"
    if str(rnc_pdf_dir) not in sys.path:
        sys.path.insert(0, str(rnc_pdf_dir))
    from generate_rnc_pdf import anexar_evidencias

    anexar_evidencias(output_path, payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera PDF do RCC a partir do modelo Word.")
    parser.add_argument(
        "--input",
        "-i",
        help="Arquivo JSON com os dados do registro. Se omitido, lê stdin.",
    )
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Caminho do arquivo PDF de saída.",
    )
    args = parser.parse_args()

    try:
        if args.input:
            raw = Path(args.input).read_text(encoding="utf-8")
        else:
            raw = sys.stdin.buffer.read().decode("utf-8")
        payload = json.loads(raw)
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        gerar_pdf(payload, output_path)
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
