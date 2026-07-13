"""Painel executivo — ausências (Só Aço). Execute: streamlit run app.py"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src import absences

# --- Manual da marca (cores) ---
C_NAVY = "#041E42"
C_BLUE = "#1E22AA"
C_AMBER = "#FFAD00"
C_GRAY = "#808080"
C_TEXT = "#2E2D2C"
C_BG = "#F4F6F9"
C_CARD = "#FFFFFF"


def inject_brand_css() -> None:
    st.markdown(
        f"""
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Monda:wght@400;700&display=swap" rel="stylesheet">
        <style>
            html, body, [class*="css"]  {{
                font-family: 'Monda', system-ui, sans-serif !important;
                color: {C_TEXT};
            }}
            .block-container {{
                padding-top: 1.25rem;
                padding-bottom: 2rem;
                max-width: 1200px;
            }}
            div[data-testid="stSidebar"] {{
                background: linear-gradient(180deg, {C_NAVY} 0%, #0a2a5c 100%);
            }}
            div[data-testid="stSidebar"] * {{
                color: #f0f4ff !important;
            }}
            div[data-testid="stSidebar"] .stMarkdown strong {{
                color: {C_AMBER} !important;
            }}
            .hero-card {{
                background: linear-gradient(135deg, {C_NAVY} 0%, {C_BLUE} 100%);
                border-radius: 16px;
                padding: 1.25rem 1.5rem;
                color: #fff !important;
                box-shadow: 0 8px 24px rgba(4, 30, 66, 0.25);
            }}
            .hero-card h3, .hero-card p, .hero-card span {{
                color: #fff !important;
            }}
            .kpi-card {{
                background: {C_CARD};
                border-radius: 16px;
                padding: 1.1rem 1.25rem;
                border: 1px solid rgba(128, 128, 128, 0.25);
                box-shadow: 0 4px 14px rgba(46, 45, 44, 0.06);
                min-height: 118px;
            }}
            .kpi-card h3 {{
                font-size: 0.85rem;
                font-weight: 700;
                color: {C_GRAY} !important;
                margin: 0 0 0.35rem 0;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }}
            .kpi-card .val {{
                font-size: 1.65rem;
                font-weight: 700;
                color: {C_NAVY} !important;
                margin: 0;
            }}
            .page-title {{
                font-size: 1.75rem;
                font-weight: 700;
                color: {C_NAVY};
                margin: 0;
            }}
            .page-sub {{
                color: {C_GRAY};
                margin-top: 0.25rem;
                font-size: 0.95rem;
            }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def plotly_layout(**kwargs):
    return dict(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Monda, sans-serif", color=C_TEXT, size=12),
        margin=dict(l=48, r=24, t=48, b=48),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        **kwargs,
    )


@st.cache_data(show_spinner=False)
def load_full(path_str: str | None) -> pd.DataFrame:
    path = Path(path_str) if path_str else None
    df = absences.load_absences(path)
    return absences.add_time_columns(df)


def main() -> None:
    st.set_page_config(
        page_title="Ausências — Só Aço",
        page_icon="📊",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    inject_brand_css()

    with st.sidebar:
        st.markdown("### SÓ AÇO")
        st.caption("Indicadores de ausências — uso interno")
        uploaded = st.file_uploader("Substituir planilha (.xlsx)", type=["xlsx"], accept_multiple_files=False)
        path_override = None
        if uploaded is not None:
            tmp = _ROOT / "data" / "_uploaded.xlsx"
            tmp.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_bytes(uploaded.getvalue())
            path_override = str(tmp)
        elif absences.default_data_path().exists():
            path_override = str(absences.default_data_path())
        else:
            st.warning("Coloque `faltas-atestados.xlsx` em `data/` ou envie um arquivo.")
            path_override = None

        if path_override:
            df0 = load_full(path_override)
            dmin, dmax = df0["data"].min(), df0["data"].max()
            st.markdown("---")
            st.markdown("**Filtros**")
            dr = st.date_input(
                "Período",
                value=(dmin.to_pydatetime().date(), dmax.to_pydatetime().date()),
            )
            if isinstance(dr, tuple) and len(dr) == 2:
                di, dfim = dr
            else:
                di, dfim = dr, dr
            areas = st.multiselect("Área", sorted(df0["area"].unique()), default=[])
            setores = st.multiselect("Setor", sorted(df0["setor"].unique()), default=[])
            lideres = st.multiselect("Líder", sorted(df0["lider"].unique()), default=[])
        else:
            df0 = None
            di = dfim = None
            areas = setores = lideres = []

    if df0 is None:
        st.stop()

    dff = absences.filter_absences(
        df0,
        pd.Timestamp(di),
        pd.Timestamp(dfim) + pd.Timedelta(days=1) - pd.Timedelta(microseconds=1),
        areas or None,
        setores or None,
        lideres or None,
    )
    if dff.empty:
        st.error("Nenhum registro no filtro selecionado.")
        st.stop()

    k = absences.kpis_resumo(dff)

    # Último mês completo vs anterior (para texto de tendência no hero)
    dff_m = dff.dropna(subset=["data"]).copy()
    dff_m["ym"] = dff_m["data"].dt.to_period("M")
    ult = dff_m["ym"].max()
    pen = ult - 1 if ult is not pd.NaT else None
    inj_ult_sub = float(
        dff_m.loc[(dff_m["ym"] == ult) & (dff_m["categoria"] == "Injustificada"), "qntd"].sum()
    )
    inj_pen_sub = (
        float(dff_m.loc[(dff_m["ym"] == pen) & (dff_m["categoria"] == "Injustificada"), "qntd"].sum())
        if pen is not None
        else None
    )
    delta_inj = None
    if inj_pen_sub not in (None, 0):
        delta_inj = (float(inj_ult_sub) - float(inj_pen_sub)) / float(inj_pen_sub) * 100

    c1, c2 = st.columns([3, 1], vertical_alignment="center")
    with c1:
        st.markdown('<p class="page-title">Dashboard de ausências</p>', unsafe_allow_html=True)
        st.markdown(
            '<p class="page-sub">Evolução de dias (QNTD) por categoria — injustificadas vs justificadas.</p>',
            unsafe_allow_html=True,
        )
    with c2:
        if st.button("Recarregar dados", type="primary"):
            st.cache_data.clear()
            st.rerun()

    # KPIs
    h1, h2, h3, h4 = st.columns(4)
    with h1:
        delta_txt = ""
        if delta_inj is not None:
            delta_txt = f"<p style='margin:0.35rem 0 0 0;font-size:0.85rem;opacity:0.9'>Injust. vs mês ant.: {delta_inj:+.1f}%</p>"
        st.markdown(
            f"""
            <div class="hero-card">
              <h3 style="margin:0 0 0.5rem 0;font-size:0.8rem;opacity:0.95">Foco diretoria</h3>
              <p style="margin:0;font-size:2rem;font-weight:700;">{k['pct_injustificada']:.1f}%</p>
              <p style="margin:0.25rem 0 0 0;font-size:0.9rem;">dos dias são injustificados</p>
              {delta_txt}
            </div>
            """,
            unsafe_allow_html=True,
        )
    with h2:
        st.markdown(
            f"""
            <div class="kpi-card">
              <h3>Total de dias (QNTD)</h3>
              <p class="val">{k['total_dias']:,.0f}</p>
              <p style="margin:0.35rem 0 0 0;font-size:0.8rem;color:{C_GRAY};">{k['ocorrencias']:,} ocorrências</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with h3:
        st.markdown(
            f"""
            <div class="kpi-card">
              <h3>Justificadas</h3>
              <p class="val">{k['justificada_dias']:,.0f}</p>
              <p style="margin:0.35rem 0 0 0;font-size:0.8rem;color:{C_GRAY};">{k['pct_justificada']:.1f}% do total</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with h4:
        st.markdown(
            f"""
            <div class="kpi-card">
              <h3>Injustificadas</h3>
              <p class="val">{k['injustificada_dias']:,.0f}</p>
              <p style="margin:0.35rem 0 0 0;font-size:0.8rem;color:{C_GRAY};">Falta procedente / colaborador</p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("")

    tab_vis, tab_acoes = st.tabs(["Visão analítica", "Sugestões e próximos passos"])

    with tab_vis:
        r1c1, r1c2 = st.columns([1.4, 1.0])
        with r1c1:
            st.subheader("Evolução mensal (dias)")
            pv = absences.pivot_mensal_categoria(dff)
            pv = pv.sort_values("ano_mes")
            fig = go.Figure(
                data=[
                    go.Bar(name="Injustificada", x=pv["ano_mes"], y=pv["Injustificada"], marker_color=C_NAVY),
                    go.Bar(name="Justificada", x=pv["ano_mes"], y=pv["Justificada"], marker_color=C_BLUE),
                    go.Bar(name="Não classificado", x=pv["ano_mes"], y=pv["Não classificado"], marker_color=C_GRAY),
                ]
            )
            fig.update_layout(barmode="stack", **plotly_layout(title=""))
            fig.update_xaxes(showgrid=False)
            fig.update_yaxes(showgrid=True, gridcolor="rgba(128,128,128,0.2)")
            st.plotly_chart(fig, use_container_width=True)

        with r1c2:
            st.subheader("Composição — justificadas")
            tj = absences.agg_tipo_justificadas(dff, top_n=10)
            fig2 = go.Figure(
                go.Bar(
                    x=tj["qntd"],
                    y=tj["tipo"],
                    orientation="h",
                    marker=dict(color=C_AMBER, line=dict(color=C_NAVY, width=0.5)),
                )
            )
            fig2.update_layout(**plotly_layout(title="Top tipos (dias)"))
            fig2.update_yaxes(autorange="reversed")
            st.plotly_chart(fig2, use_container_width=True)

        r2c1, r2c2 = st.columns(2)
        with r2c1:
            st.subheader("Top setores (dias)")
            ts = absences.agg_dim(dff, "setor", top_n=12)
            fig3 = go.Figure(
                go.Bar(
                    x=ts["qntd"],
                    y=ts["setor"],
                    orientation="h",
                    marker_color=C_BLUE,
                )
            )
            fig3.update_layout(**plotly_layout())
            fig3.update_yaxes(autorange="reversed")
            st.plotly_chart(fig3, use_container_width=True)
        with r2c2:
            st.subheader("Top líderes (dias)")
            tl = absences.agg_dim(dff, "lider", top_n=12)
            fig4 = go.Figure(
                go.Bar(
                    x=tl["qntd"],
                    y=tl["lider"],
                    orientation="h",
                    marker_color=C_NAVY,
                )
            )
            fig4.update_layout(**plotly_layout())
            fig4.update_yaxes(autorange="reversed")
            st.plotly_chart(fig4, use_container_width=True)

    with tab_acoes:
        st.markdown(
            f"""
### Leitura para diretoria

- Com **sanções e gestão de faltas injustificadas**, tende a cair o volume **FALTA INJUSTIFICADA PROCEDENTE** / **FALTA JUSTIFICADA PELO COLABORADOR**.
- O painel permite ver, **no mesmo recorte**, se **atestados e declarações** passaram a concentrar a maior parte dos dias — cenário típico de **absenteísmo por adoecimento / comparecimento** e não de “falta avulsa”.

### Sugestões de ação (prevenção)

1. **Saúde ocupacional e ergonomia** — foco em setores/líderes com maior massa de atestado; programa de ergonomia, pausas, EPI e postura de trabalho.
2. **Gestão por líder** — rituais 1:1, escuta ativa, carga e escala; evitar “só punir” sem endereçar carga e clima.
3. **Política clara** — comunicar critérios de documentação, prazos e canais; reduzir ambiguidade entre declaração e atestado quando aplicável.
4. **Retorno ao trabalho** — fluxo após afastamentos curtos (acolhimento, adaptação de tarefa quando cabível).
5. **Indicadores SST** — acompanhar causas (CID agregado / setor) com **respeito à privacidade**; não usar painel para expor colaborador individual em reunião ampla.

**LGPD:** evite exibir nomes em apresentações públicas; use agregados por setor/líder como neste painel.
            """,
            unsafe_allow_html=False,
        )

    st.caption("Cores e tipografia alinhadas ao manual de marca Só Aço. Dados: coluna QNTD somada por período.")


if __name__ == "__main__":
    main()
