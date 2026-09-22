import { useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@qualidade/lib/utils";
import { CadastroDocumentoInternoDialog } from "@qualidade/components/documentos/cadastro-documento-interno-dialog";
import { CadastroDocumentoExternoDialog } from "@qualidade/components/documentos/cadastro-documento-externo-dialog";
import { CadastroRegistroDialog } from "@qualidade/components/documentos/cadastro-registro-dialog";
import { DocumentoConsultaDetalheDialog } from "@qualidade/components/documentos/documento-consulta-detalhe-dialog";

export function NovoDocumentoNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [internoOpen, setInternoOpen] = useState(false);
  const [externoOpen, setExternoOpen] = useState(false);
  const [registroOpen, setRegistroOpen] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [fichaOpen, setFichaOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openMenu() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(true);
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setMenuOpen(false), 180);
  }

  function openInterno() {
    setMenuOpen(false);
    setInternoOpen(true);
  }

  function openExterno() {
    setMenuOpen(false);
    setExternoOpen(true);
  }

  function openRegistro() {
    setMenuOpen(false);
    setRegistroOpen(true);
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          data-open={menuOpen ? "true" : "false"}
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "app-header-menu-trigger flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          )}
        >
          <Plus className="size-4" />
          Novo
          <ChevronDown className="size-4 opacity-60" />
        </button>

        {menuOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1 min-w-[220px] overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              className="flex w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
              onClick={openInterno}
            >
              Documento interno
            </button>
            <button
              type="button"
              className="flex w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
              onClick={openExterno}
            >
              Documento externo
            </button>
            <button
              type="button"
              className="flex w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
              onClick={openRegistro}
            >
              Registros internos
            </button>
          </div>
        )}
      </div>

      <CadastroDocumentoInternoDialog open={internoOpen} onOpenChange={setInternoOpen} />
      <CadastroDocumentoExternoDialog open={externoOpen} onOpenChange={setExternoOpen} />
      <CadastroRegistroDialog
        open={registroOpen}
        onOpenChange={setRegistroOpen}
        onSalvo={(id) => {
          setFichaId(id);
          setFichaOpen(true);
        }}
      />
      <DocumentoConsultaDetalheDialog
        documentId={fichaId}
        open={fichaOpen}
        onOpenChange={(aberto) => {
          setFichaOpen(aberto);
          if (!aberto) setFichaId(null);
        }}
      />
    </>
  );
}
