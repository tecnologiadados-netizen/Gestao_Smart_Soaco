SELECT DISTINCT
    o.nome                              AS ordem,
    to2.nome                            AS tipo_ordem,
    p.nome                              AS codigo_produto,
    p.descricao                         AS descricao_produto,
    um.nome                             AS unidade_medida,
    o.qtde                              AS qtde_planejada,
    (o.qtde - o.saldo)                  AS qtde_produzida,
    o.saldo                             AS saldo,
    o.prioridade                        AS prioridade,
    o.dataCriacao                       AS data_emissao,
    o.dataInicialPlanejada              AS data_inicial_planejada,
    o.dataEntrega                       AS data_entrega,
    CASE
        WHEN o.status = 7                           THEN 'Cancelada'
        WHEN o.dataEncerramento IS NOT NULL         THEN 'Encerrada'
        WHEN o.status = 6                           THEN 'Requisitada parcialmente'
        WHEN o.status = 5                           THEN 'Requisitada totalmente'
        WHEN o.status = 2 AND o.liberada = 1        THEN 'Liberada'
        WHEN o.status = 3                           THEN 'Confirmada'
        WHEN o.status = 1                           THEN 'Planejada'
        ELSE 'Sem status'
    END                                 AS status
FROM weberp_soaco.ordem o
INNER JOIN weberp_soaco.produto p                        ON p.id = o.idProduto
INNER JOIN weberp_soaco.tipoordem to2                    ON to2.id = o.idTipoOrdem
INNER JOIN weberp_soaco.empresa emp                      ON emp.id = o.idEmpresa
LEFT  JOIN weberp_soaco.unidademedida um                 ON um.id = p.idUnidadeMedida
INNER JOIN weberp_soaco.operacaoroteiroordem oro         ON oro.idOrdem = o.id
INNER JOIN weberp_soaco.recursohabilitadoroteiroordem rh ON rh.idOperacaoRoteiroOrdem = oro.id
                                                       AND rh.idRecurso = 124
WHERE o.idEmpresa = 1
  AND o.lixeira = 0
  AND o.dataEncerramento IS NULL
  AND o.status IN (1, 2, 3, 6)
  AND NOT (o.status = 2 AND o.liberada = 0)
  AND p.id = ?
ORDER BY o.dataEntrega ASC
