import React, { useState, useEffect, useMemo } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Printer,
  Building2,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Network,
  TrendingUp,
  Layers,
  Scale,
  PieChart,
  DollarSign,
  Activity,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { useToast } from '@/hooks/use-toast'
import type {
  GrupoEmpresarialRecord,
  EmpresaRecord,
  MinhaEmpresaRecord,
  BalancoRecord,
  DreRecord,
} from '@/types/finance'
import {
  formatCurrency,
  formatPercent,
  formatCnpj,
  formatNumber,
  formatBrlMil,
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularKanitz,
  consolidarBalancoAnual,
  consolidarDreAnual,
  NOMES_MESES,
  type KanitzResultado,
} from '@/lib/financeCalculations'
import { balancosService, dreService } from '@/services/financeService'

export interface ModalRelatorioConsolidadoGrupoA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  grupo: GrupoEmpresarialRecord | null
  empresas: EmpresaRecord[]
  selectedAnoInicial?: number
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
}

export interface EmpresaContribuicaoItem {
  empresa: EmpresaRecord
  receitaBruta: number
  receitaLiquida: number
  custoMercadorias: number
  despesasOperacionais: number
  lucroLiquido: number
  ativoTotal: number
  ativoCirculante: number
  passivoCirculante: number
  patrimonioLiquido: number
  pctReceita: number
  pctAtivo: number
  pctPL: number
  pctLucro: number
  temDados: boolean
}

export function ModalRelatorioConsolidadoGrupoA4({
  open,
  onOpenChange,
  grupo,
  empresas,
  selectedAnoInicial = 2024,
  minhaEmpresa,
  logoUrl,
}: ModalRelatorioConsolidadoGrupoA4Props) {
  const { toast } = useToast()

  const [selectedAno, setSelectedAno] = useState<number>(selectedAnoInicial)
  const [selectedPeriodoTipo, setSelectedPeriodoTipo] = useState<'anual' | 'mensal'>('anual')
  const [selectedMes, setSelectedMes] = useState<number>(12)
  const [loading, setLoading] = useState(false)

  // Balanços e DREs de todas as empresas do grupo
  const [balancosEmpresas, setBalancosEmpresas] = useState<Map<string, BalancoRecord[]>>(new Map())
  const [dresEmpresas, setDresEmpresas] = useState<Map<string, DreRecord[]>>(new Map())

  // Lista de empresas pertencentes ao grupo
  const empresasDoGrupo = useMemo(() => {
    if (!grupo || !grupo.empresas) return []
    const ids = new Set(grupo.empresas)
    return empresas.filter((e) => ids.has(e.id))
  }, [grupo, empresas])

  // Lista de anos disponíveis com base nos balanços
  const anosDisponiveis = useMemo(() => {
    const setAnos = new Set<number>()
    setAnos.add(selectedAnoInicial)
    setAnos.add(new Date().getFullYear())
    setAnos.add(new Date().getFullYear() - 1)

    balancosEmpresas.forEach((bList) => {
      bList.forEach((b) => {
        if (b.ano) setAnos.add(b.ano)
      })
    })

    return Array.from(setAnos).sort((a, b) => b - a)
  }, [balancosEmpresas, selectedAnoInicial])

  // Carregar todos os balanços e dres individuais das empresas do grupo
  useEffect(() => {
    if (!open || !grupo || !grupo.empresas || grupo.empresas.length === 0) return

    let isMounted = true
    const carregarDadosIndividuais = async () => {
      setLoading(true)
      try {
        const empIds = grupo.empresas || []
        const balancosMap = new Map<string, BalancoRecord[]>()
        const dresMap = new Map<string, DreRecord[]>()

        await Promise.all(
          empIds.map(async (empId) => {
            try {
              const [bList, dList] = await Promise.all([
                balancosService.getByEmpresa(empId),
                dreService.getByEmpresa(empId),
              ])
              balancosMap.set(empId, bList)
              dresMap.set(empId, dList)
            } catch (err) {
              console.error(`Erro ao carregar dados da empresa ${empId}:`, err)
            }
          }),
        )

        if (isMounted) {
          setBalancosEmpresas(balancosMap)
          setDresEmpresas(dresMap)
        }
      } catch (err) {
        console.error('Erro ao carregar dados consolidados do grupo:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    carregarDadosIndividuais()
    return () => {
      isMounted = false
    }
  }, [open, grupo])

  // Atualizar selectedAno se mudar no prop
  useEffect(() => {
    if (selectedAnoInicial) {
      setSelectedAno(selectedAnoInicial)
    }
  }, [selectedAnoInicial])

  // Contribuição individual de cada empresa no período selecionado (ano ou mês)
  const contribuicoesEmpresas = useMemo<EmpresaContribuicaoItem[]>(() => {
    if (!grupo || empresasDoGrupo.length === 0) return []

    return empresasDoGrupo.map((emp) => {
      const bList = balancosEmpresas.get(emp.id) || []
      const dList = dresEmpresas.get(emp.id) || []

      let bItem: BalancoRecord | null = null
      let dItem: DreRecord | null = null

      if (selectedPeriodoTipo === 'mensal') {
        bItem = bList.find((b) => b.ano === selectedAno && (b.mes ?? 12) === selectedMes) || null
        dItem = dList.find((d) => d.ano === selectedAno && (d.mes ?? 12) === selectedMes) || null
      } else {
        bItem = consolidarBalancoAnual(bList, selectedAno)
        dItem = consolidarDreAnual(dList, selectedAno)
      }

      const calcB = calcularBalanco(bItem)
      const calcD = calcularDre(dItem)

      const temDados = !!bItem || !!dItem

      return {
        empresa: emp,
        receitaBruta: dItem?.receita_bruta || 0,
        receitaLiquida: calcD.receitaLiquida,
        custoMercadorias: dItem?.custo_mercadorias || 0,
        despesasOperacionais: dItem?.despesas_operacionais || 0,
        lucroLiquido: calcD.lucroLiquido,
        ativoTotal: calcB.ativoTotal,
        ativoCirculante: calcB.ativoCirculante,
        passivoCirculante: calcB.passivoCirculante,
        patrimonioLiquido: calcB.patrimonioLiquido,
        pctReceita: 0,
        pctAtivo: 0,
        pctPL: 0,
        pctLucro: 0,
        temDados,
      }
    })
  }, [
    grupo,
    empresasDoGrupo,
    balancosEmpresas,
    dresEmpresas,
    selectedAno,
    selectedPeriodoTipo,
    selectedMes,
  ])

  // Totais consolidados somando as contribuições das empresas
  const totalConsolidado = useMemo(() => {
    const totalReceitaBruta = contribuicoesEmpresas.reduce((acc, c) => acc + c.receitaBruta, 0)
    const totalReceitaLiquida = contribuicoesEmpresas.reduce((acc, c) => acc + c.receitaLiquida, 0)
    const totalCustoMercadorias = contribuicoesEmpresas.reduce(
      (acc, c) => acc + c.custoMercadorias,
      0,
    )
    const totalDespesasOperacionais = contribuicoesEmpresas.reduce(
      (acc, c) => acc + c.despesasOperacionais,
      0,
    )
    const totalLucroLiquido = contribuicoesEmpresas.reduce((acc, c) => acc + c.lucroLiquido, 0)
    const totalAtivo = contribuicoesEmpresas.reduce((acc, c) => acc + c.ativoTotal, 0)
    const totalAtivoCirculante = contribuicoesEmpresas.reduce(
      (acc, c) => acc + c.ativoCirculante,
      0,
    )
    const totalPassivoCirculante = contribuicoesEmpresas.reduce(
      (acc, c) => acc + c.passivoCirculante,
      0,
    )
    const totalPL = contribuicoesEmpresas.reduce((acc, c) => acc + c.patrimonioLiquido, 0)

    return {
      receitaBruta: totalReceitaBruta,
      receitaLiquida: totalReceitaLiquida,
      custoMercadorias: totalCustoMercadorias,
      despesasOperacionais: totalDespesasOperacionais,
      lucroLiquido: totalLucroLiquido,
      ativoTotal: totalAtivo,
      ativoCirculante: totalAtivoCirculante,
      passivoCirculante: totalPassivoCirculante,
      patrimonioLiquido: totalPL,
    }
  }, [contribuicoesEmpresas])

  // Balanço e DRE consolidados completos do grupo para o período
  const { balancoConsolidado, dreConsolidado } = useMemo(() => {
    if (contribuicoesEmpresas.length === 0) {
      return { balancoConsolidado: null, dreConsolidado: null }
    }

    // Acumuladores de campos
    const bAcc: Partial<BalancoRecord> = {
      ano: selectedAno,
      mes: selectedPeriodoTipo === 'mensal' ? selectedMes : 12,
      caixa_equivalentes: 0,
      aplicacoes_financeiras: 0,
      contas_receber: 0,
      estoques: 0,
      impostos_recuperar: 0,
      outros_ativo_circulante: 0,
      realizavel_longo_prazo: 0,
      investimentos: 0,
      imobilizado: 0,
      intangivel: 0,
      fornecedores: 0,
      emprestimos_curto_prazo: 0,
      obrigacoes_trabalhistas: 0,
      obrigacoes_tributarias: 0,
      outros_passivo_circulante: 0,
      emprestimos_longo_prazo: 0,
      outras_obrigacoes_longo_prazo: 0,
      capital_social: 0,
      reservas_lucros: 0,
      lucros_acumulados: 0,
    }

    const dAcc: Partial<DreRecord> = {
      ano: selectedAno,
      mes: selectedPeriodoTipo === 'mensal' ? selectedMes : 12,
      receita_bruta: 0,
      deducoes_receita: 0,
      custo_mercadorias: 0,
      despesas_operacionais: 0,
      despesas_financeiras: 0,
      outras_receitas_despesas: 0,
      imposto_renda: 0,
    }

    empresasDoGrupo.forEach((emp) => {
      const bList = balancosEmpresas.get(emp.id) || []
      const dList = dresEmpresas.get(emp.id) || []

      let bItem: BalancoRecord | null = null
      let dItem: DreRecord | null = null

      if (selectedPeriodoTipo === 'mensal') {
        bItem = bList.find((b) => b.ano === selectedAno && (b.mes ?? 12) === selectedMes) || null
        dItem = dList.find((d) => d.ano === selectedAno && (d.mes ?? 12) === selectedMes) || null
      } else {
        bItem = consolidarBalancoAnual(bList, selectedAno)
        dItem = consolidarDreAnual(dList, selectedAno)
      }

      if (bItem) {
        bAcc.caixa_equivalentes = (bAcc.caixa_equivalentes || 0) + (bItem.caixa_equivalentes || 0)
        bAcc.aplicacoes_financeiras =
          (bAcc.aplicacoes_financeiras || 0) + (bItem.aplicacoes_financeiras || 0)
        bAcc.contas_receber = (bAcc.contas_receber || 0) + (bItem.contas_receber || 0)
        bAcc.estoques = (bAcc.estoques || 0) + (bItem.estoques || 0)
        bAcc.impostos_recuperar = (bAcc.impostos_recuperar || 0) + (bItem.impostos_recuperar || 0)
        bAcc.outros_ativo_circulante =
          (bAcc.outros_ativo_circulante || 0) + (bItem.outros_ativo_circulante || 0)
        bAcc.realizavel_longo_prazo =
          (bAcc.realizavel_longo_prazo || 0) + (bItem.realizavel_longo_prazo || 0)
        bAcc.investimentos = (bAcc.investimentos || 0) + (bItem.investimentos || 0)
        bAcc.imobilizado = (bAcc.imobilizado || 0) + (bItem.imobilizado || 0)
        bAcc.intangivel = (bAcc.intangivel || 0) + (bItem.intangivel || 0)
        bAcc.fornecedores = (bAcc.fornecedores || 0) + (bItem.fornecedores || 0)
        bAcc.emprestimos_curto_prazo =
          (bAcc.emprestimos_curto_prazo || 0) + (bItem.emprestimos_curto_prazo || 0)
        bAcc.obrigacoes_trabalhistas =
          (bAcc.obrigacoes_trabalhistas || 0) + (bItem.obrigacoes_trabalhistas || 0)
        bAcc.obrigacoes_tributarias =
          (bAcc.obrigacoes_tributarias || 0) + (bItem.obrigacoes_tributarias || 0)
        bAcc.outros_passivo_circulante =
          (bAcc.outros_passivo_circulante || 0) + (bItem.outros_passivo_circulante || 0)
        bAcc.emprestimos_longo_prazo =
          (bAcc.emprestimos_longo_prazo || 0) + (bItem.emprestimos_longo_prazo || 0)
        bAcc.outras_obrigacoes_longo_prazo =
          (bAcc.outras_obrigacoes_longo_prazo || 0) + (bItem.outras_obrigacoes_longo_prazo || 0)
        bAcc.capital_social = (bAcc.capital_social || 0) + (bItem.capital_social || 0)
        bAcc.reservas_lucros = (bAcc.reservas_lucros || 0) + (bItem.reservas_lucros || 0)
        bAcc.lucros_acumulados = (bAcc.lucros_acumulados || 0) + (bItem.lucros_acumulados || 0)
      }

      if (dItem) {
        dAcc.receita_bruta = (dAcc.receita_bruta || 0) + (dItem.receita_bruta || 0)
        dAcc.deducoes_receita = (dAcc.deducoes_receita || 0) + (dItem.deducoes_receita || 0)
        dAcc.custo_mercadorias = (dAcc.custo_mercadorias || 0) + (dItem.custo_mercadorias || 0)
        dAcc.despesas_operacionais =
          (dAcc.despesas_operacionais || 0) + (dItem.despesas_operacionais || 0)
        dAcc.despesas_financeiras =
          (dAcc.despesas_financeiras || 0) + (dItem.despesas_financeiras || 0)
        dAcc.outras_receitas_despesas =
          (dAcc.outras_receitas_despesas || 0) + (dItem.outras_receitas_despesas || 0)
        dAcc.imposto_renda = (dAcc.imposto_renda || 0) + (dItem.imposto_renda || 0)
      }
    })

    return {
      balancoConsolidado: bAcc as BalancoRecord,
      dreConsolidado: dAcc as DreRecord,
    }
  }, [
    contribuicoesEmpresas,
    empresasDoGrupo,
    balancosEmpresas,
    dresEmpresas,
    selectedAno,
    selectedPeriodoTipo,
    selectedMes,
  ])

  // Cálculos do balanço e DRE consolidado
  const balancoCalc = useMemo(() => calcularBalanco(balancoConsolidado), [balancoConsolidado])
  const dreCalc = useMemo(() => calcularDre(dreConsolidado), [dreConsolidado])
  const indCalc = useMemo(
    () => calcularIndicadores(balancoConsolidado, dreConsolidado),
    [balancoConsolidado, dreConsolidado],
  )
  const kanitzCalc: KanitzResultado = useMemo(
    () => calcularKanitz(balancoConsolidado || null, dreConsolidado || null),
    [balancoConsolidado, dreConsolidado],
  )

  // Contribuições com percentuais calculados com proteção contra divisão por zero
  const contribuicoesComPct = useMemo(() => {
    return contribuicoesEmpresas.map((c) => ({
      ...c,
      pctReceita:
        totalConsolidado.receitaLiquida > 0
          ? (c.receitaLiquida / totalConsolidado.receitaLiquida) * 100
          : 0,
      pctAtivo:
        totalConsolidado.ativoTotal > 0 ? (c.ativoTotal / totalConsolidado.ativoTotal) * 100 : 0,
      pctPL:
        totalConsolidado.patrimonioLiquido > 0
          ? (c.patrimonioLiquido / totalConsolidado.patrimonioLiquido) * 100
          : 0,
      pctLucro:
        totalConsolidado.lucroLiquido > 0
          ? (c.lucroLiquido / totalConsolidado.lucroLiquido) * 100
          : 0,
    }))
  }, [contribuicoesEmpresas, totalConsolidado])

  const dataEmissao = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  const periodoLabel = useMemo(() => {
    if (selectedPeriodoTipo === 'mensal') {
      const nomeMes = NOMES_MESES[selectedMes - 1] || `Mês ${selectedMes}`
      return `${nomeMes} de ${selectedAno}`
    }
    return `Exercício Anual de ${selectedAno}`
  }, [selectedPeriodoTipo, selectedMes, selectedAno])

  const hasMinhaEmpresa = !!(
    minhaEmpresa?.razao_social ||
    minhaEmpresa?.nome_fantasia ||
    minhaEmpresa?.contador_nome
  )

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!grupo) return

    let csv = '\uFEFF' // UTF-8 BOM
    csv += `RELATÓRIO CONSOLIDADO DO GRUPO EMPRESARIAL\n`
    csv += `Grupo;${grupo.nome}\n`
    csv += `Período;${periodoLabel}\n`
    csv += `Data de Emissão;${dataEmissao}\n`
    csv += `Quantidade de Empresas;${empresasDoGrupo.length}\n\n`

    // DRE CONSOLIDADO
    csv += `--- DEMONSTRAÇÃO DO RESULTADO CONSOLIDADA (DRE) ---\n`
    csv += `Conta / Rubrica;Valor (R$)\n`
    csv += `Receita Bruta;${(dreConsolidado?.receita_bruta || 0).toFixed(2).replace('.', ',')}\n`
    csv += `Deduções da Receita;${(dreConsolidado?.deducoes_receita || 0).toFixed(2).replace('.', ',')}\n`
    csv += `(=) Receita Líquida;${dreCalc.receitaLiquida.toFixed(2).replace('.', ',')}\n`
    csv += `(-) Custo das Mercadorias / Serviços (CMV);${(dreConsolidado?.custo_mercadorias || 0).toFixed(2).replace('.', ',')}\n`
    csv += `(=) Lucro Bruto;${dreCalc.lucroBruto.toFixed(2).replace('.', ',')}\n`
    csv += `(-) Despesas Operacionais;${(dreConsolidado?.despesas_operacionais || 0).toFixed(2).replace('.', ',')}\n`
    csv += `(=) Resultado Operacional (EBIT);${dreCalc.resultadoOperacional.toFixed(2).replace('.', ',')}\n`
    csv += `(-) Despesas Financeiras Líquidas;${(dreConsolidado?.despesas_financeiras || 0).toFixed(2).replace('.', ',')}\n`
    csv += `(=) Lucro Líquido Consolidado;${dreCalc.lucroLiquido.toFixed(2).replace('.', ',')}\n`
    csv += `EBITDA Consolidado;${dreCalc.ebitda.toFixed(2).replace('.', ',')}\n\n`

    // BALANÇO CONSOLIDADO
    csv += `--- BALANÇO PATRIMONIAL CONSOLIDADO ---\n`
    csv += `Grupo Patrimonial;Valor (R$)\n`
    csv += `Ativo Circulante;${balancoCalc.ativoCirculante.toFixed(2).replace('.', ',')}\n`
    csv += `Ativo Não Circulante;${balancoCalc.ativoNaoCirculante.toFixed(2).replace('.', ',')}\n`
    csv += `(=) Ativo Total Consolidado;${balancoCalc.ativoTotal.toFixed(2).replace('.', ',')}\n`
    csv += `Passivo Circulante;${balancoCalc.passivoCirculante.toFixed(2).replace('.', ',')}\n`
    csv += `Passivo Não Circulante;${balancoCalc.passivoNaoCirculante.toFixed(2).replace('.', ',')}\n`
    csv += `(=) Patrimônio Líquido Consolidado;${balancoCalc.patrimonioLiquido.toFixed(2).replace('.', ',')}\n\n`

    // QUEBRA POR EMPRESA
    csv += `--- QUEBRA E CONTRIBUIÇÃO POR EMPRESA MEMBRO ---\n`
    csv += `Empresa;CNPJ;Segmento;Receita Líquida (R$);% Rec;Lucro Líquido (R$);% Lucro;Ativo Total (R$);% Ativo;Patrimônio Líquido (R$);% PL\n`
    contribuicoesComPct.forEach((c) => {
      csv += `${c.empresa.nome};`
      csv += `${c.empresa.cnpj ? formatCnpj(c.empresa.cnpj) : '—'};`
      csv += `${c.empresa.segmento || 'Geral'};`
      csv += `${c.receitaLiquida.toFixed(2).replace('.', ',')};`
      csv += `${c.pctReceita.toFixed(1).replace('.', ',')}%;`
      csv += `${c.lucroLiquido.toFixed(2).replace('.', ',')};`
      csv += `${c.pctLucro.toFixed(1).replace('.', ',')}%;`
      csv += `${c.ativoTotal.toFixed(2).replace('.', ',')};`
      csv += `${c.pctAtivo.toFixed(1).replace('.', ',')}%;`
      csv += `${c.patrimonioLiquido.toFixed(2).replace('.', ',')};`
      csv += `${c.pctPL.toFixed(1).replace('.', ',')}%\n`
    })
    csv += `TOTAL CONSOLIDADO;—;${empresasDoGrupo.length} empresas;`
    csv += `${totalConsolidado.receitaLiquida.toFixed(2).replace('.', ',')};100%;`
    csv += `${totalConsolidado.lucroLiquido.toFixed(2).replace('.', ',')};100%;`
    csv += `${totalConsolidado.ativoTotal.toFixed(2).replace('.', ',')};100%;`
    csv += `${totalConsolidado.patrimonioLiquido.toFixed(2).replace('.', ',')};100%\n`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Relatorio_Consolidado_Grupo_${grupo.nome.replace(/\s+/g, '_')}_${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV Consolidado Exportado',
      description: 'O relatório consolidado do grupo com quebra por empresa foi baixado.',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações e Filtros (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                Relatório Consolidado do Grupo (Padrão A4)
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                  {empresasDoGrupo.length} {empresasDoGrupo.length === 1 ? 'empresa' : 'empresas'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Demonstrativos somados, indicadores e contribuição individual de cada empresa
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Seletor de Tipo de Período (Anual ou Mensal) */}
            <Select
              value={selectedPeriodoTipo}
              onValueChange={(v: 'anual' | 'mensal') => setSelectedPeriodoTipo(v)}
            >
              <SelectTrigger className="h-8 text-xs w-28 bg-white">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anual" className="text-xs">
                  Anual (Consol.)
                </SelectItem>
                <SelectItem value="mensal" className="text-xs">
                  Mensal
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Seletor de Mês se Mensal */}
            {selectedPeriodoTipo === 'mensal' && (
              <Select value={String(selectedMes)} onValueChange={(v) => setSelectedMes(Number(v))}>
                <SelectTrigger className="h-8 text-xs w-28 bg-white">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {NOMES_MESES.map((nome, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Seletor de Ano */}
            <Select value={String(selectedAno)} onValueChange={(v) => setSelectedAno(Number(v))}>
              <SelectTrigger className="h-8 text-xs w-24 bg-white font-bold text-indigo-900">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)} className="text-xs font-semibold">
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar dados consolidados em planilha CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
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
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
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
                  <strong>Atenção:</strong> Os dados da consultoria (nome/logotipo) e do contador
                  responsável (CRC) podem ser configurados para constar no cabeçalho formal do laudo
                  consolidado.
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
        <div className="p-6 sm:p-10 bg-slate-100/60 flex justify-center print:p-0 print:bg-white">
          <div
            id="relatorio-consolidado-grupo-document"
            className="w-full max-w-[820px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-7 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white font-sans"
          >
            {/* ========================================================= */}
            {/* CABEÇALHO EXECUTIVO DO RELATÓRIO CONSOLIDADO */}
            {/* ========================================================= */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
              {/* Topo: Consultoria Emissora */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={minhaEmpresa?.nome_fantasia || 'Logotipo'}
                      className="h-12 max-w-[160px] object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {minhaEmpresa?.nome_fantasia?.charAt(0) || 'C'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria & Controladoria Econômica'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Diagnóstico Econômico-Financeiro & Consolidação de Grupos Empresariais'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data de Emissão</span>
                  <span>{dataEmissao}</span>
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center py-2 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-800 border-indigo-200 text-[10px] font-bold px-3 py-0.5 uppercase tracking-wider"
                >
                  Demonstrações Financeiras Consolidadas
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  RELATÓRIO CONSOLIDADO DO GRUPO EMPRESARIAL
                </h1>
                <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                  Agregação integral de Balanço Patrimonial, DRE, Indicadores e Quebra de
                  Contribuição por Empresa
                </p>
              </div>

              {/* Quadro Informativo do Grupo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Grupo Econômico:</span>
                    <strong className="text-indigo-950 font-bold">{grupo?.nome || '—'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresas Participantes:</span>
                    <span className="font-bold text-slate-800">
                      {empresasDoGrupo.length} empresas consolidadas
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Descrição / Propósito:</span>
                    <span
                      className="text-slate-700 truncate max-w-[200px]"
                      title={grupo?.descricao || 'Consolidação de grupo'}
                    >
                      {grupo?.descricao || 'Grupo empresarial ativo'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Período de Referência:</span>
                    <strong className="text-indigo-700 font-bold">{periodoLabel}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Consultor Responsável:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Financeiro'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Registro Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${
                            minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''
                          }`
                        : 'CRC Ativo'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* MINI CARDS DE DESTAQUES CONSOLIDADOS */}
            {/* ========================================================= */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Receita Líquida Consolidada
                </span>
                <strong className="text-xs sm:text-sm font-black text-blue-900 block font-mono">
                  {formatCurrency(dreCalc.receitaLiquida)}
                </strong>
                <span className="text-[9px] text-slate-400">Total somado do grupo</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Lucro Líquido Consolidado
                </span>
                <div className="flex items-baseline gap-1">
                  <strong
                    className={`text-xs sm:text-sm font-black font-mono ${
                      dreCalc.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {formatCurrency(dreCalc.lucroLiquido)}
                  </strong>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold">
                  Margem Líquida: {formatPercent(indCalc.margemLiquida, 1)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Ativo Total Consolidado
                </span>
                <strong className="text-xs sm:text-sm font-black text-[#0B1F3A] block font-mono">
                  {formatCurrency(balancoCalc.ativoTotal)}
                </strong>
                <span className="text-[9px] text-slate-500">
                  PL: {formatCurrency(balancoCalc.patrimonioLiquido)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Liquidez Corrente Grupo
                </span>
                <strong className="text-xs sm:text-sm font-black text-indigo-700 block font-mono">
                  {indCalc.liquidezCorrente !== null
                    ? `${formatNumber(indCalc.liquidezCorrente, 2)}x`
                    : '—'}
                </strong>
                <span className="text-[9px] text-slate-500">
                  ROE: {formatPercent(indCalc.roe, 1)}
                </span>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SEÇÃO 1: DEMONSTRAÇÃO DO RESULTADO CONSOLIDADA (DRE) */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-xs sm:text-sm font-black text-[#0B1F3A] uppercase tracking-wide">
                    1. Demonstração do Resultado do Exercício Consolidada (DRE)
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-600 font-mono">
                  {periodoLabel}
                </Badge>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-600 font-bold uppercase">
                      <th className="py-2 px-3 w-[60%]">Estrutura de Contas / Rubricas</th>
                      <th className="py-2 px-3 text-right w-[25%]">Valor Consolidado (R$)</th>
                      <th className="py-2 px-3 text-right w-[15%]">% Rec. Líquida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    <tr className="bg-slate-50/50">
                      <td className="py-1.5 px-3 font-semibold text-slate-800">
                        Receita Operacional Bruta
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-medium text-slate-900">
                        {formatCurrency(dreConsolidado?.receita_bruta || 0)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                        {dreCalc.receitaLiquida > 0
                          ? formatPercent(
                              ((dreConsolidado?.receita_bruta || 0) / dreCalc.receitaLiquida) * 100,
                              1,
                            )
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-slate-600 pl-6">
                        (-) Deduções da Receita Bruta / Impostos
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-rose-700">
                        {formatCurrency(dreConsolidado?.deducoes_receita || 0)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                        {dreCalc.receitaLiquida > 0
                          ? formatPercent(
                              ((dreConsolidado?.deducoes_receita || 0) / dreCalc.receitaLiquida) *
                                100,
                              1,
                            )
                          : '—'}
                      </td>
                    </tr>
                    <tr className="bg-blue-50/60 font-bold">
                      <td className="py-1.5 px-3 text-blue-950 font-extrabold">
                        (=) Receita Operacional Líquida
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-blue-950 font-black">
                        {formatCurrency(dreCalc.receitaLiquida)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-blue-950">100,0%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-slate-600 pl-6">
                        (-) Custos das Mercadorias / Serviços Vendidos (CMV/CSV)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-rose-700">
                        {formatCurrency(dreConsolidado?.custo_mercadorias || 0)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                        {dreCalc.receitaLiquida > 0
                          ? formatPercent(
                              ((dreConsolidado?.custo_mercadorias || 0) / dreCalc.receitaLiquida) *
                                100,
                              1,
                            )
                          : '—'}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/70 font-semibold">
                      <td className="py-1.5 px-3 text-slate-900">(=) Lucro Bruto Consolidado</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900 font-bold">
                        {formatCurrency(dreCalc.lucroBruto)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-600 font-semibold">
                        {dreCalc.receitaLiquida > 0
                          ? formatPercent((dreCalc.lucroBruto / dreCalc.receitaLiquida) * 100, 1)
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-slate-600 pl-6">
                        (-) Despesas Operacionais (Comerciais, Administrativas e Gerais)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-rose-700">
                        {formatCurrency(dreConsolidado?.despesas_operacionais || 0)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                        {dreCalc.receitaLiquida > 0
                          ? formatPercent(
                              ((dreConsolidado?.despesas_operacionais || 0) /
                                dreCalc.receitaLiquida) *
                                100,
                              1,
                            )
                          : '—'}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50 font-semibold">
                      <td className="py-1.5 px-3 text-slate-900">
                        (=) Resultado Operacional Antes do Financeiro (EBIT)
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900 font-bold">
                        {formatCurrency(dreCalc.resultadoOperacional)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                        {dreCalc.receitaLiquida > 0
                          ? formatPercent(
                              (dreCalc.resultadoOperacional / dreCalc.receitaLiquida) * 100,
                              1,
                            )
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-slate-600 pl-6">
                        (+/-) Despesas e Receitas Financeiras Líquidas
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(dreConsolidado?.despesas_financeiras || 0)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                        {dreCalc.receitaLiquida > 0
                          ? formatPercent(
                              ((dreConsolidado?.despesas_financeiras || 0) /
                                dreCalc.receitaLiquida) *
                                100,
                              1,
                            )
                          : '—'}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/80 border-t-2 border-emerald-300 font-bold text-emerald-950">
                      <td className="py-2 px-3 text-emerald-950 font-black text-xs">
                        (=) Lucro Líquido Consolidado do Grupo
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-950 font-black text-xs">
                        {formatCurrency(dreCalc.lucroLiquido)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-900 font-bold">
                        {formatPercent(indCalc.margemLiquida, 1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SEÇÃO 2: BALANÇO PATRIMONIAL CONSOLIDADO */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-xs sm:text-sm font-black text-[#0B1F3A] uppercase tracking-wide">
                    2. Balanço Patrimonial Consolidado
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-600 font-mono">
                  Posição em {periodoLabel}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Ativo */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 font-bold text-xs text-[#0B1F3A]">
                    ATIVO CONSOLIDADO
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      <tr className="bg-blue-50/40 font-semibold">
                        <td className="py-1.5 px-3 text-blue-950">
                          Ativo Circulante (Curto Prazo)
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-blue-950">
                          {formatCurrency(balancoCalc.ativoCirculante)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">Caixa e Equivalentes</td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(balancoConsolidado?.caixa_equivalentes || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">
                          Contas a Receber (Clientes)
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(balancoConsolidado?.contas_receber || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">
                          Estoques de Mercadorias / MP
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(balancoConsolidado?.estoques || 0)}
                        </td>
                      </tr>
                      <tr className="bg-blue-50/40 font-semibold">
                        <td className="py-1.5 px-3 text-blue-950">
                          Ativo Não Circulante (Longo Prazo)
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-blue-950">
                          {formatCurrency(balancoCalc.ativoNaoCirculante)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">Realizável a Longo Prazo</td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(balancoConsolidado?.realizavel_longo_prazo || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">
                          Imobilizado &amp; Intangível
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(
                            (balancoConsolidado?.imobilizado || 0) +
                              (balancoConsolidado?.intangivel || 0),
                          )}
                        </td>
                      </tr>
                      <tr className="bg-slate-100/90 font-black text-slate-900 border-t border-slate-200">
                        <td className="py-2 px-3 uppercase text-xs">Total do Ativo Consolidado</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-[#0B1F3A]">
                          {formatCurrency(balancoCalc.ativoTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Passivo e PL */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 font-bold text-xs text-[#0B1F3A]">
                    PASSIVO &amp; PATRIMÔNIO LÍQUIDO CONSOLIDADO
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      <tr className="bg-amber-50/40 font-semibold">
                        <td className="py-1.5 px-3 text-amber-950">
                          Passivo Circulante (Curto Prazo)
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-amber-950">
                          {formatCurrency(balancoCalc.passivoCirculante)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">Fornecedores</td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(balancoConsolidado?.fornecedores || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">
                          Empréstimos de Curto Prazo
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(balancoConsolidado?.emprestimos_curto_prazo || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-slate-600 pl-5">
                          Obrigações Trab. e Tributárias
                        </td>
                        <td className="py-1 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(
                            (balancoConsolidado?.obrigacoes_trabalhistas || 0) +
                              (balancoConsolidado?.obrigacoes_tributarias || 0),
                          )}
                        </td>
                      </tr>
                      <tr className="bg-amber-50/40 font-semibold">
                        <td className="py-1.5 px-3 text-amber-950">
                          Passivo Não Circulante (Longo Prazo)
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-amber-950">
                          {formatCurrency(balancoCalc.passivoNaoCirculante)}
                        </td>
                      </tr>
                      <tr className="bg-emerald-50/50 font-bold text-emerald-950">
                        <td className="py-1.5 px-3">Patrimônio Líquido Consolidado</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold">
                          {formatCurrency(balancoCalc.patrimonioLiquido)}
                        </td>
                      </tr>
                      <tr className="bg-slate-100/90 font-black text-slate-900 border-t border-slate-200">
                        <td className="py-2 px-3 uppercase text-xs">Total do Passivo + PL</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-[#0B1F3A]">
                          {formatCurrency(balancoCalc.passivoEPL)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SEÇÃO 3: QUEBRA E CONTRIBUIÇÃO POR EMPRESA (INDISPENSÁVEL) */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-xs sm:text-sm font-black text-[#0B1F3A] uppercase tracking-wide">
                    3. Quebra de Contribuição por Empresa Membro
                  </h3>
                </div>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-mono">
                  {empresasDoGrupo.length} Participantes
                </Badge>
              </div>

              <p className="text-[11px] text-slate-500">
                A tabela abaixo detalha a participação individual de cada empresa integrante na
                composição da Receita Líquida, Lucro Líquido, Ativo Total e Patrimônio Líquido do
                grupo.
              </p>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] text-slate-700 font-bold uppercase">
                        <th className="py-2.5 px-3 w-[26%]">Empresa Participante</th>
                        <th className="py-2.5 px-2 text-right w-[18%]">
                          Receita Líquida (% Grupo)
                        </th>
                        <th className="py-2.5 px-2 text-right w-[18%]">Lucro Líquido (% Grupo)</th>
                        <th className="py-2.5 px-2 text-right w-[19%]">Ativo Total (% Grupo)</th>
                        <th className="py-2.5 px-2 text-right w-[19%]">Patrimônio Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {contribuicoesComPct.map((item) => (
                        <tr
                          key={item.empresa.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate max-w-[180px]">{item.empresa.nome}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>
                                CNPJ: {item.empresa.cnpj ? formatCnpj(item.empresa.cnpj) : '—'}
                              </span>
                              <span>•</span>
                              <span>{item.empresa.segmento || 'Geral'}</span>
                            </div>
                          </td>

                          {/* Receita */}
                          <td className="py-2.5 px-2 text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatCurrency(item.receitaLiquida)}
                            </span>
                            <span className="text-[10px] text-blue-700 font-semibold">
                              {formatPercent(item.pctReceita, 1)} do total
                            </span>
                          </td>

                          {/* Lucro Líquido */}
                          <td className="py-2.5 px-2 text-right">
                            <span
                              className={`font-mono font-bold block ${
                                item.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {formatCurrency(item.lucroLiquido)}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {totalConsolidado.lucroLiquido > 0
                                ? `${formatPercent(item.pctLucro, 1)}`
                                : item.lucroLiquido >= 0
                                  ? 'Positivo'
                                  : 'Negativo'}
                            </span>
                          </td>

                          {/* Ativo Total */}
                          <td className="py-2.5 px-2 text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatCurrency(item.ativoTotal)}
                            </span>
                            <span className="text-[10px] text-indigo-700 font-semibold">
                              {formatPercent(item.pctAtivo, 1)} do total
                            </span>
                          </td>

                          {/* Patrimônio Líquido */}
                          <td className="py-2.5 px-2 text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatCurrency(item.patrimonioLiquido)}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {formatPercent(item.pctPL, 1)} do PL
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Linha de Total Consolidado */}
                      <tr className="bg-indigo-50/70 border-t-2 border-indigo-300 font-bold text-indigo-950">
                        <td className="py-2.5 px-3 font-extrabold text-xs text-indigo-950">
                          TOTAL CONSOLIDADO DO GRUPO
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono font-black text-xs text-indigo-950 block">
                            {formatCurrency(totalConsolidado.receitaLiquida)}
                          </span>
                          <span className="text-[10px] text-indigo-800 font-bold">100,0%</span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span
                            className={`font-mono font-black text-xs block ${
                              totalConsolidado.lucroLiquido >= 0
                                ? 'text-emerald-800'
                                : 'text-rose-700'
                            }`}
                          >
                            {formatCurrency(totalConsolidado.lucroLiquido)}
                          </span>
                          <span className="text-[10px] text-slate-600 font-bold">
                            ML: {formatPercent(indCalc.margemLiquida, 1)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono font-black text-xs text-indigo-950 block">
                            {formatCurrency(totalConsolidado.ativoTotal)}
                          </span>
                          <span className="text-[10px] text-indigo-800 font-bold">100,0%</span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono font-black text-xs text-indigo-950 block">
                            {formatCurrency(totalConsolidado.patrimonioLiquido)}
                          </span>
                          <span className="text-[10px] text-indigo-800 font-bold">100,0%</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* SEÇÃO 4: INDICADORES ECONÔMICO-FINANCEIROS CONSOLIDADOS */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-xs sm:text-sm font-black text-[#0B1F3A] uppercase tracking-wide">
                    4. Principais Indicadores Econômicos e Financeiros
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-600 font-mono">
                  Consolidado
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Liquidez Corrente */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Liquidez Corrente
                  </span>
                  <strong className="text-base font-black text-blue-900 font-mono block">
                    {indCalc.liquidezCorrente !== null
                      ? `${formatNumber(indCalc.liquidezCorrente, 2)}x`
                      : '—'}
                  </strong>
                  <span className="text-[10px] text-slate-600 block">
                    {indCalc.liquidezCorrente && indCalc.liquidezCorrente >= 1.2
                      ? 'Capacidade sólida de pagamento'
                      : 'Atenção à liquidez imediata'}
                  </span>
                </div>

                {/* Margem Líquida */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Margem Líquida
                  </span>
                  <strong
                    className={`text-base font-black font-mono block ${
                      indCalc.margemLiquida !== null && indCalc.margemLiquida >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-600'
                    }`}
                  >
                    {formatPercent(indCalc.margemLiquida, 1)}
                  </strong>
                  <span className="text-[10px] text-slate-600 block">
                    Conversão de receita em lucro
                  </span>
                </div>

                {/* ROE */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Retorno s/ PL (ROE)
                  </span>
                  <strong className="text-base font-black text-indigo-700 font-mono block">
                    {formatPercent(indCalc.roe, 1)}
                  </strong>
                  <span className="text-[10px] text-slate-600 block">
                    Remuneração do capital próprio
                  </span>
                </div>

                {/* Kanitz / Solvência */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Termômetro de Kanitz
                  </span>
                  <strong className="text-base font-black text-slate-900 font-mono block">
                    {kanitzCalc.fi !== null ? formatNumber(kanitzCalc.fi, 2) : '—'}
                  </strong>
                  <span
                    className={`text-[10px] font-bold block ${
                      kanitzCalc.classificacao === 'solvente'
                        ? 'text-emerald-700'
                        : kanitzCalc.classificacao === 'penumbra'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                    }`}
                  >
                    {kanitzCalc.statusTexto}
                  </span>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* NOTA METODOLÓGICA DE CONSOLIDAÇÃO */}
            {/* ========================================================= */}
            <section className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-xs text-[#0B1F3A] font-bold block flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Regra de Consolidação Contábil
              </strong>
              <p>
                Os demonstrativos consolidados deste relatório representam a soma direta linha a
                linha dos balanços patrimoniais e DREs de todas as empresas pertencentes ao grupo{' '}
                <strong>"{grupo?.nome}"</strong> no período de <strong>{periodoLabel}</strong>,
                conforme apurado no motor contábil do sistema.
              </p>
            </section>

            {/* ========================================================= */}
            {/* CAMPO DE ASSINATURA FORMAL */}
            {/* ========================================================= */}
            <footer className="pt-6 border-t-2 border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                <div className="text-center space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                  <strong className="text-xs text-slate-900 block">
                    Representação Legal do Grupo
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    {grupo?.nome || 'Grupo Empresarial'}
                  </span>
                </div>

                <div className="text-center space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                  <strong className="text-xs text-slate-900 block">
                    {minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    {minhaEmpresa?.contador_crc
                      ? `CRC: ${minhaEmpresa.contador_crc}${
                          minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''
                        }`
                      : 'Controladoria & Diagnóstico Contábil'}
                  </span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2">
                Documento gerado em {dataEmissao} via Sistema de Gestão Econômica e Financeira
              </div>
            </footer>

            {/* Rodapé fixo formal na impressão */}
            <DocumentPrintFooter
              documentTitle={`Relatório Consolidado do Grupo: ${grupo?.nome || 'Grupo Empresarial'}`}
              empresaNome={grupo?.nome || 'Grupo Econômico'}
              exercicioAno={selectedAno}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ModalRelatorioConsolidadoGrupoA4
