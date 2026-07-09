import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parent / "templates" / "cliente.source.docx"
xml = zipfile.ZipFile(SOURCE).read("word/document.xml").decode("utf-8")


def substituir_sz(match: re.Match[str]) -> str:
    attr = match.group(1)
    valor = int(match.group(2))
    if valor > 16:
        return f'{attr}="16"'
    return match.group(0)


def validar(nome: str, conteudo: str) -> None:
    try:
        ET.fromstring(conteudo)
        print(f"{nome}: OK")
    except ET.ParseError as exc:
        print(f"{nome}: FAIL {exc}")
        col = exc.position[1] if exc.position else 0
        print(conteudo[max(0, col - 80) : col + 80])


validar("original", xml)

passo1 = re.sub(r'(w:sz) w:val="(\d+)"', substituir_sz, xml)
passo1 = re.sub(r'(w:szCs) w:val="(\d+)"', substituir_sz, passo1)
validar("fontes", passo1)

ALTURAS = [320] * 22

indice = 0

def substituir_altura(match: re.Match[str]) -> str:
    global indice
    if indice >= len(ALTURAS):
        return match.group(0)
    nova = ALTURAS[indice]
    indice += 1
    return f'<w:trHeight w:val="{nova}" w:hRule="exact"/>'


passo2 = re.sub(
    r'<w:trHeight w:val="\d+" w:hRule="exact"/>',
    substituir_altura,
    passo1,
)
validar("alturas", passo2)

passo3 = passo2.replace(
    '<w:headerReference w:type="default" r:id="rId8"/>',
    '<w:headerReference w:type="default" r:id="rId11"/>',
)
validar("header", passo3)

passo4 = re.sub(
    r'<w:pgMar w:top="\d+" w:right="\d+" w:bottom="\d+" w:left="\d+"',
    '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"',
    passo3,
    count=1,
)
validar("margens", passo4)
