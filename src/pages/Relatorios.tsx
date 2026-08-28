import React, { useState, useEffect, useMemo } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularPontoEquilibrio,
  gerarAnaliseAutomatica,
  formatBrlMil,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatInteger,
  formatCnpj,
} from '@/lib/financeCalculations'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  FileText,
  Building2,
  Calendar,
  Scale,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Landmark,
  QrCode,
  DollarSign,
  User,
  Hash,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type TipoRelatorio = 'completo' | 'balanco' | 'dre' | 'indicadores' | 'recibo'

export default function Relatorios() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()
  const { minhaEmpresa, logoUrl, corPrimaria, corSecundaria } = useMinhaEmpresa()
  const { toast } = useToast()

  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>('completo')
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Estado do Recibo
  const [reciboNumero, setReciboNumero] = useState<string>(() => {
    const saved = localStorage.getItem('last_recibo_num')
    const next = saved ? parseInt(saved, 10) + 1 : 1001
    return String(next)
  })
  const [reciboClienteId, setReciboClienteId] = useState<string>(selectedEmpresaId || '')
  const [reciboValor, setReciboValor] = useState<number>(3500)
  const [reciboData, setReciboData] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10)
  })
  const [reciboDescricao, setReciboDescricao] = useState<string>(
    'Prestação de serviços de consultoria contábil, análise de balanço patrimonial, diagnóstico econômico-financeiro e parecer gerencial referente ao exercício corrente.',
  )

  // Sincroniza o cliente selecionado quando muda no filtro
  useEffect(() => {
    if (selectedEmpresaId) {
      setReciboClienteId(selectedEmpresaId)
    }
  }, [selectedEmpresaId])

  const reciboCliente = useMemo(() => {
    return empresas.find((e) => e.id === reciboClienteId) || selectedEmpresa
  }, [empresas, reciboClienteId, selectedEmpresa])

  // Gerar novo número sequencial de recibo
  const handleGerarNovoNumero = () => {
    const next = parseInt(reciboNumero || '1000', 10) + 1
    setReciboNumero(String(next))
    localStorage.setItem('last_recibo_num', String(next))
    toast({
      title: 'Novo número gerado',
      description: `Recibo sequencial: #${next}`,
    })
  }

  const loadRelatorioData = async () => {
    if (!selectedEmpresaId) return
    try {
      setLoading(true)
      const [bList, dList] = await Promise.all([
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
      ])
      setBalancos(bList)
      setDres(dList)
    } catch (err) {
      console.error('Erro ao carregar dados do relatório:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRelatorioData()
  }, [selectedEmpresaId])

  const anoAnterior = selectedAno - 1
  const balancoAtual = balancos.find((b) => b.ano === selectedAno) || null
  const balancoAnterior = balancos.find((b) => b.ano === anoAnterior) || null
  const dreAtual = dres.find((d) => d.ano === selectedAno) || null
  const dreAnterior = dres.find((d) => d.ano === anoAnterior) || null

  const calcBAtual = calcularBalanco(balancoAtual)
  const calcBAnterior = calcularBalanco(balancoAnterior)
  const calcDAtual = calcularDre(dreAtual)
  const calcDAnterior = calcularDre(dreAnterior)

  const indAtual = calcularIndicadores(balancoAtual, dreAtual)
  const indAnterior = balancoAnterior ? calcularIndicadores(balancoAnterior, dreAnterior) : null

  const pontoEquilibrioAtual = useMemo(() => {
    return calcularPontoEquilibrio(dreAtual, balancoAtual)
  }, [dreAtual, balancoAtual])

  const analise = gerarAnaliseAutomatica(balancoAtual, dreAtual, balancoAnterior, dreAnterior)

  const hasAnoAnterior = !!balancoAnterior

  // Análise Horizontal helper
  const calcAH = (atual?: number | null, ant?: number | null) => {
    if (!atual || !ant || ant === 0) return '—'
    const pct = ((atual - ant) / Math.abs(ant)) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  const calcAV = (val?: number | null, total?: number | null) => {
    if (!val || !total || total === 0) return '—'
    return `${((val / total) * 100).toFixed(1)}%`
  }

  // Print PDF handler
  const handlePrint = () => {
    window.print()
  }

  // Export CSV handler
  const handleExportCsv = () => {
    if (!selectedEmpresa) return

    let csvContent = '\uFEFF' // BOM para UTF-8 no Excel
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    if (tipoRelatorio === 'completo' || tipoRelatorio === 'balanco') {
      csvContent += `BALANÇO PATRIMONIAL (Valores em R$ mil)\n`
      csvContent += `Conta;${selectedAno};${hasAnoAnterior ? anoAnterior : 'Ano Anterior'};AV%;AH%\n`
      csvContent += `1. ATIVO TOTAL;${calcBAtual.ativoTotal};${calcBAnterior.ativoTotal};100,0%;${calcAH(calcBAtual.ativoTotal, calcBAnterior.ativoTotal)}\n`
      csvContent += `1.1 Ativo Circulante;${calcBAtual.ativoCirculante};${calcBAnterior.ativoCirculante};${calcAV(calcBAtual.ativoCirculante, calcBAtual.ativoTotal)};${calcAH(calcBAtual.ativoCirculante, calcBAnterior.ativoCirculante)}\n`
      csvContent += `Caixa e Equivalentes;${balancoAtual?.caixa_equivalentes || 0};${balancoAnterior?.caixa_equivalentes || 0};${calcAV(balancoAtual?.caixa_equivalentes, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.caixa_equivalentes, balancoAnterior?.caixa_equivalentes)}\n`
      csvContent += `Aplicações Financeiras;${balancoAtual?.aplicacoes_financeiras || 0};${balancoAnterior?.aplicacoes_financeiras || 0};${calcAV(balancoAtual?.aplicacoes_financeiras, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.aplicacoes_financeiras, balancoAnterior?.aplicacoes_financeiras)}\n`
      csvContent += `Contas a Receber;${balancoAtual?.contas_receber || 0};${balancoAnterior?.contas_receber || 0};${calcAV(balancoAtual?.contas_receber, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.contas_receber, balancoAnterior?.contas_receber)}\n`
      csvContent += `Estoques;${balancoAtual?.estoques || 0};${balancoAnterior?.estoques || 0};${calcAV(balancoAtual?.estoques, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.estoques, balancoAnterior?.estoques)}\n`
      csvContent += `1.2 Ativo Não Circulante;${calcBAtual.ativoNaoCirculante};${calcBAnterior.ativoNaoCirculante};${calcAV(calcBAtual.ativoNaoCirculante, calcBAtual.ativoTotal)};${calcAH(calcBAtual.ativoNaoCirculante, calcBAnterior.ativoNaoCirculante)}\n`
      csvContent += `Imobilizado;${balancoAtual?.imobilizado || 0};${balancoAnterior?.imobilizado || 0};${calcAV(balancoAtual?.imobilizado, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.imobilizado, balancoAnterior?.imobilizado)}\n`
      csvContent += `2. PASSIVO E PL;${calcBAtual.passivoEPL};${calcBAnterior.passivoEPL};100,0%;${calcAH(calcBAtual.passivoEPL, calcBAnterior.passivoEPL)}\n`
      csvContent += `2.1 Passivo Circulante;${calcBAtual.passivoCirculante};${calcBAnterior.passivoCirculante};${calcAV(calcBAtual.passivoCirculante, calcBAtual.passivoEPL)};${calcAH(calcBAtual.passivoCirculante, calcBAnterior.passivoCirculante)}\n`
      csvContent += `Fornecedores;${balancoAtual?.fornecedores || 0};${balancoAnterior?.fornecedores || 0};${calcAV(balancoAtual?.fornecedores, calcBAtual.passivoEPL)};${calcAH(balancoAtual?.fornecedores, balancoAnterior?.fornecedores)}\n`
      csvContent += `Empréstimos Curto Prazo;${balancoAtual?.emprestimos_curto_prazo || 0};${balancoAnterior?.emprestimos_curto_prazo || 0};${calcAV(balancoAtual?.emprestimos_curto_prazo, calcBAtual.passivoEPL)};${calcAH(balancoAtual?.emprestimos_curto_prazo, balancoAnterior?.emprestimos_curto_prazo)}\n`
      csvContent += `2.2 Passivo Não Circulante;${calcBAtual.passivoNaoCirculante};${calcBAnterior.passivoNaoCirculante};${calcAV(calcBAtual.passivoNaoCirculante, calcBAtual.passivoEPL)};${calcAH(calcBAtual.passivoNaoCirculante, calcBAnterior.passivoNaoCirculante)}\n`
      csvContent += `Empréstimos Longo Prazo;${balancoAtual?.emprestimos_longo_prazo || 0};${balancoAnterior?.emprestimos_longo_prazo || 0};${calcAV(balancoAtual?.emprestimos_longo_prazo, calcBAtual.passivoEPL)};${calcAH(balancoAtual?.emprestimos_longo_prazo, balancoAnterior?.emprestimos_longo_prazo)}\n`
      csvContent += `2.3 Patrimônio Líquido;${calcBAtual.patrimonioLiquido};${calcBAnterior.patrimonioLiquido};${calcAV(calcBAtual.patrimonioLiquido, calcBAtual.passivoEPL)};${calcAH(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido)}\n\n`
    }

    if (tipoRelatorio === 'completo' || tipoRelatorio === 'dre') {
      csvContent += `DEMONSTRATIVO DO RESULTADO (DRE - R$ mil)\n`
      csvContent += `Linha;${selectedAno};${hasAnoAnterior ? anoAnterior : 'Ano Anterior'};AV%;AH%\n`
      csvContent += `Receita Bruta;${dreAtual?.receita_bruta || 0};${dreAnterior?.receita_bruta || 0};;${calcAH(dreAtual?.receita_bruta, dreAnterior?.receita_bruta)}\n`
      csvContent += `Receita Líquida;${calcDAtual.receitaLiquida};${calcDAnterior.receitaLiquida};100,0%;${calcAH(calcDAtual.receitaLiquida, calcDAnterior.receitaLiquida)}\n`
      csvContent += `Lucro Bruto;${calcDAtual.lucroBruto};${calcDAnterior.lucroBruto};${calcAV(calcDAtual.lucroBruto, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.lucroBruto, calcDAnterior.lucroBruto)}\n`
      csvContent += `Resultado Operacional (EBIT);${calcDAtual.resultadoOperacional};${calcDAnterior.resultadoOperacional};${calcAV(calcDAtual.resultadoOperacional, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.resultadoOperacional, calcDAnterior.resultadoOperacional)}\n`
      csvContent += `Lucro Líquido;${calcDAtual.lucroLiquido};${calcDAnterior.lucroLiquido};${calcAV(calcDAtual.lucroLiquido, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.lucroLiquido, calcDAnterior.lucroLiquido)}\n`
      csvContent += `EBITDA;${calcDAtual.ebitda};${calcDAnterior.ebitda};${calcAV(calcDAtual.ebitda, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.ebitda, calcDAnterior.ebitda)}\n\n`
    }

    if (tipoRelatorio === 'completo' || tipoRelatorio === 'indicadores') {
      csvContent += `INDICADORES FINANCEIROS\n`
      csvContent += `Indicador;${selectedAno};${hasAnoAnterior ? anoAnterior : 'Ano Anterior'}\n`
      csvContent += `Liquidez Corrente;${formatNumber(indAtual.liquidezCorrente, 2)};${formatNumber(indAnterior?.liquidezCorrente, 2)}\n`
      csvContent += `Liquidez Seca;${formatNumber(indAtual.liquidezSeca, 2)};${formatNumber(indAnterior?.liquidezSeca, 2)}\n`
      csvContent += `Liquidez Imediata;${formatNumber(indAtual.liquidezImediata, 2)};${formatNumber(indAnterior?.liquidezImediata, 2)}\n`
      csvContent += `Liquidez Geral;${formatNumber(indAtual.liquidezGeral, 2)};${formatNumber(indAnterior?.liquidezGeral, 2)}\n`
      csvContent += `Endividamento Geral (%);${formatPercent(indAtual.endividamentoGeral, 1)};${formatPercent(indAnterior?.endividamentoGeral, 1)}\n`
      csvContent += `Composição do Endividamento (%);${formatPercent(indAtual.composicaoEndividamento, 1)};${formatPercent(indAnterior?.composicaoEndividamento, 1)}\n`
      csvContent += `Margem Bruta (%);${formatPercent(indAtual.margemBruta, 1)};${formatPercent(indAnterior?.margemBruta, 1)}\n`
      csvContent += `Margem Líquida (%);${formatPercent(indAtual.margemLiquida, 1)};${formatPercent(indAnterior?.margemLiquida, 1)}\n`
      csvContent += `ROA (%);${formatPercent(indAtual.roa, 1)};${formatPercent(indAnterior?.roa, 1)}\n`
      csvContent += `ROE (%);${formatPercent(indAtual.roe, 1)};${formatPercent(indAnterior?.roe, 1)}\n\n`

      csvContent += `PONTO DE EQUILÍBRIO E MARGEM DE SEGURANÇA\n`
      csvContent += `Métrica;Valor em R$;Em Unidades (un);Detalhes\n`
      csvContent += `Ponto de Equilíbrio Contábil (PEC);${pontoEquilibrioAtual.pec.toFixed(2).replace('.', ',')};${pontoEquilibrioAtual.pecUnidades || '—'};Custos Fixos / MC%\n`
      csvContent += `Ponto de Equilíbrio Econômico (PEE);${pontoEquilibrioAtual.pee.toFixed(2).replace('.', ',')};${pontoEquilibrioAtual.peeUnidades || '—'};(Custos Fixos + Lucro Meta) / MC%\n`
      csvContent += `Ponto de Equilíbrio Financeiro (PEF);${pontoEquilibrioAtual.pef.toFixed(2).replace('.', ',')};${pontoEquilibrioAtual.pefUnidades || '—'};(Custos Fixos - Depreciação) / MC%\n`
      csvContent += `Margem de Contribuição (R$ e %);${pontoEquilibrioAtual.margemContribuicaoReais.toFixed(2).replace('.', ',')};—;${pontoEquilibrioAtual.margemContribuicaoPercentual.toFixed(1).replace('.', ',')}%\n`
      csvContent += `Margem de Segurança (% e R$);${pontoEquilibrioAtual.margemSegurancaReais.toFixed(2).replace('.', ',')};—;${pontoEquilibrioAtual.margemSeguranca.toFixed(1).replace('.', ',')}%\n`
      csvContent += `Preço Médio Unitário Sugerido;${pontoEquilibrioAtual.precoMedioUnitario.toFixed(2).replace('.', ',')};—;Base de cálculo para unidades\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `relatorio_${selectedEmpresa.nome.toLowerCase().replace(/\s+/g, '_')}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Arquivo CSV Exportado',
      description: 'O relatório foi gerado e baixado para seu dispositivo.',
    })
  }

  if (!selectedEmpresa) {
    return (
      <div className="py-12 text-center text-xs text-slate-500">
        Selecione uma empresa para gerar relatórios.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controles de Configuração do Relatório (Ocultos na impressão) */}
      <div className="print:hidden bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Tipo de Relatório:
            </span>
            <Select
              value={tipoRelatorio}
              onValueChange={(val) => setTipoRelatorio(val as TipoRelatorio)}
            >
              <SelectTrigger className="h-8 text-xs font-semibold bg-slate-50 border-slate-200 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completo" className="text-xs">
                  Relatório Completo (Executivo)
                </SelectItem>
                <SelectItem value="balanco" className="text-xs">
                  Balanço Patrimonial
                </SelectItem>
                <SelectItem value="dre" className="text-xs">
                  Demonstrativo DRE
                </SelectItem>
                <SelectItem value="indicadores" className="text-xs">
                  Painel de Indicadores
                </SelectItem>
                <SelectItem value="recibo" className="text-xs font-semibold text-blue-700">
                  📄 Recibo de Prestação de Serviços
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={tipoRelatorio === 'recibo' ? 'default' : 'outline'}
            onClick={() => setTipoRelatorio('recibo')}
            className={`h-9 text-xs font-semibold ${
              tipoRelatorio === 'recibo'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'border-blue-200 hover:bg-blue-50 text-blue-700'
            }`}
          >
            <Receipt className="w-4 h-4 mr-1.5" />
            Recibos
          </Button>

          {tipoRelatorio !== 'recibo' && (
            <Button
              asChild
              variant="outline"
              className="h-9 text-xs font-semibold border-blue-200 hover:bg-blue-50 text-blue-700"
            >
              <Link to="/relatorio-anual">
                <FileText className="w-4 h-4 mr-1.5" />
                Ver Relatório Anual (12 Meses)
              </Link>
            </Button>
          )}

          {tipoRelatorio !== 'recibo' && (
            <Button
              onClick={handleExportCsv}
              variant="outline"
              className="h-9 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Exportar CSV
            </Button>
          )}

          <Button
            onClick={handlePrint}
            className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Painel de Edição Rápida do Recibo (Aparece somente quando tipoRelatorio === 'recibo' e oculto na impressão) */}
      {tipoRelatorio === 'recibo' && (
        <Card className="print:hidden border-slate-200 bg-white shadow-2xs animate-fadeIn">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  Configurar Dados do Recibo / Cobrança
                </CardTitle>
                <CardDescription className="text-xs">
                  Preencha os campos abaixo. As alterações atualizam a folha A4 em tempo real.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGerarNovoNumero}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  Próximo Nº Sequencial
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-blue-700 border-blue-200"
                >
                  <Link to="/minha-empresa">
                    <Landmark className="w-3.5 h-3.5 mr-1" />
                    Editar Dados Bancários
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Cliente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Cliente (Empresa)</Label>
                <Select value={reciboClienteId} onValueChange={setReciboClienteId}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome} ({formatCnpj(emp.cnpj)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Valor do Serviço (R$)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={reciboValor}
                    onChange={(e) => setReciboValor(parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs pl-9 font-semibold"
                  />
                </div>
              </div>

              {/* Data */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Data de Emissão</Label>
                <Input
                  type="date"
                  value={reciboData}
                  onChange={(e) => setReciboData(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Número Recibo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Nº do Recibo</Label>
                <Input
                  value={reciboNumero}
                  onChange={(e) => setReciboNumero(e.target.value)}
                  placeholder="Ex: 00102"
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>

              {/* Descrição dos Serviços */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                <Label className="text-xs font-semibold text-slate-700">
                  Descrição dos Serviços Prestados
                </Label>
                <Textarea
                  value={reciboDescricao}
                  onChange={(e) => setReciboDescricao(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                  placeholder="Descreva detalhadamente os serviços prestados..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso quando o ano anterior não existir (Oculto na impressão se desejar) */}
      {!hasAnoAnterior && tipoRelatorio !== 'recibo' && (
        <div className="print:hidden bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Aviso de Análise Horizontal:</strong> Não foram encontrados lançamentos para o
            ano anterior ({anoAnterior}). As colunas comparativas e variações históricas são
            exibidas como "—".
          </span>
        </div>
      )}

      {/* =========================================================================
          FOLHA A4 - PRÉ-VISUALIZAÇÃO / IMPRESSÃO
      ========================================================================= */}
      <div className="bg-white border border-slate-200 print:border-none shadow-md print:shadow-none rounded-2xl print:rounded-none max-w-[210mm] mx-auto p-8 sm:p-12 print:p-0 min-h-[297mm] text-slate-900">
        {/* Cabeçalho Corporativo Relatório */}
        <div
          className="border-b-2 pb-5 mb-6 flex items-start justify-between"
          style={{ borderColor: corPrimaria }}
        >
          <div className="flex items-center gap-3.5">
            {logoUrl ? (
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden">
                <img
                  src={logoUrl}
                  alt={minhaEmpresa?.nome_fantasia || 'Logotipo'}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div
                className="w-11 h-11 rounded-xl text-white flex items-center justify-center font-bold shadow-xs"
                style={{ backgroundColor: corPrimaria }}
              >
                <Scale className="w-6 h-6" />
              </div>
            )}
            <div>
              <span
                className="font-extrabold text-base tracking-tight block"
                style={{ color: corPrimaria }}
              >
                {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Analise de Balanço'}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold block">
                {minhaEmpresa?.nome_fantasia && minhaEmpresa?.razao_social
                  ? `${minhaEmpresa.nome_fantasia} · Consultoria Financeira & Contábil`
                  : 'Consultoria Financeira Corporativa'}
              </span>
              {minhaEmpresa?.cnpj && (
                <span className="text-[10px] text-slate-400 font-mono block">
                  CNPJ: {formatCnpj(minhaEmpresa.cnpj)}
                  {minhaEmpresa?.contador_nome &&
                    ` · CRC Resp: ${minhaEmpresa.contador_nome} (${minhaEmpresa.contador_crc})`}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <Badge className="bg-blue-50 text-blue-800 border-blue-200 font-bold text-xs uppercase tracking-wider mb-1">
              {tipoRelatorio === 'completo' && 'Parecer & Relatório Completo'}
              {tipoRelatorio === 'balanco' && 'Balanço Patrimonial'}
              {tipoRelatorio === 'dre' && 'Demonstrativo de Resultado'}
              {tipoRelatorio === 'indicadores' && 'Painel de Indicadores'}
              {tipoRelatorio === 'recibo' && `Recibo Oficial #${reciboNumero}`}
            </Badge>
            <p className="text-[11px] text-slate-500">
              Emissão:{' '}
              {tipoRelatorio === 'recibo' && reciboData
                ? new Date(reciboData + 'T12:00:00').toLocaleDateString('pt-BR')
                : new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* =========================================================================
            CORPO DO RELATÓRIO — QUANDO FOR RECIBO
        ========================================================================= */}
        {tipoRelatorio === 'recibo' && (
          <div className="space-y-6">
            {/* Título do Recibo e Caixa de Destaque de Valor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-slate-50/70">
              <div>
                <span className="text-[11px] uppercase tracking-widest font-bold text-slate-500 block">
                  Comprovante de Pagamento / Cobrança
                </span>
                <h3 className="text-xl font-extrabold text-[#0B1F3A]">
                  RECIBO DE PRESTAÇÃO DE SERVIÇOS
                </h3>
                <p className="text-xs text-slate-600 font-mono mt-0.5">
                  Número de Controle: <strong>#{reciboNumero}</strong> · Emissão:{' '}
                  {new Date(reciboData + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div
                className="p-4 rounded-xl text-white text-right self-start sm:self-auto min-w-[200px] shadow-xs"
                style={{ backgroundColor: corPrimaria }}
              >
                <span className="text-[10px] uppercase tracking-wider font-medium opacity-80 block">
                  Valor Total do Recibo
                </span>
                <strong className="text-2xl font-black block tracking-tight">
                  {formatCurrency(reciboValor)}
                </strong>
              </div>
            </div>

            {/* Dados do Tomador (Cliente) e Prestador (Minha Empresa) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Prestador / Emitente */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <strong className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                    Prestador dos Serviços (Emitente)
                  </strong>
                </div>
                <div className="space-y-1 text-slate-700">
                  <p>
                    <strong className="text-slate-900 font-semibold">Razão Social:</strong>{' '}
                    {minhaEmpresa?.razao_social || 'Apex Consultoria Contábil & Financeira Ltda'}
                  </p>
                  {minhaEmpresa?.nome_fantasia && (
                    <p>
                      <strong className="text-slate-900 font-semibold">Nome Fantasia:</strong>{' '}
                      {minhaEmpresa.nome_fantasia}
                    </p>
                  )}
                  <p>
                    <strong className="text-slate-900 font-semibold">CNPJ:</strong>{' '}
                    <span className="font-mono">
                      {minhaEmpresa?.cnpj ? formatCnpj(minhaEmpresa.cnpj) : '—'}
                    </span>
                  </p>
                  {minhaEmpresa?.logradouro && (
                    <p>
                      <strong className="text-slate-900 font-semibold">Endereço:</strong>{' '}
                      {minhaEmpresa.logradouro}
                      {minhaEmpresa.numero ? `, ${minhaEmpresa.numero}` : ''}
                      {minhaEmpresa.complemento ? ` - ${minhaEmpresa.complemento}` : ''}
                      {minhaEmpresa.bairro ? ` - ${minhaEmpresa.bairro}` : ''}
                      {minhaEmpresa.cidade
                        ? ` - ${minhaEmpresa.cidade}/${minhaEmpresa.estado}`
                        : ''}
                    </p>
                  )}
                  {minhaEmpresa?.telefone_comercial && (
                    <p>
                      <strong className="text-slate-900 font-semibold">Telefone:</strong>{' '}
                      {minhaEmpresa.telefone_comercial}
                    </p>
                  )}
                  {minhaEmpresa?.email_comercial && (
                    <p>
                      <strong className="text-slate-900 font-semibold">E-mail:</strong>{' '}
                      {minhaEmpresa.email_comercial}
                    </p>
                  )}
                  {minhaEmpresa?.contador_nome && (
                    <p>
                      <strong className="text-slate-900 font-semibold">Responsável Técnico:</strong>{' '}
                      {minhaEmpresa.contador_nome} (CRC {minhaEmpresa.contador_crc})
                    </p>
                  )}
                </div>
              </div>

              {/* Tomador (Cliente Pagador) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <strong className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                    Tomador dos Serviços (Cliente)
                  </strong>
                </div>
                <div className="space-y-1 text-slate-700">
                  <p>
                    <strong className="text-slate-900 font-semibold">Razão Social / Nome:</strong>{' '}
                    {reciboCliente?.nome || '—'}
                  </p>
                  {reciboCliente?.nome_fantasia && (
                    <p>
                      <strong className="text-slate-900 font-semibold">Nome Fantasia:</strong>{' '}
                      {reciboCliente.nome_fantasia}
                    </p>
                  )}
                  <p>
                    <strong className="text-slate-900 font-semibold">CNPJ:</strong>{' '}
                    <span className="font-mono">
                      {reciboCliente?.cnpj ? formatCnpj(reciboCliente.cnpj) : '—'}
                    </span>
                  </p>
                  <p>
                    <strong className="text-slate-900 font-semibold">Segmento:</strong>{' '}
                    {reciboCliente?.segmento || '—'}
                  </p>
                  {reciboCliente?.logradouro && (
                    <p>
                      <strong className="text-slate-900 font-semibold">Endereço:</strong>{' '}
                      {reciboCliente.logradouro}
                      {reciboCliente.numero ? `, ${reciboCliente.numero}` : ''}
                      {reciboCliente.cidade
                        ? ` - ${reciboCliente.cidade}/${reciboCliente.estado}`
                        : ''}
                    </p>
                  )}
                  {reciboCliente?.email && (
                    <p>
                      <strong className="text-slate-900 font-semibold">E-mail:</strong>{' '}
                      {reciboCliente.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Declaração e Descrição do Serviço */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 text-xs">
              <strong className="font-bold text-slate-900 uppercase text-[11px] tracking-wider block border-b border-slate-100 pb-2">
                Declaração de Recebimento & Discriminação dos Serviços
              </strong>

              <p className="text-slate-700 leading-relaxed text-[12px]">
                Recebemos de <strong>{reciboCliente?.nome || 'Empresa Cliente'}</strong>, inscrito
                no CNPJ sob o nº{' '}
                <strong>{reciboCliente?.cnpj ? formatCnpj(reciboCliente.cnpj) : '—'}</strong>, a
                importância líquida e certa de <strong>{formatCurrency(reciboValor)}</strong>,
                referente à prestação dos seguintes serviços:
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-[11px] text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                {reciboDescricao || 'Consultoria e assessoria financeira corporativa.'}
              </div>
            </div>

            {/* Seção de Dados Bancários para Pagamento / Quitação */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 text-xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                <strong className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                  Dados Bancários para Transferência / Liquidação
                </strong>
              </div>

              {minhaEmpresa?.banco || minhaEmpresa?.chave_pix ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium block text-[10px] uppercase tracking-wider">
                      Banco
                    </span>
                    <strong className="text-slate-900 font-semibold">
                      {minhaEmpresa.banco || 'Não informado'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block text-[10px] uppercase tracking-wider">
                      Agência
                    </span>
                    <strong className="text-slate-900 font-mono font-semibold">
                      {minhaEmpresa.agencia || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block text-[10px] uppercase tracking-wider">
                      Conta Corrente
                    </span>
                    <strong className="text-slate-900 font-mono font-semibold">
                      {minhaEmpresa.conta_corrente || '—'}
                    </strong>
                  </div>
                  <div className="bg-blue-50/60 border border-blue-200/60 rounded-lg p-2">
                    <span className="text-blue-800 font-bold block text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <QrCode className="w-3 h-3 text-blue-600" /> Chave PIX
                    </span>
                    <strong className="text-blue-900 font-mono text-[11px] break-all">
                      {minhaEmpresa.chave_pix || '—'}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center justify-between gap-2">
                  <span>
                    Nenhum dado bancário cadastrado em <strong>Minha Empresa</strong>. Preencha na
                    tela de configurações de sua consultoria para exibir banco, agência e chave PIX
                    automaticamente aqui.
                  </span>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] bg-white border-amber-300"
                  >
                    <Link to="/minha-empresa">Cadastrar Agora</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Assinatura / Quitação */}
            <div className="pt-8 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
              <div className="border-t border-slate-300 pt-3">
                <strong className="text-slate-900 font-bold block">
                  {minhaEmpresa?.razao_social || 'Apex Consultoria Ltda'}
                </strong>
                <span className="text-slate-500 text-[11px] block">
                  {minhaEmpresa?.contador_nome
                    ? `${minhaEmpresa.contador_nome} (CRC ${minhaEmpresa.contador_crc})`
                    : 'Representante Legal / Prestador'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Assinatura do Emitente
                </span>
              </div>

              <div className="border-t border-slate-300 pt-3">
                <strong className="text-slate-900 font-bold block">
                  {reciboCliente?.nome || 'Cliente Tomador'}
                </strong>
                <span className="text-slate-500 text-[11px] block">
                  CNPJ: {reciboCliente?.cnpj ? formatCnpj(reciboCliente.cnpj) : '—'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Assinatura do Pagador
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Informações da Empresa Cliente (Para Relatórios Financeiros) */}
        {tipoRelatorio !== 'recibo' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Empresa Cliente</span>
              <strong className="text-slate-900 font-bold">{selectedEmpresa.nome}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">CNPJ</span>
              <strong className="text-slate-900 font-mono">
                {formatCnpj(selectedEmpresa.cnpj)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Segmento</span>
              <strong className="text-slate-900 font-semibold">{selectedEmpresa.segmento}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">
                Exercício Analisado
              </span>
              <strong className="text-blue-700 font-bold">{selectedAno}</strong>
            </div>
          </div>
        )}

        {/* 1. SEÇÃO EXECUTIVA: RESUMO DE KPIS (SE COMPLETO) */}
        {tipoRelatorio === 'completo' && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              1. Visão Executiva dos Principais Indicadores
            </h4>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Ativo Total</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatBrlMil(calcBAtual.ativoTotal)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Passivo Total</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatBrlMil(calcBAtual.passivoTotal)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Patrimônio Líq.</span>
                <strong className="text-xs font-bold text-emerald-700">
                  {formatBrlMil(calcBAtual.patrimonioLiquido)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Liq. Corrente</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatNumber(indAtual.liquidezCorrente, 2)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Endividamento</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatPercent(indAtual.endividamentoGeral, 1)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">ROE</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatPercent(indAtual.roe, 1)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* 2. SEÇÃO: BALANÇO PATRIMONIAL */}
        {(tipoRelatorio === 'completo' || tipoRelatorio === 'balanco') && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              {tipoRelatorio === 'completo' ? '2. Balanço Patrimonial' : 'Balanço Patrimonial'}
            </h4>

            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-300">
                  <th className="py-1.5 px-2">Conta</th>
                  <th className="py-1.5 px-2 text-right">{selectedAno} (R$ mil)</th>
                  <th className="py-1.5 px-2 text-right">
                    {hasAnoAnterior ? anoAnterior : 'Ant.'} (R$ mil)
                  </th>
                  <th className="py-1.5 px-2 text-center">AV%</th>
                  <th className="py-1.5 px-2 text-center">AH%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="font-bold bg-slate-50">
                  <td className="py-1 px-2">1. ATIVO TOTAL</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAtual.ativoTotal)}</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAnterior.ativoTotal)}</td>
                  <td className="py-1 px-2 text-center">100%</td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.ativoTotal, calcBAnterior.ativoTotal)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">1.1 Ativo Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.ativoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.ativoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.ativoCirculante, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.ativoCirculante, calcBAnterior.ativoCirculante)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Caixa e Equivalentes</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAtual?.caixa_equivalentes)}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.caixa_equivalentes)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.caixa_equivalentes, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.caixa_equivalentes, balancoAnterior?.caixa_equivalentes)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Contas a Receber</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAtual?.contas_receber)}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.contas_receber)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.contas_receber, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.contas_receber, balancoAnterior?.contas_receber)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Estoques</td>
                  <td className="py-0.5 px-2 text-right">{formatBrlMil(balancoAtual?.estoques)}</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.estoques)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.estoques, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.estoques, balancoAnterior?.estoques)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">1.2 Ativo Não Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.ativoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.ativoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.ativoNaoCirculante, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.ativoNaoCirculante, calcBAnterior.ativoNaoCirculante)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Imobilizado</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAtual?.imobilizado)}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.imobilizado)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.imobilizado, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.imobilizado, balancoAnterior?.imobilizado)}
                  </td>
                </tr>

                <tr className="font-bold bg-slate-50">
                  <td className="py-1 px-2">2. PASSIVO E PATRIMÔNIO LÍQUIDO</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAtual.passivoEPL)}</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAnterior.passivoEPL)}</td>
                  <td className="py-1 px-2 text-center">100%</td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.passivoEPL, calcBAnterior.passivoEPL)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">2.1 Passivo Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.passivoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.passivoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.passivoCirculante, calcBAtual.passivoEPL)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.passivoCirculante, calcBAnterior.passivoCirculante)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">2.2 Passivo Não Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.passivoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.passivoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.passivoNaoCirculante, calcBAtual.passivoEPL)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.passivoNaoCirculante, calcBAnterior.passivoNaoCirculante)}
                  </td>
                </tr>
                <tr className="font-bold text-emerald-900 bg-emerald-50/40">
                  <td className="py-1 px-4">2.3 Patrimônio Líquido</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.patrimonioLiquido)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.patrimonioLiquido)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.patrimonioLiquido, calcBAtual.passivoEPL)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 3. SEÇÃO: DRE */}
        {(tipoRelatorio === 'completo' || tipoRelatorio === 'dre') && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              {tipoRelatorio === 'completo'
                ? '3. Demonstrativo de Resultado (DRE)'
                : 'Demonstrativo de Resultado'}
            </h4>

            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-300">
                  <th className="py-1.5 px-2">Linha da DRE</th>
                  <th className="py-1.5 px-2 text-right">{selectedAno} (R$ mil)</th>
                  <th className="py-1.5 px-2 text-right">
                    {hasAnoAnterior ? anoAnterior : 'Ant.'} (R$ mil)
                  </th>
                  <th className="py-1.5 px-2 text-center">AV% (sobre Rec. Líq.)</th>
                  <th className="py-1.5 px-2 text-center">AH%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1 px-2 font-medium">(=) Receita Operacional Bruta</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(dreAtual?.receita_bruta)}</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(dreAnterior?.receita_bruta)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(dreAtual?.receita_bruta, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(dreAtual?.receita_bruta, dreAnterior?.receita_bruta)}
                  </td>
                </tr>
                <tr className="font-bold bg-slate-50">
                  <td className="py-1 px-2">(=) RECEITA OPERACIONAL LÍQUIDA</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAnterior.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">100%</td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.receitaLiquida, calcDAnterior.receitaLiquida)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-2">(=) LUCRO BRUTO</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcDAtual.lucroBruto)}</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcDAnterior.lucroBruto)}</td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcDAtual.lucroBruto, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.lucroBruto, calcDAnterior.lucroBruto)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-2">(=) RESULTADO OPERACIONAL (EBIT)</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAtual.resultadoOperacional)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAnterior.resultadoOperacional)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcDAtual.resultadoOperacional, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.resultadoOperacional, calcDAnterior.resultadoOperacional)}
                  </td>
                </tr>
                <tr className="font-bold text-emerald-900 bg-emerald-50/40">
                  <td className="py-1 px-2">(=) LUCRO LÍQUIDO DO EXERCÍCIO</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcDAtual.lucroLiquido)}</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAnterior.lucroLiquido)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcDAtual.lucroLiquido, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.lucroLiquido, calcDAnterior.lucroLiquido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 4. SEÇÃO: INDICADORES FINANCEIROS */}
        {(tipoRelatorio === 'completo' || tipoRelatorio === 'indicadores') && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              {tipoRelatorio === 'completo'
                ? '4. Tabela de Indicadores e Índices'
                : 'Painel de Indicadores'}
            </h4>

            <div className="grid grid-cols-2 gap-4 text-[11px]">
              {/* Liquidez e Endividamento */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-slate-900 block text-xs border-b border-slate-100 pb-1">
                  Liquidez & Endividamento
                </span>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Liquidez Corrente:</span>
                  <strong>{formatNumber(indAtual.liquidezCorrente, 2)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Liquidez Seca:</span>
                  <strong>{formatNumber(indAtual.liquidezSeca, 2)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Liquidez Imediata:</span>
                  <strong>{formatNumber(indAtual.liquidezImediata, 2)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Endividamento Geral (%):</span>
                  <strong>{formatPercent(indAtual.endividamentoGeral, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Composição Endividamento:</span>
                  <strong>{formatPercent(indAtual.composicaoEndividamento, 1)}</strong>
                </div>
              </div>

              {/* Rentabilidade e Estrutura */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-slate-900 block text-xs border-b border-slate-100 pb-1">
                  Rentabilidade & Estrutura
                </span>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Margem Bruta (%):</span>
                  <strong>{formatPercent(indAtual.margemBruta, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Margem Líquida (%):</span>
                  <strong>{formatPercent(indAtual.margemLiquida, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">ROA (Retorno Ativo %):</span>
                  <strong>{formatPercent(indAtual.roa, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">ROE (Retorno PL %):</span>
                  <strong>{formatPercent(indAtual.roe, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Alavancagem Financeira:</span>
                  <strong>{formatNumber(indAtual.alavancagemFinanceira, 2)}x</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. SEÇÃO: PONTO DE EQUILÍBRIO (SE COMPLETO OU INDICADORES) */}
        {(tipoRelatorio === 'completo' || tipoRelatorio === 'indicadores') && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-blue-600" />
                {tipoRelatorio === 'completo'
                  ? '5. Ponto de Equilíbrio & Margem de Segurança'
                  : 'Ponto de Equilíbrio'}
              </span>
              <span className="text-[10px] font-normal text-slate-500 lowercase">
                preço unitário sugerido: {formatCurrency(pontoEquilibrioAtual.precoMedioUnitario)}
              </span>
            </h4>

            {/* Grid dos 3 Pontos de Equilíbrio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              {/* PEC */}
              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 uppercase text-[10px]">
                    PE Contábil (PEC)
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0 border-0">
                    Lucro Zero
                  </Badge>
                </div>
                <div className="text-base font-black text-emerald-700">
                  {formatCurrency(pontoEquilibrioAtual.pec)}
                </div>
                <div className="text-xs font-bold text-emerald-900">
                  {formatInteger(pontoEquilibrioAtual.pecUnidades)} un
                </div>
                <p className="text-[10px] text-slate-600 leading-tight pt-1 border-t border-emerald-100">
                  Volume e faturamento para cobrir custos e despesas fixas (
                  {formatCurrency(pontoEquilibrioAtual.custosFixos)}).
                </p>
              </div>

              {/* PEE */}
              <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950 uppercase text-[10px]">
                    PE Econômico (PEE)
                  </span>
                  <Badge className="bg-purple-100 text-purple-800 text-[9px] px-1.5 py-0 border-0">
                    Fixos + Lucro
                  </Badge>
                </div>
                <div className="text-base font-black text-purple-700">
                  {formatCurrency(pontoEquilibrioAtual.pee)}
                </div>
                <div className="text-xs font-bold text-purple-900">
                  {formatInteger(pontoEquilibrioAtual.peeUnidades)} un
                </div>
                <p className="text-[10px] text-slate-600 leading-tight pt-1 border-t border-purple-100">
                  Necessário para cobrir fixos e entregar o lucro desejado de{' '}
                  {formatCurrency(pontoEquilibrioAtual.lucroDesejado)}.
                </p>
              </div>

              {/* PEF */}
              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 uppercase text-[10px]">
                    PE Financeiro (PEF)
                  </span>
                  <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0 border-0">
                    Caixa Efetivo
                  </Badge>
                </div>
                <div className="text-base font-black text-amber-700">
                  {formatCurrency(pontoEquilibrioAtual.pef)}
                </div>
                <div className="text-xs font-bold text-amber-900">
                  {formatInteger(pontoEquilibrioAtual.pefUnidades)} un
                </div>
                <p className="text-[10px] text-slate-600 leading-tight pt-1 border-t border-amber-100">
                  Necessário para honrar despesas desembolsáveis (desconsiderando depreciação de{' '}
                  {formatCurrency(pontoEquilibrioAtual.depreciacao)}).
                </p>
              </div>
            </div>

            {/* Linha complementar de Margem de Contribuição e Segurança */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-1">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">
                  Margem de Contribuição (R$)
                </span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatCurrency(pontoEquilibrioAtual.margemContribuicaoReais)}
                </strong>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Margem de Contribuição (%)</span>
                <strong className="text-xs font-bold text-blue-700">
                  {formatPercent(pontoEquilibrioAtual.margemContribuicaoPercentual, 1)}
                </strong>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Margem de Segurança (R$)</span>
                <strong
                  className={`text-xs font-bold ${
                    pontoEquilibrioAtual.margemSegurancaReais >= 0
                      ? 'text-emerald-700'
                      : 'text-red-600'
                  }`}
                >
                  {formatCurrency(pontoEquilibrioAtual.margemSegurancaReais)}
                </strong>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Margem de Segurança (%)</span>
                <strong
                  className={`text-xs font-bold ${
                    pontoEquilibrioAtual.margemSeguranca >= 15
                      ? 'text-emerald-700'
                      : pontoEquilibrioAtual.margemSeguranca >= 0
                        ? 'text-amber-700'
                        : 'text-red-600'
                  }`}
                >
                  {formatPercent(pontoEquilibrioAtual.margemSeguranca, 1)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* 6. PARECER AUTOMÁTICO DO CONSULTOR (SE COMPLETO) */}
        {tipoRelatorio === 'completo' && (
          <div className="mb-6 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              6. Parecer Técnico da Consultoria
            </h4>

            <div className="space-y-2 text-[11px] leading-relaxed text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {analise.visaoGeral.map((paragrafo, idx) => (
                <p key={idx}>{paragrafo}</p>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé A4 */}
        <div className="border-t border-slate-200 pt-4 mt-8 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Analise de Balanço'} ·
            Consultoria Financeira &copy; {new Date().getFullYear()}
          </span>
          <span>Documento gerado eletronicamente para fins de análise gerencial</span>
        </div>
      </div>
    </div>
  )
}
