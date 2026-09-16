import { describe, it, expect } from 'vitest'
import {
  calcularMensalidadesPeriodo,
  normalizarPeriodoCobranca,
  gerarParcelasDePeriodos,
  numeroPorExtenso,
} from './periodosCobranca'

describe('periodosCobranca - Regras de negócio de cobrança recorrente em faixas', () => {
  it('deve calcular corretamente o exemplo exato do usuário: Período 1 com 4 meses e Período 2 com 9 meses', () => {
    // Exemplo do usuário:
    // Período 1: 16/10/2026 a 16/01/2027 => Out/26, Nov/26, Dez/26, Jan/27 = 4 meses
    const mesesP1 = calcularMensalidadesPeriodo('2026-10-16', '2027-01-16')
    expect(mesesP1).toBe(4)

    // Período 2: 16/02/2027 a 16/10/2027 => Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out/27 = 9 meses
    const mesesP2 = calcularMensalidadesPeriodo('2027-02-16', '2027-10-16')
    expect(mesesP2).toBe(9)

    // Total de mensalidades = 13
    const totalMeses = mesesP1 + mesesP2
    expect(totalMeses).toBe(13)

    // Divergência contra 12 parcelas do contrato
    const parcelasContrato = 12
    expect(totalMeses !== parcelasContrato).toBe(true)
  })

  it('deve calcular valores e totais financeiros de cada período', () => {
    const p1 = normalizarPeriodoCobranca({
      data_inicio: '2026-10-16',
      data_final: '2027-01-16',
      valor_mensal: 1500,
      forma_pagamento: 'Pix',
    })

    expect(p1.meses).toBe(4)
    expect(p1.total).toBe(6000)

    const p2 = normalizarPeriodoCobranca({
      data_inicio: '2027-02-16',
      data_final: '2027-10-16',
      valor_mensal: 2000,
      forma_pagamento: 'Boleto Bancário',
    })

    expect(p2.meses).toBe(9)
    expect(p2.total).toBe(18000)

    const totalFinanceiro = (p1.total || 0) + (p2.total || 0)
    expect(totalFinanceiro).toBe(24000)
  })

  it('deve gerar a lista cronológica de parcelas com seus respectivos vencimentos e valores', () => {
    const periodos = [
      normalizarPeriodoCobranca({
        data_inicio: '2026-10-16',
        data_final: '2027-01-16',
        valor_mensal: 1500,
      }),
      normalizarPeriodoCobranca({
        data_inicio: '2027-02-16',
        data_final: '2027-10-16',
        valor_mensal: 2000,
      }),
    ]

    const parcelas = gerarParcelasDePeriodos(periodos, 16)
    expect(parcelas.length).toBe(13)

    // Primeira parcela
    expect(parcelas[0].parcela).toBe(1)
    expect(parcelas[0].vencimento).toBe('2026-10-16')
    expect(parcelas[0].valor).toBe(1500)

    // Quarta parcela (fim do P1)
    expect(parcelas[3].parcela).toBe(4)
    expect(parcelas[3].vencimento).toBe('2027-01-16')
    expect(parcelas[3].valor).toBe(1500)

    // Quinta parcela (início do P2)
    expect(parcelas[4].parcela).toBe(5)
    expect(parcelas[4].vencimento).toBe('2027-02-16')
    expect(parcelas[4].valor).toBe(2000)

    // Décima terceira parcela (fim do P2)
    expect(parcelas[12].parcela).toBe(13)
    expect(parcelas[12].vencimento).toBe('2027-10-16')
    expect(parcelas[12].valor).toBe(2000)
  })

  it('deve converter números para extenso adequadamente para as cláusulas jurídicas', () => {
    expect(numeroPorExtenso(4)).toBe('quatro')
    expect(numeroPorExtenso(9)).toBe('nove')
    expect(numeroPorExtenso(12)).toBe('doze')
    expect(numeroPorExtenso(13)).toBe('treze')
  })

  it('deve lidar com caso exato onde os períodos batem 100% com as parcelas', () => {
    // Caso exato: 6 meses a R$ 1.000 + 6 meses a R$ 1.500 = 12 meses
    const mesesP1 = calcularMensalidadesPeriodo('2026-01-10', '2026-06-10')
    const mesesP2 = calcularMensalidadesPeriodo('2026-07-10', '2026-12-10')
    expect(mesesP1).toBe(6)
    expect(mesesP2).toBe(6)
    expect(mesesP1 + mesesP2).toBe(12)
  })
})
