import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Layers,
  ClipboardList,
  DollarSign,
  Building2,
  TrendingUp,
  Percent,
  Coins,
  ShieldCheck,
  ArrowRight,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type {
  ProdutoRecord,
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  EmpresaRecord,
  ConfiguracaoTributariaRecord,
} from '@/types/finance'
import { calcularTributosMateriaPrima } from '@/lib/taxCalculations'

export interface PainelConsolidadoEmpresaProps {
  empresa: EmpresaRecord | null
  empresas: EmpresaRecord[]
  selectedEmpresaId: string
  onSelectEmpresa: (empresaId: string) => void
  produtos: ProdutoRecord[]
  materiasPrimas: MateriaPrimaRecord[]
  fichasTecnicas: FichaTecnicaRecord[]
  configTributaria?: ConfiguracaoTributariaRecord | null
  loading?: boolean
  onNavigateToTab?: (tab: string) => void
}

function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0,0%'
  return `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

export function PainelConsolidadoEmpresa({
  empresa,
  empresas,
  selectedEmpresaId,
  onSelectEmpresa,
  produtos,
  materiasPrimas,
  fichasTecnicas,
  configTributaria,
  loading = false,
  onNavigateToTab,
}: PainelConsolidadoEmpresaProps) {
  // Cálculos consolidados da empresa ativa
  const metrics = useMemo(() => {
    // 1. Produtos
    const totalProdutos = produtos.length
    const produtosComFicha = produtos.filter((p) =>
      fichasTecnicas.some((f) => f.produto === p.id),
    ).length
    const pctProdutosComFicha = totalProdutos > 0 ? (produtosComFicha / totalProdutos) * 100 : 0
    const precoMedioVenda =
      totalProdutos > 0
        ? produtos.reduce((acc, p) => acc + (Number(p.preco_venda) || 0), 0) / totalProdutos
        : 0
    const margemMediaProdutos =
      totalProdutos > 0
        ? produtos.reduce((acc, p) => {
            const custo = Number(p.custo) || 0
            const preco = Number(p.preco_venda) || 0
            if (preco > 0 && custo > 0) {
              return acc + ((preco - custo) / preco) * 100
            }
            return acc + (Number(p.margem_desejada) || 0)
          }, 0) / totalProdutos
        : 0

    // 2. Matérias-Primas & Estoque Valorizado
    const totalMaterias = materiasPrimas.length
    let valorEstoqueBruto = 0
    let valorEstoqueLiquido = 0
    let totalCreditosTributariosEstoque = 0
    let totalItensEstoqueZerado = 0
    let totalItensAbaixoMinimo = 0

    materiasPrimas.forEach((m) => {
      const custoUnit = Number(m.custo_unitario) || 0
      const estoque = Number(m.estoque_atual) || 0
      const estMin = Number(m.estoque_minimo) || 0

      if (estoque <= 0) {
        totalItensEstoqueZerado++
      } else if (estMin > 0 && estoque < estMin) {
        totalItensAbaixoMinimo++
      }

      const calcTrib = calcularTributosMateriaPrima(
        custoUnit,
        m.icms_percentual,
        m.pis_percentual,
        m.cofins_percentual,
        m.isenta_st,
        m.tipo_tributacao,
        m.ipi_percentual,
        m.frete_percentual,
        m.perdas_percentual,
      )

      valorEstoqueBruto += calcTrib.custoBruto * estoque
      valorEstoqueLiquido += calcTrib.custoLiquido * estoque
      totalCreditosTributariosEstoque += calcTrib.totalCreditos * estoque
    })

    // 3. Fichas Técnicas
    const totalFichas = fichasTecnicas.length
    const custoMedioFichas =
      totalFichas > 0
        ? fichasTecnicas.reduce((acc, f) => acc + (Number(f.custo_total) || 0), 0) / totalFichas
        : 0
    const precoSugeridoMedio =
      totalFichas > 0
        ? fichasTecnicas.reduce((acc, f) => acc + (Number(f.preco_venda_sugerido) || 0), 0) /
          totalFichas
        : 0
    const totalInsumosUtilizados = fichasTecnicas.reduce(
      (acc, f) => acc + (f.itens?.length || 0),
      0,
    )

    return {
      totalProdutos,
      produtosComFicha,
      pctProdutosComFicha,
      precoMedioVenda,
      margemMediaProdutos,
      totalMaterias,
      valorEstoqueBruto,
      valorEstoqueLiquido,
      totalCreditosTributariosEstoque,
      totalItensEstoqueZerado,
      totalItensAbaixoMinimo,
      totalFichas,
      custoMedioFichas,
      precoSugeridoMedio,
      totalInsumosUtilizados,
    }
  }, [produtos, materiasPrimas, fichasTecnicas])

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner de Topo com Contexto da Empresa e Seletor Rápido */}
      <div className="bg-gradient-to-r from-[#0B1F3A] via-[#132E54] to-[#1A365D] text-white p-5 rounded-xl shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded border border-blue-400/30">
                  Painel Consolidado de Custos
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : 'Empresa Ativa'}
                </span>
                {empresa?.segmento && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-300 border-emerald-400/40 bg-emerald-950/30"
                  >
                    {empresa.segmento}
                  </Badge>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                {empresa?.nome || 'Visão Consolidada por Empresa'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Visão 360° de produtos cadastrados, insumos, fichas técnicas de custo e estoque
                valorizado da empresa.
              </p>
            </div>
          </div>

          {empresas.length > 1 && (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs p-2 rounded-lg border border-white/15 w-full lg:w-auto">
              <label
                htmlFor="painel-trocar-empresa"
                className="text-xs font-semibold text-blue-200 shrink-0"
              >
                Empresa:
              </label>
              <select
                id="painel-trocar-empresa"
                value={selectedEmpresaId}
                onChange={(e) => onSelectEmpresa(e.target.value)}
                className="h-9 text-xs bg-slate-900/90 text-white border border-blue-400/40 rounded-md px-3 font-medium focus:ring-2 focus:ring-blue-400 focus:outline-none w-full lg:w-64"
              >
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome} {emp.cnpj ? `(${emp.cnpj})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4 CARDS DE KPI PRINCIPAIS SOLICITADOS NA ESPECIFICAÇÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total de Produtos */}
        <Card className="bg-white border-slate-200 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Total de Produtos</p>
                <h3 className="text-2xl font-black text-[#0B1F3A] mt-1">{metrics.totalProdutos}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <span className="text-emerald-600 font-semibold">{metrics.produtosComFicha}</span>{' '}
                  com ficha técnica
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Margem Média:</span>
              <span className="font-bold text-emerald-700">
                {formatPct(metrics.margemMediaProdutos)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Total de Matérias-Primas */}
        <Card className="bg-white border-slate-200 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Matérias-Primas / Insumos</p>
                <h3 className="text-2xl font-black text-[#0B1F3A] mt-1">{metrics.totalMaterias}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <span className="text-blue-600 font-semibold">
                    {metrics.totalInsumosUtilizados}
                  </span>{' '}
                  vínculos em fichas
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Alertas Estoque:</span>
              <span
                className={`font-bold ${
                  metrics.totalItensAbaixoMinimo > 0 ? 'text-amber-600' : 'text-emerald-700'
                }`}
              >
                {metrics.totalItensAbaixoMinimo} em atenção
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Total de Fichas Técnicas */}
        <Card className="bg-white border-slate-200 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Fichas Técnicas</p>
                <h3 className="text-2xl font-black text-[#0B1F3A] mt-1">{metrics.totalFichas}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <span className="text-purple-600 font-semibold">
                    {metrics.pctProdutosComFicha.toFixed(0)}%
                  </span>{' '}
                  cobertura catálogo
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Custo Médio Total:</span>
              <span className="font-bold text-slate-800">
                {formatBrl(metrics.custoMedioFichas)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Valor Total de Estoque (Matéria-Prima Valorizada) */}
        <Card className="bg-gradient-to-br from-emerald-50/60 to-white border-emerald-200 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  Estoque Valorizado (Líquido)
                </p>
                <h3 className="text-2xl font-black text-emerald-800 mt-1 font-mono">
                  {formatBrl(metrics.valorEstoqueLiquido)}
                </h3>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Bruto: {formatBrl(metrics.valorEstoqueBruto)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Créditos Tributários (ICMS/PIS):</span>
              <span className="font-bold text-blue-700">
                {formatBrl(metrics.totalCreditosTributariosEstoque)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DETALHAMENTO EM GRID (PRODUTOS & COBERTURA, ESTRUTURA DE ESTOQUE E REGIME TRIBUTÁRIO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Painel 1: Cobertura de Fichas Técnicas e Formação de Preço */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Catálogo & Cobertura de Custos
            </CardTitle>
            <CardDescription className="text-xs">
              Mapeamento de produtos precificados e composições técnicas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1.5 font-semibold text-slate-700">
                <span>Produtos com Ficha Técnica</span>
                <span className="text-blue-700 font-bold">
                  {metrics.produtosComFicha} de {metrics.totalProdutos} (
                  {metrics.pctProdutosComFicha.toFixed(0)}%)
                </span>
              </div>
              <Progress value={metrics.pctProdutosComFicha} className="h-2 bg-slate-100" />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Preço Médio de Venda:</span>
                <span className="font-bold text-blue-900">
                  {formatBrl(metrics.precoMedioVenda)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Margem Média Praticada:</span>
                <span className="font-bold text-emerald-700">
                  {formatPct(metrics.margemMediaProdutos)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Preço Sugerido Médio (Fichas):</span>
                <span className="font-bold text-purple-800">
                  {formatBrl(metrics.precoSugeridoMedio)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {onNavigateToTab ? (
                <Button
                  onClick={() => onNavigateToTab('catalogo')}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                >
                  Ir para Catálogo de Produtos
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ) : (
                <Link to="/formacao-preco/produtos" className="w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                  >
                    Ir para Catálogo de Produtos
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Painel 2: Diagnóstico de Matérias-Primas & Estoque */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-600" />
              Estoque & Saúde dos Insumos
            </CardTitle>
            <CardDescription className="text-xs">
              Posição de estoque de matérias-primas e alertas de reposição.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-400 text-[10px] block">Estoque Valorizado Bruto</span>
                <span className="text-sm font-bold text-slate-800 font-mono block mt-0.5">
                  {formatBrl(metrics.valorEstoqueBruto)}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-emerald-700 text-[10px] font-semibold block">
                  Estoque Valorizado Líquido
                </span>
                <span className="text-sm font-bold text-emerald-900 font-mono block mt-0.5">
                  {formatBrl(metrics.valorEstoqueLiquido)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-700 font-medium">Insumos em Nível Adequado:</span>
                </div>
                <span className="font-bold text-slate-900">
                  {Math.max(
                    0,
                    metrics.totalMaterias -
                      metrics.totalItensEstoqueZerado -
                      metrics.totalItensAbaixoMinimo,
                  )}
                </span>
              </div>

              {metrics.totalItensAbaixoMinimo > 0 && (
                <div className="flex items-center justify-between p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-medium">Abaixo do Estoque Mínimo:</span>
                  </div>
                  <span className="font-bold">{metrics.totalItensAbaixoMinimo} itens</span>
                </div>
              )}

              {metrics.totalItensEstoqueZerado > 0 && (
                <div className="flex items-center justify-between p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span className="font-medium">Estoque Zerado / Sem Saldo:</span>
                  </div>
                  <span className="font-bold">{metrics.totalItensEstoqueZerado} itens</span>
                </div>
              )}
            </div>

            <div className="pt-1">
              <Link to="/formacao-preco/materia-prima" className="w-full block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200"
                >
                  Gerenciar Matérias-Primas & Curva ABC
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Painel 3: Configuração Tributária & Formação de Preço */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Regime Tributário & Parâmetros
            </CardTitle>
            <CardDescription className="text-xs">
              Tributação configurada para aplicação nas margens e créditos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            {configTributaria ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                  <span className="text-slate-600 font-medium">Regime Tributário:</span>
                  <Badge className="bg-blue-600 text-white font-bold">
                    {configTributaria.regime_tributario}
                  </Badge>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Carga Tributária Total:</span>
                    <span className="font-bold text-slate-900">
                      {formatPct(configTributaria.carga_tributaria_total)}
                    </span>
                  </div>
                  {configTributaria.regime_tributario === 'Simples Nacional' ? (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Alíquota Efetiva DAS:</span>
                      <span className="font-semibold text-slate-700">
                        {formatPct(configTributaria.aliquota_simples_efetiva)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">PIS / COFINS:</span>
                        <span className="font-semibold text-slate-700">
                          {formatPct(configTributaria.aliquota_pis)} /{' '}
                          {formatPct(configTributaria.aliquota_cofins)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">ICMS:</span>
                        <span className="font-semibold text-slate-700">
                          {formatPct(configTributaria.aliquota_icms)}
                        </span>
                      </div>
                    </>
                  )}
                  {configTributaria.fator_por_dentro && (
                    <div className="flex justify-between border-t border-slate-200 pt-1.5">
                      <span className="text-slate-500">Fator Gross-up (Por Dentro):</span>
                      <span className="font-mono font-bold text-blue-700">
                        {Number(configTributaria.fator_por_dentro).toFixed(4)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Info className="w-4 h-4 text-amber-600" />
                  Nenhum regime específico configurado
                </div>
                <p className="text-[11px] text-amber-800">
                  Configure o regime tributário da empresa para cálculo automatizado de gross-up e
                  créditos tributários na formação de preço.
                </p>
              </div>
            )}

            <div className="pt-2">
              <Link to="/formacao-preco/impostos" className="w-full block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                >
                  Ajustar Parâmetros Fiscais & Tributos
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
