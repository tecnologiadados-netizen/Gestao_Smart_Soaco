import zipfile
from pathlib import Path

path = Path(__file__).resolve().parent / "templates" / "cliente.docx"
z = zipfile.ZipFile(path)
for name in sorted(z.namelist()):
    if name.startswith("word/header") or name.startswith("word/footer"):
        if name.endswith(".xml"):
            text = z.read(name).decode("utf-8", "ignore")
            plain = "".join(
                part
                for part in text.replace("</w:p>", "\n").split("<")
                if part and not part.startswith("w:")
            )
            print("===", name, "===")
            print(plain[:500])
            print()
