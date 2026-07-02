#!/usr/bin/env python3
"""
CLI para geração de PDF de cotação de compra (Pré Compra).
Uso: python generate_pdf_cli.py <input.json> <output.pdf>
"""
from __future__ import annotations

import json
import sys

from pdf_service import generate_pdf


def main() -> int:
    if len(sys.argv) != 3:
        print("Uso: generate_pdf_cli.py <input.json> <output.pdf>", file=sys.stderr)
        return 1

    input_path, output_path = sys.argv[1], sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    pdf_bytes = generate_pdf(data)

    with open(output_path, "wb") as f:
        f.write(pdf_bytes)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
