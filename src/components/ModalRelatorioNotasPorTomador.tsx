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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Printer,
  Download,
  Filter,
  Building2,
  Calendar as CalendarIcon,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  DollarSign,
  FileText,
  PieChart,
  ShieldAlert,
  Percent,
} from 'lucide-react'
import type {
  NotaFiscalRecord,
  EmpresaRecord,
  MinhaEmpresaRecord,
  NfseTomadorRecord,
} from '@/types/finance'
import { formatCnpj, cleanCnpj } from '@/lib/financeCalculations'
import { formatBrlMoeda } from '@/lib/nfseXmlGenerator'

export interface ModalRelatorioNotasPorTomadorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notas: NotaFiscalRecord[]
  empresas: EmpresaRecord[]
  minhaEmpresa: MinhaEmpresaRecord | null
  tomadoresCadastrados?: NfseTomadorRecord[]
  empresaAtivaId?: string
  anoAtivo?: number
  isUserAdminOuFinanceiro?: boolean
}

interface TomadorConsolidado {
  idKey: string
  nome: string
  cpfCnpj: string
  tipoPessoa: 'PJ' | 'PF' | 'Exterior' | 'Não informado'
  qtdNotas: number
  qtdCanceladas: number
  valorServicos: number
  valorIss: number
  valorRetencoes: number
  valorLiquido: number
  participacaoPct: number
  acumuladoPct: number
  notas: NotaFiscalRecord[]
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

function formatarDocumento(doc?: string | null): string {
  if (!doc) return '—'
  const limpo = cleanCnpj(doc)
  if (limpo.length === 14) {
    return formatCnpj(limpo)
  }
  if (limpo.length === 11) {
    // Formatar CPF
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return doc
}

export function ModalRelatorioNotasPorTomador({
  open,
  onOpenChange,
  notas,
  empresas,
  minhaEmpresa,
  tomadoresCadastrados = [],
  empresaAtivaId,
  anoAtivo,
  isUserAdminOuFinanceiro = true,
}: ModalRelatorioNotasPorTomadorProps) {
  // Ano-base inicial: ano informado ou ano atual
  const anoBase = anoAtivo || new Date().getFullYear()

  // 1. Estados dos filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>(() => {
    if (empresaAtivaId && empresaAtivaId !== 'todas') return empresaAtivaId
    return 'todas'
  })

  const [dataInicio, setDataInicio] = useState<string>(() => `${anoBase}-01-01`)
  const [dataFim, setDataFim] = useState<string>(() => `${anoBase}-12-31`)

  // Status de faturamento: 'apenas_faturamento' (Emitida + Enviada), 'todos_validos' (Emitida, Enviada, Substituída, Rascunho)
  const [filtroStatusTipo, setFiltroStatusTipo] = useState<'faturamento' | 'todos'>('faturamento')
  // Toggle para permitir incluir canceladas (por padrão excluídas do faturamento)
  const [incluirCanceladas, setIncluirCanceladas] = useState<boolean>(false)

  // Mapa de empresas para lookup rápido
  const empresaMap = useMemo(() => {
    const m = new Map<string, EmpresaRecord>()
    for (const e of empresas) m.set(e.id, e)
    return m
  }, [empresas])

  // Mapa de tomadores cadastrados por ID e por CNPJ para lookup enriquecido
  const tomadorCadastradoMap = useMemo(() => {
    const byId = new Map<string, NfseTomadorRecord>()
    const byDoc = new Map<string, NfseTomadorRecord>()
    for (const t of tomadoresCadastrados) {
      if (t.id) byId.set(t.id, t)
      const docClean = cleanCnpj(t.cpf_cnpj || '')
      if (docClean) byDoc.set(docClean, t)
    }
    return { byId, byDoc }
  }, [tomadoresCadastrados])

  // 2. Filtragem de notas
  const notasFiltradas = useMemo(() => {
    return notas.filter((n) => {
      // Filtro de empresa emissora
      if (filtroEmpresa !== 'todas' && n.empresa !== filtroEmpresa) {
        return false
      }

      // Filtro de período
      const dtStr = (n.data_emissao || n.competencia || '').slice(0, 10)
      if (dataInicio && dtStr && dtStr < dataInicio) return false
      if (dataFim && dtStr && dtStr > dataFim) return false

      // Tratamento de Canceladas:
      if (n.status === 'Cancelada' && !incluirCanceladas) {
        return false
      }

      // Filtro de status
      if (filtroStatusTipo === 'faturamento') {
        // Apenas notas que compõem faturamento regular ativo
        if (n.status === 'Cancelada') {
          return incluirCanceladas
        }
        return n.status === 'Emitida' || n.status === 'Enviada'
      }

      // Se 'todos', mantém notas desde que respeite regra de canceladas
      if (n.status === 'Cancelada' && !incluirCanceladas) return false

      return true
    })
  }, [notas, filtroEmpresa, dataInicio, dataFim, filtroStatusTipo, incluirCanceladas])

  // 3. Totais executivos consolidados
  const totaisGerais = useMemo(() => {
    let totalServicos = 0
    let totalIss = 0
    let totalRetencoes = 0
    let totalLiquido = 0
    let qtdEmitidas = 0
    let qtdCanceladas = 0
    let qtdValidas = 0

    for (const n of notasFiltradas) {
      if (n.status === 'Cancelada') {
        qtdCanceladas += 1
        continue
      }

      qtdValidas += 1
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
      qtdValidas,
      qtdTotal: notasFiltradas.length,
    }
  }, [notasFiltradas])

  // 4. Consolidação por Tomador (Cliente)
  const tomadoresConsolidados: TomadorConsolidado[] = useMemo(() => {
    const map = new Map<
      string,
      {
        idKey: string
        nome: string
        cpfCnpj: string
        tipoPessoa: 'PJ' | 'PF' | 'Exterior' | 'Não informado'
        qtdNotas: number
        qtdCanceladas: number
        valorServicos: number
        valorIss: number
        valorRetencoes: number
        valorLiquido: number
        notas: NotaFiscalRecord[]
      }
    >()

    for (const n of notasFiltradas) {
      // Resolução inteligente da identidade do tomador:
      // 1. tomador_ref via expand ou cadastro
      // 2. tomador_cnpj ou CPF
      // 3. tomador_razao_social
      // 4. expand empresa
      const refCadastrado =
        n.expand?.tomador_ref ||
        (n.tomador_ref ? tomadorCadastradoMap.byId.get(n.tomador_ref) : undefined)

      const docClean = cleanCnpj(
        n.tomador_cnpj || refCadastrado?.cpf_cnpj || n.expand?.empresa?.cnpj || '',
      )

      const docRefCadastrado = docClean ? tomadorCadastradoMap.byDoc.get(docClean) : undefined

      const nomeTomador =
        n.tomador_razao_social ||
        refCadastrado?.razao_social ||
        docRefCadastrado?.razao_social ||
        n.expand?.empresa?.nome ||
        'Tomador Não Identificado'

      const docTomador =
        n.tomador_cnpj ||
        refCadastrado?.cpf_cnpj ||
        docRefCadastrado?.cpf_cnpj ||
        n.expand?.empresa?.cnpj ||
        ''

      const key =
        docClean && docClean.length >= 8
          ? `doc-${docClean}`
          : `nome-${nomeTomador.trim().toLowerCase()}`

      let tipoPessoa: 'PJ' | 'PF' | 'Exterior' | 'Não informado' = 'Não informado'
      if (refCadastrado?.tipo_pessoa) {
        tipoPessoa = refCadastrado.tipo_pessoa
      } else if (docClean.length === 14) {
        tipoPessoa = 'PJ'
      } else if (docClean.length === 11) {
        tipoPessoa = 'PF'
      }

      if (!map.has(key)) {
        map.set(key, {
          idKey: key,
          nome: nomeTomador,
          cpfCnpj: docTomador,
          tipoPessoa,
          qtdNotas: 0,
          qtdCanceladas: 0,
          valorServicos: 0,
          valorIss: 0,
          valorRetencoes: 0,
          valorLiquido: 0,
          notas: [],
        })
      }

      const item = map.get(key)!
      item.qtdNotas += 1
      item.notas.push(n)

      if (n.status === 'Cancelada') {
        item.qtdCanceladas += 1
        // Se cancelada, não soma no faturamento efetivo
      } else {
        item.valorServicos += Number(n.valor_servicos) || 0
        item.valorIss += Number(n.valor_iss) || 0
        item.valorRetencoes +=
          (Number(n.valor_pis) || 0) +
          (Number(n.valor_cofins) || 0) +
          (Number(n.valor_inss) || 0) +
          (Number(n.valor_ir) || 0) +
          (Number(n.valor_csll) || 0) +
          (Number(n.outras_retencoes) || 0)
        item.valorLiquido += Number(n.valor_liquido) || 0
      }
    }

    // Ordenação do maior para o menor faturamento de serviços
    const lista = Array.from(map.values()).sort((a, b) => b.valorServicos - a.valorServicos)

    // Cálculo das participações percentuais e percentual acumulado (Curva ABC / Concentração)
    let somaAcumulada = 0
    const totalBase = totaisGerais.totalServicos || 1

    return lista.map((item) => {
      const part = (item.valorServicos / totalBase) * 100
      somaAcumulada += item.valorServicos
      const acum = (somaAcumulada / totalBase) * 100
      return {
        ...item,
        participacaoPct: Number(part.toFixed(2)),
        acumuladoPct: Number(Math.min(100, acum).toFixed(2)),
      }
    })
  }, [notasFiltradas, tomadorCadastradoMap, totaisGerais.totalServicos])

  // 5. Parecer executivo automático
  const parecerExecutivo = useMemo(() => {
    const totalTomadores = tomadoresConsolidados.length
    if (totalTomadores === 0) {
      return {
        temDados: false,
        maiorCliente: null,
        alertaConcentracao: false,
        mediaNotasPorTomador: 0,
        ticketMedioPorTomador: 0,
        observacaoCancelamento: null,
        grauConcentracao: 'Neutro',
        textoParecer: 'Nenhuma nota fiscal encontrada para os filtros e período selecionados.',
      }
    }

    const maiorCliente = tomadoresConsolidados[0]
    const participacaoMaior = maiorCliente.participacaoPct
    const alertaConcentracao = participacaoMaior > 40.0
    const mediaNotas = totaisGerais.qtdValidas / (totalTomadores || 1)
    const ticketMedio = totaisGerais.totalServicos / (totalTomadores || 1)

    // Classificação de concentração da carteira (HHI simplificado / regra de Pareto)
    let grauConcentracao = 'Baixa Concentração'
    if (participacaoMaior > 40) {
      grauConcentracao = 'Alta Concentração de Risco'
    } else if (participacaoMaior > 25) {
      grauConcentracao = 'Concentração Moderada'
    }

    const canceladasTexto =
      totaisGerais.qtdCanceladas > 0
        ? `No período foram identificadas ${totaisGerais.qtdCanceladas} nota(s) cancelada(s), as quais foram segregadas do faturamento ativo conforme boas práticas contábeis.`
        : 'Não houve cancelamentos de notas fiscais de serviço no período apurado, evidenciando regularidade na emissão.'

    const alertaTexto = alertaConcentracao
      ? `ATENÇÃO: O cliente "${maiorCliente.nome}" concentra ${participacaoMaior.toFixed(1)}% do faturamento total do período (> 40%), configurando alta dependência de receita e risco financeiro de concentração de carteira.`
      : `O maior cliente ("${maiorCliente.nome}") representa ${participacaoMaior.toFixed(1)}% do faturamento, mantendo a carteira com distribuição equilibrada e baixo risco de descontinuidade.`

    return {
      temDados: true,
      maiorCliente,
      alertaConcentracao,
      mediaNotasPorTomador: Number(mediaNotas.toFixed(1)),
      ticketMedioPorTomador: ticketMedio,
      observacaoCancelamento: canceladasTexto,
      grauConcentracao,
      textoParecer: `${alertaTexto} A carteira ativa conta com ${totalTomadores} tomador(es) distinto(s), com média de ${mediaNotas.toFixed(1)} nota(s) por cliente e ticket médio faturado de ${formatBrlMoeda(ticketMedio)}.`,
    }
  }, [tomadoresConsolidados, totaisGerais])

  // 6. Handlers de Ações
  const handlePrint = () => {
    window.print()
  }

  const handleExportarCsv = () => {
    if (tomadoresConsolidados.length === 0) return

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const fmtMoeda = (v: number) => v.toFixed(2).replace('.', ',')
    const fmtPct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

    const linhas: string[] = []

    // Cabeçalho institucional do Laudo
    linhas.push(
      escapeCsv(
        `RELATÓRIO DE NOTAS FISCAIS POR TOMADOR (FATURAMENTO POR CLIENTE NO PERÍODO) - ${formatarDataBr(dataInicio)} a ${formatarDataBr(dataFim)}`,
      ),
    )
    linhas.push(
      escapeCsv(
        `Prestador / Consultoria: ${minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria'} | CNPJ: ${minhaEmpresa?.cnpj ? formatCnpj(minhaEmpresa.cnpj) : '—'}`,
      ),
    )
    if (filtroEmpresa !== 'todas') {
      const emp = empresaMap.get(filtroEmpresa)
      linhas.push(
        escapeCsv(
          `Empresa Filtrada: ${emp?.nome || filtroEmpresa} | CNPJ: ${emp?.cnpj ? formatCnpj(emp.cnpj) : '—'}`,
        ),
      )
    }
    linhas.push(
      escapeCsv(
        `Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      ),
    )
    linhas.push('')

    // Resumo Executivo em Linhas
    linhas.push('RESUMO EXECUTIVO DO PERÍODO')
    linhas.push(['Métrica', 'Valor'].map(escapeCsv).join(';'))
    linhas.push(
      ['Total de Tomadores Distintos', tomadoresConsolidados.length].map(escapeCsv).join(';'),
    )
    linhas.push(['Quantidade de Notas Válidas', totaisGerais.qtdValidas].map(escapeCsv).join(';'))
    linhas.push(['Notas Canceladas', totaisGerais.qtdCanceladas].map(escapeCsv).join(';'))
    linhas.push(
      ['Faturamento Bruto (Serviços R$)', fmtMoeda(totaisGerais.totalServicos)]
        .map(escapeCsv)
        .join(';'),
    )
    linhas.push(
      ['Total ISS Apurado (R$)', fmtMoeda(totaisGerais.totalIss)].map(escapeCsv).join(';'),
    )
    linhas.push(
      ['Total Retenções Federais (R$)', fmtMoeda(totaisGerais.totalRetencoes)]
        .map(escapeCsv)
        .join(';'),
    )
    linhas.push(
      ['Valor Líquido Faturado (R$)', fmtMoeda(totaisGerais.totalLiquido)].map(escapeCsv).join(';'),
    )
    linhas.push('')

    // Tabela por Tomador
    linhas.push('FATURAMENTO CONSOLIDADO POR TOMADOR (CLIENTE)')
    const colunas = [
      'Posição',
      'Razão Social / Nome Tomador',
      'CPF / CNPJ',
      'Tipo Pessoa',
      'Qtd Notas Válidas',
      'Qtd Canceladas',
      'Valor Serviços (R$)',
      'Total ISS (R$)',
      'Retenções Federais (R$)',
      'Valor Líquido (R$)',
      'Participação %',
      'Acumulado %',
    ]
    linhas.push(colunas.map(escapeCsv).join(';'))

    tomadoresConsolidados.forEach((c, idx) => {
      linhas.push(
        [
          idx + 1,
          c.nome,
          c.cpfCnpj ? formatarDocumento(c.cpfCnpj) : 'Não informado',
          c.tipoPessoa,
          c.qtdNotas - c.qtdCanceladas,
          c.qtdCanceladas,
          fmtMoeda(c.valorServicos),
          fmtMoeda(c.valorIss),
          fmtMoeda(c.valorRetencoes),
          fmtMoeda(c.valorLiquido),
          fmtPct(c.participacaoPct),
          fmtPct(c.acumuladoPct),
        ]
          .map(escapeCsv)
          .join(';'),
      )
    })

    // Linha de Totais da Tabela
    linhas.push(
      [
        'TOTAL GERAL',
        `${tomadoresConsolidados.length} tomadores`,
        '—',
        '—',
        totaisGerais.qtdValidas,
        totaisGerais.qtdCanceladas,
        fmtMoeda(totaisGerais.totalServicos),
        fmtMoeda(totaisGerais.totalIss),
        fmtMoeda(totaisGerais.totalRetencoes),
        fmtMoeda(totaisGerais.totalLiquido),
        '100,00%',
        '100,00%',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    // Parecer executivo
    linhas.push('')
    linhas.push('PARECER EXECUTIVO AUTOMÁTICO')
    linhas.push(escapeCsv(parecerExecutivo.textoParecer))
    if (parecerExecutivo.observacaoCancelamento) {
      linhas.push(escapeCsv(parecerExecutivo.observacaoCancelamento))
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `relatorio_notas_por_tomador_${dataInicio}_a_${dataFim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* ========================================================= */}
        {/* BARRA SUPERIOR DE AÇÕES (Oculta na impressão) */}
        {/* ========================================================= */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Relatório de Notas por Tomador (Faturamento por Cliente)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Faturamento acumulado, ISS, retenções federais, ranking de concentração e laudo A4
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarCsv}
              disabled={tomadoresConsolidados.length === 0}
              className="h-8 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={tomadoresConsolidados.length === 0}
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

        {/* ========================================================= */}
        {/* FILTROS DO RELATÓRIO (Ocultos na impressão) */}
        {/* ========================================================= */}
        <div className="p-4 bg-white border-b border-slate-200 print:hidden space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Empresa Emissora */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" /> Empresa Emissora
              </Label>
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger className="h-8 text-xs bg-slate-50">
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas" className="text-xs font-semibold text-blue-700">
                    Todas as Empresas
                  </SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.nome} {e.cnpj ? `(${formatCnpj(e.cnpj)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Inicial */}
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

            {/* Data Final */}
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

            {/* Status das Notas */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" /> Escopo do Faturamento
              </Label>
              <Select
                value={filtroStatusTipo}
                onValueChange={(v: 'faturamento' | 'todos') => setFiltroStatusTipo(v)}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="faturamento" className="text-xs">
                    Faturamento Válido (Emitida / Enviada)
                  </SelectItem>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Status Cadastrados
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha secundária de opções de filtro */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Switch
                id="toggle-canceladas"
                checked={incluirCanceladas}
                onCheckedChange={setIncluirCanceladas}
              />
              <Label
                htmlFor="toggle-canceladas"
                className="text-xs text-slate-600 cursor-pointer flex items-center gap-1"
              >
                Incluir notas canceladas no relatório
                <span className="text-[10px] text-slate-400">
                  (são contabilizadas em quantidade e expostas sem somar no faturamento líquido)
                </span>
              </Label>
            </div>

            <div className="text-[11px] text-slate-500">
              Total de notas filtradas: <strong>{notasFiltradas.length}</strong> | Tomadores únicos:{' '}
              <strong className="text-[#0B1F3A]">{tomadoresConsolidados.length}</strong>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* FOLHA DO DOCUMENTO A4 (Área Imprimível) */}
        {/* ========================================================= */}
        <div className="p-6 sm:p-10 bg-slate-100/60 flex justify-center print:p-0 print:bg-white">
          <div
            id="relatorio-notas-por-tomador-document"
            className="w-full max-w-[840px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
          >
            {/* CABEÇALHO CORPORATIVO FORMAL (Padrão BSC / Laudos do Sistema) */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-black text-sm shadow-xs">
                    {minhaEmpresa?.nome_fantasia?.charAt(0) || 'CF'}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria & Controladoria Estratégica'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Assessoria Econômico-Financeira'}
                      {minhaEmpresa?.inscricao_municipal
                        ? ` · IM: ${minhaEmpresa.inscricao_municipal}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data de Emissão</span>
                  <span>
                    {new Date().toLocaleDateString('pt-BR')} às{' '}
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center py-2 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5"
                >
                  Módulo NFS-e · Gestão de Receitas por Tomador
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  RELATÓRIO DE NOTAS POR TOMADOR
                </h1>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Demonstrativo consolidado de faturamento, tributos municipais, retenções na fonte
                  e análise de concentração de clientes
                </p>
              </div>

              {/* Quadro de Contexto da Análise */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa / Unidade:</span>
                    <strong className="text-[#0B1F3A] font-bold">
                      {filtroEmpresa === 'todas'
                        ? 'Todas as Empresas (Consolidado)'
                        : empresaMap.get(filtroEmpresa)?.nome || 'Empresa Selecionada'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ Analisado:</span>
                    <span className="font-mono text-slate-800">
                      {filtroEmpresa === 'todas'
                        ? 'Multiempresa'
                        : empresaMap.get(filtroEmpresa)?.cnpj
                          ? formatCnpj(empresaMap.get(filtroEmpresa)!.cnpj)
                          : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Base de Clientes:</span>
                    <span className="font-bold text-slate-900">
                      {tomadoresConsolidados.length} tomador(es) faturado(s)
                    </span>
                  </div>
                </div>

                <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Período Apurado:</span>
                    <span className="font-bold text-blue-700">
                      {formatarDataBr(dataInicio)} até {formatarDataBr(dataFim)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Responsável'}
                      {minhaEmpresa?.contador_crc ? ` (CRC ${minhaEmpresa.contador_crc})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Filtro de Status:</span>
                    <span className="text-slate-700 font-medium text-[11px]">
                      {filtroStatusTipo === 'faturamento'
                        ? 'Emitidas / Enviadas'
                        : 'Todos os Status'}{' '}
                      {incluirCanceladas ? '(incl. canceladas)' : '(sem canceladas)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARDS DE RESUMO EXECUTIVO (6 Métricas Obrigatórias) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-xs">
                {/* 1. Total de Notas */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">
                    Notas Emitidas
                  </span>
                  <strong className="text-base font-black text-slate-900 font-mono">
                    {totaisGerais.qtdValidas}
                  </strong>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    {totaisGerais.qtdCanceladas > 0
                      ? `+${totaisGerais.qtdCanceladas} cancelada(s)`
                      : 'Nenhuma cancelada'}
                  </span>
                </div>

                {/* 2. Tomadores Distintos */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">
                    Tomadores Únicos
                  </span>
                  <strong className="text-base font-black text-[#0B1F3A] font-mono">
                    {tomadoresConsolidados.length}
                  </strong>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Clientes ativos</span>
                </div>

                {/* 3. Valor Total dos Serviços (Faturamento Bruto) */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">
                    Total Serviços
                  </span>
                  <strong className="text-sm font-black text-slate-900 font-mono block truncate">
                    {formatBrlMoeda(totaisGerais.totalServicos)}
                  </strong>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Receita Bruta</span>
                </div>

                {/* 4. Total ISS */}
                <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-blue-700 uppercase block">
                    Total ISS
                  </span>
                  <strong className="text-sm font-black text-blue-800 font-mono block truncate">
                    {formatBrlMoeda(totaisGerais.totalIss)}
                  </strong>
                  <span className="text-[9px] text-blue-600/80 block mt-0.5">
                    Imposto Municipal
                  </span>
                </div>

                {/* 5. Total Retenções Federais */}
                <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-amber-800 uppercase block">
                    Retenções Fed.
                  </span>
                  <strong className="text-sm font-black text-amber-900 font-mono block truncate">
                    {formatBrlMoeda(totaisGerais.totalRetencoes)}
                  </strong>
                  <span className="text-[9px] text-amber-700/80 block mt-0.5">
                    PIS/COF/INSS/IR/CSLL
                  </span>
                </div>

                {/* 6. Valor Líquido Faturado */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-emerald-800 uppercase block">
                    Líquido Faturado
                  </span>
                  <strong className="text-sm font-black text-emerald-800 font-mono block truncate">
                    {formatBrlMoeda(totaisGerais.totalLiquido)}
                  </strong>
                  <span className="text-[9px] text-emerald-700 font-semibold block mt-0.5">
                    Receita Efetiva
                  </span>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* SEÇÃO 1: TABELA POR TOMADOR (Ordenada por faturamento) */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  Faturamento Consolidado por Tomador ({tomadoresConsolidados.length})
                </h2>
                <span className="text-[10px] text-slate-500 font-medium">
                  Ordenado do maior para o menor faturamento de serviços
                </span>
              </div>

              {tomadoresConsolidados.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">
                    Nenhuma nota fiscal encontrada no período selecionado com os filtros atuais.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Tomador (Cliente)</th>
                        <th className="py-2.5 px-3">CPF / CNPJ</th>
                        <th className="py-2.5 px-2 text-center">Notas</th>
                        <th className="py-2.5 px-3 text-right">Valor Serviços</th>
                        <th className="py-2.5 px-3 text-right">ISS</th>
                        <th className="py-2.5 px-3 text-right">Retenções</th>
                        <th className="py-2.5 px-3 text-right font-black text-emerald-800">
                          Valor Líquido
                        </th>
                        <th className="py-2.5 px-3 text-right">% Part.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {tomadoresConsolidados.map((tomador, idx) => (
                        <tr key={tomador.idKey} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 font-mono text-[10px] text-slate-400">
                            {idx + 1}º
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 max-w-[210px]">
                            <div className="truncate" title={tomador.nome}>
                              {tomador.nome}
                            </div>
                            {tomador.qtdCanceladas > 0 && incluirCanceladas && (
                              <span className="text-[9px] text-rose-600 block">
                                {tomador.qtdCanceladas} cancelada(s) no histórico
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap text-[10px]">
                            {tomador.cpfCnpj ? formatarDocumento(tomador.cpfCnpj) : '—'}
                          </td>
                          <td className="py-2 px-2 text-center font-bold">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-slate-50 font-mono"
                            >
                              {tomador.qtdNotas - tomador.qtdCanceladas}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                            {formatBrlMoeda(tomador.valorServicos)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-blue-700 whitespace-nowrap">
                            {formatBrlMoeda(tomador.valorIss)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-700 whitespace-nowrap">
                            {formatBrlMoeda(tomador.valorRetencoes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatBrlMoeda(tomador.valorLiquido)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                            <span
                              className={
                                tomador.participacaoPct > 40
                                  ? 'text-rose-700 font-extrabold'
                                  : tomador.participacaoPct > 20
                                    ? 'text-blue-700'
                                    : 'text-slate-700'
                              }
                            >
                              {tomador.participacaoPct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50/95 font-bold text-slate-900 text-xs">
                        <td colSpan={3} className="py-2.5 px-3 uppercase text-[10px]">
                          Totais Gerais ({tomadoresConsolidados.length} clientes faturados)
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {totaisGerais.qtdValidas}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          {formatBrlMoeda(totaisGerais.totalServicos)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-800">
                          {formatBrlMoeda(totaisGerais.totalIss)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-800">
                          {formatBrlMoeda(totaisGerais.totalRetencoes)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-black">
                          {formatBrlMoeda(totaisGerais.totalLiquido)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-900 font-black">
                          100,00%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {/* ========================================================= */}
            {/* SEÇÃO 2: RANKING VISUAL E BARRAS DE PARTICIPAÇÃO % */}
            {/* ========================================================= */}
            {tomadoresConsolidados.length > 0 && (
              <section className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    Ranking de Concentração (% de Participação no Faturamento)
                  </h2>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Top tomadores por volume faturado
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  {tomadoresConsolidados.slice(0, 8).map((tomador, idx) => {
                    const isMaior = idx === 0
                    const isAlerta = tomador.participacaoPct > 40.0
                    return (
                      <div key={tomador.idKey} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2 max-w-[70%]">
                            <span className="font-mono text-[10px] font-bold text-slate-400 w-5">
                              #{idx + 1}
                            </span>
                            <strong className="text-slate-900 truncate" title={tomador.nome}>
                              {tomador.nome}
                            </strong>
                            {isMaior && (
                              <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-800 border-blue-200">
                                Maior Cliente
                              </Badge>
                            )}
                            {isAlerta && (
                              <Badge className="text-[9px] px-1 py-0 bg-rose-100 text-rose-800 border-rose-200">
                                Risco &gt; 40%
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <span className="font-mono text-slate-600 text-[10px]">
                              {formatBrlMoeda(tomador.valorServicos)}
                            </span>
                            <span
                              className={`font-mono font-bold w-14 text-right ${
                                isAlerta
                                  ? 'text-rose-700 font-black'
                                  : isMaior
                                    ? 'text-blue-700'
                                    : 'text-slate-700'
                              }`}
                            >
                              {tomador.participacaoPct.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Barra de Progresso / Participação % */}
                        <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isAlerta
                                ? 'bg-rose-500'
                                : idx === 0
                                  ? 'bg-blue-600'
                                  : idx === 1
                                    ? 'bg-indigo-500'
                                    : idx === 2
                                      ? 'bg-sky-500'
                                      : 'bg-slate-400'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(3, tomador.participacaoPct))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}

                  {tomadoresConsolidados.length > 8 && (
                    <p className="text-[10px] text-slate-400 text-right pt-1">
                      + {tomadoresConsolidados.length - 8} outro(s) tomador(es) compõem o restante
                      da carteira.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* ========================================================= */}
            {/* SEÇÃO 3: PARECER EXECUTIVO AUTOMÁTICO */}
            {/* ========================================================= */}
            <section className="space-y-3 pt-1">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  Parecer Executivo da Consultoria
                </h2>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    parecerExecutivo.alertaConcentracao
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {parecerExecutivo.grauConcentracao}
                </Badge>
              </div>

              <div className="space-y-2.5">
                {/* Destaque Maior Cliente & Alerta de Concentração */}
                {parecerExecutivo.alertaConcentracao ? (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-rose-950 space-y-1">
                      <strong className="block text-xs font-bold text-rose-900">
                        Alerta de Alta Concentração de Receita (&gt; 40%)
                      </strong>
                      <p className="leading-relaxed">
                        O tomador{' '}
                        <span className="font-bold underline">
                          {parecerExecutivo.maiorCliente?.nome}
                        </span>{' '}
                        responde por{' '}
                        <strong>
                          {parecerExecutivo.maiorCliente?.participacaoPct.toFixed(2)}%
                        </strong>{' '}
                        do faturamento de serviços do período apurado (
                        {formatBrlMoeda(parecerExecutivo.maiorCliente?.valorServicos || 0)}). Esse
                        índice ultrapassa o limiar prudencial de 40%, caracterizando elevada
                        sensibilidade operacional e dependência econômica.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-emerald-950 space-y-1">
                      <strong className="block text-xs font-bold text-emerald-900">
                        Carteira de Clientes com Concentração Equilibrada
                      </strong>
                      <p className="leading-relaxed">
                        O maior tomador faturado no período é{' '}
                        <span className="font-semibold">
                          {parecerExecutivo.maiorCliente?.nome || '—'}
                        </span>
                        , representando{' '}
                        <strong>
                          {parecerExecutivo.maiorCliente?.participacaoPct.toFixed(2) || '0.00'}%
                        </strong>{' '}
                        do volume total emitido. A dispersão observada situa-se abaixo do teto
                        crítico de 40%, conferindo estabilidade ao fluxo de caixa.
                      </p>
                    </div>
                  </div>
                )}

                {/* Resumo Estatístico em 2 Caixas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 flex items-center gap-1.5 font-bold">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      Média de Emissão por Tomador
                    </strong>
                    <p className="text-slate-600 leading-relaxed">
                      Foram registradas em média{' '}
                      <strong className="text-slate-900">
                        {parecerExecutivo.mediaNotasPorTomador} nota(s)
                      </strong>{' '}
                      por cliente no período apurado, com faturamento médio de{' '}
                      <strong className="text-slate-900">
                        {formatBrlMoeda(parecerExecutivo.ticketMedioPorTomador)}
                      </strong>{' '}
                      por tomador ativo.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 flex items-center gap-1.5 font-bold">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      Controle de Cancelamentos
                    </strong>
                    <p className="text-slate-600 leading-relaxed">
                      {parecerExecutivo.observacaoCancelamento}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SEÇÃO 4: CAMPOS DE ASSINATURA (Padrão Laudos do Sistema) */}
            {/* ========================================================= */}
            <footer className="pt-6 border-t-2 border-slate-200 space-y-6">
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl text-[10px] text-slate-500 leading-relaxed text-center">
                Este relatório é um documento gerencial e contábil emitido a partir dos registros de
                NFS-e e DPS Nacional homologados no sistema. O demonstrativo de retenções destina-se
                ao confronto e conciliação com as guias municipais (ISS) e federais (DARF DCTFWeb /
                DIRF).
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                {/* Assinatura Consultor / Responsável Técnico */}
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {minhaEmpresa?.contador_nome || 'Consultor / Responsável Técnico'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {minhaEmpresa?.contador_crc
                      ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                      : 'Controladoria & Planejamento Tributário'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {minhaEmpresa?.razao_social ||
                      minhaEmpresa?.nome_fantasia ||
                      'Consultoria Contábil & Financeira'}
                  </p>
                </div>

                {/* Assinatura Diretoria / Gestor da Empresa */}
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {filtroEmpresa !== 'todas'
                      ? empresaMap.get(filtroEmpresa)?.nome || 'Diretoria / Gestão Financeira'
                      : 'Diretoria / Gestão Financeira'}
                  </p>
                  <p className="text-[10px] text-slate-500">Tomada de Contas &amp; Faturamento</p>
                  <p className="text-[10px] text-slate-400">
                    {filtroEmpresa !== 'todas' && empresaMap.get(filtroEmpresa)?.cnpj
                      ? `CNPJ: ${formatCnpj(empresaMap.get(filtroEmpresa)!.cnpj)}`
                      : 'Empresa Prestadora de Serviços'}
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
