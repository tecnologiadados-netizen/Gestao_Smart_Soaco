"""Carga, classificação e agregações de ausências (Excel RH)."""

from __future__ import annotations

from pathlib import Path
import re
import unicodedata
from typing import Literal

import pandas as pd

_DH_LEADING_NUM = re.compile(r"^(\d+(?:[.,]\d+)?)", re.IGNORECASE)


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _is_suspensao_disciplinar(tipo: str) -> bool:
    u = _strip_accents((tipo or "").strip()).upper()
    return "SUSPEN" in u and "DISCIPLINAR" in u


def _parse_dias_horas_qty(value) -> float | None:
    """Extrai quantidade de células tipo '20 DIA', '0,5 TURNO' (mesma regra do front)."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s:
        return None
    m = _DH_LEADING_NUM.match(s)
    if not m:
        return None
    num = m.group(1)
    if re.match(r"^\d+[.,]\d", num):
        num = num.replace(".", "").replace(",", ".")
    else:
        num = num.replace(",", ".")
    try:
        return float(num)
    except ValueError:
        return None

INJUSTIFICADA_TIPOS = frozenset(
    {
        "FALTA INJUSTIFICADA PROCEDENTE",
        "FALTA JUSTIFICADA PELO COLABORADOR",
    }
)

_COL_ORDER = [
    "data",
    "matricula",
    "nome",
    "endereco",
    "area",
    "setor",
    "lider",
    "periodo",
    "qntd",
    "dias_horas",
    "tipo",
    "cid",
    "local_atendimento",
    "medico",
]

Categoria = Literal["Injustificada", "Justificada", "Não classificado"]


def default_data_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "faltas-atestados.xlsx"


def load_absences(path: str | Path | None = None, sheet: str | int = 0) -> pd.DataFrame:
    p = Path(path) if path else default_data_path()
    raw = pd.read_excel(p, sheet_name=sheet, header=0)
    if raw.shape[1] < len(_COL_ORDER):
        raise ValueError(f"Planilha com colunas insuficientes: {raw.shape[1]}")
    df = raw.iloc[:, : len(_COL_ORDER)].copy()
    df.columns = _COL_ORDER
    df["data"] = pd.to_datetime(df["data"], dayfirst=True, errors="coerce")
    qnum = pd.to_numeric(df["qntd"], errors="coerce")
    dh_qty = df["dias_horas"].map(_parse_dias_horas_qty)
    dh_str = df["dias_horas"].fillna("").astype(str)
    qtd_vazia = df["qntd"].isna() | df["qntd"].apply(
        lambda x: isinstance(x, str) and x.strip() == ""
    )
    zero_mas_dh = (
        qnum.fillna(0).eq(0)
        & dh_qty.notna()
        & dh_qty.gt(0)
        & dh_str.str.contains(r"DIA|TURNO|HORA", case=False, regex=True)
    )
    df["qntd"] = qnum.astype(float)
    usar_dh = qtd_vazia & dh_qty.notna()
    df.loc[usar_dh, "qntd"] = dh_qty.loc[usar_dh].astype(float)
    df.loc[zero_mas_dh, "qntd"] = dh_qty.loc[zero_mas_dh].astype(float)
    df["qntd"] = df["qntd"].fillna(0.0)
    df["tipo"] = df["tipo"].apply(lambda x: str(x).strip() if pd.notna(x) else "")
    for col in ("area", "setor", "lider"):
        df[col] = df[col].apply(lambda x: str(x).strip() if pd.notna(x) else "(Não informado)")
    return df


def classify_absence(tipo: str) -> Categoria:
    t = (tipo or "").strip()
    if not t:
        return "Não classificado"
    if _is_suspensao_disciplinar(t):
        return "Justificada"
    if t in INJUSTIFICADA_TIPOS:
        return "Injustificada"
    return "Justificada"


def add_time_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ano_mes"] = out["data"].dt.to_period("M").astype(str)
    out["trimestre"] = out["data"].dt.to_period("Q").astype(str)
    out["categoria"] = out["tipo"].map(classify_absence)
    return out


def filter_absences(
    df: pd.DataFrame,
    data_inicio,
    data_fim,
    areas: list[str] | None = None,
    setores: list[str] | None = None,
    lideres: list[str] | None = None,
) -> pd.DataFrame:
    m = (df["data"] >= data_inicio) & (df["data"] <= data_fim)
    out = df.loc[m].copy()
    if areas:
        out = out[out["area"].isin(areas)]
    if setores:
        out = out[out["setor"].isin(setores)]
    if lideres:
        out = out[out["lider"].isin(lideres)]
    return out


def agg_mensal(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["ano_mes", "categoria"], dropna=False)["qntd"]
        .sum()
        .reset_index()
    )


def agg_tipo_justificadas(df: pd.DataFrame, top_n: int = 12) -> pd.DataFrame:
    sub = df[df["categoria"] == "Justificada"]
    t = sub.groupby("tipo", dropna=False)["qntd"].sum().reset_index()
    return t.sort_values("qntd", ascending=False).head(top_n)


def agg_dim(df: pd.DataFrame, col: str, top_n: int = 15) -> pd.DataFrame:
    t = df.groupby(col, dropna=False)["qntd"].sum().reset_index()
    return t.sort_values("qntd", ascending=False).head(top_n)


def kpis_resumo(df: pd.DataFrame) -> dict:
    total_dias = float(df["qntd"].sum())
    inj = float(df.loc[df["categoria"] == "Injustificada", "qntd"].sum())
    jus = float(df.loc[df["categoria"] == "Justificada", "qntd"].sum())
    nao = float(df.loc[df["categoria"] == "Não classificado", "qntd"].sum())
    pct_inj = (inj / total_dias * 100) if total_dias else 0.0
    pct_jus = (jus / total_dias * 100) if total_dias else 0.0
    return {
        "total_dias": total_dias,
        "injustificada_dias": inj,
        "justificada_dias": jus,
        "nao_class_dias": nao,
        "pct_injustificada": pct_inj,
        "pct_justificada": pct_jus,
        "ocorrencias": int(len(df)),
    }


def pivot_mensal_categoria(df: pd.DataFrame) -> pd.DataFrame:
    m = agg_mensal(df)
    if m.empty:
        return pd.DataFrame(columns=["ano_mes", "Injustificada", "Justificada", "Não classificado"])
    p = m.pivot_table(index="ano_mes", columns="categoria", values="qntd", aggfunc="sum").fillna(0)
    p = p.reset_index()
    for col in ("Injustificada", "Justificada", "Não classificado"):
        if col not in p.columns:
            p[col] = 0.0
    return p
