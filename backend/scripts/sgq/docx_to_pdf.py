"""Converte DOCX em PDF via Microsoft Word (win32com, com fallback docx2pdf).

Evita EnsureDispatch/gen_py corrompido (erro CLSIDToPackageMap), comum em
servicos Windows / LocalSystem.
"""

from __future__ import annotations

import shutil
import threading
import time
from pathlib import Path

_word_lock = threading.Lock()


def _limpar_cache_gen_py() -> None:
    """Remove cache early-bound do pywin32 (gen_py) quando estiver corrompido."""
    candidatos: list[Path] = []
    try:
        import win32com

        gen_path = getattr(win32com, "__gen_path__", None)
        if gen_path:
            candidatos.append(Path(gen_path))
    except Exception:
        pass

    try:
        import win32com.client.gencache as gencache

        get_path = getattr(gencache, "GetGeneratePath", None)
        if callable(get_path):
            candidatos.append(Path(get_path()))
    except Exception:
        pass

    candidatos.extend(
        [
            Path.home() / "AppData" / "Local" / "Temp" / "gen_py",
            Path(r"C:\Windows\Temp\gen_py"),
            Path(r"C:\Windows\System32\config\systemprofile\AppData\Local\Temp\gen_py"),
            Path(r"C:\Windows\SysWOW64\config\systemprofile\AppData\Local\Temp\gen_py"),
        ]
    )

    vistos: set[str] = set()
    for path in candidatos:
        try:
            resolved = str(path.resolve())
        except Exception:
            resolved = str(path)
        if resolved in vistos:
            continue
        vistos.add(resolved)
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)


def _abrir_word():
    """Usa late-binding (Dispatch). EnsureDispatch corrompe com facilidade no servidor."""
    import win32com.client

    try:
        return win32com.client.DispatchEx("Word.Application")
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


def _eh_erro_gen_py(exc: BaseException) -> bool:
    msg = str(exc)
    return "CLSIDToPackageMap" in msg or "gen_py" in msg


def converter_docx_para_pdf(docx_path: str, pdf_path: str) -> None:
    import os

    import pythoncom

    docx_abs = os.path.abspath(docx_path)
    pdf_abs = os.path.abspath(pdf_path)

    with _word_lock:
        pythoncom.CoInitialize()
        last_error: Exception | None = None
        gen_py_limpo = False

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
                    try:
                        doc.SaveAs2(pdf_abs, FileFormat=17)
                    except Exception:
                        doc.SaveAs(pdf_abs, FileFormat=17)
                    doc.Close(False)
                    word.Quit()
                    return
                except Exception as exc:
                    last_error = exc
                    _encerrar_word(word, doc)
                    if _eh_erro_gen_py(exc) and not gen_py_limpo:
                        _limpar_cache_gen_py()
                        gen_py_limpo = True
                    if attempt < 2:
                        time.sleep(1.5)

            try:
                from docx2pdf import convert

                convert(docx_abs, pdf_abs)
                return
            except Exception as exc:
                last_error = exc
                if _eh_erro_gen_py(exc) and not gen_py_limpo:
                    _limpar_cache_gen_py()
        finally:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass

        msg = str(last_error) if last_error else "erro desconhecido"
        if "CLSIDToPackageMap" in msg or "gen_py" in msg:
            raise RuntimeError(
                "Cache do Microsoft Word (win32com/gen_py) estava corrompido. "
                "O cache foi limpo — tente gerar o PDF novamente. "
                f"Detalhe: {msg}"
            ) from last_error
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
