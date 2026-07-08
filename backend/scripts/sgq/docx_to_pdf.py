"""Converte DOCX em PDF via Microsoft Word (win32com, com fallback docx2pdf)."""

from __future__ import annotations

import threading

_word_lock = threading.Lock()


def converter_docx_para_pdf(docx_path: str, pdf_path: str) -> None:
    import os

    docx_abs = os.path.abspath(docx_path)
    pdf_abs = os.path.abspath(pdf_path)

    with _word_lock:
        word = None
        doc = None
        last_error: Exception | None = None

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

        msg = str(last_error) if last_error else "erro desconhecido"
        if "-2147221005" in msg or "class string" in msg.lower():
            raise RuntimeError(
                "Microsoft Word não está disponível para o processo do servidor. "
                "O serviço Windows deve rodar com um usuário que tenha o Word instalado "
                "(não use LocalSystem)."
            ) from last_error
        raise RuntimeError(
            f"Não foi possível converter DOCX para PDF via Microsoft Word. {msg}"
        ) from last_error
