import { NextRequest, NextResponse } from "next/server";
import { getClientes, getClientesSource } from "@/lib/registros/get-clientes";
import {
  CLIENTES_INITIAL_LIMIT,
  CLIENTES_SEARCH_LIMIT,
} from "@/lib/registros/clientes-constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? undefined;
    const id = searchParams.get("id") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(
          Number(limitParam) || CLIENTES_INITIAL_LIMIT,
          CLIENTES_SEARCH_LIMIT
        )
      : undefined;

    const clientes = await getClientes({ q, id, limit });

    return NextResponse.json({
      clientes,
      source: getClientesSource(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao buscar clientes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
