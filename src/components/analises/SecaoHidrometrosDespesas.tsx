import { useMemo } from 'react'
import { Gauge } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { HodometroGauge, type ZonaHodometro } from '@/components/HodometroGauge'
import { formatarPercentualExport } from '@/lib/despesasFixasExport'
import type { AnaliseAnual360Resultado } from '@/lib/analiseAnual360'

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Zonas do semáforo oficial das telas de despesa (<25% baixo, 25-40% médio, >40% alto). */
const ZONAS_PERCENTUAL: ZonaHodometro[] = [
  { de: 0, ate: 25, cor: '#10B981', rotulo: 'Baixo' },
  { de: 25, ate: 40, cor: '#F59E0B', rotulo: 'Médio' },
  { de: 40, ate: 100, cor: '#EF4444', rotulo: 'Alto' },
]

function statusDoPercentual(p: number | null): {
  texto: string
  tipo: 'positivo' | 'alerta' | 'critico' | 'neutro'
} {
  if (p === null || !Number.isFinite(p)) return { texto: 'Sem dados', tipo: 'neutro' }
  if (p < 25) return { texto: 'Baixo', tipo: 'positivo' }
  if (p <= 40) return { texto: 'Médio', tipo: 'alerta' }
  return { texto: 'Alto', tipo: 'critico' }
}

function variacaoTexto(variacaoPct: number | null): string {
  if (variacaoPct === null) return '—'
  return `${variacaoPct >= 0 ? '+' : ''}${variacaoPct.toFixed(1)}%`
}

interface SecaoHidrometrosDespesasProps {
  tipo: 'fixas' | 'variaveis'
  resultado: AnaliseAnual360Resultado
  percentualFaturamento: number | null
  semaforo: 'verde' | 'ambar' | 'vermelho' | 'neutro'
}

/**
 * Seção "Hidrômetros" das telas de Despesas Fixas e Variáveis: três medidores
 * gauge (semicírculo) com os indicadores que antes apareciam no Radar 360 —
 * % da despesa sobre o faturamento, variação vs exercício anterior e média
 * mensal do exercício. Somente leitura, no padrão visual do app.
 */
export function SecaoHidrometrosDespesas({
  tipo,
  resultado,
  percentualFaturamento,
  semaforo,
}: SecaoHidrometrosDespesasProps) {
  const eFixas = tipo === 'fixas'
  const termo = eFixas ? 'Despesas Fixas' : 'Despesas Variáveis'

  const temDados =
    resultado.atual.totalPeriodo !== 0 ||
    Object.values(resultado.atual.valoresPorMes).some((v) => v !== 0) ||
    resultado.resumo.variacaoPct !== null

  const status = statusDoPercentual(percentualFaturamento)
  const variacao = resultado.resumo.variacaoPct

  const mediaMensal = resultado.resumo.mediaMensal
  const maiorMes = resultado.resumo.maiorMes?.valor ?? null

  // Escala do hidrômetro de variação: 0 no centro, ±(2× maior variação observada, mínimo 10%)
  const escalaVariacao = useMemo(() => {
    const candidatos = [variacao ?? 0, 10]
    const maxAbs = Math.max(...candidatos.map((c) => Math.abs(c)))
    return Math.ceil(maxAbs * 2)
  }, [variacao])

  if (!temDados) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0B1F3A] dark:text-slate-100">
            <Gauge className="w-4 h-4 text-sky-700 dark:text-sky-400" />
            Hidrômetros — {termo}
          </CardTitle>
          <CardDescription>
            Indicadores consolidados do exercício em medidores gauge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 py-12 px-6 text-center">
            <Gauge className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Sem dados para o período
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Não há lançamentos suficientes para montar os hidrômetros deste exercício.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 print:break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#0B1F3A] dark:text-slate-100">
          <Gauge className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          Hidrômetros — {termo}
        </CardTitle>
        <CardDescription>
          Indicadores consolidados do exercício {resultado.anoAtual}
          {resultado.anoAnterior?.temDados ? ` vs ${resultado.anoAnterior.ano}` : ''} em medidores
          gauge.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <HodometroGauge
            valor={percentualFaturamento}
            min={0}
            max={100}
            titulo="% sobre o Faturamento"
            subtitulo={`${termo} consolidadas no período`}
            unidade="%"
            formatarValor={(v) => formatarPercentualExport(v)}
            zonas={ZONAS_PERCENTUAL}
            statusTexto={status.texto}
            statusTipo={status.tipo}
            metaTexto="Semáforo: <25% baixo · 25-40% médio · >40% alto"
            tamanho="md"
          />
          <HodometroGauge
            valor={variacao}
            min={-escalaVariacao}
            max={escalaVariacao}
            titulo="Variação vs Ano Anterior"
            subtitulo={
              resultado.anoAnterior?.temDados
                ? `Exercício ${resultado.anoAtual} vs ${resultado.anoAnterior.ano}`
                : 'Sem base de comparação'
            }
            unidade="%"
            formatarValor={(v) => variacaoTexto(v)}
            zonas={[
              { de: -escalaVariacao, ate: 0, cor: '#10B981' },
              { de: 0, ate: escalaVariacao, cor: '#EF4444' },
            ]}
            statusTexto={variacao === null ? 'Sem base' : variacao >= 0 ? 'Aumento' : 'Redução'}
            statusTipo={variacao === null ? 'neutro' : variacao >= 0 ? 'critico' : 'positivo'}
            metaTexto={
              variacao === null
                ? 'Sem lançamentos no exercício anterior'
                : `Total ${ano(resultado)}: ${formatBrl(resultado.resumo.total)}`
            }
            tamanho="md"
          />
          <HodometroGauge
            valor={
              mediaMensal !== null && maiorMes && maiorMes !== 0
                ? (mediaMensal / maiorMes) * 100
                : null
            }
            min={0}
            max={100}
            titulo="Média Mensal"
            subtitulo={`${termo} por mês (${resultado.meses.length} meses)`}
            unidade="%"
            formatarValor={() => (mediaMensal === null ? '—' : formatBrl(mediaMensal))}
            zonas={[{ de: 0, ate: 100, cor: '#144272' }]}
            statusTexto={mediaMensal === null ? 'Sem dados' : 'Média'}
            statusTipo={mediaMensal === null ? 'neutro' : 'neutro'}
            metaTexto={
              mediaMensal === null
                ? 'Sem lançamentos no período'
                : `Escala: % da média vs maior mês (${formatBrl(maiorMes)})`
            }
            tamanho="md"
          />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5">
          Em despesas, aumento em relação ao ano anterior é sinal de atenção (zona vermelha);
          redução é sinal positivo (zona verde).
        </p>
      </CardContent>
    </Card>
  )
}

/** Ano base da análise, extraído do resultado (evita prop extra). */
function ano(resultado: AnaliseAnual360Resultado): number {
  return resultado.anoAtual
}
