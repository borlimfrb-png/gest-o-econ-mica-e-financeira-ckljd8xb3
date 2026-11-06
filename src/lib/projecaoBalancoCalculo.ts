import type { BalancoRecord } from '@/types/finance'
import type { ProjecaoResultado } from './projecaoDreCalculo'
import { calcularBalanco } from './financeCalculations'
import { extrairSomaBalanco } from './comparativoDreBalancoCalculo'

/**
 * Balanço Projetado — motor de cálculo dedicado da Projeção de DRE.
 *
 * Princípios:
 * - O balanço REALIZADO é o último balanço do exercício COM DADOS (soma
 *   patrimonial > 0) — mesma estratégia do Painel & Benchmarks; nunca pega
 *   balanço mensal zerado.
 * - Caixa e equivalentes é a LINHA DE FECHAMENTO: derivado do fluxo
 *   (caixa realizado + geração de caixa da DRE projetada) e ajustado para
 *   equilibrar Ativo Total = Passivo + PL. Nunca negativo sem aviso.
 * - PL projetado = PL realizado + lucro do total realizado+projetado da DRE.
 * - Contas a receber, estoques e fornecedores usam circulação (dias médios
 *   da DRE projetada); sem base para dias, % da receita anual projetada.
 * - Demais linhas mantêm o saldo realizado (nota metodológica na tela).
 */

export type MetodoLinhaBalanço =
  | 'caixa_fechamento'
  | 'circulacao_receber'
  | 'circulacao_estoques'
  | 'circulacao_fornecedores'
  | 'mantem_realizado'

export interface LinhaBalançoProjetado {
  chave: string
  rotulo: string
  /** 'ativo' | 'passivo' | 'pl' */
  lado: 'ativo' | 'passivo' | 'pl'
  /** subtotal em destaque? */
  subtotal: boolean
  realizado: number
  projetado: number
  variacao: number
  metodo: MetodoLinhaBalanço
  notaMetodo: string
}

export interface BalancoProjetadoResultado {
  temBalancoRealizado: boolean
  /** descrição do balanço realizado usado (mês/ano) */
  rotuloBalancoRealizado: string
  /** caixa derivado antes do ajuste de fechamento */
  caixaDerivadoBruto: number
  /** valor aplicado para fechar Ativo = Passivo + PL */
  ajusteFechamento: number
  /** true quando o caixa de fechamento ficou negativo */
  caixaNegativo: boolean
  lucroProjetadoUsado: number
  linhas: LinhaBalançoProjetado[]
  ativoTotalRealizado: number
  ativoTotalProjetado: number
  passivoPlTotalRealizado: number
  passivoPlTotalProjetado: number
  /** diferença absoluta residual — deve ser 0 (tolerância 0,01) */
  diferencaFechamento: number
}

const NOTAS: Record<MetodoLinhaBalanço, string> = {
  caixa_fechamento:
    'Caixa e equivalentes = linha de fechamento: caixa do último balanço realizado + geração de caixa da DRE projetada (resultado do período), ajustado para equilibrar Ativo = Passivo + PL.',
  circulacao_receber:
    'Contas a receber = dias médios de recebimento (PMR) sobre a receita diária projetada; sem base para dias, % da receita anual projetada.',
  circulacao_estoques:
    'Estoques = dias médios de estoque (PME) sobre o custo diário projetado (despesa variável); sem base, % da receita anual projetada.',
  circulacao_fornecedores:
    'Fornecedores = dias médios de pagamento (PMP) sobre o custo diário projetado; sem base, % da receita anual projetada.',
  mantem_realizado:
    'Mantém o saldo do último balanço realizado com dados — sem base de projeção para esta linha.',
}

const DIAS_ANO = 365

/** PMR/PME/PMP aproximados a partir do balanço realizado e da DRE realizada */
function estimarDiasCirculacao(
  saldoRealizado: number,
  baseRealizada: number,
  diasBaseRealizada: number,
): number | null {
  if (saldoRealizado <= 0 || baseRealizada <= 0 || diasBaseRealizada <= 0) return null
  const dias = saldoRealizado / (baseRealizada / diasBaseRealizada)
  if (!isFinite(dias) || dias <= 0 || dias > DIAS_ANO * 2) return null
  return dias
}

/** % da receita anual quando não há base para dias */
function estimarPercentualReceita(saldoRealizado: number, receitaRealizada: number): number | null {
  if (saldoRealizado <= 0 || receitaRealizada <= 0) return null
  const pct = (saldoRealizado / receitaRealizada) * 100
  if (!isFinite(pct) || pct <= 0 || pct > 500) return null
  return pct
}

/**
 * Seleciona o último balanço do exercício COM DADOS (soma > 0), mesma
 * estratégia do Painel & Benchmarks (nunca balanço mensal zerado).
 */
export function selecionarUltimoBalancoComDados(
  balancos: BalancoRecord[],
  ano: number,
): { balanco: BalancoRecord | null; mes: number | null } {
  const doAno = balancos.filter((b) => Number(b.ano) === Number(ano))
  const comDados = doAno
    .filter((b) => extrairSomaBalanco(b) > 0)
    .sort((a, b) => Number(b.mes ?? 12) - Number(a.mes ?? 12))
  if (comDados.length > 0) return { balanco: comDados[0], mes: Number(comDados[0].mes ?? 12) }
  return { balanco: null, mes: null }
}

/**
 * Motor principal: projeta cada linha patrimonial coerente com a DRE
 * projetada e fecha o balanço pelo caixa (linha de fechamento).
 */
export function calcularBalancoProjetado(params: {
  balancos: BalancoRecord[]
  exercicio: number
  projecao: ProjecaoResultado
}): BalancoProjetadoResultado {
  const { balancos, exercicio, projecao } = params

  const { balanco: balancoReal, mes: mesBalancoReal } = selecionarUltimoBalancoComDados(
    balancos,
    exercicio,
  )

  const linhas: LinhaBalançoProjetado[] = []
  const calcReal = calcularBalanco(balancoReal)
  const temBalancoRealizado = balancoReal !== null

  const somaSaldoRealizado = (v: number | undefined) => v || 0

  // Base da DRE para circulação
  const receitaAnoProjetada = projecao.receitaTotalAno
  const receitaAnoRealizada = projecao.receitaRealizada
  const despVarAnoRealizada =
    projecao.grupos.find((g) => g.classificacao === 'Despesa Variável')?.realizadoTotal || 0
  const despVarAnoProjetada =
    projecao.grupos.find((g) => g.classificacao === 'Despesa Variável')?.projetadoTotal || 0
  const custoAnoProjetado = despVarAnoRealizada + despVarAnoProjetada
  const mesesRealizadosCount = projecao.mesesRealizadosComMovimento.length || 1
  const diasBaseRealizada = mesesRealizadosCount * 30

  // --- ATIVO ---

  // Contas a receber — circulação (dias ou % da receita)
  const crReal = somaSaldoRealizado(balancoReal?.contas_receber)
  const diasReceber = estimarDiasCirculacao(crReal, receitaAnoRealizada, diasBaseRealizada)
  const pctReceber =
    diasReceber === null ? estimarPercentualReceita(crReal, receitaAnoRealizada) : null
  const crProjetado =
    diasReceber !== null
      ? diasReceber * (receitaAnoProjetada / DIAS_ANO)
      : pctReceber !== null
        ? (pctReceber / 100) * receitaAnoProjetada
        : crReal
  const metodoReceber: MetodoLinhaBalanço =
    diasReceber !== null ? 'circulacao_receber' : 'mantem_realizado'

  // Estoques — circulação sobre custo (despesa variável) ou % da receita
  const estReal = somaSaldoRealizado(balancoReal?.estoques)
  const diasEstoques = estimarDiasCirculacao(estReal, despVarAnoRealizada, diasBaseRealizada)
  const pctEstoques =
    diasEstoques === null ? estimarPercentualReceita(estReal, receitaAnoRealizada) : null
  const estProjetado =
    diasEstoques !== null
      ? diasEstoques * (custoAnoProjetado / DIAS_ANO)
      : pctEstoques !== null
        ? (pctEstoques / 100) * receitaAnoProjetada
        : estReal
  const metodoEstoques: MetodoLinhaBalanço =
    diasEstoques !== null ? 'circulacao_estoques' : 'mantem_realizado'

  // Fornecedores — circulação sobre custo (despesa variável) ou % da receita
  const fornReal = somaSaldoRealizado(balancoReal?.fornecedores)
  const diasForn = estimarDiasCirculacao(fornReal, despVarAnoRealizada, diasBaseRealizada)
  const pctForn = diasForn === null ? estimarPercentualReceita(fornReal, receitaAnoRealizada) : null
  const fornProjetado =
    diasForn !== null
      ? diasForn * (custoAnoProjetado / DIAS_ANO)
      : pctForn !== null
        ? (pctForn / 100) * receitaAnoProjetada
        : fornReal
  const metodoForn: MetodoLinhaBalanço =
    diasForn !== null ? 'circulacao_fornecedores' : 'mantem_realizado'

  // Demais linhas do Ativo — mantém realizado
  const aplicReal = somaSaldoRealizado(balancoReal?.aplicacoes_financeiras)
  const impRecReal = somaSaldoRealizado(balancoReal?.impostos_recuperar)
  const outrosAcReal = somaSaldoRealizado(balancoReal?.outros_ativo_circulante)
  const rlpReal = somaSaldoRealizado(balancoReal?.realizavel_longo_prazo)
  const invReal = somaSaldoRealizado(balancoReal?.investimentos)
  const imobReal = somaSaldoRealizado(balancoReal?.imobilizado)
  const intangReal = somaSaldoRealizado(balancoReal?.intangivel)

  // Demais linhas do Passivo — mantém realizado
  const emprCpReal = somaSaldoRealizado(balancoReal?.emprestimos_curto_prazo)
  const obrTrabReal = somaSaldoRealizado(balancoReal?.obrigacoes_trabalhistas)
  const obrTribReal = somaSaldoRealizado(balancoReal?.obrigacoes_tributarias)
  const outrosPcReal = somaSaldoRealizado(balancoReal?.outros_passivo_circulante)
  const emprLpReal = somaSaldoRealizado(balancoReal?.emprestimos_longo_prazo)
  const outrasLpReal = somaSaldoRealizado(balancoReal?.outras_obrigacoes_longo_prazo)

  // PL — PL realizado + lucro total realizado+projetado da DRE
  const capSocialReal = somaSaldoRealizado(balancoReal?.capital_social)
  const reservasReal = somaSaldoRealizado(balancoReal?.reservas_lucros)
  const lucrosAcumReal = somaSaldoRealizado(balancoReal?.lucros_acumulados)
  const plRealizado = calcReal.patrimonioLiquido
  const lucroProjetadoUsado = projecao.lucroPrejuizoTotalAno
  const plProjetado = plRealizado + lucroProjetadoUsado

  // Passivo + PL projetado (excluindo caixa, que é a linha de fechamento)
  const ativoSemCaixaProjetado =
    crProjetado +
    estProjetado +
    aplicReal +
    impRecReal +
    outrosAcReal +
    rlpReal +
    invReal +
    imobReal +
    intangReal
  const passivoPlSemCaixaProjetado =
    fornProjetado +
    emprCpReal +
    obrTrabReal +
    obrTribReal +
    outrosPcReal +
    emprLpReal +
    outrasLpReal +
    plProjetado

  // Caixa derivado do fluxo
  const caixaRealTotal = somaSaldoRealizado(balancoReal?.caixa_equivalentes) + aplicReal
  const caixaDerivadoBruto = caixaRealTotal + projecao.lucroPrejuizoProjetado
  const ajusteFechamento = passivoPlSemCaixaProjetado - ativoSemCaixaProjetado
  const caixaProjetadoFinal = caixaDerivadoBruto + ajusteFechamento

  const passivoPlTotalProjetado = passivoPlSemCaixaProjetado
  const ativoTotalProjetado = caixaProjetadoFinal + ativoSemCaixaProjetado
  const diferencaFechamento = Math.abs(ativoTotalProjetado - passivoPlTotalProjetado)

  const pushLinha = (
    chave: string,
    rotulo: string,
    lado: LinhaBalançoProjetado['lado'],
    realizado: number,
    projetado: number,
    metodo: MetodoLinhaBalanço,
    opts?: { subtotal?: boolean; nota?: string },
  ) => {
    linhas.push({
      chave,
      rotulo,
      lado,
      subtotal: opts?.subtotal ?? false,
      realizado,
      projetado,
      variacao: projetado - realizado,
      metodo,
      notaMetodo: opts?.nota || NOTAS[metodo],
    })
  }

  // ---- Ativo Circulante ----
  pushLinha('secao_ac', 'Ativo Circulante', 'ativo', 0, 0, 'mantem_realizado', {
    subtotal: true,
    nota: 'Subtotal da seção.',
  })
  pushLinha(
    'caixa',
    'Caixa e equivalentes',
    'ativo',
    caixaRealTotal,
    caixaProjetadoFinal,
    'caixa_fechamento',
  )
  pushLinha('contas_receber', 'Contas a receber', 'ativo', crReal, crProjetado, metodoReceber)
  pushLinha('estoques', 'Estoques', 'ativo', estReal, estProjetado, metodoEstoques)
  pushLinha(
    'impostos_recuperar',
    'Impostos a recuperar',
    'ativo',
    impRecReal,
    impRecReal,
    'mantem_realizado',
  )
  pushLinha(
    'outros_ac',
    'Outros (Ativo Circulante)',
    'ativo',
    outrosAcReal,
    outrosAcReal,
    'mantem_realizado',
  )

  // ---- Ativo Não Circulante ----
  pushLinha('secao_anc', 'Ativo Não Circulante', 'ativo', 0, 0, 'mantem_realizado', {
    subtotal: true,
    nota: 'Subtotal da seção.',
  })
  pushLinha('rlp', 'Realizável a longo prazo', 'ativo', rlpReal, rlpReal, 'mantem_realizado')
  pushLinha('investimentos', 'Investimentos', 'ativo', invReal, invReal, 'mantem_realizado')
  pushLinha('imobilizado', 'Imobilizado', 'ativo', imobReal, imobReal, 'mantem_realizado')
  pushLinha('intangivel', 'Intangível', 'ativo', intangReal, intangReal, 'mantem_realizado')

  // ---- Passivo Circulante ----
  pushLinha('secao_pc', 'Passivo Circulante', 'passivo', 0, 0, 'mantem_realizado', {
    subtotal: true,
    nota: 'Subtotal da seção.',
  })
  pushLinha('fornecedores', 'Fornecedores', 'passivo', fornReal, fornProjetado, metodoForn)
  pushLinha(
    'empr_cp',
    'Empréstimos (curto prazo)',
    'passivo',
    emprCpReal,
    emprCpReal,
    'mantem_realizado',
  )
  pushLinha(
    'obr_trab',
    'Obrigações trabalhistas',
    'passivo',
    obrTrabReal,
    obrTrabReal,
    'mantem_realizado',
  )
  pushLinha(
    'obr_trib',
    'Obrigações tributárias',
    'passivo',
    obrTribReal,
    obrTribReal,
    'mantem_realizado',
  )
  pushLinha(
    'outros_pc',
    'Outros (Passivo Circulante)',
    'passivo',
    outrosPcReal,
    outrosPcReal,
    'mantem_realizado',
  )

  // ---- Passivo Não Circulante ----
  pushLinha('secao_pnc', 'Passivo Não Circulante', 'passivo', 0, 0, 'mantem_realizado', {
    subtotal: true,
    nota: 'Subtotal da seção.',
  })
  pushLinha(
    'empr_lp',
    'Empréstimos (longo prazo)',
    'passivo',
    emprLpReal,
    emprLpReal,
    'mantem_realizado',
  )
  pushLinha(
    'outras_lp',
    'Outras obrigações (LP)',
    'passivo',
    outrasLpReal,
    outrasLpReal,
    'mantem_realizado',
  )

  // ---- Patrimônio Líquido ----
  pushLinha('secao_pl', 'Patrimônio Líquido', 'pl', 0, 0, 'mantem_realizado', {
    subtotal: true,
    nota: 'Subtotal da seção.',
  })
  pushLinha(
    'capital_social',
    'Capital social',
    'pl',
    capSocialReal,
    capSocialReal,
    'mantem_realizado',
  )
  pushLinha('reservas', 'Reservas de lucros', 'pl', reservasReal, reservasReal, 'mantem_realizado')
  pushLinha(
    'lucros_acumulados',
    'Lucros acumulados (inclui resultado projetado)',
    'pl',
    lucrosAcumReal,
    lucrosAcumReal + lucroProjetadoUsado,
    'mantem_realizado',
    {
      nota: 'Lucros acumulados projetados = lucros acumulados realizados + resultado do exercício (realizado + projetado da DRE).',
    },
  )

  const rotuloBalancoRealizado = mesBalancoReal
    ? `Balanço ${String(mesBalancoReal).padStart(2, '0')}/${exercicio}`
    : 'Sem balanço com dados'

  return {
    temBalancoRealizado,
    rotuloBalancoRealizado,
    caixaDerivadoBruto,
    ajusteFechamento,
    caixaNegativo: caixaProjetadoFinal < 0,
    lucroProjetadoUsado,
    linhas,
    ativoTotalRealizado: calcReal.ativoTotal,
    ativoTotalProjetado,
    passivoPlTotalRealizado: calcReal.passivoEPL,
    passivoPlTotalProjetado,
    diferencaFechamento,
  }
}

/**
 * Subtotais agregados por seção (Ativo Circulante, ANC, PC, PNC, PL).
 */
export function calcularSubtotaisBalanço(res: BalancoProjetadoResultado): {
  chave: string
  rotulo: string
  lado: LinhaBalançoProjetado['lado']
  realizado: number
  projetado: number
}[] {
  const secoes = [
    {
      chave: 'secao_ac',
      lado: 'ativo' as const,
      membros: ['caixa', 'contas_receber', 'estoques', 'impostos_recuperar', 'outros_ac'],
    },
    {
      chave: 'secao_anc',
      lado: 'ativo' as const,
      membros: ['rlp', 'investimentos', 'imobilizado', 'intangivel'],
    },
    {
      chave: 'secao_pc',
      lado: 'passivo' as const,
      membros: ['fornecedores', 'empr_cp', 'obr_trab', 'obr_trib', 'outros_pc'],
    },
    { chave: 'secao_pnc', lado: 'passivo' as const, membros: ['empr_lp', 'outras_lp'] },
    {
      chave: 'secao_pl',
      lado: 'pl' as const,
      membros: ['capital_social', 'reservas', 'lucros_acumulados'],
    },
  ]
  return secoes.map((s) => {
    const realizado = res.linhas
      .filter((l) => s.membros.includes(l.chave))
      .reduce((acc, l) => acc + l.realizado, 0)
    const projetado = res.linhas
      .filter((l) => s.membros.includes(l.chave))
      .reduce((acc, l) => acc + l.projetado, 0)
    return {
      chave: s.chave,
      rotulo: `Total ${s.chave === 'secao_ac' ? 'Ativo Circulante' : s.chave === 'secao_anc' ? 'Ativo Não Circulante' : s.chave === 'secao_pc' ? 'Passivo Circulante' : s.chave === 'secao_pnc' ? 'Passivo Não Circulante' : 'Patrimônio Líquido'}`,
      lado: s.lado,
      realizado,
      projetado,
    }
  })
}
