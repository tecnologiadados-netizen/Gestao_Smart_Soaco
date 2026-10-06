"""Utilitários compartilhados para preenchimento de células nos modelos Word."""

from __future__ import annotations

from docx.shared import Pt

FONT_NAME = "Arial"
FONT_SIZE = Pt(8)


def formatar_texto_celula(texto: str) -> str:
    """Adiciona margem visual à esquerda para não colar na grade."""
    valor = texto.strip()
    if not valor:
        return ""
    return f" {valor}"


def _aplicar_fonte(run) -> None:
    run.font.name = FONT_NAME
    run.font.size = FONT_SIZE


def _escrever_linha_unica(paragraph, texto: str) -> None:
    if paragraph.runs:
        paragraph.runs[0].text = texto
        for run in paragraph.runs[1:]:
            run.text = ""
        run = paragraph.runs[0]
    else:
        run = paragraph.add_run(texto)
    _aplicar_fonte(run)


def _escrever_varias_linhas(paragraph, linhas: list[str]) -> None:
    """Cada quebra vira uma linha no Word; linha vazia vira espaço entre produtos."""
    for run in list(paragraph.runs):
        run._element.getparent().remove(run._element)

    for indice, linha in enumerate(linhas):
        if indice > 0:
            paragraph.add_run().add_break()
        if not linha:
            continue
        conteudo = linha if linha.startswith(" ") else f" {linha}"
        _aplicar_fonte(paragraph.add_run(conteudo))


def _altura_acompanha_conteudo(table, linha: int) -> None:
    """A linha cresce com o texto. O valor original continua sendo o mínimo."""
    from docx.oxml.ns import qn

    tr = table.rows[linha]._tr
    tr_pr = tr.get_or_add_trPr()
    altura = tr_pr.find(qn("w:trHeight"))
    if altura is None:
        return
    altura.set(qn("w:hRule"), "atLeast")


def definir_celula(table, linha: int, coluna: int, texto: str) -> None:
    """Preenche apenas o valor, preservando mesclagens e formatação do modelo."""
    texto_formatado = formatar_texto_celula(texto)
    if not texto_formatado:
        return

    cell = table.cell(linha, coluna)
    if not cell.paragraphs:
        cell.add_paragraph()
    paragraph = cell.paragraphs[0]

    linhas = texto_formatado.split("\n")
    if len(linhas) == 1:
        _escrever_linha_unica(paragraph, linhas[0])
    else:
        _escrever_varias_linhas(paragraph, linhas)
        _altura_acompanha_conteudo(table, linha)

    for extra in cell.paragraphs[1:]:
        extra._element.getparent().remove(extra._element)
