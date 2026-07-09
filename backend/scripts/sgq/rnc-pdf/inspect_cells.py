from pathlib import Path

from docx import Document
from docx.table import _Cell

path = Path(__file__).resolve().parent / "templates" / "rnc.source.docx"
doc = Document(path)
table = doc.tables[0]
print(f"rows={len(table.rows)} cols={len(table.columns)}")
print(f"sections={len(doc.sections)}")


def cell_key(cell: _Cell) -> int:
    return id(cell._tc)


for ri, row in enumerate(table.rows):
    seen: set[int] = set()
    parts: list[str] = []
    for ci, cell in enumerate(row.cells):
        key = cell_key(cell)
        if key in seen:
            continue
        seen.add(key)
        text = cell.text.replace("\n", " ").strip()
        parts.append(f"C{ci}='{text[:55]}'")
    print(f"R{ri}: {' | '.join(parts)}")
