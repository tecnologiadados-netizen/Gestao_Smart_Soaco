import { NextRequest, NextResponse } from "next/server";
import { getFornecedores } from "@/lib/avaliacao-fornecedor/get-fornecedores";
import {
  FORNECEDORES_INITIAL_LIMIT,
  FORNECEDORES_SEARCH_LIMIT,
} from "@/lib/avaliacao-fornecedor/fornecedores-constants";
import { getSuppliersSqlConfig } from "@/lib/avaliacao-fornecedor/suppliers-sql";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(
          Number(limitParam) || FORNECEDORES_INITIAL_LIMIT,
          FORNECEDORES_SEARCH_LIMIT
        )
      : undefined;

    const fornecedores = await getFornecedores({ q, limit });
    const sqlConfig = getSuppliersSqlConfig();

    return NextResponse.json({
      fornecedores,
      source: sqlConfig ? sqlConfig.driver : "mock",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao buscar fornecedores.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
