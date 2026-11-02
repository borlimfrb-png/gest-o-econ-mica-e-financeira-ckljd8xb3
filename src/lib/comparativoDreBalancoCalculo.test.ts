import { describe, it, expect } from 'vitest'
import {
  extrairSomaBalanco,
  selecionarMelhorBalancoMes,
  consolidarBalancosGrupoMes,
  calcularComparativoMensalDreBalanco,
} from './comparativoDreBalancoCalculo'
import type {
  BalancoRecord,
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
} from '@/types/finance'

describe('Motor de Cálculo Comparativo DRE x Balanço Mensal', () => {
  const criarConta = (
    id: string,
    nome: string,
    codigo: string,
    tipo: 'Receita' | 'Despesa',
    grupo: string,
  ): ContaRecord => ({
    id,
    collectionId: 'contas',
    collectionName: 'contas',
    created: '',
    updated: '',
    nome,
    codigo,
    tipo,
    grupo,
    empresa: 'emp-1',
    ativo: true,
    user: 'u-1',
  })

  const criarPlano = (
    id: string,
    nome: string,
    codigo: string,
    tipo_dre: string,
  ): PlanoContaRecord => ({
    id,
    collectionId: 'plano_contas',
    collectionName: 'plano_contas',
    created: '',
    updated: '',
    codigo,
    nome,
    natureza: 'credora',
    nivel: 3,
    ativo: true,
    tipo_dre,
    empresa: 'emp-1',
    conta: '',
    centro: '',
    user: 'u-1',
  })

  const criarLancamento = (
    id: string,
    empresa: string,
    data: string,
    valor: number,
    tipo: 'entrada' | 'saida',
    conta: string,
    plano_conta: string,
  ): LancamentoRecord => ({
    id,
    collectionId: 'lancamentos',
    collectionName: 'lancamentos',
    created: '',
    updated: '',
    user: 'u-1',
    empresa,
    data,
    valor,
    tipo,
    conta,
    plano_conta,
  })

  const criarBalanco = (
    id: string,
    empresa: string,
    ano: number,
    mes: number,
    valores: Partial<BalancoRecord> = {},
  ): BalancoRecord => ({
    id,
    collectionId: 'balancos',
    collectionName: 'balancos',
    created: '',
    updated: '',
    empresa,
    ano,
    mes,
    fechado: true,
    caixa_equivalentes: 0,
    aplicacoes_financeiras: 0,
    contas_receber: 0,
    estoques: 0,
    impostos_recuperar: 0,
    outros_ativo_circulante: 0,
    realizavel_longo_prazo: 0,
    investimentos: 0,
    imobilizado: 0,
    intangivel: 0,
    fornecedores: 0,
    emprestimos_curto_prazo: 0,
    obrigacoes_trabalhistas: 0,
    obrigacoes_tributarias: 0,
    outros_passivo_circulante: 0,
    emprestimos_longo_prazo: 0,
    outras_obrigacoes_longo_prazo: 0,
    capital_social: 0,
    reservas_lucros: 0,
    lucros_acumulados: 0,
    ...valores,
  })

  const contasMock: ContaRecord[] = [
    criarConta('c-rec', 'Venda de Mercadorias', '3.1.01', 'Receita', 'Receita Bruta'),
    criarConta('c-custo', 'Comissões de Venda', '4.1.01', 'Despesa', 'Despesas Variáveis'),
    criarConta('c-fixa', 'Salários Administrativos', '4.2.01', 'Despesa', 'Despesas Fixas'),
    criarConta('c-fin', 'Juros Bancários', '4.3.01', 'Despesa', 'Despesas Financeiras'),
  ]

  const planosMock: PlanoContaRecord[] = [
    criarPlano('pc-rec', 'Receita de Vendas', '3.1.01', 'Receita'),
    criarPlano('pc-custo', 'Comissões e Fretes', '4.1.01', 'Despesa Variável'),
    criarPlano('pc-fixa', 'Despesas Administrativas', '4.2.01', 'Despesa Fixa'),
    criarPlano('pc-fin', 'Despesas Financeiras', '4.3.01', 'Despesa Financeira'),
  ]

  describe('extrairSomaBalanco e selecionarMelhorBalancoMes', () => {
    it('retorna 0 para balanço nulo ou vazio', () => {
      expect(extrairSomaBalanco(null)).toBe(0)
      expect(extrairSomaBalanco(undefined)).toBe(0)
    })

    it('soma corretamente as rubricas patrimoniais reais', () => {
      const b = criarBalanco('b-teste', 'emp-1', 2024, 1, {
        caixa_equivalentes: 50000,
        contas_receber: 80000,
        estoques: 30000,
        imobilizado: 100000,
        fornecedores: 40000,
        patrimonio_liquido: 0,
        lucros_acumulados: 120000,
      })
      expect(extrairSomaBalanco(b)).toBe(50000 + 80000 + 30000 + 100000 + 40000 + 120000)
    })

    it('seleciona o balanço com dados preenchidos quando houver registro zerado e registro preenchido no mesmo mês', () => {
      const zerado = criarBalanco('b-zerado', 'emp-1', 2024, 3, {
        caixa_equivalentes: 0,
        contas_receber: 0,
        estoques: 0,
        imobilizado: 0,
        fornecedores: 0,
        lucros_acumulados: 0,
      })

      const preenchido = criarBalanco('b-preenchido', 'emp-1', 2024, 3, {
        caixa_equivalentes: 100000,
        contas_receber: 250000,
        estoques: 150000,
        imobilizado: 400000,
        fornecedores: 180000,
        lucros_acumulados: 600000,
      })

      const melhor = selecionarMelhorBalancoMes([zerado, preenchido], 2024, 3)
      expect(melhor?.id).toBe('b-preenchido')
      expect(melhor?.caixa_equivalentes).toBe(100000)
    })
  })

  describe('consolidarBalancosGrupoMes', () => {
    it('consolida balanços de todas as empresas-membro do grupo para o mês', () => {
      const bEmp1 = criarBalanco('b-emp1', 'emp-1', 2024, 5, {
        caixa_equivalentes: 40000,
        contas_receber: 60000,
        estoques: 30000,
        imobilizado: 100000,
        fornecedores: 50000,
        capital_social: 100000,
        lucros_acumulados: 80000,
      })

      const bEmp2 = criarBalanco('b-emp2', 'emp-2', 2024, 5, {
        caixa_equivalentes: 70000,
        contas_receber: 90000,
        estoques: 50000,
        imobilizado: 200000,
        fornecedores: 80000,
        capital_social: 150000,
        lucros_acumulados: 180000,
      })

      const consolidado = consolidarBalancosGrupoMes([bEmp1, bEmp2], ['emp-1', 'emp-2'], 2024, 5)
      expect(consolidado).not.toBeNull()
      expect(consolidado?.caixa_equivalentes).toBe(110000)
      expect(consolidado?.contas_receber).toBe(150000)
      expect(consolidado?.estoques).toBe(80000)
      expect(consolidado?.imobilizado).toBe(300000)
      expect(consolidado?.fornecedores).toBe(130000)
      expect(consolidado?.capital_social).toBe(250000)
      expect(consolidado?.lucros_acumulados).toBe(260000)
    })

    it('retorna null quando nenhuma empresa tem balanço com dados no mês', () => {
      const res = consolidarBalancosGrupoMes([], ['emp-1', 'emp-2'], 2024, 5)
      expect(res).toBeNull()
    })
  })

  describe('calcularComparativoMensalDreBalanco — Emparelhamento e Indicadores', () => {
    it('calcula a DRE pelo mesmo motor da DRE Gerencial (calcularDreGerencialMatriz)', () => {
      // 12 meses de lançamentos para certificar equivalência matemática
      const lancamentos: LancamentoRecord[] = [
        criarLancamento('l1', 'emp-1', '2024-01-10', 100000, 'entrada', 'c-rec', 'pc-rec'),
        criarLancamento('l2', 'emp-1', '2024-01-15', 20000, 'saida', 'c-custo', 'pc-custo'),
        criarLancamento('l3', 'emp-1', '2024-01-20', 30000, 'saida', 'c-fixa', 'pc-fixa'),
        criarLancamento('l4', 'emp-1', '2024-06-05', 200000, 'entrada', 'c-rec', 'pc-rec'),
        criarLancamento('l5', 'emp-1', '2024-06-10', 40000, 'saida', 'c-custo', 'pc-custo'),
      ]

      const res = calcularComparativoMensalDreBalanco({
        ano: 2024,
        lancamentos,
        contas: contasMock,
        planoContas: planosMock,
        balancos: [],
        empresaNome: 'Empresa Teste',
      })

      // Jan: Rec 100k, CustosVar 20k, DespFix 30k => Lucro 50k
      expect(res.meses[0].receitaBruta).toBe(100000)
      expect(res.meses[0].custosVariaveis).toBe(20000)
      expect(res.meses[0].despesasFixas).toBe(30000)
      expect(res.meses[0].resultadoLiquido).toBe(50000)

      // Jun: Rec 200k, CustosVar 40k => Lucro 160k
      expect(res.meses[5].receitaBruta).toBe(200000)
      expect(res.meses[5].custosVariaveis).toBe(40000)
      expect(res.meses[5].resultadoLiquido).toBe(160000)

      // Total Exercicio
      expect(res.totalExercicio.receitaBruta).toBe(300000)
      expect(res.totalExercicio.custosVariaveis).toBe(60000)
      expect(res.totalExercicio.despesasFixas).toBe(30000)
      expect(res.totalExercicio.resultadoLiquido).toBe(210000)
    })

    it('emparelha os 12 meses de DRE e Balanço com totalizadores corretos', () => {
      const lancamentos: LancamentoRecord[] = [
        // Janeiro 2024: Venda 100.000, Var 20.000, Fixa 30.000, Fin 5.000 => Lucro 45.000
        criarLancamento('l1', 'emp-1', '2024-01-15', 100000, 'entrada', 'c-rec', 'pc-rec'),
        criarLancamento('l2', 'emp-1', '2024-01-20', 20000, 'saida', 'c-custo', 'pc-custo'),
        criarLancamento('l3', 'emp-1', '2024-01-25', 30000, 'saida', 'c-fixa', 'pc-fixa'),
        criarLancamento('l4', 'emp-1', '2024-01-28', 5000, 'saida', 'c-fin', 'pc-fin'),
        // Fevereiro 2024: Venda 150.000, Var 30.000, Fixa 30.000 => Lucro 90.000
        criarLancamento('l5', 'emp-1', '2024-02-10', 150000, 'entrada', 'c-rec', 'pc-rec'),
        criarLancamento('l6', 'emp-1', '2024-02-18', 30000, 'saida', 'c-custo', 'pc-custo'),
        criarLancamento('l7', 'emp-1', '2024-02-22', 30000, 'saida', 'c-fixa', 'pc-fixa'),
      ]

      const balancos: BalancoRecord[] = [
        criarBalanco('b-jan', 'emp-1', 2024, 1, {
          caixa_equivalentes: 80000,
          contas_receber: 120000,
          estoques: 50000,
          imobilizado: 200000,
          fornecedores: 100000,
          emprestimos_curto_prazo: 25000,
          capital_social: 150000,
          lucros_acumulados: 175000,
        }),
        criarBalanco('b-fev', 'emp-1', 2024, 2, {
          caixa_equivalentes: 140000,
          contas_receber: 160000,
          estoques: 60000,
          imobilizado: 200000,
          fornecedores: 110000,
          emprestimos_curto_prazo: 25000,
          capital_social: 150000,
          lucros_acumulados: 275000,
        }),
      ]

      const res = calcularComparativoMensalDreBalanco({
        ano: 2024,
        lancamentos,
        contas: contasMock,
        planoContas: planosMock,
        balancos,
        empresaNome: 'Empresa Teste',
      })

      expect(res.meses.length).toBe(12)

      // Janeiro
      const m1 = res.meses[0]
      expect(m1.receitaBruta).toBe(100000)
      expect(m1.custosVariaveis).toBe(20000)
      expect(m1.despesasFixas).toBe(30000)
      expect(m1.despesasFinanceiras).toBe(5000)
      expect(m1.resultadoLiquido).toBe(45000) // 100k - 20k - 30k - 5k = 45k
      expect(m1.margemLiquida).toBe(45) // 45%
      expect(m1.ebitda).toBe(50000) // 45k + 5k = 50k
      expect(m1.temBalanco).toBe(true)
      // AC = 80k + 120k + 50k = 250k. PC = 100k + 25k = 125k. LC = 250k / 125k = 2.0x
      expect(m1.ativoCirculante).toBe(250000)
      expect(m1.passivoCirculante).toBe(125000)
      expect(m1.liquidezCorrente).toBeCloseTo(2.0, 2)
      // PL = 150k + 175k = 325k. ROE = (45k / 325k) * 100 = 13.85%
      expect(m1.patrimonioLiquido).toBe(325000)
      expect(m1.roeMensal).toBeCloseTo((45000 / 325000) * 100, 2)

      // Fevereiro
      const m2 = res.meses[1]
      expect(m2.receitaBruta).toBe(150000)
      expect(m2.custosVariaveis).toBe(30000)
      expect(m2.despesasFixas).toBe(30000)
      expect(m2.despesasFinanceiras).toBe(0)
      expect(m2.resultadoLiquido).toBe(90000)
      expect(m2.margemLiquida).toBe(60)
      expect(m2.temBalanco).toBe(true)

      // Meses sem lançamento (ex: Março a Dezembro)
      const m3 = res.meses[2]
      expect(m3.temDados).toBe(false)
      expect(m3.receitaBruta).toBe(0)
      expect(m3.resultadoLiquido).toBe(0)
      expect(m3.liquidezCorrente).toBeNull()

      // Coluna Total do Exercício
      // DRE = soma de fluxo (Jan + Fev = 250k rec, 135k lucro)
      expect(res.totalExercicio.receitaBruta).toBe(250000)
      expect(res.totalExercicio.resultadoLiquido).toBe(135000)
      expect(res.totalExercicio.margemLiquida).toBeCloseTo(54.0, 1)

      // Balanço = último mês com balanço (Fev)
      expect(res.totalExercicio.ultimoMesComBalanco).toBe(2)
      expect(res.totalExercicio.caixaEquivalentes).toBe(140000)
      expect(res.totalExercicio.contasReceber).toBe(160000)
      expect(res.totalExercicio.patrimonioLiquido).toBe(425000)
      // ROE acumulado = 135k / 425k * 100 = 31.76%
      expect(res.totalExercicio.roeAcumulado).toBeCloseTo((135000 / 425000) * 100, 2)
    })

    it('isola os lançamentos por grupo econômico somando apenas as empresas-membro', () => {
      const lancamentos: LancamentoRecord[] = [
        criarLancamento('l-g1', 'emp-caneira-1', '2024-04-10', 80000, 'entrada', 'c-rec', 'pc-rec'),
        criarLancamento(
          'l-g2',
          'emp-caneira-2',
          '2024-04-12',
          120000,
          'entrada',
          'c-rec',
          'pc-rec',
        ),
        criarLancamento(
          'l-outra',
          'emp-fora-grupo',
          '2024-04-15',
          999999,
          'entrada',
          'c-rec',
          'pc-rec',
        ),
      ]

      const res = calcularComparativoMensalDreBalanco({
        ano: 2024,
        lancamentos,
        contas: contasMock,
        planoContas: planosMock,
        balancos: [],
        isGrupo: true,
        membrosGrupoIds: ['emp-caneira-1', 'emp-caneira-2'],
        empresaNome: 'GRUPO CANEIRA',
      })

      const m4 = res.meses[3]
      // Apenas emp-caneira-1 + emp-caneira-2 = 80k + 120k = 200k (emp-fora-grupo ignorada)
      expect(m4.receitaBruta).toBe(200000)
      expect(res.totalExercicio.receitaBruta).toBe(200000)
    })
  })
})
