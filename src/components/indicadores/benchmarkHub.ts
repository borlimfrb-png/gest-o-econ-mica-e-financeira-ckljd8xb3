import type { BenchmarkSetorialRecord, SegmentoEmpresa } from '@/types/finance'
import { BENCHMARKS_SETORIAIS, type BenchmarkSetorValores } from '@/lib/benchmarks'
import { benchmarksService } from '@/services/benchmarksService'

/**
 * Referência de mercado unificada usada pelos comparativos do HUB.
 * Sempre resolve: benchmark setorial do banco → fallback padrão do setor →
 * fallback padrão Indústria (nunca zero enganoso).
 */
export interface ReferenciaMercado {
  /** Rótulo da referência usada (ex.: "Indústria" ou "Indústria (padrão)") */
  rotuloSetor: string
  /** true quando a referência veio do fallback padrão (sem benchmark cadastrado para o setor) */
  usarFallback: boolean
  roe: number
  margemBruta: number
  margemOperacional: number
  margemLiquida: number
  margemEbitda: number
  liquidezCorrente: number
  endividamentoGeral: number
  // Métricas avançadas (tela /indicadores/apresentacao):
  coberturaJuros: number // x
  pme: number // dias
  pmr: number // dias
  pmp: number // dias
  cicloFinanceiro: number // dias (CCC)
  giroAtivo: number // x (DuPont)
  wacc: number // % (custo de capital do EVA)
}

function normalizar(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function paraReferencia(
  valores: Partial<BenchmarkSetorValores>,
  rotuloSetor: string,
  usarFallback: boolean,
): ReferenciaMercado {
  const padrao = BENCHMARKS_SETORIAIS['Indústria']
  return {
    rotuloSetor,
    usarFallback,
    roe: normalizar(valores.roe, padrao.roe),
    margemBruta: normalizar(valores.margemBruta, padrao.margemBruta),
    margemOperacional: normalizar(valores.margemOperacional, padrao.margemOperacional),
    margemLiquida: normalizar(valores.margemLiquida, padrao.margemLiquida),
    margemEbitda: normalizar(valores.margemEbitda, padrao.margemEbitda),
    liquidezCorrente: normalizar(valores.liquidezCorrente, padrao.liquidezCorrente),
    endividamentoGeral: normalizar(valores.endividamentoGeral, padrao.endividamentoGeral),
    // Métricas avançadas: mesmos fallbacks Indústria
    coberturaJuros: normalizar(valores.coberturaJuros, padrao.coberturaJuros),
    pme: normalizar(valores.pme, padrao.pme),
    pmr: normalizar(valores.pmr, padrao.pmr),
    pmp: normalizar(valores.pmp, padrao.pmp),
    cicloFinanceiro: normalizar(valores.cicloFinanceiro, padrao.cicloFinanceiro),
    giroAtivo: normalizar(valores.giroAtivo, padrao.giroAtivo),
    wacc: normalizar(valores.wacc, padrao.wacc),
  }
}

function doRecord(rec: BenchmarkSetorialRecord): ReferenciaMercado {
  return paraReferencia(rec, rec.setor || 'Indústria', false)
}

function doPadrao(setor: string): ReferenciaMercado {
  const padraoSetor = BENCHMARKS_SETORIAIS[setor]
  if (padraoSetor) {
    return paraReferencia(padraoSetor, setor, true)
  }
  return paraReferencia(BENCHMARKS_SETORIAIS['Indústria'], 'Indústria', true)
}

/**
 * Resolve a referência de mercado para o segmento da empresa ativa.
 * Ordem: registro no banco (benchmarks_setoriais) → BENCHMARKS_SETORIAIS[setor] →
 * padrão Indústria. É async porque consulta o PocketBase.
 */
export async function resolverReferenciaMercado(
  segmento: string | null | undefined,
  empresaId?: string | null,
): Promise<ReferenciaMercado> {
  const setor = (segmento || 'Indústria') as SegmentoEmpresa

  try {
    const rec = await benchmarksService.getBySetor(setor, empresaId || undefined)
    if (rec) return doRecord(rec)
  } catch {
    // segue para fallback
  }

  return doPadrao(setor)
}

/** Badge visual "Acima/Abaixo do mercado" com cor invertida para endividamento. */
export function avaliarVersusMercado(
  valorEmpresa: number | null | undefined,
  valorMercado: number,
  inverteCor: boolean,
): { acima: boolean | null; rotulo: string; classes: string } {
  if (valorEmpresa === null || valorEmpresa === undefined || !Number.isFinite(valorEmpresa)) {
    return {
      acima: null,
      rotulo: 'Sem dados',
      classes:
        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    }
  }
  const delta = valorEmpresa - valorMercado
  const acima = Math.abs(delta) < 1e-9 ? null : inverteCor ? delta < 0 : delta > 0
  if (acima === null) {
    return {
      acima: null,
      rotulo: 'Na média',
      classes:
        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    }
  }
  return acima
    ? {
        acima: true,
        rotulo: 'Acima do mercado',
        classes:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      }
    : {
        acima: false,
        rotulo: 'Abaixo do mercado',
        classes:
          'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
      }
}
