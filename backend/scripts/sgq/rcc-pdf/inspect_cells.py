from pathlib import Path

from docx import Document
from docx.table import _Cell

DOWNLOADS = Path(r"c:\Users\Davi\Downloads")


def cell_key(cell: _Cell) -> int:
    return id(cell._tc)


def dump_table(path: Path) -> None:
    doc = Document(path)
    table = doc.tables[0]
    print(f"=== {path.name} ===")
    for ri, row in enumerate(table.rows):
        seen: set[int] = set()
        parts: list[str] = []
        for ci, cell in enumerate(row.cells):
            key = cell_key(cell)
            if key in seen:
                continue
            seen.add(key)
            text = cell.text.replace("\n", " ").strip()
            parts.append(f"C{ci}='{text[:40]}'")
        print(f"R{ri}: {' | '.join(parts)}")


for filename in ["formulario_RCC_V.cliente.docx", "formulario_RCC_V.Empresa.docx"]:
    dump_table(DOWNLOADS / filename)
    print()
