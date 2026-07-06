import re
import zipfile
from pathlib import Path

path = Path(__file__).resolve().parent / "templates" / "cliente.docx"
xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "ignore")
sect = re.search(r"<w:sectPr[\s\S]*?</w:sectPr>", xml)
if sect:
    print(sect.group(0))
