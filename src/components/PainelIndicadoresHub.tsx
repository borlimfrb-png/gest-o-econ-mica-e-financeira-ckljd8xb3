import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Gauge,
  LineChart as LineChartIcon,
  Info,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HodometroGauge, type ZonaHodometro } from '@/components/HodometroGauge'
import { calcularRegressaoLinear } from '@/lib/regressaoLinearTendencia'
import { formatBrlMil, formatPercent } from '@/lib/financeCalculations'
import type {
  BalancoRecord,
  DreRecord,
  LancamentoRecord,
  ContaRecord,
  PlanoContaRecord,
} from '@/types/finance'
import {
  consolidarBalancoAnual,
  consolidarDreAnual,
  calcularDre,
  calcularBalanco,
} from '@/lib/financeCalculations'
import { calcularZScoreAltman } from '@/lib/termometroInsolvenciaCalculo'
import { calcularAnaliseFaturamento } from '@/lib/analiseFaturamentoCalculo'

export interface PainelIndicadoresHubProps {
  empresaId: string | null
  empresaNome: string
  anoAtivo: number
  anosDisponiveis: number[]
  balancos: BalancoRecord[]
  dres: DreRecord[]
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas: PlanoContaRecord[]
  loading?: boolean
  isCliente?: boolean
}

export function PainelIndicadoresHub({
  empresaId,
  empresaNome,
  anoAtivo,
  anosDisponiveis,
  balancos,
  dres,
  lancamentos,
  contas,
  planoContas,
  loading = false,
  isCliente = false,
}: PainelIndicadoresHubProps) {
  const navigate = useNavigate()
  const [indicadorTendenciaAtivo, setIndicadorTendenciaAtivo] = useState<
    'receita_lucro' | 'roe' | 'margem_liquida' | 'liquidez_corrente' | 'ebitda'
  >('receita_lucro')

  // 1. Apuração de dados para o ano ativo selecionado
  const dadosAnoAtivo = useMemo(() => {
    const balancosDoAno = balancos.filter((b) => b.ano === anoAtivo)
    const dresDoAno = dres.filter((d) => d.ano === anoAtivo)

    let dAtivo = consolidarDreAnual(dresDoAno, anoAtivo)
    const bAtivo = consolidarBalancoAnual(balancosDoAno, anoAtivo)

    // Fallback sintético por lançamentos se DRE não tiver dados
    const dreSemDados =
      !dAtivo ||
      (!dAtivo.receita_bruta &&
        !dAtivo.despesas_operacionais &&
        !dAtivo.custo_mercadorias &&
        !dAtivo.despesas_financeiras)

    const lancsAno = lancamentos.filter((l) => {
      const dataStr = l.data_competencia || l.data_pagamento || l.data_lancamento
      if (!dataStr) return false
      return new Date(dataStr).getFullYear() === anoAtivo
    })

    if (dreSemDados && lancsAno.length > 0) {
      const faturamentoMotor = calcularAnaliseFaturamento(lancsAno, contas, planoContas)
      const linhaAno = faturamentoMotor.linhasPorAno.find((l) => l.ano === anoAtivo)
      if (linhaAno && linhaAno.totalAno > 0) {
        dAtivo = {
          id: `sintetico-${anoAtivo}`,
          collectionId: 'dres',
          collectionName: 'dres',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          empresa: empresaId || '',
          ano: anoAtivo,
          mes: 12,
          receita_bruta: linhaAno.totalAno,
          deducoes_receita: 0,
          custo_mercadorias: 0,
          despesas_operacionais: 0,
          despesas_financeiras: 0,
          outras_receitas_despesas: 0,
          imposto_renda: 0,
        }
      }
    }

    const calcD = calcularDre(dAtivo)
    const calcB = calcularBalanco(bAtivo)
    const altman = calcularZScoreAltman(bAtivo, dAtivo)

    // Liquidez Corrente
    const temPassivoCirc = calcB.passivoCirculante > 0
    const liquidezCorrente = temPassivoCirc ? calcB.ativoCirculante / calcB.passivoCirculante : null

    // ROE (Retorno sobre o PL)
    const temPL = calcB.patrimonioLiquido > 0
    const lucroLiqCalculado = calcD.lucroLiquido
    const roe =
      temPL && lucroLiqCalculado !== 0 ? (lucroLiqCalculado / calcB.patrimonioLiquido) * 100 : null

    // Margem Líquida
    const receitaRef = calcD.receitaLiquida > 0 ? calcD.receitaLiquida : dAtivo.receita_bruta || 0
    const lucroLiq = calcD.lucroLiquido
    const margemLiquida = receitaRef > 0 ? (lucroLiq / receitaRef) * 100 : null

    // Margem Bruta
    const margemBruta = receitaRef > 0 ? (calcD.lucroBruto / receitaRef) * 100 : null

    // Margem EBITDA
    const margemEbitda = receitaRef > 0 ? (calcD.ebitda / receitaRef) * 100 : null

    // Endividamento Geral (Passivo Total / Ativo Total)
    const endividamentoGeral =
      calcB.ativoTotal > 0 ? (calcB.passivoTotal / calcB.ativoTotal) * 100 : null

    // Z-Score Altman
    const zScore = altman.temDados ? altman.zPrivada : null

    return {
      temDados:
        (dAtivo.receita_bruta || 0) > 0 ||
        calcD.receitaLiquida > 0 ||
        calcB.ativoTotal > 0 ||
        lucroLiq !== 0 ||
        lancsAno.length > 0,
      receitaBruta: dAtivo.receita_bruta || calcD.receitaLiquida || 0,
      lucroLiquido: lucroLiq,
      ebitda: calcD.ebitda,
      liquidezCorrente,
      roe,
      margemLiquida,
      margemBruta,
      margemEbitda,
      endividamentoGeral,
      zScore,
      zonaAltman: altman.zona,
    }
  }, [anoAtivo, balancos, dres, lancamentos, contas, planoContas, empresaId])

  // 2. Apuração da Série Histórica Multi-Exercício para os Gráficos de Tendência
  const serieAnual = useMemo(() => {
    // Determina os anos para a série (ordem cronológica crescente)
    const anosValidos = Array.from(
      new Set([
        ...anosDisponiveis,
        ...balancos.map((b) => Number(b.ano)),
        ...dres.map((d) => Number(d.ano)),
      ]),
    )
      .filter((a) => !Number.isNaN(a) && a > 2000 && a < 2100)
      .sort((a, b) => a - b)

    // Se tiver menos de 2 anos, projeta janela de 3 anos em torno do ativo
    const listaAnos = anosValidos.length >= 2 ? anosValidos : [anoAtivo - 2, anoAtivo - 1, anoAtivo]

    return listaAnos.map((ano) => {
      const bDoAno = balancos.filter((b) => b.ano === ano)
      const dDoAno = dres.filter((d) => d.ano === ano)

      const dConsol = consolidarDreAnual(dDoAno, ano)
      const bConsol = consolidarBalancoAnual(bDoAno, ano)
      const calcD = calcularDre(dConsol)
      const calcB = calcularBalanco(bConsol)

      const rec = (dConsol.receita_bruta || 0) > 0 ? dConsol.receita_bruta : calcD.receitaLiquida
      const lucro = calcD.lucroLiquido
      const ebitda = calcD.ebitda
      const temDados = rec > 0 || calcB.ativoTotal > 0 || lucro !== 0

      const lc =
        calcB.passivoCirculante > 0 ? calcB.ativoCirculante / calcB.passivoCirculante : null
      const roe =
        calcB.patrimonioLiquido > 0 && lucro !== 0 ? (lucro / calcB.patrimonioLiquido) * 100 : null
      const ml = rec > 0 ? (lucro / rec) * 100 : null

      return {
        ano,
        temDados,
        receita: temDados && rec > 0 ? rec : null,
        lucro: temDados ? lucro : null,
        ebitda: temDados ? ebitda : null,
        liquidezCorrente: lc,
        roe,
        margemLiquida: ml,
      }
    })
  }, [anosDisponiveis, balancos, dres, anoAtivo])
  // 3. Regressões Lineares e badges de tendência para cada indicador
  const tendencias = useMemo(() => {
    const pontosReceita = serieAnual.map((p) => ({ ano: p.ano, valor: p.receita }))
    const pontosLucro = serieAnual.map((p) => ({ ano: p.ano, valor: p.lucro }))
    const pontosEbitda = serieAnual.map((p) => ({ ano: p.ano, valor: p.ebitda }))
    const pontosRoe = serieAnual.map((p) => ({ ano: p.ano, valor: p.roe }))
    const pontosMl = serieAnual.map((p) => ({ ano: p.ano, valor: p.margemLiquida }))
    const pontosLc = serieAnual.map((p) => ({ ano: p.ano, valor: p.liquidezCorrente }))

    return {
      receita: calcularRegressaoLinear(pontosReceita),
      lucro: calcularRegressaoLinear(pontosLucro),
      ebitda: calcularRegressaoLinear(pontosEbitda),
      roe: calcularRegressaoLinear(pontosRoe),
      margemLiquida: calcularRegressaoLinear(pontosMl),
      liquidezCorrente: calcularRegressaoLinear(pontosLc),
    }
  }, [serieAnual])

  // 4. Monta a série com as linhas de tendência lineares traçadas (unificadas para compatibilidade de tipos Recharts)
  const dadosGraficoAtivo = useMemo(() => {
    const regRec = tendencias.receita.pontosRegressao
    const regLuc = tendencias.lucro.pontosRegressao
    const regRoe = tendencias.roe.pontosRegressao
    const regMl = tendencias.margemLiquida.pontosRegressao
    const regLc = tendencias.liquidezCorrente.pontosRegressao
    const regEb = tendencias.ebitda.pontosRegressao

    return serieAnual.map((item, idx) => ({
      ...item,
      tendenciaReceita: regRec[idx]?.valorAjustado ?? null,
      tendenciaLucro: regLuc[idx]?.valorAjustado ?? null,
      tendenciaRoe: regRoe[idx]?.valorAjustado ?? null,
      tendenciaMargemLiquida: regMl[idx]?.valorAjustado ?? null,
      tendenciaLiquidezCorrente: regLc[idx]?.valorAjustado ?? null,
      tendenciaEbitda: regEb[idx]?.valorAjustado ?? null,
    }))
  }, [serieAnual, tendencias])

  // Helper de badge de tendência
  const renderTendenciaBadge = (dir: 'alta' | 'baixa' | 'estavel', varPct?: number | null) => {
    if (dir === 'alta') {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold gap-1 shrink-0">
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          Tendência Alta {varPct !== null && varPct !== undefined ? `(+${varPct.toFixed(0)}%)` : ''}
        </Badge>
      )
    }
    if (dir === 'baixa') {
      return (
        <Badge className="bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800 text-[10px] font-bold gap-1 shrink-0">
          <TrendingDown className="w-3 h-3 text-red-600" />
          Tendência Baixa {varPct !== null && varPct !== undefined ? `(${varPct.toFixed(0)}%)` : ''}
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[10px] font-bold gap-1 shrink-0">
        <Minus className="w-3 h-3 text-slate-500" />
        Tendência Estável
      </Badge>
    )
  }

  // Zonas de cor para cada hodômetro
  const zonasLiquidez: ZonaHodometro[] = [
    { de: 0, ate: 0.8, cor: '#EF4444', rotulo: 'Crítica (<0.8)' },
    { de: 0.8, ate: 1.0, cor: '#F59E0B', rotulo: 'Atenção (0.8-1.0)' },
    { de: 1.0, ate: 3.0, cor: '#10B981', rotulo: 'Adequada (≥1.0)' },
  ]

  const zonasRoe: ZonaHodometro[] = [
    { de: -20, ate: 0, cor: '#EF4444', rotulo: 'Negativo' },
    { de: 0, ate: 10, cor: '#F59E0B', rotulo: 'Baixo' },
    { de: 10, ate: 40, cor: '#10B981', rotulo: 'Atrativo (>10%)' },
  ]

  const zonasMargemLiquida: ZonaHodometro[] = [
    { de: -10, ate: 0, cor: '#EF4444', rotulo: 'Prejuízo' },
    { de: 0, ate: 5, cor: '#F59E0B', rotulo: 'Apertada (0-5%)' },
    { de: 5, ate: 25, cor: '#10B981', rotulo: 'Saudável (>5%)' },
  ]

  const zonasMargemBruta: ZonaHodometro[] = [
    { de: 0, ate: 20, cor: '#EF4444', rotulo: 'Baixa (<20%)' },
    { de: 20, ate: 40, cor: '#F59E0B', rotulo: 'Média (20-40%)' },
    { de: 40, ate: 80, cor: '#10B981', rotulo: 'Excelente (>40%)' },
  ]

  const zonasEndividamento: ZonaHodometro[] = [
    { de: 0, ate: 50, cor: '#10B981', rotulo: 'Conservador (<50%)' },
    { de: 50, ate: 75, cor: '#F59E0B', rotulo: 'Moderado (50-75%)' },
    { de: 75, ate: 100, cor: '#EF4444', rotulo: 'Elevado (>75%)' },
  ]

  const zonasZScoreAltman: ZonaHodometro[] = [
    { de: 0, ate: 1.1, cor: '#EF4444', rotulo: 'Insolvência (<1.1)' },
    { de: 1.1, ate: 2.6, cor: '#F59E0B', rotulo: 'Zona Cinzenta' },
    { de: 2.6, ate: 5.0, cor: '#10B981', rotulo: 'Solvente (>2.6)' },
  ]

  const zonasMargemEbitda: ZonaHodometro[] = [
    { de: -10, ate: 0, cor: '#EF4444', rotulo: 'Negativa' },
    { de: 0, ate: 10, cor: '#F59E0B', rotulo: 'Moderada (0-10%)' },
    { de: 10, ate: 35, cor: '#10B981', rotulo: 'Forte (>10%)' },
  ]

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Banner de apresentação da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0B1F3A] to-[#143A6E] text-white border border-blue-900/40 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">
              Painel de Indicadores & Velocímetros Gerenciais
            </span>
            <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-400/30 text-[10px] font-bold">
              Exercício {anoAtivo}
            </Badge>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Hodômetros de Performance & Análise de Tendência
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Visualização executiva com velocímetros calibrados por faixas de risco (verde, âmbar e
            vermelho) e curvas de tendência multi-ano via regressão linear estatística.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(isCliente ? '/cliente/indicadores' : '/gerencial/indicadores')}
            className="h-8 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 cursor-pointer"
          >
            Ver Tabela Completa
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* SEÇÃO 1: GRADE DE HODÔMETROS (VELOCÍMETROS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Hodômetros dos Indicadores Principais ({anoAtivo})
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Agulha centralizada nas faixas de referência contábil
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Hodômetro 1: Liquidez Corrente */}
          <HodometroGauge
            titulo="Liquidez Corrente"
            subtitulo="Ativo Circulante ÷ Passivo Circulante"
            valor={dadosAnoAtivo.liquidezCorrente}
            min={0}
            max={3.0}
            unidade="x"
            zonas={zonasLiquidez}
            statusTexto={
              dadosAnoAtivo.liquidezCorrente === null
                ? 'Sem Balanço'
                : dadosAnoAtivo.liquidezCorrente >= 1.0
                  ? 'Adequada'
                  : dadosAnoAtivo.liquidezCorrente >= 0.8
                    ? 'Atenção'
                    : 'Crítica'
            }
            statusTipo={
              dadosAnoAtivo.liquidezCorrente === null
                ? 'neutro'
                : dadosAnoAtivo.liquidezCorrente >= 1.0
                  ? 'positivo'
                  : dadosAnoAtivo.liquidezCorrente >= 0.8
                    ? 'alerta'
                    : 'critico'
            }
            metaTexto="Ideal: acima de 1,0x (recursos cobrem passivos)"
            formatarValor={(v) => `${v.toFixed(2)}x`}
            onClickDetalhes={() =>
              navigate(isCliente ? '/cliente/indicadores' : '/gerencial/indicadores')
            }
          />

          {/* Hodômetro 2: ROE (Retorno sobre PL) */}
          <HodometroGauge
            titulo="Retorno sobre PL (ROE)"
            subtitulo="Lucro Líquido ÷ Patrimônio Líquido"
            valor={dadosAnoAtivo.roe}
            min={-20}
            max={40}
            unidade="%"
            zonas={zonasRoe}
            statusTexto={
              dadosAnoAtivo.roe === null
                ? 'Sem Dados'
                : dadosAnoAtivo.roe >= 15
                  ? 'Excelente'
                  : dadosAnoAtivo.roe > 0
                    ? 'Positivo'
                    : 'Prejuízo'
            }
            statusTipo={
              dadosAnoAtivo.roe === null
                ? 'neutro'
                : dadosAnoAtivo.roe >= 10
                  ? 'positivo'
                  : dadosAnoAtivo.roe > 0
                    ? 'alerta'
                    : 'critico'
            }
            metaTexto="Ideal: taxa de retorno superior ao CDI"
            formatarValor={(v) => formatPercent(v, 1)}
            onClickDetalhes={() =>
              navigate(isCliente ? '/cliente/indicadores' : '/gerencial/indicadores')
            }
          />

          {/* Hodômetro 3: Margem Líquida */}
          <HodometroGauge
            titulo="Margem Líquida"
            subtitulo="Lucro Líquido ÷ Receita Líquida"
            valor={dadosAnoAtivo.margemLiquida}
            min={-10}
            max={25}
            unidade="%"
            zonas={zonasMargemLiquida}
            statusTexto={
              dadosAnoAtivo.margemLiquida === null
                ? 'Sem DRE'
                : dadosAnoAtivo.margemLiquida >= 10
                  ? 'Excelente'
                  : dadosAnoAtivo.margemLiquida >= 5
                    ? 'Saudável'
                    : dadosAnoAtivo.margemLiquida >= 0
                      ? 'Apertada'
                      : 'Negativa'
            }
            statusTipo={
              dadosAnoAtivo.margemLiquida === null
                ? 'neutro'
                : dadosAnoAtivo.margemLiquida >= 5
                  ? 'positivo'
                  : dadosAnoAtivo.margemLiquida >= 0
                    ? 'alerta'
                    : 'critico'
            }
            metaTexto="Parcela líquida de cada R$ 100 vendidos"
            formatarValor={(v) => formatPercent(v, 1)}
            onClickDetalhes={() =>
              navigate(isCliente ? '/cliente/rentabilidade' : '/gerencial/analise-rentabilidade')
            }
          />

          {/* Hodômetro 4: Margem Bruta */}
          <HodometroGauge
            titulo="Margem Bruta"
            subtitulo="Lucro Bruto ÷ Receita"
            valor={dadosAnoAtivo.margemBruta}
            min={0}
            max={80}
            unidade="%"
            zonas={zonasMargemBruta}
            statusTexto={
              dadosAnoAtivo.margemBruta === null
                ? 'Sem DRE'
                : dadosAnoAtivo.margemBruta >= 40
                  ? 'Excelente'
                  : dadosAnoAtivo.margemBruta >= 20
                    ? 'Média'
                    : 'Baixa'
            }
            statusTipo={
              dadosAnoAtivo.margemBruta === null
                ? 'neutro'
                : dadosAnoAtivo.margemBruta >= 40
                  ? 'positivo'
                  : dadosAnoAtivo.margemBruta >= 20
                    ? 'alerta'
                    : 'critico'
            }
            metaTexto="Sobra operacional antes das despesas fixas"
            formatarValor={(v) => formatPercent(v, 1)}
            onClickDetalhes={() =>
              navigate(isCliente ? '/cliente/rentabilidade' : '/gerencial/analise-rentabilidade')
            }
          />

          {/* Hodômetro 5: Margem EBITDA */}
          <HodometroGauge
            titulo="Margem EBITDA (LAJIDA)"
            subtitulo="EBITDA ÷ Receita Operacional"
            valor={dadosAnoAtivo.margemEbitda}
            min={-10}
            max={35}
            unidade="%"
            zonas={zonasMargemEbitda}
            statusTexto={
              dadosAnoAtivo.margemEbitda === null
                ? 'Sem Dados'
                : dadosAnoAtivo.margemEbitda >= 15
                  ? 'Forte'
                  : dadosAnoAtivo.margemEbitda >= 5
                    ? 'Moderada'
                    : 'Fraca'
            }
            statusTipo={
              dadosAnoAtivo.margemEbitda === null
                ? 'neutro'
                : dadosAnoAtivo.margemEbitda >= 10
                  ? 'positivo'
                  : dadosAnoAtivo.margemEbitda >= 0
                    ? 'alerta'
                    : 'critico'
            }
            metaTexto={`EBITDA Total: ${formatBrlMil(dadosAnoAtivo.ebitda)}`}
            formatarValor={(v) => formatPercent(v, 1)}
            onClickDetalhes={() =>
              navigate(isCliente ? '/cliente/dashboard-bi' : '/gerencial/dashboard-bi')
            }
          />

          {/* Hodômetro 6: Endividamento Geral */}
          <HodometroGauge
            titulo="Endividamento Geral"
            subtitulo="Passivo Exigível ÷ Ativo Total"
            valor={dadosAnoAtivo.endividamentoGeral}
            min={0}
            max={100}
            unidade="%"
            zonas={zonasEndividamento}
            statusTexto={
              dadosAnoAtivo.endividamentoGeral === null
                ? 'Sem Balanço'
                : dadosAnoAtivo.endividamentoGeral <= 50
                  ? 'Baixo'
                  : dadosAnoAtivo.endividamentoGeral <= 75
                    ? 'Moderado'
                    : 'Elevado'
            }
            statusTipo={
              dadosAnoAtivo.endividamentoGeral === null
                ? 'neutro'
                : dadosAnoAtivo.endividamentoGeral <= 50
                  ? 'positivo'
                  : dadosAnoAtivo.endividamentoGeral <= 75
                    ? 'alerta'
                    : 'critico'
            }
            metaTexto="Ideal: menor que 50% de capital de terceiros"
            formatarValor={(v) => formatPercent(v, 1)}
            onClickDetalhes={() =>
              navigate(isCliente ? '/cliente/indicadores' : '/gerencial/indicadores')
            }
          />

          {/* Hodômetro 7: Termômetro Z-Score Altman */}
          <HodometroGauge
            titulo="Termômetro de Insolvência"
            subtitulo="Z-Score Altman Z'' PME Privada"
            valor={dadosAnoAtivo.zScore}
            min={0}
            max={5.0}
            unidade="pts"
            zonas={zonasZScoreAltman}
            statusTexto={
              dadosAnoAtivo.zScore === null
                ? 'Sem Balanço'
                : dadosAnoAtivo.zonaAltman === 'solvencia'
                  ? 'Solvente'
                  : dadosAnoAtivo.zonaAltman === 'cinzenta'
                    ? 'Cinzenta'
                    : 'Insolvência'
            }
            statusTipo={
              dadosAnoAtivo.zScore === null
                ? 'neutro'
                : dadosAnoAtivo.zonaAltman === 'solvencia'
                  ? 'positivo'
                  : dadosAnoAtivo.zonaAltman === 'cinzenta'
                    ? 'alerta'
                    : 'critico'
            }
            metaTexto="Verde > 2,6 | Cinzenta 1,1 a 2,6 | Vermelho < 1,1"
            formatarValor={(v) => `${v.toFixed(2)} pts`}
            onClickDetalhes={() =>
              navigate(isCliente ? '/cliente/dashboard-bi' : '/gerencial/termometro-insolvencia')
            }
          />

          {/* Card Resumo de Síntese Operacional */}
          <div className="flex flex-col justify-between p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-[#0B1F3A] text-white border border-slate-800 shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  Síntese do Exercício
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span className="text-slate-400">Receita Bruta:</span>
                  <span className="font-mono font-bold text-cyan-200">
                    {formatBrlMil(dadosAnoAtivo.receitaBruta)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span className="text-slate-400">Resultado Líquido:</span>
                  <span
                    className={`font-mono font-bold ${
                      dadosAnoAtivo.lucroLiquido >= 0 ? 'text-emerald-300' : 'text-red-400'
                    }`}
                  >
                    {formatBrlMil(dadosAnoAtivo.lucroLiquido)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">EBITDA Gerencial:</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {formatBrlMil(dadosAnoAtivo.ebitda)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() =>
                navigate(isCliente ? '/cliente/dashboard-bi' : '/gerencial/dashboard-bi')
              }
              className="mt-3 w-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold h-8"
            >
              Abrir Dashboard Executivo
            </Button>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: GRÁFICOS DE TENDÊNCIA TEMPORAL (COM REGRESSÃO LINEAR TRAÇADA) */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
                Análise de Tendência dos Indicadores Multi-Exercício
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Evolução histórica com reta de tendência linear calculada e classificação automática
              (Alta, Baixa ou Estável).
            </CardDescription>
          </div>

          {/* Seletores de métrica do gráfico */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-wrap">
            <button
              type="button"
              onClick={() => setIndicadorTendenciaAtivo('receita_lucro')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                indicadorTendenciaAtivo === 'receita_lucro'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Receita vs Lucro
            </button>
            <button
              type="button"
              onClick={() => setIndicadorTendenciaAtivo('roe')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                indicadorTendenciaAtivo === 'roe'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              ROE (%)
            </button>
            <button
              type="button"
              onClick={() => setIndicadorTendenciaAtivo('margem_liquida')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                indicadorTendenciaAtivo === 'margem_liquida'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Margem Líquida (%)
            </button>
            <button
              type="button"
              onClick={() => setIndicadorTendenciaAtivo('liquidez_corrente')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                indicadorTendenciaAtivo === 'liquidez_corrente'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Liquidez Corrente
            </button>
            <button
              type="button"
              onClick={() => setIndicadorTendenciaAtivo('ebitda')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                indicadorTendenciaAtivo === 'ebitda'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              EBITDA (R$)
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Barra de Status da Tendência Ativa */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Diagnóstico de Tendência:
              </span>
              {indicadorTendenciaAtivo === 'receita_lucro' ? (
                <div className="flex items-center gap-2">
                  <span>Receita:</span>
                  {renderTendenciaBadge(
                    tendencias.receita.direcao,
                    tendencias.receita.variacaoTotalPct,
                  )}
                  <span className="text-slate-300">|</span>
                  <span>Lucro:</span>
                  {renderTendenciaBadge(
                    tendencias.lucro.direcao,
                    tendencias.lucro.variacaoTotalPct,
                  )}
                </div>
              ) : indicadorTendenciaAtivo === 'roe' ? (
                renderTendenciaBadge(tendencias.roe.direcao, tendencias.roe.variacaoTotalPct)
              ) : indicadorTendenciaAtivo === 'margem_liquida' ? (
                renderTendenciaBadge(
                  tendencias.margemLiquida.direcao,
                  tendencias.margemLiquida.variacaoTotalPct,
                )
              ) : indicadorTendenciaAtivo === 'liquidez_corrente' ? (
                renderTendenciaBadge(
                  tendencias.liquidezCorrente.direcao,
                  tendencias.liquidezCorrente.variacaoTotalPct,
                )
              ) : (
                renderTendenciaBadge(tendencias.ebitda.direcao, tendencias.ebitda.variacaoTotalPct)
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Linha pontilhada: <strong>regressão linear estimada</strong>
            </div>
          </div>

          {/* Gráfico Recharts com linha real e linha de tendência */}
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {indicadorTendenciaAtivo === 'receita_lucro' ? (
                <LineChart
                  data={dadosGraficoAtivo}
                  margin={{ top: 15, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="ano"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      val !== null ? formatBrlMil(Number(val)) : 'Sem dados',
                      name === 'receita'
                        ? 'Receita Bruta'
                        : name === 'lucro'
                          ? 'Lucro Líquido'
                          : name === 'tendenciaReceita'
                            ? 'Tendência Receita'
                            : 'Tendência Lucro',
                    ]}
                  />
                  <Legend
                    formatter={(val) => (
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {val === 'receita'
                          ? 'Receita Bruta'
                          : val === 'lucro'
                            ? 'Lucro Líquido'
                            : val === 'tendenciaReceita'
                              ? 'Tendência Receita (Ajuste)'
                              : 'Tendência Lucro (Ajuste)'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="receita"
                    name="receita"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#2563EB' }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    name="lucro"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#10B981' }}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="tendenciaReceita"
                    name="tendenciaReceita"
                    stroke="#60A5FA"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="tendenciaLucro"
                    name="tendenciaLucro"
                    stroke="#34D399"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              ) : indicadorTendenciaAtivo === 'roe' ? (
                <LineChart
                  data={dadosGraficoAtivo}
                  margin={{ top: 15, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="ano"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      val !== null ? `${Number(val).toFixed(1)}%` : 'Sem dados',
                      name === 'roe' ? 'ROE Apurado' : 'Linha de Tendência ROE',
                    ]}
                  />
                  <Legend
                    formatter={(val) => (
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {val === 'roe' ? 'ROE Real (%)' : 'Linha de Tendência Linear'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="roe"
                    name="roe"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#8B5CF6' }}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="tendenciaRoe"
                    name="tendenciaRoe"
                    stroke="#C4B5FD"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              ) : indicadorTendenciaAtivo === 'margem_liquida' ? (
                <LineChart
                  data={dadosGraficoAtivo}
                  margin={{ top: 15, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="ano"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      val !== null ? `${Number(val).toFixed(1)}%` : 'Sem dados',
                      name === 'margemLiquida' ? 'Margem Líquida' : 'Linha de Tendência',
                    ]}
                  />
                  <Legend
                    formatter={(val) => (
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {val === 'margemLiquida'
                          ? 'Margem Líquida Real (%)'
                          : 'Linha de Tendência Linear'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemLiquida"
                    name="margemLiquida"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#059669' }}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="tendenciaMargemLiquida"
                    name="tendenciaMargemLiquida"
                    stroke="#6EE7B7"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              ) : indicadorTendenciaAtivo === 'liquidez_corrente' ? (
                <LineChart
                  data={dadosGraficoAtivo}
                  margin={{ top: 15, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="ano"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `${v}x`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      val !== null ? `${Number(val).toFixed(2)}x` : 'Sem dados',
                      name === 'liquidezCorrente' ? 'Liquidez Corrente' : 'Linha de Tendência',
                    ]}
                  />
                  <Legend
                    formatter={(val) => (
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {val === 'liquidezCorrente'
                          ? 'Liquidez Corrente Real'
                          : 'Linha de Tendência Linear'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="liquidezCorrente"
                    name="liquidezCorrente"
                    stroke="#0284C7"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0284C7' }}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="tendenciaLiquidezCorrente"
                    name="tendenciaLiquidezCorrente"
                    stroke="#7DD3FC"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              ) : (
                <LineChart
                  data={dadosGraficoAtivo}
                  margin={{ top: 15, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="ano"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      val !== null ? formatBrlMil(Number(val)) : 'Sem dados',
                      name === 'ebitda' ? 'EBITDA (LAJIDA)' : 'Linha de Tendência EBITDA',
                    ]}
                  />
                  <Legend
                    formatter={(val) => (
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {val === 'ebitda' ? 'EBITDA Operacional' : 'Linha de Tendência Linear'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="ebitda"
                    name="ebitda"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#10B981' }}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="tendenciaEbitda"
                    name="tendenciaEbitda"
                    stroke="#6EE7B7"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
