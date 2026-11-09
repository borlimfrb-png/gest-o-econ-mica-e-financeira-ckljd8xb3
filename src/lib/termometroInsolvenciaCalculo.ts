/**
 * Termômetro de Insolvência — Z-Score de Altman
 * Reutiliza os motores oficiais de Balanço e DRE (financeCalculations) sem inventar fontes paralelas.
 *
 * Modelos calculados:
 *  - Z'' (empresas privadas / não listadas): Z'' = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4
 *    Zonas: Z > 2.60 → Solvência | 1.10 ≤ Z ≤ 2.60 → Zona Cinzenta | Z < 1.10 → Insolvência
 *  - Z clássica (1968, companhias de capital aberto/indústria):
 *    Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5
 *    Zonas: Z > 2.99 → Solvência | 1.81 ≤ Z ≤ 2.99 → Zona Cinzenta | Z < 1.81 → Insolvência
 *
 * Observação de paridade: o EBIT aproximado utiliza o EBITDA oficial do sistema
 * (Lucro Líquido + IR + Despesas Financeiras) — mesma métrica exibida no Dashboard BI.
 */

import type { BalancoRecord, DreRecord } from '@/types/finance'
import { calcularBalanco, calcularDre } from './financeCalculations'

export type ZonaInsolvencia = 'solvencia' | 'cinzenta' | 'insolvencia'

export interface ComponenteZScore {
  codigo: string
  nome: string
  formula: string
  valor: number | null
  peso: number
  contribuicao: number | null
  modelo: 'privada' | 'classica'
}

export interface ZScoreResultado {
  temDados: boolean
  ativoTotal: number
  capitalGiroLiquido: number
  lucrosAcumulados: number
  ebitAproximado: number
  patrimonioLiquido: number
  passivoTotal: number
  receitaLiquida: number
  x1: number | null
  x2: number | null
  x3: number | null
  x4: number | null
  x5: number | null
  zPrivada: number | null
  zClassica: number | null
  zona: ZonaInsolvencia | null
  zonaPrivada: ZonaInsolvencia | null
  zonaClassica: ZonaInsolvencia | null
  componentesPrivada: ComponenteZScore[]
  componentesClassica: ComponenteZScore[]
}

export function zonaPorZPrivada(z: number | null): ZonaInsolvencia | null {
  if (z === null || Number.isNaN(z)) return null
  if (z > 2.6) return 'solvencia'
  if (z >= 1.1) return 'cinzenta'
  return 'insolvencia'
}

export function zonaPorZClassica(z: number | null): ZonaInsolvencia | null {
  if (z === null || Number.isNaN(z)) return null
  if (z > 2.99) return 'solvencia'
  if (z >= 1.81) return 'cinzenta'
  return 'insolvencia'
}

export const ROTULO_ZONA: Record<ZonaInsolvencia, string> = {
  solvencia: 'Zona de Solvência',
  cinzenta: 'Zona Cinzenta (Atenção)',
  insolvencia: 'Zona de Insolvência',
}

export const DESCRICAO_ZONA: Record<ZonaInsolvencia, string> = {
  solvencia:
    'A empresa apresenta baixo risco de insolvência no horizonte de análise. A estrutura patrimonial e a geração de resultados sustentam as obrigações.',
  cinzenta:
    'Zona de alerta: há sinais mistos de equilíbrio financeiro. Recomenda-se monitoramento contínuo dos fluxos de caixa, do endividamento e das margens.',
  insolvencia:
    'Alto risco de insolvência/falência nos próximos dois exercícios, segundo o modelo de Altman. Exige plano imediato de recomposição financeira.',
}

function comporComponentes(
  x1: number | null,
  x2: number | null,
  x3: number | null,
  x4: number | null,
  x5: number | null,
  modelo: 'privada' | 'classica',
): ComponenteZScore[] {
  const base: Array<Omit<ComponenteZScore, 'contribuicao'>> = [
    {
      codigo: 'X1',
      nome: 'Capital de Giro Líquido / Ativo Total',
      formula: '(Ativo Circulante − Passivo Circulante) ÷ Ativo Total',
      valor: x1,
      peso: modelo === 'privada' ? 6.56 : 1.2,
      modelo,
    },
    {
      codigo: 'X2',
      nome: 'Lucros Acumulados / Ativo Total',
      formula: '(Lucros Acumulados + Reservas de Lucros) ÷ Ativo Total',
      valor: x2,
      peso: modelo === 'privada' ? 3.26 : 1.4,
      modelo,
    },
    {
      codigo: 'X3',
      nome: 'EBIT ≈ EBITDA / Ativo Total',
      formula: 'EBITDA (motor oficial DRE/BI) ÷ Ativo Total',
      valor: x3,
      peso: modelo === 'privada' ? 6.72 : 3.3,
      modelo,
    },
    {
      codigo: 'X4',
      nome: 'Patrimônio Líquido / Passivo Total',
      formula: 'PL ÷ Passivo Total (exclui o PL)',
      valor: x4,
      peso: modelo === 'privada' ? 1.05 : 0.6,
      modelo,
    },
  ]

  if (modelo === 'classica') {
    base.push({
      codigo: 'X5',
      nome: 'Receita Líquida / Ativo Total',
      formula: 'Receita Líquida ÷ Ativo Total (giro do ativo)',
      valor: x5,
      peso: 1.0,
      modelo,
    })
  }

  return base.map((c) => ({
    ...c,
    contribuicao: c.valor !== null ? c.valor * c.peso : null,
  }))
}

export function calcularZScoreAltman(
  balanco: Partial<BalancoRecord> | null,
  dre: Partial<DreRecord> | null,
): ZScoreResultado {
  const calcB = calcularBalanco(balanco)
  const calcD = calcularDre(dre)

  const ativoTotal = calcB.ativoTotal
  const capitalGiroLiquido = calcB.ativoCirculante - calcB.passivoCirculante
  const lucrosAcumulados = (balanco?.lucros_acumulados || 0) + (balanco?.reservas_lucros || 0)
  const ebitAproximado = calcD.ebitda
  const patrimonioLiquido = calcB.patrimonioLiquido
  const passivoTotal = calcB.passivoTotal
  const receitaLiquida = calcD.receitaLiquida

  const temDados = ativoTotal > 0

  const seguro = (num: number, den: number): number | null => (den > 0 ? num / den : null)

  const x1 = seguro(capitalGiroLiquido, ativoTotal)
  const x2 = seguro(lucrosAcumulados, ativoTotal)
  const x3 = seguro(ebitAproximado, ativoTotal)
  const x4 = seguro(patrimonioLiquido, passivoTotal)
  const x5 = seguro(receitaLiquida, ativoTotal)

  const zPrivada =
    x1 !== null && x2 !== null && x3 !== null && x4 !== null
      ? 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4
      : null
  const zClassica =
    x1 !== null && x2 !== null && x3 !== null && x4 !== null && x5 !== null
      ? 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
      : null

  const zonaPrivada = zonaPorZPrivada(zPrivada)
  const zonaClassica = zonaPorZClassica(zClassica)

  return {
    temDados,
    ativoTotal,
    capitalGiroLiquido,
    lucrosAcumulados,
    ebitAproximado,
    patrimonioLiquido,
    passivoTotal,
    receitaLiquida,
    x1,
    x2,
    x3,
    x4,
    x5,
    zPrivada,
    zClassica,
    zona: zonaPrivada,
    zonaPrivada,
    zonaClassica,
    componentesPrivada: comporComponentes(x1, x2, x3, x4, x5, 'privada'),
    componentesClassica: comporComponentes(x1, x2, x3, x4, x5, 'classica'),
  }
}
