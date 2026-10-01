import { apiFetch } from "@/api/client";
import { rccFieldLabels } from "@qualidade/lib/registros/constants";
import { fetchPessoasClient } from "@qualidade/lib/registros/fetch-pessoas-client";
import {
  diferencasClienteCadastro,
  marcarClienteCadastroAlertado,
  type RccDados,
} from "@qualidade/types/rcc";

/** Mesma introdução que o envio de WhatsApp acrescenta. */
const INTRO_WHATSAPP = "Olá! Aqui é o *Amigaço* 👋, passando para avisar:";

function textoAviso(valor: string): string {
  const texto = valor.trim();
  return texto || "(vazio)";
}

function mensagemParaUsuario(texto: string | undefined, fallback: string): string {
  const msg = (texto ?? "").trim();
  if (!msg) return fallback;
  if (/evolution|api key|unauthorized|\.env|http \d{3}/i.test(msg)) {
    return "Não foi possível enviar o alerta agora. Tente novamente em instantes.";
  }
  return msg;
}

export function dadosAlertaCadastroCliente(rcc: RccDados, reenviar = false) {
  const campos = diferencasClienteCadastro(rcc, { incluirJaAlertadas: reenviar });
  const origem = rcc.clienteCadastroOrigem;
  return {
    nomePessoa: origem?.nomeClienteConsumidor.trim() || rcc.nomeClienteConsumidor.trim(),
    codigoPessoa: rcc.codigoPessoaCliente.trim(),
    campos: campos.map((campo) => ({
      rotulo: rccFieldLabels[campo],
      valor: textoAviso(rcc[campo] ?? ""),
    })),
  };
}

export function montarPreviaAlertaCadastroCliente(
  dados: {
    nomePessoa: string;
    codigoPessoa: string;
    campos: Array<{ rotulo: string; valor: string }>;
  },
  observacao: string
): string {
  const linhas = dados.campos.map((campo) => `- ${campo.rotulo}: ${campo.valor}`);
  const nota = observacao.trim();
  const partes = [
    INTRO_WHATSAPP,
    "",
    "Setor comercial, segue uma solicitação de inclusão no cadastro de pessoa no sistema Nomus.",
    "",
    `Pessoa: ${dados.nomePessoa.trim() || "(não informada)"}`,
    `Código: ${dados.codigoPessoa.trim() || "(não informado)"}`,
    "",
    "Dados a incluir:",
    ...linhas,
  ];
  if (nota) {
    partes.push("", "Observação:", nota);
  }
  return partes.join("\n");
}

/** Preenche o código da pessoa quando o nome existe uma única vez no Nomus. */
export async function resolverCodigoPessoaCliente(rcc: RccDados): Promise<string> {
  const atual = rcc.codigoPessoaCliente.trim();
  if (atual) return atual;
  const nome =
    rcc.clienteCadastroOrigem?.nomeClienteConsumidor.trim() ||
    rcc.nomeClienteConsumidor.trim();
  if (nome.length < 2) return "";
  const lista = await fetchPessoasClient({ q: nome, limit: 100 });
  const alvo = nome.toLocaleLowerCase("pt-BR");
  const iguais = lista.filter((pessoa) => pessoa.nome.trim().toLocaleLowerCase("pt-BR") === alvo);
  return iguais.length === 1 ? iguais[0].id : "";
}

/** Dispara o WhatsApp de inclusão no cadastro. Não grava a RCC. */
export async function rccComAlertaCadastro(
  rcc: RccDados,
  opcoes?: { reenviar?: boolean; observacao?: string }
): Promise<{
  rcc: RccDados;
  enviado: boolean;
  mensagem: string;
}> {
  const dados = dadosAlertaCadastroCliente(rcc, opcoes?.reenviar);
  if (dados.campos.length === 0 || !rcc.clienteCadastroOrigem) {
    return { rcc, enviado: false, mensagem: "Nenhum dado corrigido para avisar." };
  }

  const res = await apiFetch("/api/qualidade/rcc/alerta-cadastro-cliente", {
    method: "POST",
    body: {
      nomePessoa: dados.nomePessoa,
      codigoPessoa: dados.codigoPessoa,
      observacao: (opcoes?.observacao ?? "").trim(),
      campos: dados.campos,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    enviado?: boolean;
    mensagem?: string;
    error?: string;
    codigoPessoa?: string;
  };
  const codigoResolvido =
    typeof data.codigoPessoa === "string" && data.codigoPessoa.trim()
      ? data.codigoPessoa.trim()
      : rcc.codigoPessoaCliente;
  const rccComCodigo =
    codigoResolvido === rcc.codigoPessoaCliente
      ? rcc
      : { ...rcc, codigoPessoaCliente: codigoResolvido };
  if (!res.ok) {
    return {
      rcc: rccComCodigo,
      enviado: false,
      mensagem: mensagemParaUsuario(data.mensagem || data.error, "Não foi possível enviar o alerta."),
    };
  }
  if (!data.enviado) {
    return {
      rcc: rccComCodigo,
      enviado: false,
      mensagem: mensagemParaUsuario(
        data.mensagem,
        "Não foi possível enviar o alerta agora. Tente novamente em instantes."
      ),
    };
  }
  return {
    rcc: marcarClienteCadastroAlertado(rccComCodigo),
    enviado: true,
    mensagem: data.mensagem || "Alerta enviado.",
  };
}
