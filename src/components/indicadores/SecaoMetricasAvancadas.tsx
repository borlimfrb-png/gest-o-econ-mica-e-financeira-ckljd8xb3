/**
 * Seção "Métricas Avançadas" da tela total de Indicadores (/indicadores/apresentacao).
 * Reutiliza os motores oficiais já validados:
 *  - Termômetro de Insolvência (Z-Score de Altman, modelos Z'' privada e clássica)
 *  - Indicadores Avançados (EVA, DuPont, Ciclo de Conversão de Caixa, Cobertura de Juros)
 * e o resolver unificado de benchmark (resolverReferenciaMercado), com badge
 * "Acima/Abaixo do mercado" (invertido para endividamento/CCC).
 */
import { useEffect, useMemo, useState } from 'react'
import { Activity, Coins, Percent, ShieldCheck, TrendingUp, Gauge, Timer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  calcularZScoreAltman,
  ROTULO_ZONA,
  DESCRICAO_ZONA,
} from '@/lib/termometroInsolvenciaCalculo'
import {
  calcularIndicadoresAvancados,
  ROTULO_CLASSIFICACAO_COBERTURA,
} from '@/lib/indicadoresAvancadosCalculo'
import {
  resolverReferenciaMercado,
  avaliarVersusMercado,
  type ReferenciaMercado,
} from '@/components/indicadores/benchmarkHub'
import type { BalancoRecord, DreRecord } from '@/types/finance'

// ---------- Formatação (pt-BR, no navegador) ----------
const fmtNum = (v: number | null | undefined, dec = 2): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
const fmtPct = (v: number | null | undefined, dec = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, dec)}%`
const fmtMoeda = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const fmtDias = (v: number | null | undefined, dec = 0): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, dec)} dias`
const fmtMult = (v: number | null | undefined, dec = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, dec)}x`

const BADGE_SEM_DADOS =
  'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400 border-slate-200 dark:border-slate-700'

export interface SecaoMetricasAvancadasProps {
  balancoAtual: Partial<BalancoRecord> | null
  dreAtual: Partial<DreRecord> | null
  empresaId: string | null
  /** Segmento/setor da empresa ativa (resolve o benchmark). */
  segmento?: string | null
  ano: number
  empresaNome?: string
}

// ---------- Badge de comparação com o mercado ----------
function BadgeMercado({
  valorEmpresa,
  valorMercado,
  inverteCor,
}: {
  valorEmpresa: number | null
  valorMercado: number | undefined
  inverteCor: boolean
}) {
  if (valorMercado === undefined) {
    return (
      <Badge variant="outline" className={`text-[10px] ${BADGE_SEM_DADOS}`}>
        Sem dados
      </Badge>
    )
  }
  const aval = avaliarVersusMercado(valorEmpresa, valorMercado, inverteCor)
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold ${aval.classes}`}>
      {aval.rotulo}
    </Badge>
  )
}

interface CardMetricaProps {
  titulo: string
  sigla: string
  icone: React.ElementType
  valorPrincipal: string
  rotuloPrincipal: string
  valorMercado?: string
  valorMercadoBruto?: number | undefined
  valorEmpresaBruto: number | null
  inverteCor?: boolean
  detalhes?: { rotulo: string; valor: string }[]
  descricao: string
  badgeFaixa?: { texto: string; classes: string }
  tooltipFaixa?: string
}

function CardMetrica({
  titulo,
  sigla,
  icone: Icone,
  valorPrincipal,
  rotuloPrincipal,
  valorMercado,
  valorMercadoBruto,
  valorEmpresaBruto,
  inverteCor = false,
  detalhes = [],
  descricao,
  badgeFaixa,
  tooltipFaixa,
}: CardMetricaProps) {
  const semDados =
    valorEmpresaBruto === null ||
    valorEmpresaBruto === undefined ||
    !Number.isFinite(valorEmpresaBruto)

  return (
    <Card className="flex flex-col justify-between border-border/80 hover:shadow-md transition-shadow">
      <CardHeader className="p-4 pb-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
              <Icone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
                {titulo}
              </CardTitle>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">{sigla}</span>
            </div>
          </div>
          {badgeFaixa ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold shrink-0 ${badgeFaixa.classes}`}
                  >
                    {badgeFaixa.texto}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64 text-xs">
                  {tooltipFaixa}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Badge variant="outline" className={`text-[10px] shrink-0 ${BADGE_SEM_DADOS}`}>
              Sem dados
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-2">
        <div className="rounded-lg border bg-gradient-to-r from-card to-muted/30 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{rotuloPrincipal}</span>
            {semDados ? (
              <Badge variant="outline" className={`text-[10px] ${BADGE_SEM_DADOS}`}>
                Sem dados
              </Badge>
            ) : (
              <BadgeMercado
                valorEmpresa={valorEmpresaBruto}
                valorMercado={valorMercadoBruto}
                inverteCor={inverteCor}
              />
            )}
          </div>
          <div className="text-xl font-black tracking-tight text-foreground mt-0.5">
            {semDados ? '—' : valorPrincipal}
          </div>
          {valorMercado !== undefined && (
            <div className="text-[10px] text-muted-foreground mt-0.5">Mercado: {valorMercado}</div>
          )}
        </div>

        {detalhes.length > 0 && (
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] border-t border-border/60 pt-2">
            {detalhes.map((d) => (
              <div key={d.rotulo} className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground">{d.rotulo}</span>
                <span className="font-mono font-semibold text-foreground">{d.valor}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
          {descricao}
        </p>
      </CardContent>
    </Card>
  )
}

// ---------- Faixas visuais do Z-Score e da Cobertura ----------
const FAIXA_ZONA = {
  solvencia:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  cinzenta:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  insolvencia:
    'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
}

const FAIXA_COBERTURA: Record<string, string> = {
  confortavel:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  adequada:
    'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  apertada:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  critica:
    'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
}

const WACC_PADRAO_PCT = 12 // % a.a. — mesma premissa padrão da tela /gerencial/indicadores-avancados

export function SecaoMetricasAvancadas({
  balancoAtual,
  dreAtual,
  empresaId,
  segmento,
  ano,
  empresaNome,
}: SecaoMetricasAvancadasProps) {
  const [referencia, setReferencia] = useState<ReferenciaMercado | null>(null)

  // Benchmark SEMPRE via resolverReferenciaMercado (nunca benchmarksService direto).
  useEffect(() => {
    let vivo = true
    resolverReferenciaMercado(segmento, empresaId)
      .then((r) => {
        if (vivo) setReferencia(r)
      })
      .catch(() => {
        if (vivo) setReferencia(null)
      })
    return () => {
      vivo = false
    }
  }, [segmento, empresaId])

  // Motores oficiais reutilizados (Z-Score + indicadores avançados)
  const z = useMemo(() => calcularZScoreAltman(balancoAtual, dreAtual), [balancoAtual, dreAtual])
  const adv = useMemo(
    () => calcularIndicadoresAvancados(balancoAtual, dreAtual, WACC_PADRAO_PCT),
    [balancoAtual, dreAtual],
  )

  const endividamentoPct =
    adv.resumo.ativoTotal > 0 ? (adv.resumo.passivoTotal / adv.resumo.ativoTotal) * 100 : null

  return (
    <section aria-label="Métricas Avançadas" className="space-y-3">
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-800">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Métricas Avançadas</h2>
            <p className="text-xs text-muted-foreground">
              Termômetro de Insolvência (Altman), EVA, DuPont, Ciclo de Conversão de Caixa e
              Cobertura de Juros — apurados com os motores oficiais do sistema.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          Exercício {ano}
        </Badge>
      </div>

      {referencia && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span>
            Referência de mercado:{' '}
            <strong className="text-foreground">{referencia.rotuloSetor}</strong>
          </span>
          {referencia.usarFallback && (
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
            >
              Referência padrão Indústria
            </Badge>
          )}
        </div>
      )}

      {/* Grade de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* ===== 1. Termômetro de Insolvência (Z-Score de Altman) ===== */}
        <CardMetrica
          titulo="Termômetro de Insolvência"
          sigla="Altman Z''"
          icone={ShieldCheck}
          valorPrincipal={z.zPrivada !== null ? fmtNum(z.zPrivada, 2) : '—'}
          rotuloPrincipal={`Z-Score (${ano})`}
          badgeFaixa={
            z.zona
              ? {
                  texto: ROTULO_ZONA[z.zona],
                  classes: FAIXA_ZONA[z.zona],
                }
              : undefined
          }
          tooltipFaixa={z.zona ? DESCRICAO_ZONA[z.zona] : undefined}
          valorEmpresaBruto={z.zPrivada}
          descricao="Modelo privado Z'' de Altman: combina capital de giro, lucros acumulados, EBITDA/Ativo e PL/Passivo para estimar o risco de insolvência nos próximos dois exercícios."
          detalhes={[
            {
              rotulo: 'Z Clássica (1968)',
              valor: z.zClassica !== null ? fmtNum(z.zClassica, 2) : '—',
            },
            {
              rotulo: 'Zona Clássica',
              valor: z.zonaClassica ? ROTULO_ZONA[z.zonaClassica] : '—',
            },
            { rotulo: 'X1 — CG/AT', valor: fmtNum(z.x1, 3) },
            { rotulo: 'X2 — Lucros Acum./AT', valor: fmtNum(z.x2, 3) },
            { rotulo: 'X3 — EBITDA/AT', valor: fmtNum(z.x3, 3) },
            { rotulo: 'X4 — PL/Passivo', valor: fmtNum(z.x4, 3) },
          ]}
        />

        {/* ===== 2. EVA — Valor Econômico Agregado ===== */}
        <CardMetrica
          titulo="EVA — Valor Econômico Agregado"
          sigla="EVA"
          icone={Coins}
          valorPrincipal={adv.eva.temDados ? fmtMoeda(adv.eva.eva) : '—'}
          rotuloPrincipal={`EVA (${ano})`}
          valorEmpresaBruto={adv.eva.temDados ? adv.eva.eva : null}
          descricao="EVA = NOPAT − (Capital Investido × WACC). Mede se o retorno operacional remunera o capital investido acima do custo de oportunidade (WACC padrão de 12% a.a.)."
          detalhes={[
            { rotulo: 'NOPAT', valor: fmtMoeda(adv.eva.nopat) },
            { rotulo: 'Capital Investido', valor: fmtMoeda(adv.eva.capitalInvestido) },
            { rotulo: 'Custo de Capital', valor: fmtMoeda(adv.eva.custoCapital) },
            { rotulo: 'Margem EVA', valor: fmtPct(adv.eva.margemEva) },
          ]}
        />

        {/* ===== 3. DuPont — ROE decomposto ===== */}
        <CardMetrica
          titulo="DuPont — ROE Decomposto"
          sigla="ROE"
          icone={TrendingUp}
          valorPrincipal={adv.dupont.roe !== null ? fmtPct(adv.dupont.roe) : '—'}
          rotuloPrincipal={`ROE (${ano})`}
          valorEmpresaBruto={adv.dupont.roe}
          valorMercadoBruto={referencia?.roe}
          valorMercado={referencia ? fmtPct(referencia.roe, 1) : undefined}
          descricao="ROE = Margem Líquida × Giro do Ativo × Alavancagem Financeira. Mostra de onde vem o retorno ao acionista: operação, eficiência de ativos ou alavancagem."
          detalhes={[
            { rotulo: 'Margem Líquida', valor: fmtPct(adv.dupont.margemLiquida) },
            { rotulo: 'Giro do Ativo', valor: fmtMult(adv.dupont.giroAtivo, 3) },
            { rotulo: 'Alavancagem', valor: fmtMult(adv.dupont.alavancagemFinanceira, 3) },
            { rotulo: 'ROA', valor: fmtPct(adv.dupont.roa) },
          ]}
        />

        {/* ===== 4. Ciclo de Conversão de Caixa (CCC) ===== */}
        <CardMetrica
          titulo="Ciclo de Conversão de Caixa"
          sigla="CCC"
          icone={Timer}
          valorPrincipal={
            adv.ciclo.cicloConversaoCaixa !== null ? fmtDias(adv.ciclo.cicloConversaoCaixa, 0) : '—'
          }
          rotuloPrincipal={`CCC (${ano})`}
          valorEmpresaBruto={adv.ciclo.cicloConversaoCaixa}
          valorMercadoBruto={referencia?.cicloFinanceiro}
          valorMercado={referencia ? fmtDias(referencia.cicloFinanceiro, 0) : undefined}
          inverteCor
          descricao="CCC = (PME + PMR) − PMP, em dias. Quanto menor, mais rápido o capital de giro volta ao caixa — por isso abaixo do mercado é bom."
          detalhes={[
            { rotulo: 'PME — Estocagem', valor: fmtDias(adv.ciclo.pme, 0) },
            { rotulo: 'PMR — Recebimento', valor: fmtDias(adv.ciclo.pmr, 0) },
            { rotulo: 'PMP — Pagamento', valor: fmtDias(adv.ciclo.pmp, 0) },
            { rotulo: 'Ciclo Operacional', valor: fmtDias(adv.ciclo.cicloOperacional, 0) },
          ]}
        />

        {/* ===== 5. Cobertura de Juros ===== */}
        <CardMetrica
          titulo="Cobertura de Juros"
          sigla="EBIT ÷ Juros"
          icone={Percent}
          valorPrincipal={
            adv.cobertura.cobertura !== null ? `${fmtNum(adv.cobertura.cobertura, 2)}x` : '—'
          }
          rotuloPrincipal={`Cobertura (${ano})`}
          valorEmpresaBruto={adv.cobertura.cobertura}
          valorMercadoBruto={referencia?.coberturaJuros}
          valorMercado={referencia ? `${fmtNum(referencia.coberturaJuros, 1)}x` : undefined}
          badgeFaixa={
            adv.cobertura.classificacao !== 'sem_dados'
              ? {
                  texto: ROTULO_CLASSIFICACAO_COBERTURA[adv.cobertura.classificacao],
                  classes: FAIXA_COBERTURA[adv.cobertura.classificacao],
                }
              : undefined
          }
          tooltipFaixa={
            adv.cobertura.classificacao !== 'sem_dados'
              ? `EBIT ≈ EBITDA de ${fmtMoeda(adv.cobertura.ebit)} contra despesas financeiras de ${fmtMoeda(adv.cobertura.despesasFinanceiras)}.`
              : undefined
          }
          descricao="Quantas vezes o resultado operacional (EBIT ≈ EBITDA oficial) cobre as despesas financeiras. Quanto maior, mais confortável o serviço da dívida."
          detalhes={[
            { rotulo: 'EBIT ≈ EBITDA', valor: fmtMoeda(adv.cobertura.ebit) },
            { rotulo: 'Despesas Financ.', valor: fmtMoeda(adv.cobertura.despesasFinanceiras) },
            {
              rotulo: 'Classificação',
              valor: ROTULO_CLASSIFICACAO_COBERTURA[adv.cobertura.classificacao],
            },
          ]}
        />

        {/* ===== 6. Endividamento Geral (cor invertida: abaixo é bom) ===== */}
        <CardMetrica
          titulo="Endividamento Geral"
          sigla="EG"
          icone={Activity}
          valorPrincipal={endividamentoPct !== null ? fmtPct(endividamentoPct, 1) : '—'}
          rotuloPrincipal={`Endividamento (${ano})`}
          valorEmpresaBruto={endividamentoPct}
          valorMercadoBruto={referencia?.endividamentoGeral}
          valorMercado={referencia ? fmtPct(referencia.endividamentoGeral, 1) : undefined}
          inverteCor
          descricao="Passivo Total ÷ Ativo Total: parcela dos ativos financiada por terceiros. Abaixo do mercado é bom — menos dependência de capital externo."
          detalhes={[
            { rotulo: 'Ativo Total', valor: fmtMoeda(adv.resumo.ativoTotal) },
            { rotulo: 'Passivo Total', valor: fmtMoeda(adv.resumo.passivoTotal) },
            { rotulo: 'Patrimônio Líquido', valor: fmtMoeda(adv.resumo.patrimonioLiquido) },
            { rotulo: 'Receita Líquida', valor: fmtMoeda(adv.resumo.receitaLiquida) },
          ]}
        />
      </div>

      {/* Nota metodológica */}
      <div className="rounded-md bg-muted/40 border p-3 text-[11px] text-muted-foreground">
        <strong className="text-foreground">Nota metodológica:</strong> as métricas são apuradas
        pelos mesmos motores das telas gerenciais (Termômetro de Insolvência e Indicadores
        Avançados) sobre o Balanço e a DRE do exercício selecionado. EVA usa WACC padrão de{' '}
        {WACC_PADRAO_PCT}% a.a. Os benchmarks vêm da referência de mercado do segmento da empresa
        {empresaNome ? ` (${empresaNome})` : ''}; para Endividamento e CCC, abaixo do mercado é
        positivo (cor invertida). Indicador sem dados do exercício aparece como “—” com badge “Sem
        dados”.
      </div>
    </section>
  )
}

export default SecaoMetricasAvancadas
