import { useRef, useState } from 'react';
import ResizableModalShell from '../ResizableModalShell';
import type { LinhaProgramacaoProducao } from './types';
import {
  aplicarInventarioNasLinhas,
  downloadInventarioModelo,
  parseInventarioXlsx,
} from '../../utils/programacaoProducaoInventario';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';

type Props = {
  linhas: LinhaProgramacaoProducao[];
  onClose: () => void;
  onApply: (linhas: LinhaProgramacaoProducao[]) => void;
};

export default function ProgramacaoProducaoInventarioModal({ linhas, onClose, onApply }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const handleFile = (file: File | null) => {
    setErro(null);
    setPreviewCount(null);
    if (!file) {
      setArquivoNome(null);
      return;
    }
    setArquivoNome(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result;
      if (!(buf instanceof ArrayBuffer)) {
        setErro('Erro ao ler o arquivo.');
        return;
      }
      const { rows, erro: errParse } = parseInventarioXlsx(buf);
      if (errParse) {
        setErro(errParse);
        setPreviewCount(null);
        return;
      }
      setPreviewCount(rows.length);
      onApply(aplicarInventarioNasLinhas(linhas, rows));
      onClose();
    };
    reader.onerror = () => setErro('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
  };

  return (
    <ResizableModalShell
      onClose={onClose}
      defaultWidth={480}
      defaultHeight={320}
      ariaLabelledBy="pp-inventario-title"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-600">
          <h2 id="pp-inventario-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Inventário — estoque em produção
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Baixe o modelo, preencha e envie. Campos em branco viram 0. Componentes que não estiverem na
            planilha mantêm os valores atuais.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 min-h-0">
          <div>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => downloadInventarioModelo(linhas)}
            >
              Baixar planilha modelo
            </button>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                handleFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => fileRef.current?.click()}
            >
              Enviar planilha preenchida
            </button>
            {arquivoNome && !erro && previewCount == null && (
              <p className="mt-2 text-xs text-slate-500">Processando {arquivoNome}…</p>
            )}
          </div>
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        </div>
        <div className="shrink-0 border-t border-slate-200 p-4 flex justify-end dark:border-slate-600">
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ResizableModalShell>
  );
}
