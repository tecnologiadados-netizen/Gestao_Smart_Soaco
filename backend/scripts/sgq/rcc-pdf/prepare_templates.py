#!/usr/bin/env python3
"""Prepara os modelos Word originais (1 página) para preenchimento pelo sistema."""

from __future__ import annotations

import re
import shutil
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = SCRIPT_DIR / "templates"

# w:sz usa meio-pontos; 16 = 8pt
FONT_SIZE_HALF_POINTS = "16"


def ajustar_tamanhos_fonte(xml: str) -> str:
    def substituir_sz(match: re.Match[str]) -> str:
        attr = match.group(1)
        valor = int(match.group(2))
        if valor > int(FONT_SIZE_HALF_POINTS):
            return f'{attr} w:val="{FONT_SIZE_HALF_POINTS}"'
        return match.group(0)

    xml = re.sub(r'(w:sz) w:val="(\d+)"', substituir_sz, xml)
    xml = re.sub(r'(w:szCs) w:val="(\d+)"', substituir_sz, xml)
    return xml


def remover_paragrafo_vazio_apos_tabela(xml: str) -> str:
    """Remove parágrafo vazio após a tabela que pode forçar quebra de página."""
    return re.sub(
        r"</w:tbl>\s*<w:p[^>]*>\s*<w:pPr>\s*<w:rPr>\s*<w:b/>\s*</w:rPr>\s*</w:pPr>\s*</w:p>",
        "</w:tbl>",
        xml,
        count=1,
    )


def preparar_arquivo(origem: Path, destino: Path) -> None:
    """Mantém layout original (1 página): só padroniza fonte e limpa XML extra."""
    with zipfile.ZipFile(origem, "r") as zin:
        arquivos = {name: zin.read(name) for name in zin.namelist()}

    documento = arquivos["word/document.xml"].decode("utf-8")
    documento = ajustar_tamanhos_fonte(documento)
    documento = remover_paragrafo_vazio_apos_tabela(documento)
    arquivos["word/document.xml"] = documento.encode("utf-8")

    if "word/styles.xml" in arquivos:
        estilos = arquivos["word/styles.xml"].decode("utf-8")
        arquivos["word/styles.xml"] = ajustar_tamanhos_fonte(estilos).encode("utf-8")

    destino.write_bytes(b"")
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zout:
        for nome, conteudo in arquivos.items():
            zout.writestr(nome, conteudo)


def main() -> None:
    for nome in ("cliente.docx", "empresa.docx"):
        origem = TEMPLATES_DIR / nome.replace(".docx", ".source.docx")
        destino = TEMPLATES_DIR / nome
        if not origem.exists():
            shutil.copy2(destino, origem)
        preparar_arquivo(origem, destino)
    print("Modelos preparados (layout original preservado, Arial 8pt).")


if __name__ == "__main__":
    main()
