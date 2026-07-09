import re
import zipfile
from pathlib import Path

TEMPLATES = Path(__file__).resolve().parent / "templates"


def inspect(name: str) -> None:
    path = TEMPLATES / name
    if not path.exists():
        print(f"{name}: MISSING")
        return

    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "ignore")
    heights = [int(v) for v in re.findall(r'w:trHeight w:val="(\d+)"', xml)]
    page_breaks = len(re.findall(r'w:type="page"', xml))
    after_table = xml.split("</w:tbl>")[-1]
    extra_paras = after_table.count("<w:p ")

    sect = re.search(r"<w:sectPr[\s\S]*?</w:sectPr>", xml)
    margins = {}
    if sect:
        for tag in ["top", "bottom", "header", "footer"]:
            match = re.search(rf'w:{tag}="(\d+)"', sect.group(0))
            if match:
                margins[tag] = int(match.group(1))

    page_h = 15840
    reserved = sum(margins.get(k, 0) for k in ("top", "bottom", "header", "footer"))
    body_budget = (page_h - reserved) / 1440

    print(f"=== {name} ===")
    print(f"rows={len(heights)} table={sum(heights)/1440:.2f}in")
    print(f"margins twips={margins} body_budget={body_budget:.2f}in")
    print(f"page_breaks={page_breaks} paras_after_table={extra_paras}")
    if extra_paras:
        print("after_table snippet:", after_table[:400])


for filename in [
    "cliente.docx",
    "empresa.docx",
    "cliente.source.docx",
    "empresa.source.docx",
]:
    inspect(filename)
