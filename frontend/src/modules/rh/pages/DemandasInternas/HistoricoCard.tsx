import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { getLogsCard } from '@rh/lib/demandas-internas';

export const CHAVE_LOGS_CARD = 'rh-demanda-card-logs';

function formatarQuando(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

/** Recarregado a cada gravação bem-sucedida do quadro (invalidação de {@link CHAVE_LOGS_CARD}). */
export default function HistoricoCard({ cardId }: { cardId: string }) {
  const consulta = useQuery({
    queryKey: [CHAVE_LOGS_CARD, cardId],
    queryFn: () => getLogsCard(cardId),
  });
  const logs = consulta.data ?? [];

  return (
    <section>
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Atividade
      </p>
      {consulta.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : consulta.isError ? (
        <p className="text-sm text-[#b42318]">Não foi possível carregar o histórico.</p>
      ) : !logs.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
      ) : (
        <ol className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {logs.map((log) => (
            <li key={log.id} className="rounded-lg border border-[#d5e0ee] bg-white px-2.5 py-2">
              <p className="text-[13px] leading-snug text-[#10233f] [overflow-wrap:anywhere]">{log.descricao}</p>
              <p className="mt-1 text-[11px] text-[#5c7084]">
                {log.autorNome} · {formatarQuando(log.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
