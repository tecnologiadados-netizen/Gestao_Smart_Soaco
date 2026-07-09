import re
import zipfile
from pathlib import Path

TEMPLATES = Path(__file__).resolve().parent / "templates"


def inspect(name: str) -> None:
    path = TEMPLATES / name
    z = zipfile.ZipFile(path)
    xml = z.read("word/document.xml").decode("utf-8", "ignore")
    heights = [int(v) for v in re.findall(r'w:trHeight w:val="(\d+)"', xml)]
    print(f"=== {name} ===")
    print("rows with height:", len(heights))
    print("heights twips:", heights)
    print("sum inches:", round(sum(heights) / 1440, 2))
    print("page breaks:", "w:br" in xml and "page" in xml)
    sect = re.search(r"<w:sectPr[\s\S]*?</w:sectPr>", xml)
    if sect:
        s = sect.group(0)
        print("titlePg:", "w:titlePg" in s)
        for tag in ["top", "bottom", "header", "footer"]:
            m = re.search(rf'w:{tag} w:w="(\d+)"', s)
            if m:
                print(f"  {tag}: {int(m.group(1))/1440:.2f} in")
    print()


for filename in ["cliente.docx", "empresa.docx"]:
    inspect(filename)
