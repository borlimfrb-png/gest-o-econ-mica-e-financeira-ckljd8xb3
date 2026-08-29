import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  Printer,
  FileSpreadsheet,
  Download,
  Filter,
  Building,
  Calendar as CalendarIcon,
  DollarSign,
  TrendingUp,
  FileText,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  Mail,
  ShieldCheck,
  Ban,
} from 'lucide-react'
import type { NotaFiscalRecord, EmpresaRecord, MinhaEmpresaRecord } from '@/types/finance'
import { formatCnpj, cleanCnpj } from '@/lib/financeCalculations'
import { formatBrlMoeda } from '@/lib/nfseXmlGenerator'

export interface ModalRelatorioNotasPeriodoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notas: NotaFiscalRecord[]
  empresas: EmpresaRecord[]
  minhaEmpresa: MinhaEmpresaRecord | null
}

function formatarDataBr(dataStr?: string | null): string {
  if (!dataStr) return '—'
  const partes = dataStr.slice(0, 10).split('-')
  if (partes.length === 3) {
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }
  return dataStr
}

function periodoMesCorrenteIso(): { inicio: string; fim: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const primeiroDia = new Date(y, m, 1)
  const ultimoDia = new Date(y, m + 1, 0)
  return {
    inicio: primeiroDia.toISOString().slice(0, 10),
    fim: ultimoDia.toISOString().slice(0, 10),
  }
}

export function ModalRelatorioNotasPeriodo({
  open,
  onOpenChange,
  notas,
  empresas,
  minhaEmpresa,
}: ModalRelatorioNotasPeriodoProps) {
  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10) // 1º de janeiro do ano atual
  })
  const [dataFim, setDataFim] = useState<string>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10) // 31 de dezembro
  })
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Mapa de empresas
  const empresaMap = useMemo(() => {
    const m = new Map<string, EmpresaRecord>()
    for (const e of empresas) m.set(e.id, e)
    return m
  }, [empresas])

  // Filtragem das notas
  const notasFiltradas = useMemo(() => {
    return notas.filter((n) => {
      if (filtroEmpresa !== 'todas' && n.empresa !== filtroEmpresa) return false

      if (filtroStatus !== 'todos' && n.status !== filtroStatus) return false

      const dtStr = (n.data_emissao || n.competencia || '').slice(0, 10)
      if (dataInicio && dtStr && dtStr < dataInicio) return false
      if (dataFim && dtStr && dtStr > dataFim) return false

      return true
    })
  }, [notas, filtroEmpresa, filtroStatus, dataInicio, dataFim])

  // Totais gerais
  const totaisGerais = useMemo(() => {
    let totalServicos = 0
    let totalIss = 0
    let totalRetencoes = 0
    let totalLiquido = 0
    let qtdEmitidas = 0
    let qtdCanceladas = 0

    for (const n of notasFiltradas) {
      if (n.status === 'Cancelada') {
        qtdCanceladas += 1
        continue
      }
      qtdEmitidas += 1
      totalServicos += Number(n.valor_servicos) || 0
      totalIss += Number(n.valor_iss) || 0
      totalRetencoes +=
        (Number(n.valor_pis) || 0) +
        (Number(n.valor_cofins) || 0) +
        (Number(n.valor_inss) || 0) +
        (Number(n.valor_ir) || 0) +
        (Number(n.valor_csll) || 0) +
        (Number(n.outras_retencoes) || 0)
      totalLiquido += Number(n.valor_liquido) || 0
    }

    return {
      totalServicos,
      totalIss,
      totalRetencoes,
      totalLiquido,
      qtdEmitidas,
      qtdCanceladas,
      qtdTotal: notasFiltradas.length,
    }
  }, [notasFiltradas])

  // Agrupamento por Cliente
  const agrupamentoPorCliente = useMemo(() => {
    const map = new Map<
      string,
      {
        clienteNome: string
        cnpj: string
        qtdNotas: number
        totalServicos: number
        totalIss: number
        totalLiquido: number
        notas: NotaFiscalRecord[]
      }
    >()

    for (const n of notasFiltradas) {
      const empId = n.empresa || 'sem_empresa'
      const emp = n.expand?.empresa || empresaMap.get(n.empresa)
      const nome = n.tomador_razao_social || emp?.nome || 'Cliente Não Identificado'
      const cnpj = n.tomador_cnpj || emp?.cnpj || ''

      if (!map.has(empId)) {
        map.set(empId, {
          clienteNome: nome,
          cnpj,
          qtdNotas: 0,
          totalServicos: 0,
          totalIss: 0,
          totalLiquido: 0,
          notas: [],
        })
      }

      const item = map.get(empId)!
      item.qtdNotas += 1
      item.notas.push(n)

      if (n.status !== 'Cancelada') {
        item.totalServicos += Number(n.valor_servicos) || 0
        item.totalIss += Number(n.valor_iss) || 0
        item.totalLiquido += Number(n.valor_liquido) || 0
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalLiquido - a.totalLiquido)
  }, [notasFiltradas, empresaMap])

  // Agrupamento por Mês (Ano-Mês)
  const agrupamentoPorMes = useMemo(() => {
    const map = new Map<
      string,
      {
        anoMesKey: string
        labelMes: string
        qtdNotas: number
        totalServicos: number
        totalIss: number
        totalLiquido: number
      }
    >()

    const mesesNomes = [
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

    for (const n of notasFiltradas) {
      const dtStr = (n.data_emissao || n.competencia || '').slice(0, 7) // YYYY-MM
      if (!dtStr || dtStr.length < 7) continue

      const [ano, mes] = dtStr.split('-').map(Number)
      const mesNome = mesesNomes[(mes || 1) - 1] || 'Mês'
      const label = `${mesNome} / ${ano}`

      if (!map.has(dtStr)) {
        map.set(dtStr, {
          anoMesKey: dtStr,
          labelMes: label,
          qtdNotas: 0,
          totalServicos: 0,
          totalIss: 0,
          totalLiquido: 0,
        })
      }

      const item = map.get(dtStr)!
      item.qtdNotas += 1

      if (n.status !== 'Cancelada') {
        item.totalServicos += Number(n.valor_servicos) || 0
        item.totalIss += Number(n.valor_iss) || 0
        item.totalLiquido += Number(n.valor_liquido) || 0
      }
    }

    return Array.from(map.values()).sort((a, b) => a.anoMesKey.localeCompare(b.anoMesKey))
  }, [notasFiltradas])

  // Handlers de Impressão e CSV
  const handlePrint = () => {
    window.print()
  }

  const handleExportarCsv = () => {
    if (notasFiltradas.length === 0) return

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const linhas: string[] = []

    // 1. Cabeçalho do Relatório
    linhas.push(
      escapeCsv(
        `RELATÓRIO DE NOTAS FISCAIS DE SERVIÇO (NFS-E) - PERÍODO: ${formatarDataBr(dataInicio)} a ${formatarDataBr(dataFim)}`,
      ),
    )
    linhas.push(
      escapeCsv(
        `Prestador: ${minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria'} - CNPJ: ${minhaEmpresa?.cnpj || ''}`,
      ),
    )
    linhas.push('')

    // 2. Seção Detalhada de Notas
    linhas.push('DETALHAMENTO DE NOTAS EMITIDAS')
    const colunas = [
      'Nº Nota',
      'Série',
      'Tipo Doc',
      'Data Emissão',
      'Competência',
      'Cliente (Tomador)',
      'CNPJ Tomador',
      'Valor Serviços (R$)',
      'Alíquota ISS (%)',
      'Valor ISS (R$)',
      'Valor Líquido (R$)',
      'Status',
      'Cód Verificação',
      'Chave Acesso',
      'Conciliada com Recebível',
    ]
    linhas.push(colunas.map(escapeCsv).join(';'))

    for (const n of notasFiltradas) {
      const emp = n.expand?.empresa || empresaMap.get(n.empresa)
      const empNome = n.tomador_razao_social || emp?.nome || ''
      const cnpj = n.tomador_cnpj || emp?.cnpj || ''
      const dtEmissao = formatarDataBr(n.data_emissao)
      const dtCompetencia = formatarDataBr(n.competencia)
      const vServStr = (Number(n.valor_servicos) || 0).toFixed(2).replace('.', ',')
      const aliqIssStr = (Number(n.aliquota_iss) || 0).toFixed(2).replace('.', ',')
      const vIssStr = (Number(n.valor_iss) || 0).toFixed(2).replace('.', ',')
      const vLiqStr = (Number(n.valor_liquido) || 0).toFixed(2).replace('.', ',')
      const conciliadaStr = n.conciliada ? 'Sim' : 'Não'

      linhas.push(
        [
          n.numero,
          n.serie || '1',
          n.tipo_documento || 'NFSe',
          dtEmissao,
          dtCompetencia,
          empNome,
          cnpj,
          vServStr,
          aliqIssStr,
          vIssStr,
          vLiqStr,
          n.status,
          n.codigo_verificacao || '',
          n.chave_acesso || '',
          conciliadaStr,
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    linhas.push('')
    linhas.push('TOTAIS POR CLIENTE (TOMADOR)')
    linhas.push(
      [
        'Cliente',
        'CNPJ',
        'Qtd Notas',
        'Total Serviços (R$)',
        'Total ISS (R$)',
        'Total Líquido (R$)',
      ]
        .map(escapeCsv)
        .join(';'),
    )
    for (const c of agrupamentoPorCliente) {
      linhas.push(
        [
          c.clienteNome,
          c.cnpj,
          c.qtdNotas,
          c.totalServicos.toFixed(2).replace('.', ','),
          c.totalIss.toFixed(2).replace('.', ','),
          c.totalLiquido.toFixed(2).replace('.', ','),
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    linhas.push('')
    linhas.push('TOTAIS POR MÊS (COMPETÊNCIA / EMISSÃO)')
    linhas.push(
      ['Mês/Ano', 'Qtd Notas', 'Total Serviços (R$)', 'Total ISS (R$)', 'Total Líquido (R$)']
        .map(escapeCsv)
        .join(';'),
    )
    for (const m of agrupamentoPorMes) {
      linhas.push(
        [
          m.labelMes,
          m.qtdNotas,
          m.totalServicos.toFixed(2).replace('.', ','),
          m.totalIss.toFixed(2).replace('.', ','),
          m.totalLiquido.toFixed(2).replace('.', ','),
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `relatorio_nfse_${dataInicio}_a_${dataFim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Relatório de Notas Fiscais Emitidas por Período
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Totais por cliente, por mês, discriminação e exportação em CSV / PDF A4
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarCsv}
              disabled={notasFiltradas.length === 0}
              className="h-8 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF (A4)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold"
            >
              Fechar
            </Button>
          </div>
        </div>

        {/* Filtros em Tela (ocultos na impressão) */}
        <div className="p-4 bg-white border-b border-slate-200 print:hidden space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Empresa */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-blue-600" /> Cliente / Tomador
              </Label>
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger className="h-8 text-xs bg-slate-50">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas" className="text-xs font-semibold text-blue-700">
                    Todos os Clientes
                  </SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.nome} {e.cnpj ? `(${formatCnpj(e.cnpj)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Início */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" /> Data Inicial
              </Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-8 text-xs bg-slate-50"
              />
            </div>

            {/* Data Fim */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" /> Data Final
              </Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-8 text-xs bg-slate-50"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" /> Status da Nota
              </Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-8 text-xs bg-slate-50">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Status
                  </SelectItem>
                  <SelectItem value="Emitida" className="text-xs">
                    Emitidas
                  </SelectItem>
                  <SelectItem value="Enviada" className="text-xs">
                    Enviadas por E-mail
                  </SelectItem>
                  <SelectItem value="Rascunho" className="text-xs">
                    Rascunho
                  </SelectItem>
                  <SelectItem value="Cancelada" className="text-xs">
                    Canceladas
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Folha do Documento A4 (Área Imprimível) */}
        <div className="p-6 sm:p-10 bg-slate-100/60 flex justify-center">
          <div
            id="relatorio-notas-periodo-document"
            className="w-full max-w-[840px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
          >
            {/* Cabeçalho Formal */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-black text-sm shadow-xs">
                    {minhaEmpresa?.nome_fantasia?.charAt(0) || 'NF'}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria Contábil & Financeira'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)} | IM: ${minhaEmpresa.inscricao_municipal || 'ISENTO'}`
                        : 'Emissor Eletrônico de Documentos Fiscais'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Emitido em</span>
                  <span>
                    {new Date().toLocaleDateString('pt-BR')} às{' '}
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="text-center py-2 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5"
                >
                  Relatório Faturamento &amp; Tributos
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  RELATÓRIO DE NOTAS FISCAIS DE SERVIÇO (NFS-E)
                </h1>
                <p className="text-xs text-slate-500">
                  Período apurado: <strong>{formatarDataBr(dataInicio)}</strong> até{' '}
                  <strong>{formatarDataBr(dataFim)}</strong> ·{' '}
                  {filtroEmpresa === 'todas'
                    ? 'Todos os Clientes'
                    : `Cliente: ${empresaMap.get(filtroEmpresa)?.nome || 'Selecionado'}`}
                </p>
              </div>

              {/* Cards de Resumo no Cabeçalho */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Faturamento Bruto
                  </span>
                  <strong className="text-sm font-bold text-slate-900 font-mono">
                    {formatBrlMoeda(totaisGerais.totalServicos)}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {totaisGerais.qtdEmitidas} nota(s) válida(s)
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    ISS Apurado
                  </span>
                  <strong className="text-sm font-bold text-blue-700 font-mono">
                    {formatBrlMoeda(totaisGerais.totalIss)}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Imposto Municipal</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Retenções Federais
                  </span>
                  <strong className="text-sm font-bold text-amber-700 font-mono">
                    {formatBrlMoeda(totaisGerais.totalRetencoes)}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    PIS / COFINS / IR / CSLL
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Total Líquido Emitido
                  </span>
                  <strong className="text-sm font-black text-emerald-700 font-mono">
                    {formatBrlMoeda(totaisGerais.totalLiquido)}
                  </strong>
                  <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                    Receita Efetiva
                  </span>
                </div>
              </div>
            </header>

            {/* SEÇÃO 1: TOTAIS POR CLIENTE */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Totais por Cliente (Tomador de Serviços)
              </h2>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                      <th className="py-2 px-3">Cliente / Tomador</th>
                      <th className="py-2 px-3">CNPJ</th>
                      <th className="py-2 px-2 text-center">Qtd Notas</th>
                      <th className="py-2 px-3 text-right">Valor Serviços</th>
                      <th className="py-2 px-3 text-right">ISS</th>
                      <th className="py-2 px-3 text-right font-black text-emerald-800">
                        Valor Líquido
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {agrupamentoPorCliente.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{c.clienteNome}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {c.cnpj ? formatCnpj(c.cnpj) : '—'}
                        </td>
                        <td className="py-2 px-2 text-center font-bold">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {c.qtdNotas}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {formatBrlMoeda(c.totalServicos)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-700">
                          {formatBrlMoeda(c.totalIss)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatBrlMoeda(c.totalLiquido)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-900 text-xs">
                      <td colSpan={2} className="py-2 px-3 uppercase">
                        Total Geral por Cliente
                      </td>
                      <td className="py-2 px-2 text-center">{totaisGerais.qtdTotal}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatBrlMoeda(totaisGerais.totalServicos)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-800">
                        {formatBrlMoeda(totaisGerais.totalIss)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-800">
                        {formatBrlMoeda(totaisGerais.totalLiquido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* SEÇÃO 2: TOTAIS POR MÊS */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Totais por Mês (Competência / Emissão)
              </h2>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                      <th className="py-2 px-3">Mês / Ano</th>
                      <th className="py-2 px-2 text-center">Qtd Notas</th>
                      <th className="py-2 px-3 text-right">Valor Serviços</th>
                      <th className="py-2 px-3 text-right">ISS Calculado</th>
                      <th className="py-2 px-3 text-right font-black text-emerald-800">
                        Valor Líquido
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {agrupamentoPorMes.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{m.labelMes}</td>
                        <td className="py-2 px-2 text-center font-bold">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {m.qtdNotas}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {formatBrlMoeda(m.totalServicos)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-700">
                          {formatBrlMoeda(m.totalIss)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatBrlMoeda(m.totalLiquido)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-900 text-xs">
                      <td className="py-2 px-3 uppercase">Total Geral por Mês</td>
                      <td className="py-2 px-2 text-center">{totaisGerais.qtdTotal}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatBrlMoeda(totaisGerais.totalServicos)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-800">
                        {formatBrlMoeda(totaisGerais.totalIss)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-800">
                        {formatBrlMoeda(totaisGerais.totalLiquido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* SEÇÃO 3: DETALHAMENTO DE TODAS AS NOTAS NO PERÍODO */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Relação Analítica das Notas Fiscais ({notasFiltradas.length})
              </h2>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                      <th className="py-2 px-2.5">Nº / Série</th>
                      <th className="py-2 px-2.5">Emissão</th>
                      <th className="py-2 px-3">Tomador</th>
                      <th className="py-2 px-2.5 text-right">Vlr Serviços</th>
                      <th className="py-2 px-2.5 text-right">Vlr Líquido</th>
                      <th className="py-2 px-2 text-center">Status</th>
                      <th className="py-2 px-2 text-center">Conciliada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {notasFiltradas.map((n) => {
                      const emp = n.expand?.empresa || empresaMap.get(n.empresa)
                      return (
                        <tr key={n.id} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-2.5 font-bold font-mono text-blue-700">
                            #{n.numero}{' '}
                            <span className="text-slate-400 font-normal">(S.{n.serie || '1'})</span>
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                            {formatarDataBr(n.data_emissao)}
                          </td>
                          <td
                            className="py-1.5 px-3 font-medium text-slate-900 truncate max-w-[180px]"
                            title={n.tomador_razao_social || emp?.nome}
                          >
                            {n.tomador_razao_social || emp?.nome || 'Cliente'}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                            {formatBrlMoeda(n.valor_servicos)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatBrlMoeda(n.valor_liquido)}
                          </td>
                          <td className="py-1.5 px-2 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                n.status === 'Emitida'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : n.status === 'Enviada'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : n.status === 'Cancelada'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {n.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center whitespace-nowrap">
                            {n.conciliada ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0 border-emerald-300 font-semibold">
                                ✓ Conciliada
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Rodapé / Assinatura */}
            <footer className="pt-6 border-t border-slate-200 flex flex-col items-center justify-center text-center space-y-1">
              <div className="w-64 border-t border-slate-400 pt-1.5 font-bold text-slate-800 text-xs">
                {minhaEmpresa?.contador_nome || 'Responsável Técnico / Contador'}
              </div>
              <p className="text-[10px] text-slate-500">
                {minhaEmpresa?.contador_crc
                  ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                  : 'Responsável Contábil e Financeiro'}
              </p>
              <p className="text-[9px] text-slate-400">
                Documento auxiliar para conferência de faturamento e controle de retenções de NFS-e.
              </p>
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
