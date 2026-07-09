import { apiFetch } from '@/api/client';
import { getRegistroCodigoDocumento } from '@qualidade/types/registro';
import type { Registro } from '@qualidade/types/registro';

export function podeGerarRncRelatorioPdf(registro: Registro): boolean {
  return registro.tipo === 'rnc' && Boolean(registro.rnc);
}

function nomeArquivoPdf(codigo: string): string {
  const base = codigo.replace(/[^\w.-]+/g, '_') || 'relatorio';
  return `RNC_${base}.pdf`;
}

export async function baixarRncRelatorioPdf(registro: Registro): Promise<void> {
  if (!podeGerarRncRelatorioPdf(registro)) {
    throw new Error('Registro RNC inválido para geração do relatório.');
  }

  const response = await apiFetch('/api/qualidade/registros/rnc/pdf', {
    method: 'POST',
    body: { registro },
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
  link.download = nomeArquivoPdf(codigo);
  link.click();
  URL.revokeObjectURL(url);
}
