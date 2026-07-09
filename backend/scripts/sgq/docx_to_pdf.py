"""Converte DOCX em PDF via Microsoft Word (win32com, com fallback docx2pdf)."""

from __future__ import annotations

import threading
import time

_word_lock = threading.Lock()


def _abrir_word():
    import win32com.client

    try:
        return win32com.client.gencache.EnsureDispatch("Word.Application")
    except Exception:
        return win32com.client.Dispatch("Word.Application")


def _encerrar_word(word, doc) -> None:
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


def converter_docx_para_pdf(docx_path: str, pdf_path: str) -> None:
    import os

    import pythoncom

    docx_abs = os.path.abspath(docx_path)
    pdf_abs = os.path.abspath(pdf_path)

    with _word_lock:
        pythoncom.CoInitialize()
        last_error: Exception | None = None

        try:
            for attempt in range(3):
                word = None
                doc = None
                try:
                    word = _abrir_word()
                    if word is None:
                        raise RuntimeError("Word.Application retornou None.")

                    word.Visible = False
                    word.DisplayAlerts = 0
                    doc = word.Documents.Open(docx_abs, ReadOnly=True)
                    doc.SaveAs2(pdf_abs, FileFormat=17)
                    doc.Close(False)
                    word.Quit()
                    return
                except Exception as exc:
                    last_error = exc
                    _encerrar_word(word, doc)
                    if attempt < 2:
                        time.sleep(1.5)

            try:
                from docx2pdf import convert

                convert(docx_abs, pdf_abs)
                return
            except Exception as exc:
                last_error = exc
        finally:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass

        msg = str(last_error) if last_error else "erro desconhecido"
        if "Documents" in msg or "SaveAs" in msg:
            raise RuntimeError(
                "Microsoft Word não respondeu ao COM (serviço Windows / LocalSystem). "
                "Execute scripts/ensure-word-com-dirs.ps1 como Administrador e reinicie o serviço. "
                f"Detalhe: {msg}"
            ) from last_error
        if "-2147221005" in msg or "class string" in msg.lower():
            raise RuntimeError(
                "Microsoft Word não está disponível para o processo do servidor. "
                "O serviço Windows deve rodar com um usuário que tenha o Word instalado "
                "(não use LocalSystem)."
            ) from last_error
        raise RuntimeError(
            f"Não foi possível converter DOCX para PDF via Microsoft Word. {msg}"
        ) from last_error
