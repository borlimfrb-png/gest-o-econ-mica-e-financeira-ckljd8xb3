import { describe, it, expect } from 'vitest'
import { valuationHistoricoService } from './valuationHistoricoService'
import type { ValuationHistoricoRecord } from '@/types/finance'

describe('valuationHistoricoService', () => {
  it('deve calcular CAGR corretamente para serie com crescimento', () => {
    // Série hipotética: ano 2021 = 1.000.000, ano 2024 = 1.331.000 (10% a.a. por 3 anos)
    const serie = [
      {
        ano: 2021,
        valorFcd: 1000000,
        valorSuperlucro: 1000000,
        valorMultiplos: 1000000,
        consenso: 1000000,
        minimo: 1000000,
        maximo: 1000000,
        metodosContados: 3,
        origem: 'snapshot' as const,
      },
      {
        ano: 2024,
        valorFcd: 1331000,
        valorSuperlucro: 1331000,
        valorMultiplos: 1331000,
        consenso: 1331000,
        minimo: 1331000,
        maximo: 1331000,
        metodosContados: 3,
        origem: 'snapshot' as const,
      },
    ]

    const cagr = valuationHistoricoService.calcularCagr(serie)
    expect(cagr).not.toBeNull()
    expect(cagr!).toBeCloseTo(10, 1)
  })

  it('deve retornar null no CAGR com menos de 2 anos ou valor <= 0', () => {
    expect(valuationHistoricoService.calcularCagr([])).toBeNull()
    expect(
      valuationHistoricoService.calcularCagr([
        {
          ano: 2023,
          valorFcd: 500000,
          valorSuperlucro: null,
          valorMultiplos: null,
          consenso: 500000,
          minimo: 500000,
          maximo: 500000,
          metodosContados: 1,
          origem: 'snapshot' as const,
        },
      ]),
    ).toBeNull()
  })

  it('deve consolidar serie historica calculando consenso, min, max e variacao percentual', () => {
    const registrosDb: ValuationHistoricoRecord[] = [
      {
        id: 'rec_1',
        collectionId: 'col_hist',
        collectionName: 'valuation_historico',
        created: '2023-01-01',
        updated: '2023-01-01',
        empresa: 'emp_1',
        ano: 2022,
        metodologia: 'fcd',
        valor: 1000000,
      },
      {
        id: 'rec_2',
        collectionId: 'col_hist',
        collectionName: 'valuation_historico',
        created: '2023-01-01',
        updated: '2023-01-01',
        empresa: 'emp_1',
        ano: 2022,
        metodologia: 'superlucro',
        valor: 1200000,
      },
      {
        id: 'rec_3',
        collectionId: 'col_hist',
        collectionName: 'valuation_historico',
        created: '2023-01-01',
        updated: '2023-01-01',
        empresa: 'emp_1',
        ano: 2023,
        metodologia: 'fcd',
        valor: 1500000,
      },
    ]

    const serie = valuationHistoricoService.consolidarSerieHistorica(
      registrosDb,
      [2022, 2023],
      () => ({
        valorFcd: null,
        valorSuperlucro: null,
        valorMultiplos: null,
      }),
    )

    expect(serie.length).toBe(2)

    // Ano 2022: fcd 1.000.000, superlucro 1.200.000 -> média 1.100.000, min 1.000.000, max 1.200.000
    const p2022 = serie[0]
    expect(p2022.ano).toBe(2022)
    expect(p2022.consenso).toBe(1100000)
    expect(p2022.minimo).toBe(1000000)
    expect(p2022.maximo).toBe(1200000)
    expect(p2022.variacaoPercentualVsAnterior).toBeNull()

    // Ano 2023: fcd 1.500.000 -> consenso 1.500.000 -> variacao vs 2022 = (1.500.000 - 1.100.000) / 1.100.000 * 100 = ~36.36%
    const p2023 = serie[1]
    expect(p2023.ano).toBe(2023)
    expect(p2023.consenso).toBe(1500000)
    expect(p2023.variacaoPercentualVsAnterior).toBeCloseTo(36.36, 1)
  })
})
