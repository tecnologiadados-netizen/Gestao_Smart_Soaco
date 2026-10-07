import { CORES_POSTIT } from '@rh/lib/demandas-internas';

export default function SeletorCorCard({
  valor,
  onEscolher,
}: {
  valor: string;
  onEscolher: (cor: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Cor do post-it">
      {CORES_POSTIT.map((item) => {
        const ativo = (valor || 'branco') === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={ativo}
            aria-label={item.rotulo}
            title={item.rotulo}
            onClick={() => onEscolher(item.id)}
            className={`h-6 w-6 rounded-md border shadow-sm ${
              ativo ? 'ring-2 ring-[#041E42] ring-offset-2 ring-offset-white' : 'border-black/15'
            }`}
            style={{ backgroundColor: item.fundo }}
          />
        );
      })}
    </div>
  );
}
