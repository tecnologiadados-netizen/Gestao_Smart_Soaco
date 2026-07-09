#!/usr/bin/env python3
"""Gera PDF de cotação de pré-compra (mesmo contrato dos scripts SGQ)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = SCRIPT_DIR.parent.parent.parent
PRE_COMPRA_DIR = BACKEND_ROOT / "python" / "pre_compra"
if str(PRE_COMPRA_DIR) not in sys.path:
    sys.path.insert(0, str(PRE_COMPRA_DIR))

from pdf_service import generate_pdf  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera PDF de cotação de pré-compra.")
    parser.add_argument(
        "--input",
        "-i",
        help="Arquivo JSON com os dados. Se omitido, lê stdin.",
    )
    parser.add_argument("--output", "-o", required=True, help="Caminho do PDF de saída.")
    args = parser.parse_args()

    try:
        if args.input:
            raw = Path(args.input).read_text(encoding="utf-8")
        else:
            raw = sys.stdin.buffer.read().decode("utf-8")
        data = json.loads(raw)
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        pdf_bytes = generate_pdf(data)
        output_path.write_bytes(pdf_bytes)
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
