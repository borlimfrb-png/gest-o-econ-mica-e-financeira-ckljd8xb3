import React, { useState, useEffect, useMemo } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import {
  empresasService,
  lancamentosService,
  contasService,
  planoContasService,
} from '@/services/financeService'
import type {
  EmpresaRecord,
  LancamentoRecord,
  ContaRecord,
  PlanoContaRecord,
} from '@/types/finance'
import { formatBrlMil, formatCnpj } from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Calendar,
  Building2,
  FileSpreadsheet,
  Download,
  Printer,
  TrendingUp,
  BarChart3,
  Layers,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const NOMES_MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

interface LinhaMesConsolidado {
  mesNumero: number // 1-12
  mesNome: string
  mesAbrev: string
  ativo: number
  passivo: number
  pl: number
  receita: number
  despesa: number
  total: number
}

export default function RelatorioAnual() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()
  const { toast } = useToast()

  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const [allLanc, allContas, allPlano] = await Promise.all([
        lancamentosService.getAll({ expandRelations: true }),
        contasService.getAll(),
        planoContasService.getAll(),
      ])
      setLancamentos(allLanc)
      setContas(allContas)
      setPlanoContas(allPlano)
    } catch (err) {
      console.error('Erro ao carregar dados do relatório anual:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<LancamentoRecord>('lancamentos', () => {
    loadData()
  })
  useRealtime<ContaRecord>('contas', () => {
    loadData()
  })
  useRealtime<PlanoContaRecord>('plano_contas', () => {
    loadData()
  })

  // Lookup de contas
  const contasMap = useMemo(() => {
    const map = new Map<string, ContaRecord>()
    for (const c of contas) map.set(c.id, c)
    return map
  }, [contas])

  // Consolidação dos 12 meses para o Ano e Empresa selecionados
  const dadosConsolidados = useMemo(() => {
    // Inicializar 12 meses
    const meses: LinhaMesConsolidado[] = Array.from({ length: 12 }, (_, i) => ({
      mesNumero: i + 1,
      mesNome: NOMES_MESES[i],
      mesAbrev: NOMES_MESES_ABREV[i],
      ativo: 0,
      passivo: 0,
      pl: 0,
      receita: 0,
      despesa: 0,
      total: 0,
    }))

    if (!selectedEmpresaId) {
      return {
        meses,
        totaisGerais: { ativo: 0, passivo: 0, pl: 0, receita: 0, despesa: 0, total: 0 },
        qtdLancamentos: 0,
      }
    }

    const lancamentosFiltrados = lancamentos.filter((l) => {
      if (l.empresa !== selectedEmpresaId) return false
      if (!l.data) return false
      const anoLanc = parseInt(l.data.slice(0, 4), 10)
      return anoLanc === selectedAno
    })

    for (const l of lancamentosFiltrados) {
      const mesLanc = parseInt(l.data.slice(5, 7), 10)
      if (isNaN(mesLanc) || mesLanc < 1 || mesLanc > 12) continue

      const val = Number(l.valor) || 0
      const mesObj = meses[mesLanc - 1]
      mesObj.total += val

      // Identificar tipo de conta
      const pc = l.expand?.plano_conta || planoContas.find((p) => p.id === l.plano_conta)
      const conta = pc?.expand?.conta || (pc?.conta ? contasMap.get(pc.conta) : undefined)
      const tipoConta = conta?.tipo

      if (tipoConta === 'Ativo') {
        mesObj.ativo += val
      } else if (tipoConta === 'Passivo') {
        mesObj.passivo += val
      } else if (tipoConta === 'Patrimônio Líquido') {
        mesObj.pl += val
      } else if (tipoConta === 'Receita') {
        mesObj.receita += val
      } else if (tipoConta === 'Despesa') {
        mesObj.despesa += val
      }
    }

    const totaisGerais = meses.reduce(
      (acc, m) => ({
        ativo: acc.ativo + m.ativo,
        passivo: acc.passivo + m.passivo,
        pl: acc.pl + m.pl,
        receita: acc.receita + m.receita,
        despesa: acc.despesa + m.despesa,
        total: acc.total + m.total,
      }),
      { ativo: 0, passivo: 0, pl: 0, receita: 0, despesa: 0, total: 0 },
    )

    return {
      meses,
      totaisGerais,
      qtdLancamentos: lancamentosFiltrados.length,
    }
  }, [lancamentos, selectedEmpresaId, selectedAno, planoContas, contasMap])

  // Exportar CSV
  const handleExportCsv = () => {
    if (!selectedEmpresa) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para exportar o relatório.',
        variant: 'destructive',
      })
      return
    }

    let csvContent = '\uFEFF' // BOM UTF-8
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `RELATÓRIO CONSOLIDADO ANUAL DE LANÇAMENTOS\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `ANO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    // Cabeçalho solicitado: Mês, Ativo, Passivo, PL, Receita, Despesa, Total
    csvContent += `Mês;Ativo;Passivo;PL;Receita;Despesa;Total\n`

    for (const m of dadosConsolidados.meses) {
      csvContent += `${m.mesNome};${m.ativo.toFixed(2).replace('.', ',')};${m.passivo
        .toFixed(2)
        .replace('.', ',')};${m.pl.toFixed(2).replace('.', ',')};${m.receita
        .toFixed(2)
        .replace('.', ',')};${m.despesa.toFixed(2).replace('.', ',')};${m.total
        .toFixed(2)
        .replace('.', ',')}\n`
    }

    // Linha de totais
    const t = dadosConsolidados.totaisGerais
    csvContent += `TOTAL ANUAL;${t.ativo.toFixed(2).replace('.', ',')};${t.passivo
      .toFixed(2)
      .replace('.', ',')};${t.pl.toFixed(2).replace('.', ',')};${t.receita
      .toFixed(2)
      .replace('.', ',')};${t.despesa.toFixed(2).replace('.', ',')};${t.total
      .toFixed(2)
      .replace('.', ',')}\n`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `relatorio_anual_${selectedEmpresa.nome.toLowerCase().replace(/\s+/g, '_')}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Arquivo CSV Exportado com Sucesso',
      description: 'O relatório consolidado de 12 meses foi baixado.',
    })
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading && empresas.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Carregando relatório consolidado...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Controles de Filtros e Ações de Exportação */}
      <div className="print:hidden bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Seletor Empresa */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">Empresa:</span>
            <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[180px] sm:w-[220px]">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome} ({emp.segmento})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seletor Ano */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">Ano:</span>
            <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <Select
                value={String(selectedAno)}
                onValueChange={(val) => setSelectedAno(Number(val))}
              >
                <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[80px]">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Botões de Exportação */}
        <div className="flex items-center gap-2 self-start sm:self-end">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="h-9 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>

          <Button
            onClick={handlePrint}
            className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {!selectedEmpresa ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhuma empresa selecionada</h3>
          <p className="text-xs text-slate-500 mt-1">
            Selecione uma empresa para visualizar a consolidação anual dos 12 meses.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Banner de Identificação */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#0B1F3A]">{selectedEmpresa.nome}</h2>
                  <Badge
                    variant="secondary"
                    className="text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {selectedEmpresa.segmento}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  CNPJ: {formatCnpj(selectedEmpresa.cnpj)} · Exercício de Referência:{' '}
                  <span className="font-semibold text-slate-700">{selectedAno}</span> · Total de
                  Lançamentos: <strong>{dadosConsolidados.qtdLancamentos}</strong>
                </p>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Total Consolidado no Ano
              </span>
              <span className="text-lg font-extrabold text-[#0B1F3A]">
                {formatBrlMil(dadosConsolidados.totaisGerais.total)}
              </span>
            </div>
          </div>

          {/* Gráfico de Barras Empilhadas: 12 Meses no Eixo X e Tipos de Conta como Segmentos */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  Evolução Mensal por Tipo de Conta ({selectedAno})
                </span>
                <span className="text-xs font-normal text-slate-500">
                  12 meses consolidados · Barras empilhadas
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Distribuição dos valores lançados de Janeiro a Dezembro por tipo contábil (Ativo,
                Passivo, PL, Receita, Despesa)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosConsolidados.meses}
                    margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="mesAbrev"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [formatBrlMil(Number(val)), name]}
                      labelFormatter={(label) => `Mês: ${label}/${selectedAno}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar
                      dataKey="ativo"
                      name="Ativo"
                      fill="#2563EB"
                      radius={[0, 0, 0, 0]}
                      stackId="mes"
                    />
                    <Bar
                      dataKey="passivo"
                      name="Passivo"
                      fill="#F59E0B"
                      radius={[0, 0, 0, 0]}
                      stackId="mes"
                    />
                    <Bar
                      dataKey="pl"
                      name="Patrimônio Líquido"
                      fill="#8B5CF6"
                      radius={[0, 0, 0, 0]}
                      stackId="mes"
                    />
                    <Bar
                      dataKey="receita"
                      name="Receita"
                      fill="#10B981"
                      radius={[0, 0, 0, 0]}
                      stackId="mes"
                    />
                    <Bar
                      dataKey="despesa"
                      name="Despesa"
                      fill="#EF4444"
                      radius={[3, 3, 0, 0]}
                      stackId="mes"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tabela Agrupada por Mês (Janeiro a Dezembro) e por Tipo de Conta */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Demonstrativo Consolidado de Lançamentos ({selectedAno})
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Valores mensais de Ativo, Passivo, Patrimônio Líquido, Receitas e Despesas com
                  totalizador geral
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                      <th className="py-2.5 px-3">Mês</th>
                      <th className="py-2.5 px-3 text-right text-blue-700">Ativo</th>
                      <th className="py-2.5 px-3 text-right text-amber-700">Passivo</th>
                      <th className="py-2.5 px-3 text-right text-purple-700">Patrimônio Líquido</th>
                      <th className="py-2.5 px-3 text-right text-emerald-700">Receita</th>
                      <th className="py-2.5 px-3 text-right text-red-700">Despesa</th>
                      <th className="py-2.5 px-3 text-right font-extrabold text-[#0B1F3A] bg-slate-200/60">
                        Total do Mês
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dadosConsolidados.meses.map((linha) => {
                      const temLancamentos = linha.total > 0

                      return (
                        <tr
                          key={linha.mesNumero}
                          className={`hover:bg-slate-50 transition-colors ${
                            temLancamentos ? '' : 'text-slate-400'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-800 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono">
                              {linha.mesNumero}
                            </span>
                            {linha.mesNome}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {linha.ativo > 0 ? (
                              formatBrlMil(linha.ativo)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {linha.passivo > 0 ? (
                              formatBrlMil(linha.passivo)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {linha.pl > 0 ? (
                              formatBrlMil(linha.pl)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                            {linha.receita > 0 ? (
                              formatBrlMil(linha.receita)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-red-700">
                            {linha.despesa > 0 ? (
                              formatBrlMil(linha.despesa)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#0B1F3A] bg-slate-50">
                            {linha.total > 0 ? (
                              formatBrlMil(linha.total)
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Rodapé com totalizador de cada coluna e total geral */}
                  <tfoot>
                    <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-3 px-3 uppercase tracking-wider text-xs font-bold text-[#0B1F3A]">
                        Total Anual ({selectedAno})
                      </td>
                      <td className="py-3 px-3 text-right text-blue-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.ativo)}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.passivo)}
                      </td>
                      <td className="py-3 px-3 text-right text-purple-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.pl)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.receita)}
                      </td>
                      <td className="py-3 px-3 text-right text-red-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.despesa)}
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-black text-blue-900 bg-slate-200">
                        {formatBrlMil(dadosConsolidados.totaisGerais.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
