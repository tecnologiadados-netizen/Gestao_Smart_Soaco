import { redirect } from "next/navigation";

export default function AvaliacaoFornecedorHistoricoRedirectPage() {
  redirect("/registros/consulta?tipo=avaliacao-fornecedor");
}
