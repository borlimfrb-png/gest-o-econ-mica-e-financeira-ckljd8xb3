import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Grid3x3 } from 'lucide-react'
import { formatBrlPontoEquilibrio, formatPercentualPontoEquilibrio } from './pontoEquilibrioFormat'
import { getClassesMargemSeguranca, type PontoEquilibrioAno } from '@/lib/pontoEquilibrioCalculo'
import type { PontoEquilibrioAnoComMetaDespesa } from '@/lib/pontoEquilibrioMetaDespesaComparativo'
import { getClassesPercentualMeta } from '@/lib/pontoEquilibrioMetaComparativo'
import { getClassesPercentualMetaDespesa } from '@/lib/pontoEquilibrioMetaDespesaComparativo'

const TRACO = '—'

function fmtNum(v: number): string {
  return formatBrlPontoEquilibrio(v)
}

function fmtPct(v: number | null): string {
  return formatPercentualPontoEquilibrio(v)
}

function fmtMult(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return TRACO
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
}

type Posicao = PontoEquilibrioAno['meses'][number]['posicao']

const badgePosicao: Record<Posicao, { texto: string; classes: string }> = {
  acima: { texto: 'Acima', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  abaixo: { texto: 'Abaixo', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  'no-ponto': { texto: 'No ponto', classes: 'bg-slate-50 text-slate-600 border-slate-200' },
  'sem-pe': { texto: 'PE indefinido', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  'sem-movimento': {
    texto: 'Sem movimento',
    classes: 'bg-slate-50 text-slate-400 border-slate-200',
  },
}

export function MatrizPontoEquilibrio({ ano }: { ano: PontoEquilibrioAnoComMetaDespesa }) {
  const meses = ano.meses

  const totalReceita = useMemo(() => ano.totalReceita, [ano])
  const totalVariaveis = useMemo(() => ano.totalDespesasVariaveis, [ano])
  const totalFixas = useMemo(() => ano.totalDespesasFixas, [ano])
  const totalMargem = useMemo(() => ano.margemTotal, [ano])
  const totalResultado = useMemo(() => ano.resultadoAnual, [ano])

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <Grid3x3 className="w-4 h-4 text-slate-600" />
          Cálculo Mês a Mês ({ano.ano})
        </CardTitle>
        <CardDescription className="text-xs">
          PE = Despesas Fixas ÷ Margem de Contribuição %. "—" = mês sem movimento, PE indefinido
          (margem ≤ 0) ou meta não cadastrada. Verde ≥ 100% da meta, âmbar 80–99,99%, vermelho &lt;
          80%. Passe o mouse sobre os badges para a posição do mês.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="sticky left-0 z-10 bg-slate-50 text-[11px] font-semibold text-slate-600 min-w-[190px]">
                  Indicador
                </TableHead>
                {meses.map((m) => (
                  <TableHead
                    key={m.chave}
                    className="text-center text-[11px] font-semibold text-slate-600 min-w-[74px]"
                  >
                    {m.rotuloCurto}
                  </TableHead>
                ))}
                <TableHead className="text-center text-[11px] font-bold text-[#0B1F3A] min-w-[90px]">
                  Total Ano
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Linha
                label="Receita Bruta"
                destacar={false}
                celulas={meses.map((m) => (m.temMovimento ? fmtNum(m.receita) : TRACO))}
                total={totalReceita !== 0 ? fmtNum(totalReceita) : TRACO}
              />
              <Linha
                label="Meta de Receita"
                destacar={false}
                celulas={meses.map((m) => (m.meta !== null ? fmtNum(m.meta) : TRACO))}
                total={ano.totalMeta !== null ? fmtNum(ano.totalMeta) : TRACO}
              />
              <Linha
                label="% da Meta Atingido"
                destacar={false}
                celulas={meses.map((m) => {
                  if (m.percentualMeta === null) return TRACO
                  const cls = getClassesPercentualMeta(m.percentualMeta)
                  return (
                    <span className={`font-medium ${cls.texto}`}>{fmtPct(m.percentualMeta)}</span>
                  )
                })}
                total={(() => {
                  if (ano.totalPercentualMeta === null) return TRACO
                  const cls = getClassesPercentualMeta(ano.totalPercentualMeta)
                  return (
                    <span className={`font-bold ${cls.texto}`}>
                      {fmtPct(ano.totalPercentualMeta)}
                    </span>
                  )
                })()}
              />
              <Linha
                label="Diferença Realizado − Meta"
                destacar={false}
                celulas={meses.map((m) =>
                  m.diferencaMeta !== null ? (
                    <span className={m.diferencaMeta >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {fmtNum(m.diferencaMeta)}
                    </span>
                  ) : (
                    TRACO
                  ),
                )}
                total={(() => {
                  if (ano.totalDiferencaMeta === null) return TRACO
                  return (
                    <span
                      className={
                        ano.totalDiferencaMeta >= 0
                          ? 'text-emerald-700 font-bold'
                          : 'text-rose-700 font-bold'
                      }
                    >
                      {fmtNum(ano.totalDiferencaMeta)}
                    </span>
                  )
                })()}
              />
              <Linha
                label="Despesas Variáveis"
                destacar={false}
                celulas={meses.map((m) => (m.temMovimento ? fmtNum(m.despesasVariaveis) : TRACO))}
                total={totalVariaveis !== 0 ? fmtNum(totalVariaveis) : TRACO}
              />
              <Linha
                label="Margem de Contribuição (R$)"
                destacar={false}
                celulas={meses.map((m) => (m.temMovimento ? fmtNum(m.margemValor) : TRACO))}
                total={totalMargem !== 0 ? fmtNum(totalMargem) : TRACO}
              />
              <Linha
                label="Margem de Contribuição (%)"
                destacar={false}
                celulas={meses.map((m) => fmtPct(m.margemPercentual))}
                total={fmtPct(ano.margemAnualPercentual)}
              />
              <Linha
                label="Despesas Fixas"
                destacar={false}
                celulas={meses.map((m) =>
                  m.temMovimento || m.despesasFixas !== 0 ? fmtNum(m.despesasFixas) : TRACO,
                )}
                total={totalFixas !== 0 ? fmtNum(totalFixas) : TRACO}
              />
              <Linha
                label="Ponto de Equilíbrio (R$)"
                destacar
                celulas={meses.map((m) =>
                  m.pontoEquilibrio !== null ? fmtNum(m.pontoEquilibrio) : TRACO,
                )}
                total={ano.pontoEquilibrioAnual !== null ? fmtNum(ano.pontoEquilibrioAnual) : TRACO}
              />
              <Linha
                label="Margem de Segurança (%)"
                destacar={false}
                celulas={meses.map((m) => {
                  const cls = getClassesMargemSeguranca(m.margemSegurancaPercentual)
                  return m.margemSegurancaPercentual !== null ? (
                    <span className={`font-medium ${cls.texto}`}>
                      {fmtPct(m.margemSegurancaPercentual)}
                    </span>
                  ) : (
                    TRACO
                  )
                })}
                total={(() => {
                  const cls = getClassesMargemSeguranca(ano.margemSegurancaAnualPercentual)
                  return ano.margemSegurancaAnualPercentual !== null ? (
                    <span className={`font-bold ${cls.texto}`}>
                      {fmtPct(ano.margemSegurancaAnualPercentual)}
                    </span>
                  ) : (
                    TRACO
                  )
                })()}
              />
              <Linha
                label="Resultado do Mês"
                destacar={false}
                celulas={meses.map((m) => {
                  if (!m.temMovimento && m.despesasFixas === 0) return TRACO
                  return (
                    <span className={m.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {fmtNum(m.resultado)}
                    </span>
                  )
                })}
                total={
                  totalResultado !== 0 ? (
                    <span
                      className={
                        totalResultado >= 0
                          ? 'text-emerald-700 font-bold'
                          : 'text-rose-700 font-bold'
                      }
                    >
                      {fmtNum(totalResultado)}
                    </span>
                  ) : (
                    TRACO
                  )
                }
              />
              <Linha
                label="Meta de Despesa"
                destacar={false}
                celulas={meses.map((m) => (m.metaDespesa !== null ? fmtNum(m.metaDespesa) : TRACO))}
                total={ano.totalMetaDespesa !== null ? fmtNum(ano.totalMetaDespesa) : TRACO}
              />
              <Linha
                label="% da Meta de Despesa"
                destacar={false}
                celulas={meses.map((m) => {
                  if (m.percentualMetaDespesa === null) return TRACO
                  const cls = getClassesPercentualMetaDespesa(m.percentualMetaDespesa)
                  return (
                    <span className={`font-medium ${cls.texto}`}>
                      {fmtPct(m.percentualMetaDespesa)}
                    </span>
                  )
                })}
                total={(() => {
                  if (ano.totalPercentualMetaDespesa === null) return TRACO
                  const cls = getClassesPercentualMetaDespesa(ano.totalPercentualMetaDespesa)
                  return (
                    <span className={`font-bold ${cls.texto}`}>
                      {fmtPct(ano.totalPercentualMetaDespesa)}
                    </span>
                  )
                })()}
              />
              <Linha
                label="Diferença Realizado − Meta de Despesa"
                destacar={false}
                celulas={meses.map((m) =>
                  m.diferencaMetaDespesa !== null ? (
                    <span
                      className={
                        m.diferencaMetaDespesa <= 0 ? 'text-emerald-700' : 'text-amber-700'
                      }
                    >
                      {fmtNum(m.diferencaMetaDespesa)}
                    </span>
                  ) : (
                    TRACO
                  ),
                )}
                total={(() => {
                  if (ano.totalDiferencaMetaDespesa === null) return TRACO
                  return (
                    <span
                      className={
                        ano.totalDiferencaMetaDespesa <= 0
                          ? 'text-emerald-700 font-bold'
                          : 'text-amber-700 font-bold'
                      }
                    >
                      {fmtNum(ano.totalDiferencaMetaDespesa)}
                    </span>
                  )
                })()}
              />
              <Linha
                label="Posição vs PE"
                destacar={false}
                celulas={meses.map((m) => {
                  const b = badgePosicao[m.posicao]
                  return m.posicao === 'sem-movimento' ? (
                    <span className="text-slate-300">{TRACO}</span>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${b.classes}`}>
                      {b.texto}
                    </Badge>
                  )
                })}
                total=""
              />
              <Linha
                label="GAO (Alavancagem)"
                destacar={false}
                celulas={meses.map((m) => fmtMult(m.grauAlavancagemOperacional))}
                total={fmtMult(ano.grauAlavancagemAnual)}
              />
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function Linha({
  label,
  celulas,
  total,
  destacar,
}: {
  label: string
  celulas: React.ReactNode[]
  total: React.ReactNode
  destacar: boolean
}) {
  return (
    <TableRow className={destacar ? 'bg-amber-50/40 hover:bg-amber-50/60' : ''}>
      <TableCell
        className={`sticky left-0 z-10 bg-inherit text-xs font-medium text-slate-700 ${
          destacar ? 'font-bold' : ''
        }`}
      >
        {label}
      </TableCell>
      {celulas.map((c, i) => (
        <TableCell key={i} className="text-center text-xs tabular-nums">
          {c}
        </TableCell>
      ))}
      <TableCell className="text-center text-xs tabular-nums font-bold border-l border-slate-200">
        {total}
      </TableCell>
    </TableRow>
  )
}
