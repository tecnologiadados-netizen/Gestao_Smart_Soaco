import { apiFetch } from '@/api/client';
import { getRegistroCodigoDocumento } from '@qualidade/types/registro';
import type { Registro } from '@qualidade/types/registro';
import { normalizarRccDados } from '@qualidade/types/rcc';

export type RccPdfVersao = 'cliente' | 'empresa';

export function podeGerarRccRelatorioPdf(registro: Registro): boolean {
  return registro.tipo === 'rcc' && Boolean(registro.rcc);
}

function nomeArquivoPdf(codigo: string, versao: RccPdfVersao): string {
  const base = codigo.replace(/[^\w.-]+/g, '_') || 'relatorio';
  const sufixo = versao === 'cliente' ? 'Cliente' : 'Empresa';
  return `RCC_${base}_${sufixo}.pdf`;
}

export async function baixarRccRelatorioPdf(
  registro: Registro,
  versao: RccPdfVersao
): Promise<void> {
  if (!podeGerarRccRelatorioPdf(registro)) {
    throw new Error('Registro RCC inválido para geração do relatório.');
  }

  const response = await apiFetch('/api/qualidade/registros/rcc/pdf', {
    method: 'POST',
    body: {
      versao,
      registro: {
        ...registro,
        rcc: normalizarRccDados(registro.rcc!),
      },
    },
  });

  if (!response.ok) {
    let mensagem = 'Não foi possível gerar o PDF.';
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error?.trim()) {
        mensagem = data.error;
      }
    } catch {
      // mantém mensagem padrão
    }
    throw new Error(mensagem);
  }

  const blob = await response.blob();
  const codigo = getRegistroCodigoDocumento(registro);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivoPdf(codigo, versao);
  link.click();
  URL.revokeObjectURL(url);
}
