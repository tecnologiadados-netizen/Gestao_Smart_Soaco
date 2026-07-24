SELECT
    pd.idEmpresa AS 'idEmpresa',
    pd.id AS 'id',
    CASE 
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
        WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
        WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
        WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
        ELSE de.observacoes 
    END AS 'Observacoes',
    de.codigo AS 'RM',
    tpd.nome AS 'Tipo Pedido',
    pd.nome AS 'PD',
    pd.dataEmissao AS 'Emissao',
    UPPER(pe.nome) AS 'Cliente',
    MIN(ip.dataEntrega) AS 'Data de entrega',
    me.opcao AS 'Metodo de Entrega',
    aloreq.opcao AS 'Requisicao de loja do grupo?',
    CASE WHEN (CASE 
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
        WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
        WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
        WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
        ELSE de.observacoes 
    END) REGEXP 'Retirada|Entrega' THEN 'PI' ELSE IFNULL(m.uf, mc.uf) END AS 'UF',
    CASE WHEN (CASE 
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
        WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
        WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
        WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
        ELSE de.observacoes 
    END) REGEXP 'Retirada|Entrega' THEN 'Teresina' ELSE IFNULL(m.nome, mc.nome) END AS 'Municipio de entrega',
    fp.nome AS 'Forma de Pagamento',
    cp.nome AS 'Condicao de pagamento do pedido de venda',

    MAX(totped.valorTotalPedido) AS 'Valor Original Pedido',

    SUM(ROUND(ip.valorTotalComDesconto * IFNULL(t.aliquotaIPI/100,0),2) + IFNULL(ip.valorTotalComDesconto,0)) AS 'Valor Total',

    SUM(((ROUND(ip.valorTotalComDesconto * IFNULL(t.aliquotaIPI/100,0),2) + IFNULL(ip.valorTotalComDesconto,0)) / ip.qtde)
        * ((ip.qtde - ip.qtdeAtendida) + COALESCE(devol.qtdDevolvida,0))) AS 'Valor Pendente',

    SUM(((ROUND(ip.valorTotalComDesconto * IFNULL(t.aliquotaIPI/100,0),2) + IFNULL(ip.valorTotalComDesconto,0)) / ip.qtde)
        * IFNULL(prm.qtdeVinculada,0)) AS 'Valor Romaneado',

    adt.valorAdiantamento AS 'Valor Adiantamento',

    SUM(IFNULL(nfef.valorTotalComDesconto,0) + IFNULL(t.valorIPI,0)) AS 'Valor Faturado Entrega Futura + IPI',

    SUM(CASE WHEN de.observacoes IS NULL 
        THEN (CASE WHEN de.codigo IS NULL 
                   THEN ((ip.qtde - ip.qtdeAtendida) + COALESCE(devol.qtdDevolvida,0))
                   ELSE IFNULL(prm.qtdeVinculada,0) END)
             * ((ROUND(ip.valorTotalComDesconto * IFNULL(t.aliquotaIPI/100,0),2) + IFNULL(ip.valorTotalComDesconto,0)) / ip.qtde)
        ELSE ((ROUND(ip.valorTotalComDesconto * IFNULL(t.aliquotaIPI/100,0),2) + IFNULL(ip.valorTotalComDesconto,0)) / ip.qtde) * IFNULL(prm.qtdeVinculada,0)
    END) AS 'Saldo a Faturar Real',

    MAX(ef_base.datasBaseEF) AS 'Data base entrega futura',
    emp.opcao AS 'Venda por qual empresa?',
    vr.nome AS 'Vendedor/Representante',

    CASE 
        WHEN (CASE 
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
            WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
            WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
            WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
            ELSE de.observacoes END) LIKE '%ROTA%' 
        THEN DATE(DATE_ADD(pd.dataEmissao, INTERVAL 30 DAY))
        ELSE DATE(MIN(ip.dataEntrega))
    END AS 'dataParametro',

    CASE 
        WHEN (CASE 
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
            WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
            WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
            WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
            ELSE de.observacoes END) LIKE '%Retirada%' THEN 'Retirada'
        WHEN (CASE 
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
            WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
            WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
            WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
            ELSE de.observacoes END) LIKE '%Requisi%' THEN 'Requisição'
        WHEN (CASE 
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
            WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
            WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
            WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
            ELSE de.observacoes END) LIKE '%Entrega%' THEN 'Entrega Grande Teresina'
        WHEN (CASE 
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
            WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
            WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
            WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
            WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
            ELSE de.observacoes END) LIKE '%ROTA%' THEN 'Carradas'
        ELSE 'Inserir em Romaneio'
    END AS 'tipoF',

    CASE WHEN CURDATE() > 
        CASE 
            WHEN (CASE 
                WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
                WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
                WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
                WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
                WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
                ELSE de.observacoes END) LIKE '%ROTA%' 
            THEN DATE(DATE_ADD(pd.dataEmissao, INTERVAL 30 DAY))
            ELSE DATE(MIN(ip.dataEntrega))
        END
    THEN 'Atrasado' ELSE 'Em dia' END AS 'StatusPedido'

FROM itempedido ip
LEFT JOIN pedido pd ON pd.id = ip.idPedido
LEFT JOIN tipopedido tpd ON tpd.id = pd.idTipoPedido
LEFT JOIN pessoa pe ON pe.id = pd.idCliente
LEFT JOIN tributacao t ON t.idItemPedido = ip.id
LEFT JOIN (
    SELECT ip2.idPedido,
           SUM(ROUND(ip2.valorTotalComDesconto * IFNULL(t2.aliquotaIPI/100,0),2) + IFNULL(ip2.valorTotalComDesconto,0)) AS valorTotalPedido
    FROM itempedido ip2
    LEFT JOIN tributacao t2 ON t2.idItemPedido = ip2.id
    WHERE ip2.status <> 6
    GROUP BY ip2.idPedido
) totped ON totped.idPedido = pd.id
LEFT JOIN (
    SELECT pd.id, aloreq.opcao
    FROM pedido pd
    LEFT JOIN atributopedidovalor apvreq ON apvreq.idPedido = pd.id
    LEFT JOIN atributolistaopcao aloreq ON aloreq.id = apvreq.idListaOpcao 
    WHERE apvreq.idAtributo = 313
) aloreq ON aloreq.id = pd.id
LEFT JOIN condicaopagamento cp ON cp.id = pd.idCondicaoPagamento
LEFT JOIN endereco ed ON ed.id = pd.idEnderecoLocalEntrega
LEFT JOIN municipio m ON ed.idMunicipio = m.id
LEFT JOIN municipio mc ON mc.id = pe.idMunicipio
LEFT JOIN (
    SELECT idItemPedido, idRomaneio, SUM(qtdeVinculada) AS qtdeVinculada
    FROM itempedidoromaneio
    GROUP BY idItemPedido, idRomaneio
) prm ON prm.idItemPedido = ip.id
LEFT JOIN documentoestoque de ON de.id = prm.idRomaneio
LEFT JOIN formapagamento fp ON fp.id = pd.idFormaPagamento 
LEFT JOIN (
    SELECT ideipv.idItemPedidoVenda, SUM(IFNULL(ide.valorTotalComDesconto,0)) AS valorTotalComDesconto
    FROM itemdocumentoestoque_itempedidovenda ideipv
    LEFT JOIN itemdocumentoestoque ide ON ide.id = ideipv.idItemDocumentoEstoque
    LEFT JOIN documentoestoque de_nf ON de_nf.id = ide.idDocumentoSaida
    LEFT JOIN nfe nfe_nf ON nfe_nf.idDocumentoEstoque = de_nf.id
    WHERE de_nf.idTipoMovimentacao IN (48,82,44,150) AND nfe_nf.status IN (2,4)
    GROUP BY ideipv.idItemPedidoVenda
) nfef ON nfef.idItemPedidoVenda = ip.id
LEFT JOIN (
    SELECT ideipv.idItemPedidoVenda,
           GROUP_CONCAT(DISTINCT DATE_FORMAT(de_nf.dataBaseParcelas, '%d/%m/%Y') ORDER BY de_nf.dataBaseParcelas SEPARATOR ', ') AS datasBaseEF
    FROM itemdocumentoestoque_itempedidovenda ideipv
    LEFT JOIN itemdocumentoestoque ide ON ide.id = ideipv.idItemDocumentoEstoque
    LEFT JOIN documentoestoque de_nf ON de_nf.id = ide.idDocumentoSaida
    LEFT JOIN nfe nfe_nf ON nfe_nf.idDocumentoEstoque = de_nf.id
    WHERE de_nf.idTipoMovimentacao IN (48,82,44,150) AND nfe_nf.status IN (2,4)
      AND de_nf.dataBaseParcelas IS NOT NULL
    GROUP BY ideipv.idItemPedidoVenda
) ef_base ON ef_base.idItemPedidoVenda = ip.id
LEFT JOIN (
    SELECT p.id, SUM(pg.valor) AS valorAdiantamento
    FROM parcelapagamento pg
    LEFT JOIN pedido p ON p.id = pg.idEntidadeOrigem
    WHERE geraAdiantamento = 1 AND p.dataEmissao >= '2024-01-01' AND discriminador = 'Pedido'
    GROUP BY p.id
) adt ON adt.id = pd.id
LEFT JOIN (
    SELECT apv.idPedido, alo.opcao
    FROM atributopedidovalor apv 
    LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao 
    WHERE apv.idAtributo = 591
) me ON me.idPedido = pd.id
LEFT JOIN (
    SELECT apev.idPedido, alo.opcao
    FROM atributopedidovalor apev
    LEFT JOIN atributolistaopcao alo ON alo.id = apev.idListaOpcao 
    WHERE apev.idAtributo = 592
) emp ON emp.idPedido = pd.id
LEFT JOIN pessoa vr ON vr.id = COALESCE(pd.idVendedor, pd.idRepresentante) 
LEFT JOIN (
    SELECT ip.id AS idPedidoVenda, SUM(COALESCE(ide.qtde,0)) AS qtdDevolvida
    FROM itemdocumentoestoque ide
    LEFT JOIN itemdocumentoestoque_itempedidovenda ideipv ON ideipv.idItemDocumentoEstoque = ide.idItemOrigemDevolucao 
    LEFT JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda 
    LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
    WHERE tm.id IN (52,55) AND ide.idItemOrigemDevolucao IS NOT NULL AND ip.status IN (2,3)
    GROUP BY ip.id
) devol ON devol.idPedidoVenda = ip.id

WHERE ip.status IN (2,3)
  AND pd.idEmpresa IN (1,2)
  AND (CASE 
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
        WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
        WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
        WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
        WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
        ELSE de.observacoes END
      ) NOT LIKE '%Requisi%'
  AND (
        pd.idEmpresa <> 2
        OR (
            pd.idEmpresa = 2
            AND (CASE 
                WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Móveis') THEN '2-Retirada na So Moveis'
                WHEN (de.observacoes IS NULL AND me.opcao = 'Retirada na Só Aço') THEN '1-Retirada na So Aço'
                WHEN (de.observacoes IS NULL AND IFNULL(m.nome, mc.nome) = 'Teresina' AND aloreq.opcao = 'Sim') THEN '5-Requisicao'
                WHEN (de.observacoes IS NULL AND (IFNULL(m.nome, mc.nome) IN ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos')) AND aloreq.opcao = 'Não') THEN '3-Entrega em Grande Teresina'
                WHEN (de.observacoes IS NULL) THEN '4-Inserir em Romaneio'
                ELSE de.observacoes END
            ) NOT IN ('2-Retirada na So Moveis','1-Retirada na So Aço','3-Entrega em Grande Teresina','5-Requisicao')
        )
      )

GROUP BY
    pd.idEmpresa,
    pd.id,
    pd.nome,
    pd.dataEmissao,
    de.id,
    de.codigo,
    de.observacoes,
    tpd.nome,
    pe.id,
    pe.nome,
    me.opcao,
    aloreq.opcao,
    m.uf, mc.uf, m.nome, mc.nome,
    fp.nome,
    cp.nome,
    cp.regra,
    emp.opcao,
    vr.nome,
    adt.valorAdiantamento