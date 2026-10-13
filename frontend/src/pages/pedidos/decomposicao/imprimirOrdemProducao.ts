import { nomeGrupo, type OrdemProducao } from '../../../api/decomposicao';

function esc(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export function imprimirOrdemProducao(ordem: OrdemProducao): void {
  const janela = window.open('', '_blank');
  if (!janela) return;

  const linhas = ordem.itens
    .map(
      (item) => `
      <tr>
        <td>${esc(item.codigoNomus)}<div class="sub">${esc(item.descricao)}</div></td>
        <td class="centro">${num(item.quantidadeNoPai)}</td>
        <td class="centro destaque">${num(item.quantidadeTotal)}</td>
        <td>${item.materiaPrimaCodigo ? `${esc(item.materiaPrimaCodigo)}<div class="sub">${esc(item.materiaPrimaDescricao || '')}</div>` : '—'}</td>
        <td class="centro">${num(item.qtdePedida)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>SÓ AÇO - Ordem ${esc(ordem.numero)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; color: #001a35; }
    .header { background: #001a35; color: white; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 5px solid #FFB800; }
    .logo { font-size: 26px; font-weight: 900; font-style: italic; }
    .logo span { color: #FFB800; }
    .titulo { font-size: 11px; font-weight: 800; letter-spacing: 1px; margin-left: 14px; padding-left: 14px; border-left: 2px solid rgba(255,255,255,.3); }
    .id { background: #FFB800; color: #001a35; padding: 8px 18px; border-radius: 6px; font-weight: 900; font-size: 18px; }
    .content { padding: 22px 28px; }
    .info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
    .label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; }
    .value { font-size: 14px; font-weight: 800; text-transform: uppercase; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; border: 2px solid #001a35; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; }
    thead tr.faixa { background: #FFB800; color: #001a35; text-transform: uppercase; }
    thead tr.cols { background: #001a35; color: white; text-transform: uppercase; font-size: 10px; }
    .centro { text-align: center; }
    .destaque { background: #fffbeb; font-weight: 800; }
    .sub { font-size: 10px; color: #475569; font-weight: 500; text-transform: none; }
    .notas { margin-top: 18px; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 12px; }
    .assinaturas { margin-top: 42px; display: flex; justify-content: space-between; }
    .assinatura { width: 42%; text-align: center; font-size: 10px; font-weight: 800; }
    .linha { border-top: 2px solid #001a35; margin-bottom: 6px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div><span class="logo"><span>SÓ</span> AÇO</span><span class="titulo">ORDEM DE PRODUÇÃO</span></div>
    <div class="id">${esc(ordem.numero)}</div>
  </div>
  <div class="content">
    <div class="info">
      <div><div class="label">Setor</div><div class="value">${esc(nomeGrupo(ordem.grupo))}</div></div>
      <div><div class="label">Produto pai</div><div class="value">${esc(ordem.codigoPai)} — ${esc(ordem.nomePai)}</div></div>
      <div><div class="label">Quantidade a produzir</div><div class="value">${num(ordem.quantidade)}</div></div>
      <div><div class="label">Emissão</div><div class="value">${esc(new Date(ordem.createdAt).toLocaleString('pt-BR'))}</div></div>
    </div>
    <table>
      <thead>
        <tr class="faixa"><th colspan="5">Filhos e matéria-prima — quantidade multiplicada para ${num(ordem.quantidade)}</th></tr>
        <tr class="cols">
          <th style="text-align:left">Produto filho</th>
          <th>Qtd no pai</th>
          <th>Qtd total</th>
          <th style="text-align:left">Matéria-prima (PP)</th>
          <th>Qtde pedida</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="notas">
      <div class="label">Observação</div>
      <div>${esc(ordem.observacao || 'Sem observação.')}</div>
    </div>
    <div class="assinaturas">
      <div class="assinatura"><div class="linha"></div>PRODUÇÃO / ENCARREGADO</div>
      <div class="assinatura"><div class="linha"></div>QUALIDADE / CONFERÊNCIA</div>
    </div>
  </div>
  <script>window.print();</script>
</body>
</html>`;

  janela.document.write(html);
  janela.document.close();
}
