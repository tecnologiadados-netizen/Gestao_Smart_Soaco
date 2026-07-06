import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { getRegistroCodigoDocumento } from "@/types/registro";
import type { Registro } from "@/types/registro";

export const runtime = "nodejs";

interface RncPdfRequestBody {
  registro?: Registro;
}

function nomeArquivoPdf(codigo: string): string {
  const base = codigo.replace(/[^\w.-]+/g, "_") || "relatorio";
  return `RNC_${base}.pdf`;
}

function executarPython(
  payload: string,
  outputPath: string
): Promise<{ stderr: string; code: number | null }> {
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "rnc-pdf",
    "generate_rnc_pdf.py"
  );
  const pythonCmd = process.env.PYTHON_PATH || "python";

  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonCmd,
      [scriptPath, "--output", outputPath],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
        },
      }
    );

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stderr, code }));
    child.stdin.write(payload, "utf8");
    child.stdin.end();
  });
}

export async function POST(request: Request) {
  let tempDir: string | undefined;

  try {
    const body = (await request.json()) as RncPdfRequestBody;
    const registro = body.registro;

    if (!registro || registro.tipo !== "rnc" || !registro.rnc) {
      return NextResponse.json(
        { error: "Registro RNC inválido para geração do PDF." },
        { status: 400 }
      );
    }

    tempDir = await mkdtemp(path.join(tmpdir(), "rnc-pdf-"));
    const outputPath = path.join(tempDir, "relatorio.pdf");
    const payload = JSON.stringify({ registro });

    const { stderr, code } = await executarPython(payload, outputPath);
    if (code !== 0) {
      const detalhe = stderr.trim() || "Falha ao executar o gerador Python.";
      return NextResponse.json({ error: detalhe }, { status: 500 });
    }

    const pdfBuffer = await readFile(outputPath);
    const codigo = getRegistroCodigoDocumento(registro);
    const filename = nomeArquivoPdf(codigo);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao gerar o PDF do RNC.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
