#!/usr/bin/env python3
"""Preenche o modelo Word do RNC e gera PDF."""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

SCRIPT_DIR = Path(__file__).resolve().parent
SGQ_DIR = SCRIPT_DIR.parent
if str(SGQ_DIR) not in sys.path:
    sys.path.insert(0, str(SGQ_DIR))
from docx_cells import definir_celula

TEMPLATES_DIR = SCRIPT_DIR / "templates"

STATUS_LABELS = {
    "aberto": "Aberto",
    "em_tratamento": "Em andamento",
    "encerrado": "Finalizada",
}


def normalizar_texto(texto: str) -> str:
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


def descricao_ocorrencia(rnc: dict[str, Any]) -> str:
    partes: list[str] = []
    tipo_produto = valor_campo(rnc.get("tipoProduto"))
    descricao = valor_campo(rnc.get("descricaoOcorrencia"))

    if tipo_produto:
        partes.append(f"Tipo de produto: {tipo_produto}")
    if descricao:
        partes.append(descricao)
    return "\n".join(partes)


def codigo_produto(rnc: dict[str, Any]) -> str:
    codigo = valor_campo(rnc.get("codigoProduto"))
    if codigo:
        return codigo
    produto = valor_campo(rnc.get("produto"))
    if not produto:
        return ""
    match = re.match(r"^([A-Z]{2,4}\s+[\dA-Za-z./]+)\s*-", produto, re.IGNORECASE)
    return match.group(1).strip().upper() if match else ""


def descricao_produto(rnc: dict[str, Any]) -> str:
    produto = valor_campo(rnc.get("produto"))
    if not produto:
        return ""
    codigo = codigo_produto(rnc)
    if codigo and produto.upper().startswith(codigo.upper()):
        resto = produto[len(codigo) :].strip()
        if resto.startswith("-"):
            resto = resto[1:].strip()
        return resto or produto
    return produto


STATUS_ACAO_LABELS = {
    "cancelada": "Cancelada",
    "concluida": "Concluída",
    "reprogramada": "Reprogramada",
}


def acoes_apartadas(rnc: dict[str, Any]) -> list[dict[str, Any]]:
    acoes = rnc.get("acoesApartadas")
    if isinstance(acoes, list) and acoes:
        return [item for item in acoes if isinstance(item, dict)]

    legado: list[dict[str, Any]] = []
    pares = (
        ("acaoCorretiva2", "responsavelAcao2", "prazoAcao2"),
        ("acaoCorretiva3", "responsavelAcao3", "prazoAcao3"),
    )
    for acao_key, resp_key, prazo_key in pares:
        acao = valor_campo(rnc.get(acao_key))
        responsavel = valor_campo(rnc.get(resp_key))
        prazo = valor_campo(rnc.get(prazo_key))
        if acao or responsavel or prazo:
            legado.append(
                {
                    "acao": acao,
                    "responsavel": responsavel,
                    "prazoExecucao": prazo,
                    "status": "",
                }
            )
    return legado


def texto_acao_com_status(acao: dict[str, Any]) -> str:
    texto = valor_campo(acao.get("acao"))
    status = valor_campo(acao.get("status"))
    status_label = STATUS_ACAO_LABELS.get(status, status)
    if status_label and texto:
        return f"{texto} (Status: {status_label})"
    if status_label:
        return f"Status: {status_label}"
    return texto


def porques_causa(rnc: dict[str, Any]) -> list[str]:
    porques = rnc.get("porques")
    if isinstance(porques, list):
        valores = [
            valor_campo(item) if isinstance(item, str) else valor_campo(item)
            for item in porques
        ]
        if any(valores):
            return (valores[:5] + [""] * 5)[:5]

    causa = valor_campo(rnc.get("causa"))
    if not causa:
        return ["", "", "", "", ""]
    linhas = [linha.strip() for linha in causa.splitlines() if linha.strip()]
    if len(linhas) >= 2:
        return (linhas[:5] + [""] * 5)[:5]
    return ["", "", "", "", ""]


def montar_campos(payload: dict[str, Any]) -> dict[str, str]:
    registro = payload.get("registro") or {}
    rnc = registro.get("rnc") or {}
    codigo = valor_campo(
        registro.get("codigoDocumento")
        or rnc.get("codigoDocumento")
        or registro.get("numero")
    )
    status = STATUS_LABELS.get(
        valor_campo(registro.get("status")), valor_campo(registro.get("status"))
    )
    porque = porques_causa(rnc)
    acoes = acoes_apartadas(rnc)
    acao_2 = acoes[0] if len(acoes) > 0 else {}
    acao_3 = acoes[1] if len(acoes) > 1 else {}

    return {
        "numero_rnc": codigo,
        "data_registro": formatar_data(rnc.get("dataOcorrencia")),
        "data_fechamento": formatar_data(rnc.get("dataFechamento")),
        "status": status,
        "codigo_produto": codigo_produto(rnc),
        "descricao_produto": descricao_produto(rnc),
        "tipo_acao": valor_campo(rnc.get("tipoAcao")),
        "tipo_ocorrencia": valor_campo(rnc.get("tipoOcorrencia")),
        "quantidade": valor_campo(rnc.get("quantidade")),
        "setor_ocorrencia": valor_campo(rnc.get("setorOcorrencia")),
        "setor_deteccao": valor_campo(rnc.get("setorDeteccao")),
        "lote_serie": valor_campo(rnc.get("loteSerie")),
        "grupo_produto": valor_campo(rnc.get("grupoProduto")),
        "op_numero": valor_campo(rnc.get("numeroOrdemProducao")),
        "nota_fiscal": valor_campo(rnc.get("notaFiscal")),
        "descricao_ocorrencia": descricao_ocorrencia(rnc),
        "preenchido_por": valor_campo(rnc.get("responsavel") or rnc.get("usuarioCriacao")),
        "data_ocorrencia": formatar_data(rnc.get("dataOcorrencia")),
        "acao_imediata": valor_campo(rnc.get("acaoImediata")),
        "descricao_acao_imediata": valor_campo(rnc.get("descricaoAcaoImediata")),
        "responsavel_acao_imediata": valor_campo(rnc.get("responsavelAcaoImediata")),
        "prazo_execucao": formatar_data(rnc.get("prazoExecucao")),
        "abertura_analise_causa": valor_campo(rnc.get("analiseProblema")),
        "porque_1": porque[0],
        "porque_2": porque[1],
        "porque_3": porque[2],
        "porque_4": porque[3],
        "porque_5": porque[4],
        "causa_raiz": valor_campo(rnc.get("causa")),
        "acao_1": valor_campo(rnc.get("resolucaoNaoConformidade")),
        "acao_1_responsavel": valor_campo(rnc.get("responsavelAcaoImediata")),
        "acao_1_prazo": formatar_data(rnc.get("prazoExecucao")),
        "acao_2": texto_acao_com_status(acao_2),
        "acao_2_responsavel": valor_campo(acao_2.get("responsavel")),
        "acao_2_prazo": formatar_data(acao_2.get("prazoExecucao")),
        "acao_3": texto_acao_com_status(acao_3),
        "acao_3_responsavel": valor_campo(acao_3.get("responsavel")),
        "acao_3_prazo": formatar_data(acao_3.get("prazoExecucao")),
        "analise_eficaz": valor_campo(rnc.get("analiseEficaz")),
    }


def _sem_texto(*valores: str) -> bool:
    return not any(valores)


def indices_linhas_sem_conteudo(campos: dict[str, str]) -> list[int]:
    """Linhas do modelo cujo conteúdo está vazio e não devem sair no PDF."""
    remover: list[int] = []

    if _sem_texto(campos["codigo_produto"], campos["descricao_produto"]):
        remover.append(3)
    if _sem_texto(campos["tipo_acao"], campos["tipo_ocorrencia"], campos["quantidade"]):
        remover.append(4)
    if _sem_texto(campos["setor_ocorrencia"], campos["setor_deteccao"], campos["lote_serie"]):
        remover.append(5)
    if _sem_texto(campos["grupo_produto"], campos["op_numero"], campos["nota_fiscal"]):
        remover.append(6)
    if {3, 4, 5, 6}.issubset(remover):
        remover.append(2)

    if _sem_texto(campos["descricao_ocorrencia"]):
        remover.extend([7, 8])
    if _sem_texto(campos["preenchido_por"], campos["data_ocorrencia"]):
        remover.append(9)

    if _sem_texto(campos["acao_imediata"]):
        remover.append(11)
    if _sem_texto(campos["descricao_acao_imediata"]):
        remover.extend([12, 13])
    if _sem_texto(campos["responsavel_acao_imediata"], campos["prazo_execucao"]):
        remover.append(14)
    if _sem_texto(campos["abertura_analise_causa"]):
        remover.append(15)

    for indice, chave in enumerate(
        ("porque_1", "porque_2", "porque_3", "porque_4", "porque_5"),
        start=17,
    ):
        if _sem_texto(campos[chave]):
            remover.append(indice)

    if _sem_texto(campos["causa_raiz"]):
        remover.append(22)

    for indice, numero in ((23, "1"), (24, "2"), (25, "3")):
        if _sem_texto(
            campos[f"acao_{numero}"],
            campos[f"acao_{numero}_responsavel"],
            campos[f"acao_{numero}_prazo"],
        ):
            remover.append(indice)

    if _sem_texto(campos["analise_eficaz"]):
        remover.append(26)

    if all(linha in remover for linha in range(17, 27)):
        remover.append(16)

    return remover


def remover_linhas(table, indices: list[int]) -> None:
    for indice in sorted(set(indices), reverse=True):
        tr = table.rows[indice]._tr
        table._tbl.remove(tr)


def esvaziar_celula(table, linha: int, coluna: int) -> None:
    celula = table.cell(linha, coluna)._tc
    for filho in list(celula):
        if filho.tag != qn("w:tcPr"):
            celula.remove(filho)
    celula.append(OxmlElement("w:p"))


def fundir_celulas(table, linha: int, coluna_inicio: int, coluna_fim: int) -> None:
    if coluna_fim <= coluna_inicio:
        return
    table.cell(linha, coluna_inicio).merge(table.cell(linha, coluna_fim))


def ocultar_campos_vazios(table, linha: int, campos: list[tuple[int, int, int, int, str]]) -> None:
    """Some com o rótulo de um campo vazio que divide a linha com outro preenchido."""
    if not any(texto for *_, texto in campos):
        return

    indice = 0
    while indice < len(campos):
        if campos[indice][4]:
            indice += 1
            continue
        inicio = indice
        while indice < len(campos) and not campos[indice][4]:
            indice += 1
        fim = indice - 1
        for rotulo_ini, _rotulo_fim, valor_ini, _valor_fim, _texto in campos[inicio : fim + 1]:
            esvaziar_celula(table, linha, rotulo_ini)
            esvaziar_celula(table, linha, valor_ini)
        if inicio > 0:
            fundir_celulas(table, linha, campos[inicio - 1][2], campos[fim][3])
        elif indice < len(campos):
            fundir_celulas(table, linha, campos[inicio][0], campos[indice][1])


def ocultar_grade_vazia(table, campos: dict[str, str]) -> None:
    linhas = (
        (
            1,
            (
                (0, 0, 1, 3, campos["numero_rnc"]),
                (4, 6, 7, 9, campos["data_registro"]),
                (10, 12, 13, 14, campos["data_fechamento"]),
                (15, 15, 16, 16, campos["status"]),
            ),
        ),
        (
            3,
            (
                (0, 0, 1, 7, campos["codigo_produto"]),
                (8, 11, 12, 16, campos["descricao_produto"]),
            ),
        ),
        (
            4,
            (
                (0, 0, 1, 4, campos["tipo_acao"]),
                (5, 7, 8, 11, campos["tipo_ocorrencia"]),
                (12, 12, 13, 16, campos["quantidade"]),
            ),
        ),
        (
            5,
            (
                (0, 0, 1, 4, campos["setor_ocorrencia"]),
                (5, 7, 8, 11, campos["setor_deteccao"]),
                (12, 12, 13, 16, campos["lote_serie"]),
            ),
        ),
        (
            6,
            (
                (0, 0, 1, 4, campos["grupo_produto"]),
                (5, 7, 8, 11, campos["op_numero"]),
                (12, 12, 13, 16, campos["nota_fiscal"]),
            ),
        ),
        (
            9,
            (
                (0, 2, 3, 8, campos["preenchido_por"]),
                (9, 13, 14, 16, campos["data_ocorrencia"]),
            ),
        ),
        (
            14,
            (
                (0, 2, 3, 8, campos["responsavel_acao_imediata"]),
                (9, 13, 14, 16, campos["prazo_execucao"]),
            ),
        ),
    )
    for linha, grade in linhas:
        ocultar_campos_vazios(table, linha, list(grade))
    for linha, prefixo in ((23, "acao_1"), (24, "acao_2"), (25, "acao_3")):
        ocultar_campos_vazios(
            table,
            linha,
            [
                (0, 1, 2, 5, campos[prefixo]),
                (6, 10, 11, 12, campos[f"{prefixo}_responsavel"]),
                (13, 15, 16, 16, campos[f"{prefixo}_prazo"]),
            ],
        )


def preencher_rnc(table, campos: dict[str, str]) -> None:
    definir_celula(table, 1, 1, campos["numero_rnc"])
    definir_celula(table, 1, 7, campos["data_registro"])
    definir_celula(table, 1, 13, campos["data_fechamento"])
    definir_celula(table, 1, 16, campos["status"])
    definir_celula(table, 3, 1, campos["codigo_produto"])
    definir_celula(table, 3, 12, campos["descricao_produto"])
    definir_celula(table, 4, 1, campos["tipo_acao"])
    definir_celula(table, 4, 8, campos["tipo_ocorrencia"])
    definir_celula(table, 4, 13, campos["quantidade"])
    definir_celula(table, 5, 1, campos["setor_ocorrencia"])
    definir_celula(table, 5, 8, campos["setor_deteccao"])
    definir_celula(table, 5, 13, campos["lote_serie"])
    definir_celula(table, 6, 1, campos["grupo_produto"])
    definir_celula(table, 6, 8, campos["op_numero"])
    definir_celula(table, 6, 13, campos["nota_fiscal"])
    definir_celula(table, 8, 0, campos["descricao_ocorrencia"])
    definir_celula(table, 9, 3, campos["preenchido_por"])
    definir_celula(table, 9, 14, campos["data_ocorrencia"])
    definir_celula(table, 11, 3, campos["acao_imediata"])
    definir_celula(table, 13, 0, campos["descricao_acao_imediata"])
    definir_celula(table, 14, 3, campos["responsavel_acao_imediata"])
    definir_celula(table, 14, 14, campos["prazo_execucao"])
    definir_celula(table, 15, 3, campos["abertura_analise_causa"])
    definir_celula(table, 17, 2, campos["porque_1"])
    definir_celula(table, 18, 2, campos["porque_2"])
    definir_celula(table, 19, 2, campos["porque_3"])
    definir_celula(table, 20, 2, campos["porque_4"])
    definir_celula(table, 21, 2, campos["porque_5"])
    definir_celula(table, 22, 2, campos["causa_raiz"])
    definir_celula(table, 23, 2, campos["acao_1"])
    definir_celula(table, 23, 11, campos["acao_1_responsavel"])
    definir_celula(table, 23, 16, campos["acao_1_prazo"])
    definir_celula(table, 24, 2, campos["acao_2"])
    definir_celula(table, 24, 11, campos["acao_2_responsavel"])
    definir_celula(table, 24, 16, campos["acao_2_prazo"])
    definir_celula(table, 25, 2, campos["acao_3"])
    definir_celula(table, 25, 11, campos["acao_3_responsavel"])
    definir_celula(table, 25, 16, campos["acao_3_prazo"])
    definir_celula(table, 26, 2, campos["analise_eficaz"])
    ocultar_grade_vazia(table, campos)
    remover_linhas(table, indices_linhas_sem_conteudo(campos))


def preencher_documento(campos: dict[str, str]) -> Document:
    template_path = TEMPLATES_DIR / "rnc.docx"
    if not template_path.exists():
        raise FileNotFoundError(f"Modelo não encontrado: {template_path}")

    doc = Document(template_path)
    if not doc.tables:
        raise ValueError("O modelo não contém tabelas.")

    preencher_rnc(doc.tables[0], campos)
    return doc


BACKEND_ROOT = SCRIPT_DIR.parents[2]
UPLOADS_QUALIDADE = BACKEND_ROOT / "var" / "uploads" / "qualidade"
IMAGENS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff"}


def decodificar_anexo(anexo: dict[str, Any]) -> tuple[str, bytes] | None:
    nome = valor_campo(anexo.get("nome"))
    data_url = valor_campo(anexo.get("dataUrl"))
    if data_url.startswith("data:") and "," in data_url:
        cabecalho, _, conteudo = data_url.partition(",")
        try:
            return cabecalho[5:].split(";")[0].lower(), base64.b64decode(conteudo)
        except (ValueError, TypeError):
            return None

    storage = valor_campo(anexo.get("storagePath")).replace("\\", "/")
    prefixo = "/uploads/qualidade/"
    if not storage.startswith(prefixo) or ".." in storage:
        return None
    relativo = storage[len(prefixo) :]
    caminho = (UPLOADS_QUALIDADE / relativo).resolve()
    raiz = UPLOADS_QUALIDADE.resolve()
    if raiz != caminho and raiz not in caminho.parents:
        return None
    if not caminho.is_file() or not nome:
        return None
    return "", caminho.read_bytes()


def tipo_evidencia(nome: str, mime: str, bruto: bytes) -> str:
    ext = Path(nome).suffix.lower()
    if mime == "application/pdf" or ext == ".pdf" or bruto.startswith(b"%PDF"):
        return "pdf"
    if mime.startswith("image/") or ext in IMAGENS:
        return "imagem"
    if bruto.startswith(b"\x89PNG") or bruto.startswith(b"\xff\xd8"):
        return "imagem"
    return "outro"


def desenhar_cabecalho_evidencia(page, indice: int, titulo: str, nome: str) -> float:
    largura = page.rect.width
    page.draw_rect(
        page.rect.__class__(0, 0, largura, 34),
        color=(0.07, 0.16, 0.38),
        fill=(0.07, 0.16, 0.38),
    )
    page.insert_text(
        (18, 22),
        "EVIDÊNCIAS",
        fontsize=12,
        fontname="helv",
        color=(1, 1, 1),
    )
    rotulo = titulo or nome or f"Evidência {indice}"
    page.insert_textbox(
        page.rect.__class__(18, 42, largura - 18, 64),
        f"{indice}. {rotulo}",
        fontsize=11,
        fontname="helv",
        color=(0.1, 0.1, 0.1),
    )
    if titulo and nome and titulo != nome:
        page.insert_textbox(
            page.rect.__class__(18, 64, largura - 18, 82),
            nome,
            fontsize=8,
            fontname="helv",
            color=(0.35, 0.35, 0.35),
        )
        return 90
    return 76


def adicionar_pagina_texto(doc, indice: int, titulo: str, nome: str, mensagem: str) -> None:
    base = doc[0].rect if doc.page_count else None
    page = doc.new_page(width=base.width, height=base.height) if base else doc.new_page()
    desenhar_cabecalho_evidencia(page, indice, titulo, nome)
    page.insert_textbox(
        page.rect.__class__(18, 90, page.rect.width - 18, 160),
        mensagem,
        fontsize=11,
        fontname="helv",
        color=(0.2, 0.2, 0.2),
    )


def anexos_do_registro(payload: dict[str, Any]) -> list[Any]:
    registro = payload.get("registro") or {}
    tipo = valor_campo(registro.get("tipo")).lower()
    bloco = registro.get(tipo) if tipo in {"rnc", "rcc"} else None
    if not isinstance(bloco, dict):
        bloco = registro.get("rnc") or registro.get("rcc") or {}
    anexos = bloco.get("anexos") if isinstance(bloco, dict) else None
    return anexos if isinstance(anexos, list) else []


def anexar_evidencias(pdf_path: Path, payload: dict[str, Any]) -> None:
    anexos = anexos_do_registro(payload)
    if not anexos:
        return

    try:
        import fitz
    except ImportError:
        print("PyMuPDF não disponível; evidências não foram incluídas.", file=sys.stderr)
        return

    doc = fitz.open(pdf_path)
    paginas_iniciais = doc.page_count
    temporario = pdf_path.with_suffix(".evidencias.pdf")
    try:
        for indice, item in enumerate(anexos, start=1):
            if not isinstance(item, dict):
                continue
            nome = valor_campo(item.get("nome")) or f"Anexo {indice}"
            titulo = valor_campo(item.get("titulo"))
            decodificado = decodificar_anexo(item)
            if not decodificado:
                continue
            mime, bruto = decodificado
            if not bruto:
                continue
            try:
                tipo = tipo_evidencia(nome, mime, bruto)
                if tipo == "pdf":
                    origem = fitz.open(stream=bruto, filetype="pdf")
                    try:
                        for numero in range(origem.page_count):
                            base = doc[0].rect
                            page = doc.new_page(width=base.width, height=base.height)
                            topo = desenhar_cabecalho_evidencia(page, indice, titulo, nome)
                            destino = fitz.Rect(18, topo, page.rect.width - 18, page.rect.height - 18)
                            page.show_pdf_page(destino, origem, numero, keep_proportion=True)
                    finally:
                        origem.close()
                elif tipo == "imagem":
                    base = doc[0].rect
                    page = doc.new_page(width=base.width, height=base.height)
                    topo = desenhar_cabecalho_evidencia(page, indice, titulo, nome)
                    destino = fitz.Rect(18, topo, page.rect.width - 18, page.rect.height - 18)
                    page.insert_image(destino, stream=bruto, keep_proportion=True)
                else:
                    adicionar_pagina_texto(
                        doc,
                        indice,
                        titulo,
                        nome,
                        "Arquivo anexado. Este formato não é exibido dentro do relatório.",
                    )
            except Exception:
                adicionar_pagina_texto(
                    doc,
                    indice,
                    titulo,
                    nome,
                    "Não foi possível exibir este arquivo dentro do relatório.",
                )
        if doc.page_count > paginas_iniciais:
            doc.save(temporario, garbage=4, deflate=True)
    finally:
        doc.close()
    if temporario.exists():
        temporario.replace(pdf_path)


def converter_para_pdf(docx_path: Path, pdf_path: Path) -> None:
    from docx_to_pdf import converter_docx_para_pdf

    converter_docx_para_pdf(str(docx_path), str(pdf_path))


def gerar_pdf(payload: dict[str, Any], output_path: Path) -> None:
    campos = montar_campos(payload)
    doc = preencher_documento(campos)

    with tempfile.TemporaryDirectory() as tmp_dir:
        docx_path = Path(tmp_dir) / "rnc_preenchido.docx"
        doc.save(docx_path)
        converter_para_pdf(docx_path, output_path)
    anexar_evidencias(output_path, payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera PDF do RNC a partir do modelo Word.")
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
