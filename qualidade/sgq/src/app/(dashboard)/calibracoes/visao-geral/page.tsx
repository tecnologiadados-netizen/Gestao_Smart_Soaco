"use client";

import { useMemo } from "react";
import {  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCalibrationsStore } from "@/lib/store/calibrations-store";

export default function CalibracoesVisaoGeralPage() {
  const equipmentState = useCalibrationsStore((s) => s.equipment);
  const getEquipmentWithDue = useCalibrationsStore((s) => s.getEquipmentWithDue);
  const equipment = useMemo(
    () => getEquipmentWithDue(),
    [equipmentState, getEquipmentWithDue]
  );
  const total = equipment.length;
  const emDia = equipment.filter((e) => e.statusCalibracao === "em_dia").length;
  const proximo = equipment.filter((e) => e.statusCalibracao === "proximo").length;
  const vencido = equipment.filter((e) => e.statusCalibracao === "vencido").length;
  const pctEmDia = total > 0 ? Math.round((emDia / total) * 100) : 0;

  const kpis = [
    {
      title: "Equipamentos ativos",
      value: total,
      description: "Total cadastrado no sistema",
    },
    {
      title: "Calibrações em dia",
      value: `${pctEmDia}%`,
      description: `${emDia} de ${total} equipamentos`,
    },
    {
      title: "Próximas do vencimento",
      value: proximo,
      description: "Calibrações nos próximos 30 dias",
    },
    {
      title: "Calibrações vencidas",
      value: vencido,
      description: "Requerem ação imediata",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral — Calibrações</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores do programa de metrologia
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.title}</CardDescription>
              <CardTitle className="text-3xl">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Em dia", count: emDia, color: "bg-emerald-500" },
              { label: "Próximo do vencimento", count: proximo, color: "bg-amber-500" },
              { label: "Vencido", count: vencido, color: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${item.color} transition-all`}
                    style={{
                      width: total > 0 ? `${(item.count / total) * 100}%` : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
