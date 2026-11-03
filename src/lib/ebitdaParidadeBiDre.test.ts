import { describe, it, expect } from 'vitest'
import { calcularAnaliseRentabilidade } from './analiseRentabilidadeCalculo'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import { calcularDre } from './financeCalculations'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord, DreRecord } from '@/types/finance'

describe('Paridade de EBITDA e Métricas DRE 2026: Dashboard BI vs DRE Gerencial', () => {
  const EMPRESA_ID = 'emp-ficticia-2026'
  const ANO_EXERCICIO = 2026
  const meses2026 = gerarListaMeses(ANO_EXERCICIO, 1, 12)

  // 1. Plano de contas sintético com classificações DRE completas e corretas
  const contasSinteticas: ContaRecord[] = [
    {
      id: 'c-rec-op',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: '3.01.01.001',
      nome: 'Receita Bruta com Venda de Produtos e Serviços',
      tipo: 'Receita',
      classificacao_dre: 'Receita',
      natureza: 'credora',
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'c-custo-var',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: '4.01.01.001',
      nome: 'Custos Variáveis e Mercadorias Vendidas (CMV)',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Variável',
      natureza: 'devedora',
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'c-desp-fix',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: '4.02.01.001',
      nome: 'Despesas Fixas e Administrativas (Aluguel, Folha, Estrutura)',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Fixa',
      natureza: 'devedora',
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'c-desp-fin',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: '4.03.01.001',
      nome: 'Despesas Financeiras (Juros Passivos, IOF e Encargos)',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Financeira',
      natureza: 'devedora',
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'c-rec-fin',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: '3.02.01.001',
      nome: 'Receitas Financeiras (Rendimentos de Aplicações e Descontos Obtidos)',
      tipo: 'Receita',
      classificacao_dre: 'Receita Financeira',
      natureza: 'credora',
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ]

  const planoContasSintetico: PlanoContaRecord[] = [
    {
      id: 'pc-rec',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: 'PC-REC-2026',
      conta: 'c-rec-op',
      centro: 'cc-operacional',
      created: '2026-01-01',
    },
    {
      id: 'pc-var',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: 'PC-VAR-2026',
      conta: 'c-custo-var',
      centro: 'cc-operacional',
      created: '2026-01-01',
    },
    {
      id: 'pc-fix',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: 'PC-FIX-2026',
      conta: 'c-desp-fix',
      centro: 'cc-administrativo',
      created: '2026-01-01',
    },
    {
      id: 'pc-dfin',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: 'PC-DFIN-2026',
      conta: 'c-desp-fin',
      centro: 'cc-financeiro',
      created: '2026-01-01',
    },
    {
      id: 'pc-rfin',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-teste',
      empresa: EMPRESA_ID,
      codigo: 'PC-RFIN-2026',
      conta: 'c-rec-fin',
      centro: 'cc-financeiro',
      created: '2026-01-01',
    },
  ]

  /**
   * Helper que gera lançamentos ao longo dos 12 meses de 2026
   * com sazonalidade e valores conhecidos para verificação analítica.
   */
  function gerarLancamentosExercicio2026(incluirEstornado = false): LancamentoRecord[] {
    const lancamentos: LancamentoRecord[] = []

    for (let mes = 1; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, '0')
      const baseRec = 100_000 + mes * 10_000 // 110k em Jan até 220k em Dez
      const baseVar = 30_000 + mes * 3_000 // 33k em Jan até 66k em Dez (CMV/var)
      const baseFix = 40_000 // 40k fixo mensal
      const baseFin = 5_000 + mes * 500 // 5.5k a 11k
      const baseRecFin = 2_000 // 2k fixo de receita financeira

      lancamentos.push(
        {
          id: `lanc-rec-${mes}`,
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          user: 'u-teste',
          empresa: EMPRESA_ID,
          plano_conta: 'pc-rec',
          conta: 'c-rec-op',
          data: `${ANO_EXERCICIO}-${mesStr}-15`,
          valor: baseRec,
          created: `${ANO_EXERCICIO}-${mesStr}-15`,
        },
        {
          id: `lanc-var-${mes}`,
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          user: 'u-teste',
          empresa: EMPRESA_ID,
          plano_conta: 'pc-var',
          conta: 'c-custo-var',
          data: `${ANO_EXERCICIO}-${mesStr}-18`,
          valor: baseVar,
          created: `${ANO_EXERCICIO}-${mesStr}-18`,
        },
        {
          id: `lanc-fix-${mes}`,
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          user: 'u-teste',
          empresa: EMPRESA_ID,
          plano_conta: 'pc-fix',
          conta: 'c-desp-fix',
          data: `${ANO_EXERCICIO}-${mesStr}-20`,
          valor: baseFix,
          created: `${ANO_EXERCICIO}-${mesStr}-20`,
        },
        {
          id: `lanc-dfin-${mes}`,
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          user: 'u-teste',
          empresa: EMPRESA_ID,
          plano_conta: 'pc-dfin',
          conta: 'c-desp-fin',
          data: `${ANO_EXERCICIO}-${mesStr}-25`,
          valor: baseFin,
          created: `${ANO_EXERCICIO}-${mesStr}-25`,
        },
        {
          id: `lanc-rfin-${mes}`,
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          user: 'u-teste',
          empresa: EMPRESA_ID,
          plano_conta: 'pc-rfin',
          conta: 'c-rec-fin',
          data: `${ANO_EXERCICIO}-${mesStr}-28`,
          valor: baseRecFin,
          created: `${ANO_EXERCICIO}-${mesStr}-28`,
        },
      )
    }

    if (incluirEstornado) {
      // Adiciona lançamentos estornados de grande monta para assegurar que nenhum motor os considere
      lancamentos.push(
        {
          id: 'lanc-estornado-rec',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          user: 'u-teste',
          empresa: EMPRESA_ID,
          plano_conta: 'pc-rec',
          conta: 'c-rec-op',
          data: `${ANO_EXERCICIO}-06-15`,
          valor: 500_000,
          estornado: true,
          created: `${ANO_EXERCICIO}-06-15`,
        },
        {
          id: 'lanc-estornado-desp',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          user: 'u-teste',
          empresa: EMPRESA_ID,
          plano_conta: 'pc-fix',
          conta: 'c-desp-fix',
          data: `${ANO_EXERCICIO}-06-20`,
          valor: 200_000,
          estornado: true,
          created: `${ANO_EXERCICIO}-06-20`,
        },
      )
    }

    return lancamentos
  }

  /**
   * Caminho A: Fluxo do Dashboard BI (src/pages/DashboardBi.tsx)
   *
   * 1. Consolida os 12 meses via `calcularAnaliseRentabilidade(lancamentos, contas, meses, planoContas)`
   * 2. Monta o DRE Record sintético anual:
   *    - receita_bruta: rent.faturamentoTotal
   *    - custo_mercadorias: rent.despesasVariaveisTotal
   *    - despesas_operacionais: rent.despesasFixasTotal
   *    - despesas_financeiras: rent.despesasFinanceirasTotal
   *    - outras_receitas_despesas: rent.receitasFinanceirasTotal
   * 3. Aplica `calcularDre(dAtual)` para extrair EBITDA e indicadores anuais
   * 4. Também apura a soma da série mensal (item.ebitda = item.lucroApurado + item.despesasFinanceiras)
   */
  function calcularFluxoDashboardBi(lancamentos: LancamentoRecord[]) {
    // 1. Motor de rentabilidade com 12 meses de 2026
    const rent = calcularAnaliseRentabilidade(
      lancamentos,
      contasSinteticas,
      meses2026,
      planoContasSintetico,
    )

    // 2. DRE sintético anual montado pelo Dashboard BI (criarDreSintetico)
    const dreSinteticoAnual: DreRecord = {
      id: `sintetico-${ANO_EXERCICIO}-${EMPRESA_ID}`,
      collectionId: 'dres',
      collectionName: 'dres',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      empresa: EMPRESA_ID,
      ano: ANO_EXERCICIO,
      mes: 12,
      receita_bruta: rent.faturamentoTotal,
      deducoes_receita: 0,
      custo_mercadorias: rent.despesasVariaveisTotal,
      despesas_operacionais: rent.despesasFixasTotal,
      despesas_financeiras: rent.despesasFinanceirasTotal,
      outras_receitas_despesas: rent.receitasFinanceirasTotal,
      imposto_renda: 0,
    }

    // 3. Resultado pelo motor contábil padrão de DRE
    const calcDreConsolidado = calcularDre(dreSinteticoAnual)

    // 4. Soma dos 12 meses da série mensal do Dashboard BI
    const serieMensalBi = rent.itensPorMes.map((item) => ({
      faturamento: item.faturamento,
      lucroBruto: item.faturamento - item.despesasVariaveis,
      resultadoOperacional: item.faturamento - item.despesasVariaveis - item.despesasFixas,
      lucroLiquido: item.lucroApurado,
      // Fórmula da série mensal no Dashboard BI: item.lucroApurado + item.despesasFinanceiras
      ebitda: item.lucroApurado + item.despesasFinanceiras,
    }))

    const ebitdaSerieMensalBi = serieMensalBi.reduce((acc, m) => acc + m.ebitda, 0)

    return {
      faturamento: rent.faturamentoTotal,
      custosVariaveis: rent.despesasVariaveisTotal,
      lucroBruto: calcDreConsolidado.lucroBruto,
      despesasFixas: rent.despesasFixasTotal,
      resultadoOperacional: calcDreConsolidado.resultadoOperacional,
      despesasFinanceiras: rent.despesasFinanceirasTotal,
      receitasFinanceiras: rent.receitasFinanceirasTotal,
      lucroLiquido: calcDreConsolidado.lucroLiquido,
      ebitda: calcDreConsolidado.ebitda,
      ebitdaSerieMensal: ebitdaSerieMensalBi,
      rent,
    }
  }

  /**
   * Caminho B: Fluxo da DRE Gerencial (src/pages/DreGerencial.tsx)
   *
   * 1. Executa `calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas)`
   * 2. Extrai os grupos consolidados do exercício (Receita, Despesa Variável, Despesa Fixa, etc.)
   * 3. Lucro Líquido = Receita - Despesa Variável - Despesa Fixa - Despesa Financeira + Receita Financeira
   * 4. EBITDA gerencial padrão = Lucro Operacional (Receita - DespVar - DespFix) + Depreciação (0) + RecFin
   *    ou via DRE oficial: Lucro Líquido + IR(0) + Despesas Financeiras
   */
  function calcularFluxoDreGerencial(lancamentos: LancamentoRecord[]) {
    const matrizDre = calcularDreGerencialMatriz(
      lancamentos,
      contasSinteticas,
      meses2026,
      planoContasSintetico,
    )

    const grupoReceita = matrizDre.grupos.find((g) => g.classificacao === 'Receita')
    const grupoDespVar = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Variável')
    const grupoDespFix = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Fixa')
    const grupoDespFin = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Financeira')
    const grupoRecFin = matrizDre.grupos.find((g) => g.classificacao === 'Receita Financeira')

    const faturamentoTotal = grupoReceita?.totalPeriodo || 0
    const despesasVariaveisTotal = grupoDespVar?.totalPeriodo || 0
    const despesasFixasTotal = grupoDespFix?.totalPeriodo || 0
    const despesasFinanceirasTotal = grupoDespFin?.totalPeriodo || 0
    const receitasFinanceirasTotal = grupoRecFin?.totalPeriodo || 0

    const lucroBruto = faturamentoTotal - despesasVariaveisTotal
    const resultadoOperacional = lucroBruto - despesasFixasTotal
    const lucroLiquido = matrizDre.lucroPrejuizo.totalPeriodo

    // Definição contábil do sistema para EBITDA a partir do resultado gerencial:
    // Lucro Líquido + Imposto de Renda (0) + Despesas Financeiras
    // que equivale a: Resultado Operacional + Receitas Financeiras (ou LAJIDA operacional puro)
    const ebitda = lucroLiquido + despesasFinanceirasTotal

    // Soma mês a mês apurada diretamente das colunas da matriz
    const ebitdaMesAMes = meses2026.reduce((acc, m) => {
      const rec = grupoReceita?.valoresPorMes[m.chave] || 0
      const dVar = grupoDespVar?.valoresPorMes[m.chave] || 0
      const dFix = grupoDespFix?.valoresPorMes[m.chave] || 0
      const dFin = grupoDespFin?.valoresPorMes[m.chave] || 0
      const rFin = grupoRecFin?.valoresPorMes[m.chave] || 0
      const llMes = rec - dVar - dFix - dFin + rFin
      const ebitdaMes = llMes + dFin
      return acc + ebitdaMes
    }, 0)

    return {
      faturamento: faturamentoTotal,
      custosVariaveis: despesasVariaveisTotal,
      lucroBruto,
      despesasFixas: despesasFixasTotal,
      resultadoOperacional,
      despesasFinanceiras: despesasFinanceirasTotal,
      receitasFinanceiras: receitasFinanceirasTotal,
      lucroLiquido,
      ebitda,
      ebitdaMesAMes,
      matrizDre,
    }
  }

  it('deve garantir paridade EXATA de EBITDA (LAJIDA) entre Dashboard BI e DRE Gerencial para 2026', () => {
    const lancamentos = gerarLancamentosExercicio2026(false)

    const resultadoBi = calcularFluxoDashboardBi(lancamentos)
    const resultadoDre = calcularFluxoDreGerencial(lancamentos)

    // Verificação de paridade estrita do EBITDA (LAJIDA)
    if (resultadoBi.ebitda !== resultadoDre.ebitda) {
      throw new Error(
        `Divergência detectada no EBITDA 2026! Dashboard BI: ${resultadoBi.ebitda} vs DRE Gerencial: ${resultadoDre.ebitda}`,
      )
    }
    expect(resultadoBi.ebitda).toBe(resultadoDre.ebitda)

    // Paridade da série mensal consolidada do BI vs DRE Gerencial
    if (resultadoBi.ebitdaSerieMensal !== resultadoDre.ebitdaMesAMes) {
      throw new Error(
        `Divergência na série mensal de EBITDA! Dashboard BI: ${resultadoBi.ebitdaSerieMensal} vs DRE Gerencial: ${resultadoDre.ebitdaMesAMes}`,
      )
    }
    expect(resultadoBi.ebitdaSerieMensal).toBe(resultadoDre.ebitdaMesAMes)
    expect(resultadoBi.ebitda).toBe(resultadoBi.ebitdaSerieMensal)
  })

  it('deve garantir paridade EXATA em faturamento, margem bruta, resultado operacional e lucro líquido', () => {
    const lancamentos = gerarLancamentosExercicio2026(false)

    const resultadoBi = calcularFluxoDashboardBi(lancamentos)
    const resultadoDre = calcularFluxoDreGerencial(lancamentos)

    // Faturamento (Receita Bruta)
    if (resultadoBi.faturamento !== resultadoDre.faturamento) {
      throw new Error(
        `Divergência no Faturamento 2026! Dashboard BI: ${resultadoBi.faturamento} vs DRE Gerencial: ${resultadoDre.faturamento}`,
      )
    }
    expect(resultadoBi.faturamento).toBe(resultadoDre.faturamento)
    expect(resultadoBi.faturamento).toBeGreaterThan(0)

    // Lucro Bruto (Receitas - Despesas Variáveis / CMV)
    if (resultadoBi.lucroBruto !== resultadoDre.lucroBruto) {
      throw new Error(
        `Divergência no Lucro Bruto 2026! Dashboard BI: ${resultadoBi.lucroBruto} vs DRE Gerencial: ${resultadoDre.lucroBruto}`,
      )
    }
    expect(resultadoBi.lucroBruto).toBe(resultadoDre.lucroBruto)

    // Margem Bruta (%)
    const margemBrutaBi = (resultadoBi.lucroBruto / resultadoBi.faturamento) * 100
    const margemBrutaDre = (resultadoDre.lucroBruto / resultadoDre.faturamento) * 100
    expect(margemBrutaBi).toBeCloseTo(margemBrutaDre, 6)
    expect(resultadoBi.rent.margemBrutaTotal).toBeCloseTo(margemBrutaDre, 6)

    // Resultado Operacional (Lucro Bruto - Despesas Fixas)
    if (resultadoBi.resultadoOperacional !== resultadoDre.resultadoOperacional) {
      throw new Error(
        `Divergência no Resultado Operacional 2026! Dashboard BI: ${resultadoBi.resultadoOperacional} vs DRE Gerencial: ${resultadoDre.resultadoOperacional}`,
      )
    }
    expect(resultadoBi.resultadoOperacional).toBe(resultadoDre.resultadoOperacional)

    // Lucro Líquido Final
    if (resultadoBi.lucroLiquido !== resultadoDre.lucroLiquido) {
      throw new Error(
        `Divergência no Lucro Líquido 2026! Dashboard BI: ${resultadoBi.lucroLiquido} vs DRE Gerencial: ${resultadoDre.lucroLiquido}`,
      )
    }
    expect(resultadoBi.lucroLiquido).toBe(resultadoDre.lucroLiquido)
  })

  it('deve excluir lançamentos estornados (estornado = true) com paridade absoluta nos dois caminhos', () => {
    const lancamentosSemEstorno = gerarLancamentosExercicio2026(false)
    const lancamentosComEstorno = gerarLancamentosExercicio2026(true)

    // Caminho Dashboard BI
    const biSemEstorno = calcularFluxoDashboardBi(lancamentosSemEstorno)
    const biComEstorno = calcularFluxoDashboardBi(lancamentosComEstorno)

    // Caminho DRE Gerencial
    const dreSemEstorno = calcularFluxoDreGerencial(lancamentosSemEstorno)
    const dreComEstorno = calcularFluxoDreGerencial(lancamentosComEstorno)

    // Comprova que os lançamentos estornados foram completamente ignorados em ambos
    expect(biComEstorno.ebitda).toBe(biSemEstorno.ebitda)
    expect(dreComEstorno.ebitda).toBe(dreSemEstorno.ebitda)

    expect(biComEstorno.faturamento).toBe(biSemEstorno.faturamento)
    expect(dreComEstorno.faturamento).toBe(dreSemEstorno.faturamento)

    expect(biComEstorno.despesasFixas).toBe(biSemEstorno.despesasFixas)
    expect(dreComEstorno.despesasFixas).toBe(dreSemEstorno.despesasFixas)

    // E os dois caminhos continuam perfeitamente iguais entre si
    if (biComEstorno.ebitda !== dreComEstorno.ebitda) {
      throw new Error(
        `Divergência de EBITDA no cenário com estornos! Dashboard BI: ${biComEstorno.ebitda} vs DRE Gerencial: ${dreComEstorno.ebitda}`,
      )
    }
    expect(biComEstorno.ebitda).toBe(dreComEstorno.ebitda)
    expect(biComEstorno.lucroLiquido).toBe(dreComEstorno.lucroLiquido)
    expect(biComEstorno.resultadoOperacional).toBe(dreComEstorno.resultadoOperacional)
  })

  it('comprova consistência matemática dos valores conhecidos sintetizados para 2026', () => {
    const lancamentos = gerarLancamentosExercicio2026(false)
    const bi = calcularFluxoDashboardBi(lancamentos)

    // Verificação dos valores totais conhecidos dos 12 meses:
    // Receitas: sum(100k + mes * 10k) para mes 1..12 = 1.200.000 + 10.000 * 78 = 1.980.000
    expect(bi.faturamento).toBe(1_980_000)

    // Custos Variáveis: sum(30k + mes * 3k) = 360.000 + 3.000 * 78 = 594.000
    expect(bi.custosVariaveis).toBe(594_000)

    // Lucro Bruto = 1.980.000 - 594.000 = 1.386.000
    expect(bi.lucroBruto).toBe(1_386_000)

    // Despesas Fixas: 12 * 40k = 480.000
    expect(bi.despesasFixas).toBe(480_000)

    // Resultado Operacional = 1.386.000 - 480.000 = 906.000
    expect(bi.resultadoOperacional).toBe(906_000)

    // Despesas Financeiras: sum(5k + mes * 500) = 60.000 + 500 * 78 = 99.000
    expect(bi.despesasFinanceiras).toBe(99_000)

    // Receitas Financeiras: 12 * 2k = 24.000
    expect(bi.receitasFinanceiras).toBe(24_000)

    // Lucro Líquido = 906.000 - 99.000 + 24.000 = 831.000
    expect(bi.lucroLiquido).toBe(831_000)

    // EBITDA = Lucro Líquido + IR(0) + Despesas Financeiras = 831.000 + 99.000 = 930.000
    expect(bi.ebitda).toBe(930_000)
    expect(bi.ebitdaSerieMensal).toBe(930_000)
  })
})
