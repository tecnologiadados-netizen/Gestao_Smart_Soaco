/* DFC Nomus — script de negócio (2 UNION). Placeholders: {{EMP_IN}}, {{DATA_VENCIMENTO_MIN}} */
select
    lf.idContaBancaria,
    cb.nome,
    af.id as codigoConta,
    af.discriminador as tipoConta,
    lf.dataLancamento as dataBaixa,
    af.dataAgendamento,
    af.dataVencimento,
    af.dataCompetencia,
    af.descricaoLancamento,
    case
        when coalesce(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
             and af.discriminador = 'R'
            then 2
        else coalesce(af.idContaFinanceiro, lf.idContaFinanceiro)
    end as idPlanoContas,
    cf.nome as planoContas,
    '' as ordemPai,
    coalesce(td.comentarios, af.comentarios) as comentarios,
    fp.nome as formaPagamento,
    af.valorBaixar / count(af.id) over (partition by af.id) as valorBaixar,
    lf.valor as valorBaixado,
    af.saldoBaixar / count(af.id) over (partition by af.id) as saldoBaixar,
    af.idEmpresa,
    emp.nome as empresa,
    af.idPessoa,
    pe.nomeRazaoSocial,
    pe.nome as clienteFornecedor,
    pg.geraAdiantamento,
    af.idPedido,
    af.idDocumentoSaida,
    'Nomus' as software
from agendamentofinanceiro af
left join lancamentofinanceiro lf
    on coalesce(lf.idAgendamentoPagamento, lf.idAgendamentoRecebimento) = af.id
left join pessoa pe
    on pe.id = af.idPessoa
left join contafinanceiro cf
    on cf.id = case
        when coalesce(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
             and af.discriminador = 'R'
            then 2
        else coalesce(af.idContaFinanceiro, lf.idContaFinanceiro)
    end
left join contabancaria cb
    on cb.id = lf.idContaBancaria
left join empresa emp
    on emp.id = af.idEmpresa
left join formapagamento fp
    on fp.id = af.idFormaPagamento
left join parcelapagamento pg
    on pg.id = af.idParcelaDocumentoSaida
left join (
    select distinct
        idAgendamentoRecebimento,
        case
            when comentarios like '%DESCONTADO%' then 'DESCONTADO ANTECI'
            else null
        end as comentarios
    from lancamentofinanceiro
    where idAgendamentoRecebimento is not null
      and comentarios like '%DESCONTADO%'
) td
    on td.idAgendamentoRecebimento = af.id
where af.idEmpresa in ({{EMP_IN}})
  and af.dataVencimento >= '{{DATA_VENCIMENTO_MIN}}'
  and coalesce(td.comentarios, af.comentarios, '') not like '%DESCONTADO ANTECI%'

union all

select
    lf.idContaBancaria,
    cb.nome,
    coalesce(af.id, lf.id) as codigoConta,
    lf.discriminador as tipoConta,
    lf.dataLancamento as dataBaixa,
    af.dataAgendamento,
    coalesce(af.dataVencimento, lf.dataLancamento) as dataVencimento,
    af.dataCompetencia,
    coalesce(af.descricaoLancamento, lf.descricao) as descricaoLancamento,
    case
        when coalesce(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
             and lf.discriminador = 'LR'
            then 2
        else coalesce(af.idContaFinanceiro, lf.idContaFinanceiro)
    end as idPlanoContas,
    cf.nome as planoContas,
    '' as ordemPai,
    coalesce(af.comentarios, lf.comentarios) as comentarios,
    fp.nome as formaPagamento,
    af.valorBaixar,
    lf.valor as valorBaixado,
    coalesce(af.saldoBaixar, 0) as saldoBaixar,
    coalesce(af.idEmpresa, lf.idEmpresa) as idEmpresa,
    emp.nome as empresa,
    coalesce(af.idPessoa, lf.idPessoa) as idPessoa,
    pe.nomeRazaoSocial,
    pe.nome as clienteFornecedor,
    pg.geraAdiantamento,
    af.idPedido,
    af.idDocumentoSaida,
    'Nomus' as software
from lancamentofinanceiro lf
left join agendamentofinanceiro af
    on coalesce(lf.idAgendamentoPagamento, lf.idAgendamentoRecebimento) = af.id
left join pessoa pe
    on pe.id = coalesce(af.idPessoa, lf.idPessoa)
left join contafinanceiro cf
    on cf.id = case
        when coalesce(af.descricaoLancamento, lf.descricao) = 'DESCONTO DE DUPLICATAS'
             and lf.discriminador = 'LR'
            then 2
        else coalesce(af.idContaFinanceiro, lf.idContaFinanceiro)
    end
left join empresa emp
    on emp.id = coalesce(af.idEmpresa, lf.idEmpresa)
left join formapagamento fp
    on fp.id = coalesce(af.idFormaPagamento, lf.idFormaPagamento)
left join parcelapagamento pg
    on pg.id = af.idParcelaDocumentoSaida
left join contabancaria cb
    on cb.id = lf.idContaBancaria
where lf.idEmpresa in ({{EMP_IN}})
  and af.id is null
