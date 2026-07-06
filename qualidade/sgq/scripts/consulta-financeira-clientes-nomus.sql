-- Consulta original enviada (Nomus / agendamentofinanceiro)
-- Use para extrair dados de cliente, NF, pedido etc. no RCC

SELECT
    `af`.`id` AS `Código`,
    IF((`af`.`tipoConta` = 1), 'Confirmada', IF((`af`.`tipoConta` = 2), 'Prevista', IF((`af`.`tipoConta` = 3), 'Adiantamento de cliente', IF((`af`.`tipoConta` = 4), 'Adiantamento a fornecedor', 'Outras')))) AS `Tipo de conta`,
    IF((`af`.`discriminador` = 'R'), 'Entrada', IF((`af`.`discriminador` = 'P'), 'Saída', IF((`af`.`discriminador` = 'NCF'), 'Nota de crédito de fornecedor', IF((`af`.`discriminador` = 'NCC'), 'Nota de crédito de cliente', IF((`af`.`discriminador` = 'CR'), 'Cheques a receber', IF((`af`.`discriminador` = 'CP'), 'Cheques a pagar', 'Outros')))))) AS `Natureza`,
    `e`.`nome` AS `Empresa`,
    `cb`.`nome` AS `Conta bancária`,
    `fp`.`nome` AS `Forma de pagamento`,
    `cf`.`classificacao` AS `Classificação financeira`,
    SUBSTR(`cf`.`classificacao`, 1, (LOCATE('.', `cf`.`classificacao`) - 1)) AS `Classificação financeira sintética`,
    `cf`.`nome` AS `Nome da classificação financeira`,
    `cf`.`nome` AS `Nome da classificação financeira sintética`,
    `gcf`.`nome` AS `Grupo da classificação`,
    `af`.`valorBaixar` AS `Valor a receber/pagar`,
    IF((`af`.`discriminador` IN ('R', 'CR', 'NCC')), `af`.`valorBaixar`, (-(1) * `af`.`valorBaixar`)) AS `Valor a receber/pagar (+/-)`,
    `af`.`valorBaixarAgendado` AS `Valor a receber/pagar agendado`,
    IF((`af`.`discriminador` IN ('R', 'CR', 'NCC')), `af`.`valorBaixarAgendado`, (-(1) * `af`.`valorBaixarAgendado`)) AS `Valor a receber/pagar agendado (+/-)`,
    IFNULL((SELECT SUM(`lf`.`valor`) FROM `lancamentofinanceiro` `lf` WHERE (`af`.`id` = `lf`.`idAgendamentoRecebimento`)), (SELECT SUM(`lf`.`valor`) FROM `lancamentofinanceiro` `lf` WHERE (`af`.`id` = `lf`.`idAgendamentoPagamento`))) AS `Valor recebido/pago`,
    ((
        SELECT SUM(`lf`.`valor`)
        FROM `lancamentofinanceiro` `lf`
        WHERE (`af`.`id` = `lf`.`idAgendamentoRecebimento`)
    ) - (
        SELECT SUM(`lf`.`valor`)
        FROM `lancamentofinanceiro` `lf`
        WHERE (`af`.`id` = `lf`.`idAgendamentoPagamento`)
    )) AS `Valor recebido/pago (+/-)`,
    `af`.`valorBaixado` AS `Valor baixado`,
    IF((`af`.`discriminador` IN ('R', 'CR', 'NCC')), `af`.`valorBaixado`, (-(1) * `af`.`valorBaixado`)) AS `Valor baixado (+/-)`,
    `af`.`saldoBaixar` AS `Saldo a receber/pagar`,
    IF((`af`.`discriminador` IN ('R', 'CR', 'NCC')), `af`.`saldoBaixar`, (-(1) * `af`.`saldoBaixar`)) AS `Saldo a receber/pagar (+/-)`,
    `af`.`dataVencimento` AS `Data de vencimento`,
    `af`.`dataAgendamento` AS `Data de agendamento`,
    `af`.`dataBaixa` AS `Data da baixa`,
    `af`.`dataCompetencia` AS `Data de competência`,
    `af`.`dataHoraCriacao` AS `Data da criação`,
    IFNULL(
        (SELECT `lf`.`dataLancamento` FROM `lancamentofinanceiro` `lf` WHERE (`lf`.`idAgendamentoRecebimento` = `af`.`id`) LIMIT 1),
        (SELECT `lf`.`dataLancamento` FROM `lancamentofinanceiro` `lf` WHERE (`lf`.`idAgendamentoPagamento` = `af`.`id`) LIMIT 1)
    ) AS `Data do último lançamento vinculado a conta a receber/pagar`,
    IF((`af`.`baixada` = 1), 'Baixada', 'Pendente') AS `Status`,
    `af`.`descricaoLancamento` AS `Descrição do lançamento`,
    `af`.`comentarios` AS `Comentários`,
    `pes`.`nome` AS `Pessoa`,
    `pes`.`nomeRazaoSocial` AS `Razão Social da Pessoa`,
    `pes`.`ativo` AS `Ativo`,
    IF((`pes`.`tipoPessoa` = 1), 'Pessoa Jurídica', 'Pessoa Física') AS `Tipo de pessoa`,
    IF((`pes`.`tipoPessoa` = 1), `pes`.`cnpjCpf`, `pes`.`cpf`) AS `CNPJ/CPF da Pessoa`,
    `pais`.`nome` AS `País da Pessoa`,
    `pes`.`uf` AS `UF da Pessoa`,
    `cid`.`nome` AS `Município da Pessoa`,
    CONCAT(IF(((`tel`.`DDD` IS NULL) = 1), '', CONCAT(`tel`.`DDD`, ' - ')), `tel`.`numero`) AS `Telefone da Pessoa`,
    `pes`.`email` AS `E-mail da Pessoa`,
    `pes`.`emailEnvioParaNFe` AS `E-mail da pessoa para envio de NF-e`,
    `pes`.`emailCampoParaBoletoBancario` AS `E-mail da pessoa para envio do boleto bancário`,
    `pes`.`codigoSistemaContabil` AS `Código no sistema contábil da pessoa`,
    IFNULL(`nfse`.`numero`, IFNULL(`nfee`.`numero`, IFNULL(`nfes`.`numero`, `dee`.`numeroNFS`))) AS `Número da NF-e/NFS-e de origem`,
    IFNULL(`nfee`.`serie`, `nfes`.`serie`) AS `Série da NF-e de origem`,
    IFNULL(`dee`.`dataEmissao`, `des`.`dataEmissao`) AS `Data/hora da emissão da NF-e/NFS-e de origem`,
    IF(
        (IFNULL(`nfes`.`status`, IFNULL(`nfee`.`status`, `nfse`.`status`)) IS NULL),
        'Sem nota fiscal',
        IF(
            ((`nfes`.`status` = 1) OR (`nfee`.`status` = 1)),
            'Dados inconsistentes',
            IF(
                ((`nfes`.`status` = 3) OR (`nfee`.`status` = 3)),
                'Aguardando autorização',
                IF(
                    ((`nfes`.`status` = 4) OR (`nfee`.`status` = 4) OR (`nfse`.`status` = 2)),
                    'Autorizada',
                    IF(
                        ((`nfes`.`status` = 5) OR (`nfee`.`status` = 5)),
                        'Denegada',
                        IF(
                            ((`nfes`.`status` = 6) OR (`nfee`.`status` = 6) OR (`nfse`.`status` = 3)),
                            'Rejeitada',
                            IF(
                                ((`nfes`.`status` = 7) OR (`nfee`.`status` = 7) OR (`nfse`.`status` = 4)),
                                'Cancelada',
                                'Avaliar'
                            )
                        )
                    )
                )
            )
        )
    ) AS `Status da NF-e/NFS-e de origem`,
    IFNULL(`af`.`idDocumentoSaida`, `af`.`idDocumentoEntrada`) AS `Id do documento de estoque/serviço origem`,
    IFNULL(`tts`.`vNF`, `tte`.`vNF`) AS `Valor total do documento estoque de origem`,
    IFNULL(`tms`.`nome`, `tme`.`nome`) AS `Tipo de movimentação do documento estoque/serviço de origem`,
    IFNULL(`cps`.`nome`, `cpe`.`nome`) AS `Condição de pagamento do documento estoque/serviço de origem`,
    IFNULL(`pps`.`numero`, `ppe`.`numero`) AS `Parcela do pagamento do documento estoque/serviço de origem`,
    `pesrep`.`nome` AS `Representante do documento estoque/serviço de origem`,
    `pesvend`.`nome` AS `Vendedor do documento estoque/serviço de origem`,
    IFNULL(`dee`.`numeroDocumentoFiscal`, `des`.`numeroDocumentoFiscal`) AS `Número do documento estoque/serviço de origem`,
    `af`.`numeroDocumento` AS `Número do documento do boleto bancário`,
    (
        SELECT `bol`.`nossoNumero`
        FROM `boletobancario` `bol`
        WHERE (`bol`.`idAgendamentoRecebimento` = `af`.`id`)
        LIMIT 1
    ) AS `Nosso número do boleto bancário`,
    (
        SELECT `bol`.`nossoNumeroBoletoBancario`
        FROM `boletobancario` `bol`
        WHERE (`bol`.`idAgendamentoRecebimento` = `af`.`id`)
        LIMIT 1
    ) AS `Nosso número completo do boleto bancário`,
    (
        SELECT (
            CASE `bol`.`status`
                WHEN 1 THEN 'Aguardando remessa para banco'
                WHEN 2 THEN 'Aguardando Registro'
                WHEN 3 THEN 'Registrado'
                WHEN 4 THEN 'Pago'
                WHEN 5 THEN 'Rejeitado'
            END
        )
        FROM `boletobancario` `bol`
        WHERE (`bol`.`idAgendamentoRecebimento` = `af`.`id`)
        LIMIT 1
    ) AS `Status do boleto bancário`,
    (
        SELECT (
            CASE `bol`.`cancelado`
                WHEN 0 THEN 'Não'
                ELSE 'Sim'
            END
        )
        FROM `boletobancario` `bol`
        WHERE (`bol`.`idAgendamentoRecebimento` = `af`.`id`)
        LIMIT 1
    ) AS `Boleto bancário cancelado?`,
    (
        SELECT `pv`.`nome`
        FROM (
            (`itemdocumentoestoque` `ide`
            JOIN `itemdocumentoestoque_itempedidovenda` `ideipv`)
            JOIN `itempedido` `ipv`
        )
        JOIN `pedido` `pv`
        WHERE (
            (`af`.`idDocumentoSaida` = `ide`.`idDocumentoSaida`)
            AND (`ide`.`id` = `ideipv`.`idItemDocumentoEstoque`)
            AND (`ipv`.`id` = `ideipv`.`idItemPedidoVenda`)
            AND (`pv`.`id` = `ipv`.`idPedido`)
        )
        LIMIT 1
    ) AS `Pedido de venda do documento estoque/serviço`,
    (
        SELECT IF(
            (`ip`.`status` = 1), 'Aguardando liberação',
            IF((`ip`.`status` = 2), 'Liberado',
            IF((`ip`.`status` = 5), 'Atendido com corte',
            IF((`ip`.`status` = 3), 'Atendido parcialmente',
            IF((`ip`.`status` = 4), 'Atendido totalmente',
            IF((`ip`.`status` = 6), 'Cancelado',
            IF((`ip`.`status` = 7), 'Devolvido parcialmente',
            IF((`ip`.`status` = 8), 'Devolvido totalmente', 'Sem status'))))))))
        FROM (
            (`itemdocumentoestoque` `ide`
            JOIN `itemdocumentoestoque_itempedidovenda` `ideipv`)
            JOIN `itempedido` `ip`
        )
        WHERE (
            (`af`.`idDocumentoSaida` = `ide`.`idDocumentoSaida`)
            AND (`ide`.`id` = `ideipv`.`idItemDocumentoEstoque`)
            AND (`ip`.`id` = `ideipv`.`idItemPedidoVenda`)
        )
        LIMIT 1
    ) AS `Status do item do pedido de venda do documento estoque/serviço`,
    `af`.`bancoCheque` AS `Banco do cheque a receber/pagar`,
    `af`.`contaCheque` AS `Conta bancária do cheque a receber/pagar`,
    IF(
        (`af`.`discriminador` = 'CR'),
        IF((`af`.`statusCheque` = 1), 'Recebido do cliente',
        IF((`af`.`statusCheque` = 2), 'Liberado para depósito',
        IF((`af`.`statusCheque` = 3), 'Depositado',
        IF((`af`.`statusCheque` = 5), 'Devolvido pela 1ª vez',
        IF((`af`.`statusCheque` = 6), 'Reapresentado',
        IF((`af`.`statusCheque` = 7), 'Devolvido pela 2ª vez',
        IF((`af`.`statusCheque` = 8), 'Endossado',
        IF((`af`.`statusCheque` = 9), 'Devolvido pelo fornecedor',
        IF((`af`.`statusCheque` = 10), 'Devolvido para o cliente',
        IF((`af`.`statusCheque` = 11), 'Aguardando recebimento do cliente', 'Avaliar')))))))))),
        IF((`af`.`discriminador` = 'CP'),
        IF((`af`.`statusCheque` = 1), 'Emitido',
        IF((`af`.`statusCheque` = 2), 'Preenchido',
        IF((`af`.`statusCheque` = 3), 'Enviado para o fornecedor',
        IF((`af`.`statusCheque` = 5), 'Devolvido pela 1ª vez',
        IF((`af`.`statusCheque` = 6), 'Reapresentado',
        IF((`af`.`statusCheque` = 7), 'Devolvido pela 2ª vez',
        IF((`af`.`statusCheque` = 8), 'Devolvido pelo fornecedor',
        IF((`af`.`statusCheque` = 4), 'Depositado', 'Avaliar'))))))))),
        'Avaliar')
    ) AS `Status do cheque a receber/pagar`,
    `af`.`numeroCheque` AS `Número do cheque a receber/pagar`,
    `af`.`dataVencimento` AS `Data para depósito prevista do cheque a receber/pagar`,
    `pesfornend`.`nome` AS `Fornecedor do endosso do cheque a receber`,
    `pesemi`.`nome` AS `Emissor do cheque a receber/pagar`,
    IF((`af`.`chequeTerceiros` = 1), 'Sim', 'Não') AS `Cheque emitido por terceiros?`,
    IF((`af`.`suspenderCobranca` = 1), 'Sim', 'Não') AS `Conta a receber suspensa para cobrança?`,
    `af`.`idProcessoCobranca` AS `Código do processo de cobrança vinculado a conta a receber`,
    IF((`af`.`recebimentoConfirmado` = 1), 'Sim', 'Não') AS `Conta a receber com recebimento confirmado para cobrança?`,
    IF(
        (`af`.`statusDescontoDuplicata` = 1), 'Aguardando confirmação',
        IF((`af`.`statusDescontoDuplicata` = 1), 'Aguardando confirmação',
        IF((`af`.`statusDescontoDuplicata` = 2), 'Reprovado',
        IF((`af`.`statusDescontoDuplicata` = 3), 'Aprovado com risco',
        IF((`af`.`statusDescontoDuplicata` = 4), 'Aprovado sem risco',
        IF((`af`.`statusDescontoDuplicata` = 5), 'Liquidado',
        IF((`af`.`statusDescontoDuplicata` = 6), 'Em cobrança', 'Avaliar')))))))
    ) AS `Status do desconto de duplicata da conta a receber`
FROM `agendamentofinanceiro` `af`
LEFT JOIN `pessoa` `pes` ON (`pes`.`id` = `af`.`idPessoa`)
LEFT JOIN `telefone` `tel` ON (
    (`tel`.`idEntidade` = `pes`.`id`)
    AND (`tel`.`discriminador` = 'P')
    AND (`tel`.`telefonePrincipal` = 1)
)
LEFT JOIN `empresa` `e` ON (`e`.`id` = `af`.`idEmpresa`)
LEFT JOIN `contabancaria` `cb` ON (`cb`.`id` = `af`.`idContaBancaria`)
LEFT JOIN `contafinanceiro` `cf` ON (`cf`.`id` = `af`.`idContaFinanceiro`)
LEFT JOIN `grupoconta` `gcf` ON (`cf`.`idGrupoConta` = `gcf`.`id`)
LEFT JOIN `municipio` `cid` ON (`cid`.`id` = `pes`.`idMunicipio`)
LEFT JOIN `pais` ON (`pais`.`id` = `pes`.`idPais`)
LEFT JOIN `nfe` `nfes` ON (`nfes`.`idDocumentoEstoque` = `af`.`idDocumentoSaida`)
LEFT JOIN `nfe` `nfee` ON (`nfee`.`idDocumentoEstoque` = `af`.`idDocumentoEntrada`)
LEFT JOIN `nfse` ON (`nfse`.`idDocumentoServico` = `af`.`idDocumentoSaida`)
LEFT JOIN `documentoestoque` `des` ON (`des`.`id` = `af`.`idDocumentoSaida`)
LEFT JOIN `totaltributacao` `tts` ON (`des`.`idTotalTributacao` = `tts`.`id`)
LEFT JOIN `pessoa` `pesrep` ON (`pesrep`.`id` = `des`.`idRepresentante`)
LEFT JOIN `pessoa` `pesvend` ON (`pesvend`.`id` = `des`.`idVendedor`)
LEFT JOIN `documentoestoque` `dee` ON (`dee`.`id` = `af`.`idDocumentoEntrada`)
LEFT JOIN `totaltributacao` `tte` ON (`dee`.`idTotalTributacao` = `tte`.`id`)
LEFT JOIN `tipomovimentacao` `tms` ON (`des`.`idTipoMovimentacao` = `tms`.`id`)
LEFT JOIN `tipomovimentacao` `tme` ON (`dee`.`idTipoMovimentacao` = `tme`.`id`)
LEFT JOIN `condicaopagamento` `cps` ON (`des`.`idCondicaoPagamento` = `cps`.`id`)
LEFT JOIN `condicaopagamento` `cpe` ON (`dee`.`idCondicaoPagamento` = `cpe`.`id`)
LEFT JOIN `parcelapagamento` `pps` ON (`af`.`idParcelaDocumentoSaida` = `pps`.`id`)
LEFT JOIN `parcelapagamento` `ppe` ON (`af`.`idParcelaDocumentoEntrada` = `ppe`.`id`)
LEFT JOIN `formapagamento` `fp` ON (`af`.`idFormaPagamento` = `fp`.`id`)
LEFT JOIN `pessoa` `pesemi` ON (`pesemi`.`id` = `af`.`idEmissor`)
LEFT JOIN `pessoa` `pesfornend` ON (`pesfornend`.`id` = `af`.`idFornecedorEndossado`)
WHERE `pes`.`nome` IN ('IMPERADOR DAS MAQUINAS LTDA')
--  AND `af`.`baixada` =
    AND YEAR(`af`.`dataHoraCriacao`) IN (YEAR(NOW()), (YEAR(NOW()) - 1));
