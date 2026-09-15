import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  FileText,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Layers,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCnpj } from '@/lib/financeCalculations'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import type {
  EmpresaRecord,
  MinhaEmpresaRecord,
  ContaRecord,
  CentroRecord,
  LancamentoCentroRecord,
} from '@/types/finance'

export interface ModalRelatorioContasCentrosA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contas: ContaRecord[]
  centros: CentroRecord[]
  lancamentos: LancamentoCentroRecord[]
  selectedEmpresa?: EmpresaRecord | null
  selectedAno?: string | number
  minhaEmpresa?: MinhaEmpresaRecord | null
}

function formatBrl(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatPercent(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(val / 100)
}

export function ModalRelatorioContasCentrosA4({
  open,
  onOpenChange,
  contas,
  centros,
  lancamentos,
  selectedEmpresa,
  selectedAno,
  minhaEmpresa,
}: ModalRelatorioContasCentrosA4Props) {
  const [apenasComMovimentacao, setApenasComMovimentacao] = useState(false)
  const [filtroTipoConta, setFiltroTipoConta] = useState<string>('todos')

  const dataEmissao = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  const horaEmissao = useMemo(() => {
    return new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  // Matriz de valores [contaId][centroId] = soma dos lançamentos vinculados
  // Lançamentos sem conta vinculada ou sem centro vinculado
  const {
    matrizValores,
    totaisPorCentro,
    totaisPorConta,
    qtdLancamentosPorPar,
    totalGeral,
    totalLancamentosValidos,
    totalLancamentosSemConta,
    totalLancamentosSemCentro,
  } = useMemo(() => {
    const matriz: Record<string, Record<string, number>> = {}
    const contagem: Record<string, Record<string, number>> = {}
    const totCentro: Record<string, number> = {}
    const totConta: Record<string, number> = {}

    // Inicializa estruturas
    contas.forEach((c) => {
      matriz[c.id] = {}
      contagem[c.id] = {}
      totConta[c.id] = 0
      centros.forEach((cc) => {
        matriz[c.id][cc.id] = 0
        contagem[c.id][cc.id] = 0
        if (totCentro[cc.id] === undefined) totCentro[cc.id] = 0
      })
    })

    let geral = 0
    let validos = 0
    let semConta = 0
    let semCentro = 0

    lancamentos.forEach((l) => {
      const valor = Number(l.valor) || 0
      const cId = l.conta
      const ccId = l.centro

      if (!cId) {
        semConta += 1
      }
      if (!ccId) {
        semCentro += 1
      }

      if (cId && ccId && matriz[cId] && matriz[cId][ccId] !== undefined) {
        matriz[cId][ccId] += valor
        contagem[cId][ccId] = (contagem[cId][ccId] || 0) + 1
        totConta[cId] = (totConta[cId] || 0) + valor
        totCentro[ccId] = (totCentro[ccId] || 0) + valor
        geral += valor
        validos += 1
      }
    })

    return {
      matrizValores: matriz,
      totaisPorCentro: totCentro,
      totaisPorConta: totConta,
      qtdLancamentosPorPar: contagem,
      totalGeral: geral,
      totalLancamentosValidos: validos,
      totalLancamentosSemConta: semConta,
      totalLancamentosSemCentro: semCentro,
    }
  }, [contas, centros, lancamentos])

  // Contas filtradas conforme seleção de visualização
  const contasExibidas = useMemo(() => {
    let list = [...contas]

    if (filtroTipoConta !== 'todos') {
      list = list.filter((c) => c.tipo === filtroTipoConta)
    }

    if (apenasComMovimentacao) {
      list = list.filter((c) => (totaisPorConta[c.id] || 0) > 0)
    }

    // Ordenação: contas do tipo Receita/Despesa primeiro, depois código/nome
    return list.sort((a, b) => {
      const codA = a.codigo || ''
      const codB = b.codigo || ''
      if (codA && codB) return codA.localeCompare(codB)
      return a.nome.localeCompare(b.nome)
    })
  }, [contas, filtroTipoConta, apenasComMovimentacao, totaisPorConta])

  // Centros ordenados por tipo e nome
  const centrosOrdenados = useMemo(() => {
    return [...centros].sort((a, b) => {
      if (a.tipo !== b.tipo) {
        return a.tipo === 'Receita' ? -1 : 1
      }
      return a.nome.localeCompare(b.nome)
    })
  }, [centros])

  // Métricas executivas
  const totalContasCadastradas = contas.length
  const totalCentrosCadastrados = centros.length
  const contasComMovimentacao = useMemo(() => {
    return contas.filter((c) => (totaisPorConta[c.id] || 0) > 0).length
  }, [contas, totaisPorConta])
  const contasOciosas = totalContasCadastradas - contasComMovimentacao

  const centrosComMovimentacao = useMemo(() => {
    return centros.filter((cc) => (totaisPorCentro[cc.id] || 0) > 0).length
  }, [centros, totaisPorCentro])
  const centrosOciosos = totalCentrosCadastrados - centrosComMovimentacao

  // Vínculos cruzados com movimentação
  const paresComMovimentacao = useMemo(() => {
    let pares = 0
    contas.forEach((c) => {
      centros.forEach((cc) => {
        if ((matrizValores[c.id]?.[cc.id] || 0) > 0) {
          pares += 1
        }
      })
    })
    return pares
  }, [contas, centros, matrizValores])

  // Análise de concentração no maior centro
  const maiorCentroInfo = useMemo(() => {
    let maiorId = ''
    let maiorVal = 0
    centros.forEach((cc) => {
      const v = totaisPorCentro[cc.id] || 0
      if (v > maiorVal) {
        maiorVal = v
        maiorId = cc.id
      }
    })
    const centro = centros.find((cc) => cc.id === maiorId)
    const pct = totalGeral > 0 ? (maiorVal / totalGeral) * 100 : 0
    return { centro, valor: maiorVal, percentual: pct }
  }, [centros, totaisPorCentro, totalGeral])

  // Maior conta
  const maiorContaInfo = useMemo(() => {
    let maiorId = ''
    let maiorVal = 0
    contas.forEach((c) => {
      const v = totaisPorConta[c.id] || 0
      if (v > maiorVal) {
        maiorVal = v
        maiorId = c.id
      }
    })
    const conta = contas.find((c) => c.id === maiorId)
    const pct = totalGeral > 0 ? (maiorVal / totalGeral) * 100 : 0
    return { conta, valor: maiorVal, percentual: pct }
  }, [contas, totaisPorConta, totalGeral])

  const hasMinhaEmpresa = !!(
    minhaEmpresa?.razao_social ||
    minhaEmpresa?.nome_fantasia ||
    minhaEmpresa?.contador_nome
  )

  const handlePrint = () => {
    window.print()
  }

  const handleExportCsv = () => {
    const nomeEmpresa = selectedEmpresa?.nome || 'empresa'
    const dataStr = new Date().toISOString().slice(0, 10)
    const fileName = `conferencia-matriz-contas-centros-${nomeEmpresa.replace(/\s+/g, '_')}-${dataStr}.csv`

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const formatarCsvNumero = (val: number): string => {
      return val.toFixed(2).replace('.', ',')
    }

    const linhas: string[] = []

    // Cabeçalho institucional no CSV
    linhas.push(
      ['# RELATÓRIO DE CONFERÊNCIA DE CONTAS × CENTROS DE CUSTO (MATRIZ DE MOVIMENTAÇÃO)'].join(
        ';',
      ),
    )
    linhas.push(
      [
        `# Consultoria: ${minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Não informada'}`,
      ].join(';'),
    )
    linhas.push(
      [
        `# Empresa Ativa: ${selectedEmpresa?.nome || '—'} (CNPJ: ${selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'})`,
      ].join(';'),
    )
    linhas.push([`# Data de Emissão: ${dataEmissao} às ${horaEmissao}`].join(';'))
    linhas.push([''].join(';'))

    // Cabeçalhos de coluna: Código Conta, Nome Conta, Tipo, [cada Centro], Total Conta
    const colunas = [
      'Código Conta',
      'Conta Contábil',
      'Tipo Contábil',
      'Grupo Contábil',
      ...centrosOrdenados.map((cc) => `${cc.codigo || 'CC'} - ${cc.nome} (${cc.tipo})`),
      'Total da Conta (R$)',
    ]
    linhas.push(colunas.map(escapeCsv).join(';'))

    // Linhas de dados (todas as contas ou as exibidas)
    contasExibidas.forEach((c) => {
      const valoresCentro = centrosOrdenados.map((cc) =>
        formatarCsvNumero(matrizValores[c.id]?.[cc.id] || 0),
      )
      const totConta = formatarCsvNumero(totaisPorConta[c.id] || 0)

      linhas.push(
        [c.codigo || '', c.nome, c.tipo, c.grupo || '', ...valoresCentro, totConta]
          .map(escapeCsv)
          .join(';'),
      )
    })

    // Linha de Totais dos Centros
    const totaisCentrosLinha = centrosOrdenados.map((cc) =>
      formatarCsvNumero(totaisPorCentro[cc.id] || 0),
    )
    linhas.push(
      [
        'TOTAL GERAL',
        'TOTAIS POR CENTRO DE CUSTO',
        '—',
        '—',
        ...totaisCentrosLinha,
        formatarCsvNumero(totalGeral),
      ]
        .map(escapeCsv)
        .join(';'),
    )

    // Quadro resumo no rodapé do CSV
    linhas.push([''].join(';'))
    linhas.push(['# RESUMO EXECUTIVO'].join(';'))
    linhas.push(['Indicador', 'Valor'].map(escapeCsv).join(';'))
    linhas.push(['Total de Contas Cadastradas', totalContasCadastradas].map(escapeCsv).join(';'))
    linhas.push(['Contas com Movimentação Ativa', contasComMovimentacao].map(escapeCsv).join(';'))
    linhas.push(['Contas Ociosas / Sem Lançamentos', contasOciosas].map(escapeCsv).join(';'))
    linhas.push(['Total de Centros de Custo', totalCentrosCadastrados].map(escapeCsv).join(';'))
    linhas.push(['Centros com Movimentação Ativa', centrosComMovimentacao].map(escapeCsv).join(';'))
    linhas.push(['Centros sem Movimentação', centrosOciosos].map(escapeCsv).join(';'))
    linhas.push(['Vínculos Cruzados com Movimento', paresComMovimentacao].map(escapeCsv).join(';'))
    linhas.push(
      ['Valor Total Movimentado (R$)', formatarCsvNumero(totalGeral)].map(escapeCsv).join(';'),
    )

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <span>Relatório A4 — Contas × Centros de Custo</span>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold"
                >
                  Matriz de Movimentação
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Conferência formal de cruzamento contábil e rateio por centro para pasta permanente
                do cliente
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtros rápidos na barra de ações */}
            <div className="hidden sm:flex items-center gap-1.5 mr-2 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setApenasComMovimentacao((prev) => !prev)}
                className={`px-2 py-1 rounded font-medium transition-colors text-[11px] flex items-center gap-1 ${
                  apenasComMovimentacao
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 bg-transparent'
                }`}
                title="Filtrar apenas contas com saldo movimentado"
              >
                <Filter className="w-3 h-3" />
                Apenas com Movimento
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar planilha CSV formatada em PT-BR para Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-bold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF (A4)
            </Button>
          </div>
        </div>

        {/* Alerta se Minha Empresa não estiver preenchida */}
        {!hasMinhaEmpresa && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 print:hidden">
            <Alert className="bg-white border-amber-300 text-amber-900 shadow-2xs">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs flex items-center justify-between gap-2 flex-wrap">
                <span>
                  <strong>Atenção:</strong> Os dados da sua consultoria (razão social, CNPJ,
                  responsável técnico e registro CRC) valorizam a pasta do cliente quando
                  configurados em <em>Minha Empresa</em>.
                </span>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                >
                  <Link to="/minha-empresa" target="_blank" rel="noopener noreferrer">
                    Cadastrar Minha Empresa
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Folha do Documento A4 */}
        <div className="p-4 sm:p-8 bg-slate-100/60 flex justify-center print:p-0 print:bg-white">
          <div
            id="relatorio-contas-centros-a4"
            className="w-full max-w-[1020px] bg-white border border-slate-300 rounded-xl shadow-lg p-6 sm:p-10 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white font-sans"
          >
            {/* CABEÇALHO CORPORATIVO FORMAL */}
            <header className="border-b-2 border-[#0B1F3A] pb-4 space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {minhaEmpresa?.nome_fantasia?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria Econômico-Financeira & Controladoria'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Serviços Especializados de Diagnóstico Contábil, Rateio e Gestão de Centros de Custo'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data de Emissão</span>
                  <span>
                    {dataEmissao} às {horaEmissao}
                  </span>
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center py-1 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-900 border-blue-200 text-[10px] font-bold px-3 py-0.5 uppercase tracking-wider"
                >
                  Documento Contábil • Pasta Permanente do Cliente
                </Badge>
                <h1 className="text-lg sm:text-xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  Relatório de Conferência de Contas × Centros de Custo
                </h1>
                <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
                  Matriz de movimentação consolidada de lançamentos por conta contábil e centro de
                  custo com quadro resumo executivo e parecer técnico
                </p>
              </div>

              {/* Quadro Informativo da Empresa Analisada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa Analisada:</span>
                    <strong className="text-[#0B1F3A] flex items-center gap-1 font-bold">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {selectedEmpresa?.nome || '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ da Empresa:</span>
                    <span className="font-mono text-slate-800">
                      {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Segmento / Porte:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedEmpresa?.segmento || 'Geral'}
                      {selectedEmpresa?.porte ? ` • ${selectedEmpresa.porte}` : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício / Período:</span>
                    <strong className="text-blue-700 font-bold">{selectedAno || 'Geral'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Responsável'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Registro CRC:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                        : 'CRC Ativo'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* SEÇÃO 1: QUADRO RESUMO EXECUTIVO */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  Quadro Resumo Executivo
                </h2>
                <span className="text-[10px] text-slate-500">
                  Visão sintética da conciliação e rateio
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* Total Contas */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Nº de Contas
                  </span>
                  <div className="text-base font-black text-slate-900 font-mono">
                    {totalContasCadastradas}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium block">
                    {contasComMovimentacao} ativas
                  </span>
                </div>

                {/* Total Centros */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Nº de Centros
                  </span>
                  <div className="text-base font-black text-slate-900 font-mono">
                    {totalCentrosCadastrados}
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium block">
                    {centrosComMovimentacao} com saldo
                  </span>
                </div>

                {/* Vínculos Ativos */}
                <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200 space-y-0.5">
                  <span className="text-[10px] text-blue-800 uppercase font-semibold block">
                    Cruzamentos
                  </span>
                  <div className="text-base font-black text-blue-900 font-mono">
                    {paresComMovimentacao}
                  </div>
                  <span className="text-[10px] text-blue-700 font-medium block">
                    pares conta×centro
                  </span>
                </div>

                {/* Valor Total */}
                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-0.5 sm:col-span-1 lg:col-span-1">
                  <span className="text-[10px] text-emerald-800 uppercase font-semibold block">
                    Total Movimentado
                  </span>
                  <div
                    className="text-sm font-black text-emerald-900 font-mono truncate"
                    title={formatBrl(totalGeral)}
                  >
                    {formatBrl(totalGeral)}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium block">
                    {totalLancamentosValidos} lançamentos
                  </span>
                </div>

                {/* Contas Ociosas */}
                <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 space-y-0.5">
                  <span className="text-[10px] text-amber-800 uppercase font-semibold block">
                    Contas Ociosas
                  </span>
                  <div className="text-base font-black text-amber-900 font-mono">
                    {contasOciosas}
                  </div>
                  <span className="text-[10px] text-amber-700 font-medium block">
                    sem lançamentos
                  </span>
                </div>

                {/* Centros sem Movimentação */}
                <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 space-y-0.5">
                  <span className="text-[10px] text-rose-800 uppercase font-semibold block">
                    Centros Vazios
                  </span>
                  <div className="text-base font-black text-rose-900 font-mono">
                    {centrosOciosos}
                  </div>
                  <span className="text-[10px] text-rose-700 font-medium block">
                    sem movimentação
                  </span>
                </div>
              </div>

              {/* Alertas de consistência de lançamentos */}
              {(totalLancamentosSemConta > 0 || totalLancamentosSemCentro > 0) && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Aviso de integridade:</strong> Foram identificados lançamentos de
                      centro de custo{' '}
                      {totalLancamentosSemConta > 0 ? (
                        <span>
                          <strong>{totalLancamentosSemConta}</strong> sem conta contábil vinculada
                        </span>
                      ) : null}
                      {totalLancamentosSemConta > 0 && totalLancamentosSemCentro > 0 ? ' e ' : ''}
                      {totalLancamentosSemCentro > 0 ? (
                        <span>
                          <strong>{totalLancamentosSemCentro}</strong> sem centro definido
                        </span>
                      ) : null}
                      . Estes valores não compõem a matriz cruzada e necessitam de saneamento
                      cadastral.
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* SEÇÃO 2: MATRIZ DE MOVIMENTAÇÃO CONTAS × CENTROS DE CUSTO */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    Matriz de Movimentação Contas × Centros de Custo (R$)
                  </h2>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
                    {contasExibidas.length} {contasExibidas.length === 1 ? 'conta' : 'contas'} ×{' '}
                    {centrosOrdenados.length} {centrosOrdenados.length === 1 ? 'centro' : 'centros'}
                  </Badge>
                </div>

                {/* Filtro de tipos na visualização rápida (oculto no print) */}
                <div className="flex items-center gap-2 print:hidden text-[11px]">
                  <span className="text-slate-500 font-medium">Filtrar tipo:</span>
                  <select
                    value={filtroTipoConta}
                    onChange={(e) => setFiltroTipoConta(e.target.value)}
                    className="h-7 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                  >
                    <option value="todos">Todos os tipos ({contas.length})</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Passivo">Passivo</option>
                    <option value="Patrimônio Líquido">Patrimônio Líquido</option>
                    <option value="Receita">Receita</option>
                    <option value="Despesa">Despesa</option>
                  </select>
                </div>
              </div>

              {centros.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <HelpCircle className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-semibold text-slate-700 text-xs">
                    Nenhum centro de custo cadastrado para esta empresa
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Cadastre centros de custo na tela para que a matriz possa cruzar os dados.
                  </p>
                </div>
              ) : contas.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <HelpCircle className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-semibold text-slate-700 text-xs">
                    Nenhuma conta contábil cadastrada para esta empresa
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Cadastre contas contábeis para habilitar a matriz de conferência.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-300 rounded-lg overflow-x-auto shadow-2xs bg-white">
                  <table className="w-full text-[10.5px] border-collapse">
                    <thead>
                      <tr className="bg-[#0B1F3A] text-white font-semibold">
                        <th className="py-2 px-2.5 text-left border-r border-slate-700 w-20">
                          Código
                        </th>
                        <th className="py-2 px-3 text-left border-r border-slate-700 min-w-[180px]">
                          Conta Contábil / Tipo
                        </th>
                        {centrosOrdenados.map((cc) => (
                          <th
                            key={cc.id}
                            className="py-2 px-2.5 text-right border-r border-slate-700 min-w-[105px] whitespace-nowrap"
                          >
                            <div className="font-bold truncate max-w-[120px]" title={cc.nome}>
                              {cc.nome}
                            </div>
                            <span className="text-[9px] text-slate-300 font-normal uppercase block">
                              {cc.tipo}
                              {cc.codigo ? ` • ${cc.codigo}` : ''}
                            </span>
                          </th>
                        ))}
                        <th className="py-2 px-3 text-right bg-blue-950 text-amber-300 font-black min-w-[120px] whitespace-nowrap">
                          Total da Conta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {contasExibidas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={centrosOrdenados.length + 3}
                            className="py-8 text-center text-slate-500 italic"
                          >
                            Nenhuma conta corresponde ao filtro selecionado.
                          </td>
                        </tr>
                      ) : (
                        contasExibidas.map((c, idx) => {
                          const totConta = totaisPorConta[c.id] || 0
                          const temMovimento = totConta > 0
                          return (
                            <tr
                              key={c.id}
                              className={
                                idx % 2 === 0
                                  ? temMovimento
                                    ? 'bg-white hover:bg-slate-50'
                                    : 'bg-slate-50/40 text-slate-400 hover:bg-slate-50'
                                  : temMovimento
                                    ? 'bg-slate-50/70 hover:bg-slate-100/60'
                                    : 'bg-slate-100/30 text-slate-400 hover:bg-slate-100/60'
                              }
                            >
                              {/* Código da Conta */}
                              <td className="py-2 px-2.5 font-mono font-medium border-r border-slate-200 whitespace-nowrap text-slate-700">
                                {c.codigo || '—'}
                              </td>

                              {/* Nome da Conta e Tipo */}
                              <td className="py-2 px-3 border-r border-slate-200">
                                <div className="font-semibold text-slate-900 leading-tight">
                                  {c.nome}
                                </div>
                                <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 mt-0.5">
                                  <span className="font-medium text-slate-600">{c.tipo}</span>
                                  {c.grupo && <span>• {c.grupo}</span>}
                                  {!temMovimento && (
                                    <span className="text-amber-700 font-medium italic">
                                      (sem movimento)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Células da Matriz: Centros */}
                              {centrosOrdenados.map((cc) => {
                                const val = matrizValores[c.id]?.[cc.id] || 0
                                const qtd = qtdLancamentosPorPar[c.id]?.[cc.id] || 0
                                return (
                                  <td
                                    key={cc.id}
                                    className={`py-2 px-2.5 text-right font-mono border-r border-slate-200 whitespace-nowrap ${
                                      val > 0
                                        ? 'text-slate-900 font-semibold bg-blue-50/20'
                                        : 'text-slate-300'
                                    }`}
                                    title={
                                      val > 0
                                        ? `${formatBrl(val)} (${qtd} lançamentos em ${cc.nome})`
                                        : 'Sem movimentação'
                                    }
                                  >
                                    {val > 0 ? (
                                      <div>
                                        <span>{formatBrl(val)}</span>
                                        {qtd > 1 && (
                                          <span className="text-[8.5px] text-slate-400 block font-sans">
                                            {qtd} lanç.
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                )
                              })}

                              {/* Total da Conta */}
                              <td
                                className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                                  temMovimento
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'bg-slate-50 text-slate-300'
                                }`}
                              >
                                {temMovimento ? formatBrl(totConta) : '—'}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>

                    {/* LINHA DE TOTAIS POR CENTRO */}
                    <tfoot>
                      <tr className="bg-slate-200/90 font-bold border-t-2 border-slate-300 text-slate-900">
                        <td
                          colSpan={2}
                          className="py-2.5 px-3 text-left uppercase text-[10px] tracking-wider border-r border-slate-300"
                        >
                          <div className="font-black text-[#0B1F3A] flex items-center justify-between">
                            <span>Totais por Centro</span>
                            <span className="text-[9.5px] font-normal text-slate-600">
                              (soma vertical)
                            </span>
                          </div>
                        </td>

                        {centrosOrdenados.map((cc) => {
                          const totCentro = totaisPorCentro[cc.id] || 0
                          const pctCentro = totalGeral > 0 ? (totCentro / totalGeral) * 100 : 0
                          return (
                            <td
                              key={cc.id}
                              className="py-2.5 px-2.5 text-right font-mono font-black border-r border-slate-300 whitespace-nowrap"
                            >
                              <div className="text-slate-900">
                                {totCentro > 0 ? formatBrl(totCentro) : '—'}
                              </div>
                              {totCentro > 0 && (
                                <span className="text-[9px] text-blue-700 block font-sans font-semibold">
                                  {pctCentro.toFixed(1)}% do total
                                </span>
                              )}
                            </td>
                          )
                        })}

                        {/* TOTAL GERAL CONSOLIDADO */}
                        <td className="py-2.5 px-3 text-right font-mono font-black text-white bg-[#0B1F3A] whitespace-nowrap">
                          <span className="text-[9px] text-amber-300 uppercase block font-sans">
                            Total Geral
                          </span>
                          <span className="text-xs">{formatBrl(totalGeral)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {/* SEÇÃO 3: PARECER TÉCNICO EXECUTIVO E RECOMENDAÇÕES */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  Parecer Técnico Executivo & Recomendações
                </h2>
                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                  Governança & Controladoria
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Diagnóstico da Concentração */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
                  <h4 className="font-bold text-[#0B1F3A] flex items-center gap-1.5 text-[11px]">
                    <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                    Diagnóstico de Concentração de Gastos / Receitas
                  </h4>
                  {maiorCentroInfo.centro && maiorCentroInfo.valor > 0 ? (
                    <p className="text-slate-700 text-[11px]">
                      O centro de custo mais expressivo no período é{' '}
                      <strong className="text-slate-900">
                        {maiorCentroInfo.centro.nome} ({maiorCentroInfo.centro.tipo})
                      </strong>
                      , concentrando{' '}
                      <strong className="text-blue-700 font-mono">
                        {formatBrl(maiorCentroInfo.valor)}
                      </strong>{' '}
                      (
                      <strong className="text-blue-700">
                        {maiorCentroInfo.percentual.toFixed(1)}%
                      </strong>{' '}
                      do total geral movimentado na empresa).
                      {maiorContaInfo.conta && maiorContaInfo.valor > 0 ? (
                        <>
                          {' '}
                          A conta de maior relevância é{' '}
                          <strong className="text-slate-900">{maiorContaInfo.conta.nome}</strong>,
                          com <span className="font-mono">{formatBrl(maiorContaInfo.valor)}</span> (
                          {maiorContaInfo.percentual.toFixed(1)}%).
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-slate-500 text-[11px] italic">
                      Não há movimentação financeira suficiente registrada nos centros desta empresa
                      para cálculo de concentração.
                    </p>
                  )}
                </div>

                {/* Cobertura de Centros e Contas */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
                  <h4 className="font-bold text-[#0B1F3A] flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Governança Cadastral e Racionalização
                  </h4>
                  <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1">
                    <li>
                      <strong>Contas Ociosas ({contasOciosas}):</strong>{' '}
                      {contasOciosas > 0 ? (
                        <span>
                          {contasOciosas} contas não tiveram movimentação vinculada aos centros.
                          Recomenda-se avaliar se são contas patrimoniais sem centro ou inativas.
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          100% das contas cadastradas possuem lançamentos ativos vinculados.
                        </span>
                      )}
                    </li>
                    <li>
                      <strong>Centros Ociosos ({centrosOciosos}):</strong>{' '}
                      {centrosOciosos > 0 ? (
                        <span>
                          {centrosOciosos} centros de custo estão sem lançamentos registrados no
                          período. Avalie a necessidade de arquivamento ou revisão de alocação.
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          Todos os centros de custo cadastrados foram movimentados.
                        </span>
                      )}
                    </li>
                  </ul>
                </div>
              </div>

              {/* Quadro de Recomendações Práticas */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-950 space-y-1.5">
                <span className="font-bold text-[11px] block text-blue-900">
                  Recomendações da Consultoria para o Arquivo do Cliente:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px]">
                  <li>
                    <strong>Arquivo Permanente:</strong> Imprimir ou salvar este relatório em
                    formato PDF A4 na pasta permanente de auditoria e controladoria da empresa{' '}
                    <strong>{selectedEmpresa?.nome || 'ativa'}</strong> para fins de fiscalização e
                    prestação de contas a sócios e conselho.
                  </li>
                  <li>
                    <strong>Rateio das Despesas Compartilhadas:</strong> Garantir que despesas
                    administrativas, overhead e tributos indiretos estejam distribuídos conforme a
                    fórmula de rateio aprovada no plano orçamentário.
                  </li>
                  <li>
                    <strong>Conferência Trimestral:</strong> Repetir esta conferência cruzada a cada
                    fechamento contábil para identificar contas paradas ou desvios de centro antes
                    da emissão das demonstrações finais (Balanço e DRE).
                  </li>
                </ol>
              </div>
            </section>

            {/* ASSINATURA TÉCNICA E RODAPÉ */}
            <footer className="pt-6 space-y-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-400">
                <div>
                  Relatório gerado pelo sistema de Gestão Econômica e Financeira • Multi-tenant
                </div>
                <div>
                  Empresa ID:{' '}
                  <span className="font-mono text-slate-600">{selectedEmpresa?.id || '—'}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col items-center justify-center text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-2 font-bold text-slate-800 text-xs">
                  {minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {minhaEmpresa?.contador_crc
                    ? `CRC: ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                    : 'Responsável Técnico pela Controladoria & Governança'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria'}
                </div>
              </div>
            </footer>

            {/* Rodapé fixo formal na impressão */}
            <DocumentPrintFooter
              documentTitle="Relatório de Conferência de Contas × Centros de Custo"
              empresaNome={selectedEmpresa?.nome}
              exercicioAno={selectedAno}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
