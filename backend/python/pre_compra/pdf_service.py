"""
Preenche o template Word e exporta para PDF via Microsoft Word.
O layout da página não é alterado — exportação idêntica a 'Salvar como PDF' no Word.
"""
from __future__ import annotations

import os
import re
import tempfile
import threading
from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

TEMPLATE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "assets", "pre-compra", "formulario_cotacao.docx"
)

FONT_NAME = "Arial"
FONT_SIZE = Pt(8)
HEADER_PAD_LEFT = Pt(6)

ITEM_ROW_IDX = 8
SOLICITACAO_VALUE_COL = 3

_word_lock = threading.Lock()


def _fmt_date(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    text = str(value).strip()
    if "T" in text:
        try:
            return datetime.fromisoformat(text).strftime("%d/%m/%Y")
        except ValueError:
            pass
    if len(text) >= 10:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
        except ValueError:
            pass
    return text


def _fmt_date_short(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%d/%m/%y")
    text = str(value).strip()
    if "T" in text:
        try:
            return datetime.fromisoformat(text).strftime("%d/%m/%y")
        except ValueError:
            pass
    if len(text) >= 10:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").strftime("%d/%m/%y")
        except ValueError:
            pass
    return text


def _fmt_money(value) -> str:
    if value is None:
        return "R$ 0,00"
    amount = Decimal(str(value))
    formatted = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


def _fmt_qty(value) -> str:
    if value is None or value == "":
        return ""
    amount = Decimal(str(value))
    return f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower().strip())


def _apply_font_cell(cell, *, bold: bool = False) -> None:
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            run.font.name = FONT_NAME
            run.font.size = FONT_SIZE
            run.font.bold = bold


def _set_cell(
    row,
    index: int,
    text,
    *,
    center: bool = False,
    pad_left: bool = False,
    bold: bool = False,
) -> None:
    cell = row.cells[index]
    value = str(text or "")

    if cell.paragraphs:
        first = cell.paragraphs[0]
        if first.runs:
            first.runs[0].text = value
            for run in first.runs[1:]:
                run.text = ""
        else:
            run = first.add_run(value)
            run.font.name = FONT_NAME
            run.font.size = FONT_SIZE
        for extra in cell.paragraphs[1:]:
            for run in extra.runs:
                run.text = ""
    else:
        cell.text = value

    for paragraph in cell.paragraphs:
        if center:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if pad_left:
            paragraph.paragraph_format.left_indent = HEADER_PAD_LEFT

    _apply_font_cell(cell, bold=bold)


def _duplicate_row_after(table, row_index: int) -> None:
    template_row = table.rows[row_index]
    new_tr = deepcopy(template_row._tr)
    template_row._tr.addnext(new_tr)


def _find_row(table, fragment: str) -> int | None:
    needle = _normalize_text(fragment)
    for i, row in enumerate(table.rows):
        if any(needle in _normalize_text(cell.text) for cell in row.cells):
            return i
    return None


def _fill_item_row(row, item: dict) -> None:
    values = {
        0: item.get("codigo_produto"),
        1: item.get("codigo_fornecedor"),
        3: item.get("descricao_produto"),
        4: _fmt_qty(item.get("qtde")),
        5: item.get("unidade"),
        7: _fmt_money(item.get("preco_unitario")),
        10: _fmt_money(item.get("valor_total")),
    }
    for col, value in values.items():
        _set_cell(row, col, value, center=True)


def _fill_header(table, data: dict) -> None:
    header_fields = [
        (1, 2, data.get("cotacao")),
        (1, 9, _fmt_date(data.get("data_emissao"))),
        (2, 2, data.get("comprador")),
        (2, 8, data.get("telefone")),
        (3, 2, data.get("fornecedor")),
        (3, 6, data.get("cnpj")),
        (4, 2, data.get("contato")),
        (4, 6, data.get("telefone_fornecedor")),
    ]
    for row_idx, col_idx, value in header_fields:
        _set_cell(table.rows[row_idx], col_idx, value, pad_left=True, bold=False)


def _fmt_solicitacao(sol: dict) -> str:
    num = sol.get("id")
    data = _fmt_date_short(sol.get("data_necessidade"))
    if num and data:
        return f"{num} - {data}"
    return str(num or data or "")


def _fill_solicitacoes(table, solicitacoes: list[dict]) -> None:
    sol_idx = _find_row(table, "data de necessidade")
    if sol_idx is None:
        sol_idx = _find_row(table, "solicita")
    if sol_idx is None:
        return

    ordenadas = sorted(solicitacoes, key=lambda s: s.get("id") or 0)

    if not ordenadas:
        _set_cell(table.rows[sol_idx], SOLICITACAO_VALUE_COL, "", pad_left=True)
        return

    if len(ordenadas) == 1:
        texto = _fmt_solicitacao(ordenadas[0])
    else:
        texto = "\n".join(
            f"{i}° {_fmt_solicitacao(sol)}" for i, sol in enumerate(ordenadas, start=1)
        )

    _set_cell(table.rows[sol_idx], SOLICITACAO_VALUE_COL, texto, pad_left=True, bold=False)


def _fill_document(data: dict) -> Document:
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"Template não encontrado: {TEMPLATE_PATH}")

    doc = Document(TEMPLATE_PATH)
    table = doc.tables[0]

    _fill_header(table, data)

    items = data.get("itens") or [{}]
    _fill_item_row(table.rows[ITEM_ROW_IDX], items[0])
    current = ITEM_ROW_IDX
    for item in items[1:]:
        _duplicate_row_after(table, current)
        current += 1
        _fill_item_row(table.rows[current], item)

    total_row_idx = _find_row(table, "VALOR TOTAL")
    if total_row_idx is not None:
        _set_cell(table.rows[total_row_idx], 10, _fmt_money(data.get("valor_total_geral")), center=True)

    _fill_solicitacoes(table, data.get("solicitacoes") or [])
    return doc


def _convert_docx_to_pdf(docx_path: str, pdf_path: str) -> None:
    docx_abs = os.path.abspath(docx_path)
    pdf_abs = os.path.abspath(pdf_path)

    with _word_lock:
        word = None
        doc = None
        last_error = None

        try:
            import win32com.client

            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0
            doc = word.Documents.Open(docx_abs, ReadOnly=True)
            doc.SaveAs2(pdf_abs, FileFormat=17)
            doc.Close(False)
            word.Quit()
            return
        except Exception as exc:
            last_error = exc
            if doc is not None:
                try:
                    doc.Close(False)
                except Exception:
                    pass
            if word is not None:
                try:
                    word.Quit()
                except Exception:
                    pass

        try:
            from docx2pdf import convert

            convert(docx_abs, pdf_abs)
            return
        except Exception as exc:
            last_error = exc

        raise RuntimeError(
            "Não foi possível converter DOCX para PDF via Microsoft Word."
        ) from last_error


def generate_pdf(data: dict) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        docx_path = os.path.join(tmp, "cotacao.docx")
        pdf_path = os.path.join(tmp, "cotacao.pdf")

        doc = _fill_document(data)
        doc.save(docx_path)
        _convert_docx_to_pdf(docx_path, pdf_path)

        with open(pdf_path, "rb") as f:
            return f.read()
