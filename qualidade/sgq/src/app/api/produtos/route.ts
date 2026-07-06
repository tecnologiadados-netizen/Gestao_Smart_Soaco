import { NextRequest, NextResponse } from "next/server";
import {
  getCatalogoSource,
  getProdutos,
} from "@/lib/registros/get-produtos";
import {
  PRODUTOS_INITIAL_LIMIT,
  PRODUTOS_SEARCH_LIMIT,
} from "@/lib/registros/produtos-constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? undefined;
    const codigo = searchParams.get("codigo") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(
          Number(limitParam) || PRODUTOS_INITIAL_LIMIT,
          PRODUTOS_SEARCH_LIMIT
        )
      : undefined;

    const produtos = await getProdutos({ q, codigo, limit });

    return NextResponse.json({
      produtos,
      source: getCatalogoSource(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao buscar produtos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
