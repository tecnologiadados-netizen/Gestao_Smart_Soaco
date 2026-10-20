-- Status da solicitação no Otimiza, para manter o número na divergência enquanto ela não conclui.
ALTER TABLE "double_checkin_solicitacao_otimiza" ADD COLUMN "status" TEXT;
