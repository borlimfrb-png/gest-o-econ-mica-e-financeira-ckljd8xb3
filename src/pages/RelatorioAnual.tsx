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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
  TrendingDown,
  BarChart3,
  Layers,
  ArrowUpDown,
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
  // Ano Atual
  ativo: number
  passivo: number
  pl: number
  receita: number
  despesa: number
  total: number
  // Ano Anterior
  ativoAnterior: number
  passivoAnterior: number
  plAnterior: number
  receitaAnterior: number
  despesaAnterior: number
  totalAnterior: number
  // Variação % Total
  variacaoTotalPct: number | null
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
  const [compararAnoAnterior, setCompararAnoAnterior] = useState<boolean>(false)
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

  // Consolidação dos 12 meses para o Ano Atual e Ano Anterior
  const anoAnterior = selectedAno - 1

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
      ativoAnterior: 0,
      passivoAnterior: 0,
      plAnterior: 0,
      receitaAnterior: 0,
      despesaAnterior: 0,
      totalAnterior: 0,
      variacaoTotalPct: null,
    }))

    if (!selectedEmpresaId) {
      return {
        meses,
        totaisGerais: {
          ativo: 0,
          passivo: 0,
          pl: 0,
          receita: 0,
          despesa: 0,
          total: 0,
          ativoAnterior: 0,
          passivoAnterior: 0,
          plAnterior: 0,
          receitaAnterior: 0,
          despesaAnterior: 0,
          totalAnterior: 0,
          variacaoTotalPct: null as number | null,
        },
        qtdLancamentos: 0,
        qtdLancamentosAnterior: 0,
      }
    }

    const lancamentosEmpresa = lancamentos.filter(
      (l) => l.empresa === selectedEmpresaId && Boolean(l.data),
    )

    let qtdAtual = 0
    let qtdAnt = 0

    for (const l of lancamentosEmpresa) {
      const anoLanc = parseInt((l.data || '').slice(0, 4), 10)
      const mesLanc = parseInt((l.data || '').slice(5, 7), 10)
      if (isNaN(mesLanc) || mesLanc < 1 || mesLanc > 12) continue

      const val = Number(l.valor) || 0
      const mesObj = meses[mesLanc - 1]

      // Identificar tipo de conta
      const pc = l.expand?.plano_conta || planoContas.find((p) => p.id === l.plano_conta)
      const conta = pc?.expand?.conta || (pc?.conta ? contasMap.get(pc.conta) : undefined)
      const tipoConta = conta?.tipo

      if (anoLanc === selectedAno) {
        qtdAtual++
        mesObj.total += val
        if (tipoConta === 'Ativo') mesObj.ativo += val
        else if (tipoConta === 'Passivo') mesObj.passivo += val
        else if (tipoConta === 'Patrimônio Líquido') mesObj.pl += val
        else if (tipoConta === 'Receita') mesObj.receita += val
        else if (tipoConta === 'Despesa') mesObj.despesa += val
      } else if (anoLanc === anoAnterior) {
        qtdAnt++
        mesObj.totalAnterior += val
        if (tipoConta === 'Ativo') mesObj.ativoAnterior += val
        else if (tipoConta === 'Passivo') mesObj.passivoAnterior += val
        else if (tipoConta === 'Patrimônio Líquido') mesObj.plAnterior += val
        else if (tipoConta === 'Receita') mesObj.receitaAnterior += val
        else if (tipoConta === 'Despesa') mesObj.despesaAnterior += val
      }
    }

    // Calcular Variação % por mês
    for (const m of meses) {
      if (m.totalAnterior > 0) {
        m.variacaoTotalPct = ((m.total - m.totalAnterior) / m.totalAnterior) * 100
      } else if (m.total > 0 && m.totalAnterior === 0) {
        m.variacaoTotalPct = 100
      } else if (m.total === 0 && m.totalAnterior === 0) {
        m.variacaoTotalPct = 0
      } else {
        m.variacaoTotalPct = null
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
        ativoAnterior: acc.ativoAnterior + m.ativoAnterior,
        passivoAnterior: acc.passivoAnterior + m.passivoAnterior,
        plAnterior: acc.plAnterior + m.plAnterior,
        receitaAnterior: acc.receitaAnterior + m.receitaAnterior,
        despesaAnterior: acc.despesaAnterior + m.despesaAnterior,
        totalAnterior: acc.totalAnterior + m.totalAnterior,
        variacaoTotalPct: null as number | null,
      }),
      {
        ativo: 0,
        passivo: 0,
        pl: 0,
        receita: 0,
        despesa: 0,
        total: 0,
        ativoAnterior: 0,
        passivoAnterior: 0,
        plAnterior: 0,
        receitaAnterior: 0,
        despesaAnterior: 0,
        totalAnterior: 0,
        variacaoTotalPct: null as number | null,
      },
    )

    if (totaisGerais.totalAnterior > 0) {
      totaisGerais.variacaoTotalPct =
        ((totaisGerais.total - totaisGerais.totalAnterior) / totaisGerais.totalAnterior) * 100
    } else if (totaisGerais.total > 0 && totaisGerais.totalAnterior === 0) {
      totaisGerais.variacaoTotalPct = 100
    } else if (totaisGerais.total === 0 && totaisGerais.totalAnterior === 0) {
      totaisGerais.variacaoTotalPct = 0
    }

    return {
      meses,
      totaisGerais,
      qtdLancamentos: qtdAtual,
      qtdLancamentosAnterior: qtdAnt,
    }
  }, [lancamentos, selectedEmpresaId, selectedAno, anoAnterior, planoContas, contasMap])

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
    csvContent += `ANO EXERCÍCIO;${selectedAno}${
      compararAnoAnterior ? ` (Comparado com ${anoAnterior})` : ''
    }\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    if (compararAnoAnterior) {
      // Cabeçalho com comparação anual
      csvContent += `Mês;Ativo (${selectedAno});Ativo (${anoAnterior});Passivo (${selectedAno});Passivo (${anoAnterior});PL (${selectedAno});PL (${anoAnterior});Receita (${selectedAno});Receita (${anoAnterior});Despesa (${selectedAno});Despesa (${anoAnterior});Total (${selectedAno});Total (${anoAnterior});Variação %\n`

      for (const m of dadosConsolidados.meses) {
        const varStr =
          m.variacaoTotalPct !== null ? `${m.variacaoTotalPct.toFixed(2).replace('.', ',')}%` : '—'
        csvContent += `${m.mesNome};${m.ativo.toFixed(2).replace('.', ',')};${m.ativoAnterior
          .toFixed(2)
          .replace('.', ',')};${m.passivo.toFixed(2).replace('.', ',')};${m.passivoAnterior
          .toFixed(2)
          .replace('.', ',')};${m.pl.toFixed(2).replace('.', ',')};${m.plAnterior
          .toFixed(2)
          .replace('.', ',')};${m.receita.toFixed(2).replace('.', ',')};${m.receitaAnterior
          .toFixed(2)
          .replace('.', ',')};${m.despesa.toFixed(2).replace('.', ',')};${m.despesaAnterior
          .toFixed(2)
          .replace('.', ',')};${m.total.toFixed(2).replace('.', ',')};${m.totalAnterior
          .toFixed(2)
          .replace('.', ',')};${varStr}\n`
      }

      // Linha de totais
      const t = dadosConsolidados.totaisGerais
      const varTotStr =
        t.variacaoTotalPct !== null ? `${t.variacaoTotalPct.toFixed(2).replace('.', ',')}%` : '—'
      csvContent += `TOTAL ANUAL;${t.ativo.toFixed(2).replace('.', ',')};${t.ativoAnterior
        .toFixed(2)
        .replace('.', ',')};${t.passivo.toFixed(2).replace('.', ',')};${t.passivoAnterior
        .toFixed(2)
        .replace('.', ',')};${t.pl.toFixed(2).replace('.', ',')};${t.plAnterior
        .toFixed(2)
        .replace('.', ',')};${t.receita.toFixed(2).replace('.', ',')};${t.receitaAnterior
        .toFixed(2)
        .replace('.', ',')};${t.despesa.toFixed(2).replace('.', ',')};${t.despesaAnterior
        .toFixed(2)
        .replace('.', ',')};${t.total.toFixed(2).replace('.', ',')};${t.totalAnterior
        .toFixed(2)
        .replace('.', ',')};${varTotStr}\n`
    } else {
      // Cabeçalho simples
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
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `relatorio_anual_${selectedEmpresa.nome.toLowerCase().replace(/\s+/g, '_')}_${selectedAno}${
        compararAnoAnterior ? `_vs_${anoAnterior}` : ''
      }.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Arquivo CSV Exportado com Sucesso',
      description: compararAnoAnterior
        ? `O relatório comparativo (${selectedAno} vs ${anoAnterior}) foi baixado.`
        : 'O relatório consolidado de 12 meses foi baixado.',
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

          {/* Toggle de Comparação com Ano Anterior */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">Comparativo:</span>
            <div className="flex items-center gap-2 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3 py-1.5 h-9">
              <Switch
                id="toggle-comparar-ano"
                checked={compararAnoAnterior}
                onCheckedChange={setCompararAnoAnterior}
              />
              <Label
                htmlFor="toggle-comparar-ano"
                className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
              >
                Comparar com ano anterior ({anoAnterior})
              </Label>
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
          {/* Gráfico de Barras: 12 Meses no Eixo X */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  {compararAnoAnterior
                    ? `Comparativo Mensal: ${selectedAno} vs ${anoAnterior}`
                    : `Evolução Mensal por Tipo de Conta (${selectedAno})`}
                </span>
                <span className="text-xs font-normal text-slate-500">
                  {compararAnoAnterior
                    ? `Série lado a lado (${selectedAno} / ${anoAnterior})`
                    : '12 meses consolidados · Barras empilhadas'}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {compararAnoAnterior
                  ? `Comparação visual das contas no ano ${selectedAno} (cores cheias) versus o ano ${anoAnterior} (cores mais claras/opacas)`
                  : 'Distribuição dos valores lançados de Janeiro a Dezembro por tipo contábil (Ativo, Passivo, PL, Receita, Despesa)'}
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
                      labelFormatter={(label) => `Mês: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                    {compararAnoAnterior ? (
                      <>
                        {/* SÉRIE ANO ATUAL (stackId = atual) */}
                        <Bar
                          dataKey="ativo"
                          name={`Ativo (${selectedAno})`}
                          fill="#2563EB"
                          stackId="atual"
                        />
                        <Bar
                          dataKey="passivo"
                          name={`Passivo (${selectedAno})`}
                          fill="#F59E0B"
                          stackId="atual"
                        />
                        <Bar
                          dataKey="pl"
                          name={`PL (${selectedAno})`}
                          fill="#8B5CF6"
                          stackId="atual"
                        />
                        <Bar
                          dataKey="receita"
                          name={`Receita (${selectedAno})`}
                          fill="#10B981"
                          stackId="atual"
                        />
                        <Bar
                          dataKey="despesa"
                          name={`Despesa (${selectedAno})`}
                          fill="#EF4444"
                          radius={[3, 3, 0, 0]}
                          stackId="atual"
                        />

                        {/* SÉRIE ANO ANTERIOR (stackId = anterior — cores mais claras/opacas lado a lado) */}
                        <Bar
                          dataKey="ativoAnterior"
                          name={`Ativo (${anoAnterior})`}
                          fill="#93C5FD"
                          stackId="anterior"
                        />
                        <Bar
                          dataKey="passivoAnterior"
                          name={`Passivo (${anoAnterior})`}
                          fill="#FDE68A"
                          stackId="anterior"
                        />
                        <Bar
                          dataKey="plAnterior"
                          name={`PL (${anoAnterior})`}
                          fill="#DDD6FE"
                          stackId="anterior"
                        />
                        <Bar
                          dataKey="receitaAnterior"
                          name={`Receita (${anoAnterior})`}
                          fill="#A7F3D0"
                          stackId="anterior"
                        />
                        <Bar
                          dataKey="despesaAnterior"
                          name={`Despesa (${anoAnterior})`}
                          fill="#FECACA"
                          radius={[3, 3, 0, 0]}
                          stackId="anterior"
                        />
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
                  Demonstrativo Consolidado de Lançamentos ({selectedAno}
                  {compararAnoAnterior ? ` vs ${anoAnterior}` : ''})
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {compararAnoAnterior
                    ? `Valores mensais comparados com o ano anterior (${anoAnterior}) lado a lado com variação percentual (%)`
                    : 'Valores mensais de Ativo, Passivo, Patrimônio Líquido, Receitas e Despesas com totalizador geral'}
                </CardDescription>
              </div>

              {compararAnoAnterior && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold self-start sm:self-auto">
                  Comparação Ativa: {selectedAno} vs {anoAnterior}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                      <th className="py-2.5 px-3 sticky left-0 bg-slate-100 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        Mês
                      </th>

                      {/* ATIVO */}
                      <th className="py-2.5 px-3 text-right text-blue-700">
                        Ativo ({selectedAno})
                      </th>
                      {compararAnoAnterior && (
                        <th className="py-2.5 px-3 text-right text-blue-400 bg-blue-50/40 font-semibold">
                          Ativo ({anoAnterior})
                        </th>
                      )}

                      {/* PASSIVO */}
                      <th className="py-2.5 px-3 text-right text-amber-700">
                        Passivo ({selectedAno})
                      </th>
                      {compararAnoAnterior && (
                        <th className="py-2.5 px-3 text-right text-amber-400 bg-amber-50/40 font-semibold">
                          Passivo ({anoAnterior})
                        </th>
                      )}

                      {/* PL */}
                      <th className="py-2.5 px-3 text-right text-purple-700">PL ({selectedAno})</th>
                      {compararAnoAnterior && (
                        <th className="py-2.5 px-3 text-right text-purple-400 bg-purple-50/40 font-semibold">
                          PL ({anoAnterior})
                        </th>
                      )}

                      {/* RECEITA */}
                      <th className="py-2.5 px-3 text-right text-emerald-700">
                        Receita ({selectedAno})
                      </th>
                      {compararAnoAnterior && (
                        <th className="py-2.5 px-3 text-right text-emerald-400 bg-emerald-50/40 font-semibold">
                          Receita ({anoAnterior})
                        </th>
                      )}

                      {/* DESPESA */}
                      <th className="py-2.5 px-3 text-right text-red-700">
                        Despesa ({selectedAno})
                      </th>
                      {compararAnoAnterior && (
                        <th className="py-2.5 px-3 text-right text-red-400 bg-red-50/40 font-semibold">
                          Despesa ({anoAnterior})
                        </th>
                      )}

                      {/* TOTAL DO MÊS */}
                      <th className="py-2.5 px-3 text-right font-extrabold text-[#0B1F3A] bg-slate-200/60">
                        Total ({selectedAno})
                      </th>
                      {compararAnoAnterior && (
                        <th className="py-2.5 px-3 text-right font-bold text-slate-600 bg-slate-200/40">
                          Total ({anoAnterior})
                        </th>
                      )}

                      {/* VARIAÇÃO % */}
                      {compararAnoAnterior && (
                        <th className="py-2.5 px-3 text-center font-bold text-slate-800 bg-slate-100 border-l border-slate-200">
                          Variação %
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {dadosConsolidados.meses.map((linha) => {
                      const temLancamentos =
                        linha.total > 0 || (compararAnoAnterior && linha.totalAnterior > 0)
                      const varPct = linha.variacaoTotalPct

                      return (
                        <tr
                          key={linha.mesNumero}
                          className={`hover:bg-slate-50 transition-colors ${
                            temLancamentos ? '' : 'text-slate-400'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-800 flex items-center gap-2 sticky left-0 bg-white z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono">
                              {linha.mesNumero}
                            </span>
                            {linha.mesNome}
                          </td>

                          {/* ATIVO */}
                          <td className="py-2.5 px-3 text-right font-medium">
                            {linha.ativo > 0 ? (
                              formatBrlMil(linha.ativo)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          {compararAnoAnterior && (
                            <td className="py-2.5 px-3 text-right text-slate-500 bg-blue-50/20">
                              {linha.ativoAnterior > 0 ? (
                                formatBrlMil(linha.ativoAnterior)
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}

                          {/* PASSIVO */}
                          <td className="py-2.5 px-3 text-right font-medium">
                            {linha.passivo > 0 ? (
                              formatBrlMil(linha.passivo)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          {compararAnoAnterior && (
                            <td className="py-2.5 px-3 text-right text-slate-500 bg-amber-50/20">
                              {linha.passivoAnterior > 0 ? (
                                formatBrlMil(linha.passivoAnterior)
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}

                          {/* PL */}
                          <td className="py-2.5 px-3 text-right font-medium">
                            {linha.pl > 0 ? (
                              formatBrlMil(linha.pl)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          {compararAnoAnterior && (
                            <td className="py-2.5 px-3 text-right text-slate-500 bg-purple-50/20">
                              {linha.plAnterior > 0 ? (
                                formatBrlMil(linha.plAnterior)
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}

                          {/* RECEITA */}
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                            {linha.receita > 0 ? (
                              formatBrlMil(linha.receita)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          {compararAnoAnterior && (
                            <td className="py-2.5 px-3 text-right text-emerald-600/70 bg-emerald-50/20">
                              {linha.receitaAnterior > 0 ? (
                                formatBrlMil(linha.receitaAnterior)
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}

                          {/* DESPESA */}
                          <td className="py-2.5 px-3 text-right font-medium text-red-700">
                            {linha.despesa > 0 ? (
                              formatBrlMil(linha.despesa)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          {compararAnoAnterior && (
                            <td className="py-2.5 px-3 text-right text-red-600/70 bg-red-50/20">
                              {linha.despesaAnterior > 0 ? (
                                formatBrlMil(linha.despesaAnterior)
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}

                          {/* TOTAL */}
                          <td className="py-2.5 px-3 text-right font-bold text-[#0B1F3A] bg-slate-50">
                            {linha.total > 0 ? (
                              formatBrlMil(linha.total)
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          {compararAnoAnterior && (
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-600 bg-slate-50/60">
                              {linha.totalAnterior > 0 ? (
                                formatBrlMil(linha.totalAnterior)
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>
                          )}

                          {/* VARIAÇÃO % */}
                          {compararAnoAnterior && (
                            <td className="py-2.5 px-3 text-center font-bold border-l border-slate-200">
                              {varPct !== null ? (
                                <span
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] ${
                                    varPct > 0
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : varPct < 0
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {varPct > 0 ? '+' : ''}
                                  {varPct.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>

                  {/* Rodapé com totalizador de cada coluna e total geral */}
                  <tfoot>
                    <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-3 px-3 uppercase tracking-wider text-xs font-bold text-[#0B1F3A] sticky left-0 bg-slate-100 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        Total Anual
                      </td>

                      {/* ATIVO */}
                      <td className="py-3 px-3 text-right text-blue-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.ativo)}
                      </td>
                      {compararAnoAnterior && (
                        <td className="py-3 px-3 text-right text-blue-600 bg-blue-100/40">
                          {formatBrlMil(dadosConsolidados.totaisGerais.ativoAnterior)}
                        </td>
                      )}

                      {/* PASSIVO */}
                      <td className="py-3 px-3 text-right text-amber-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.passivo)}
                      </td>
                      {compararAnoAnterior && (
                        <td className="py-3 px-3 text-right text-amber-600 bg-amber-100/40">
                          {formatBrlMil(dadosConsolidados.totaisGerais.passivoAnterior)}
                        </td>
                      )}

                      {/* PL */}
                      <td className="py-3 px-3 text-right text-purple-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.pl)}
                      </td>
                      {compararAnoAnterior && (
                        <td className="py-3 px-3 text-right text-purple-600 bg-purple-100/40">
                          {formatBrlMil(dadosConsolidados.totaisGerais.plAnterior)}
                        </td>
                      )}

                      {/* RECEITA */}
                      <td className="py-3 px-3 text-right text-emerald-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.receita)}
                      </td>
                      {compararAnoAnterior && (
                        <td className="py-3 px-3 text-right text-emerald-700 bg-emerald-100/40">
                          {formatBrlMil(dadosConsolidados.totaisGerais.receitaAnterior)}
                        </td>
                      )}

                      {/* DESPESA */}
                      <td className="py-3 px-3 text-right text-red-800">
                        {formatBrlMil(dadosConsolidados.totaisGerais.despesa)}
                      </td>
                      {compararAnoAnterior && (
                        <td className="py-3 px-3 text-right text-red-700 bg-red-100/40">
                          {formatBrlMil(dadosConsolidados.totaisGerais.despesaAnterior)}
                        </td>
                      )}

                      {/* TOTAL */}
                      <td className="py-3 px-3 text-right text-sm font-black text-blue-900 bg-slate-200">
                        {formatBrlMil(dadosConsolidados.totaisGerais.total)}
                      </td>
                      {compararAnoAnterior && (
                        <td className="py-3 px-3 text-right text-sm font-bold text-slate-700 bg-slate-200/70">
                          {formatBrlMil(dadosConsolidados.totaisGerais.totalAnterior)}
                        </td>
                      )}

                      {/* VARIAÇÃO % TOTAL */}
                      {compararAnoAnterior && (
                        <td className="py-3 px-3 text-center border-l border-slate-300 bg-slate-200">
                          {dadosConsolidados.totaisGerais.variacaoTotalPct !== null ? (
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-black ${
                                dadosConsolidados.totaisGerais.variacaoTotalPct > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : dadosConsolidados.totaisGerais.variacaoTotalPct < 0
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {dadosConsolidados.totaisGerais.variacaoTotalPct > 0 ? '+' : ''}
                              {dadosConsolidados.totaisGerais.variacaoTotalPct.toFixed(1)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>{' '}
        </div>
      )}
    </div>
  )
}
