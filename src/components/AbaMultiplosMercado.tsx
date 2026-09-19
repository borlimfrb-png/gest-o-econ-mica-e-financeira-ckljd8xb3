import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  BarChart3,
  SlidersHorizontal,
  Coins,
  TrendingUp,
  Scale,
  Sparkles,
  Info,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/financeCalculations'
import type {
  ItemMultiploCalculado,
  MultiploKey,
  ResumoConsolidadoMultiplos,
} from '@/lib/valuationMultiplos'
import { MULTIPLOS_SETORIAIS_PADRAO } from '@/lib/valuationMultiplos'

export interface AbaMultiplosMercadoProps {
  resumoMultiplos: ResumoConsolidadoMultiplos
  segmentoSelecionado: string
  onSegmentoChange: (segmento: string) => void
  multiplosRef: Record<MultiploKey, number>
  onMultiploRefChange: (key: MultiploKey, val: number) => void
  pesos: Record<MultiploKey, number>
  onPesoChange: (key: MultiploKey, val: number) => void
  multiplosAtivos: Record<MultiploKey, boolean>
  onToggleAtivo: (key: MultiploKey, ativo: boolean) => void
  dividaLiquidaManual: number | undefined
  onDividaLiquidaChange: (val: number | undefined) => void
  onRestaurarPadroesSetor: () => void
  onSalvarConfiguracao: () => void
  salvando: boolean
  empresaNome?: string
  ano: number
}

const SETORES_DISPONIVEIS = Object.keys(MULTIPLOS_SETORIAIS_PADRAO)

export const AbaMultiplosMercado: React.FC<AbaMultiplosMercadoProps> = ({
  resumoMultiplos,
  segmentoSelecionado,
  onSegmentoChange,
  multiplosRef,
  onMultiploRefChange,
  pesos,
  onPesoChange,
  multiplosAtivos,
  onToggleAtivo,
  dividaLiquidaManual,
  onDividaLiquidaChange,
  onRestaurarPadroesSetor,
  onSalvarConfiguracao,
  salvando,
  empresaNome,
  ano,
}) => {
  const {
    itens,
    itensAtivos,
    valorPonderado,
    valorMedio,
    valorMediana,
    valorMinimo,
    valorMaximo,
    faixaAmplitude,
    somaPesosAtivos,
    dividaLiquida,
    ebitda,
    lucroLiquido,
    patrimonioLiquido,
    receitaBruta,
  } = resumoMultiplos

  // Dados para o gráfico de barras comparando cada múltiplo ativo com a linha central do valor ponderado
  const dadosGraficoBarras = itensAtivos.map((item) => ({
    sigla: item.sigla,
    nome: item.nome,
    valor: Number(item.valorImplícitoEmpresa.toFixed(2)),
    baseStr: formatCurrency(item.valorMetricaBase),
    multiploStr: `${item.multiploReferencia.toFixed(1)}x`,
    pesoStr: `${item.pesoPercentual}%`,
  }))

  const alertaPesos = somaPesosAtivos !== 100

  return (
    <div className="space-y-6">
      {/* 1. Header explicativo e controle de benchmarking setorial */}
      <Card className="bg-white border-blue-200/90 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 pb-3 bg-gradient-to-r from-blue-50/80 via-slate-50 to-slate-50 border-b border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Metodologia de Avaliação por Múltiplos de Mercado
                </CardTitle>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-[10px]">
                  Mercado Brasileiro
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Determina o Enterprise Value a partir de comparáveis setoriais aplicados aos dados
                reais de DRE e Balanço de {ano}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Seletor do Setor / Segmento de Referência */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-600">Setor:</span>
              <Select value={segmentoSelecionado} onValueChange={onSegmentoChange}>
                <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-bold text-slate-800 p-0 focus:ring-0 w-[120px]">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  {SETORES_DISPONIVEIS.map((setor) => (
                    <SelectItem key={setor} value={setor} className="text-xs">
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botão Restaurar Padrões */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRestaurarPadroesSetor}
              className="h-8 text-xs font-semibold text-slate-700 hover:text-blue-700 border-slate-300"
              title="Restaura os múltiplos e pesos padrão do setor selecionado"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Padrões Setoriais
            </Button>

            {/* Botão Salvar Múltiplos */}
            <Button
              type="button"
              size="sm"
              onClick={onSalvarConfiguracao}
              disabled={salvando}
              className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {salvando ? 'Salvando...' : 'Salvar Múltiplos'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-3 text-xs text-slate-600 leading-relaxed bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                EBITDA Base ({ano})
              </span>
              <div className="text-sm font-extrabold text-[#0B1F3A]">{formatCurrency(ebitda)}</div>
              <span className="text-[10px] text-slate-400">Geração de caixa da operação</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Lucro Líquido ({ano})
              </span>
              <div className="text-sm font-extrabold text-blue-700">
                {formatCurrency(lucroLiquido)}
              </div>
              <span className="text-[10px] text-slate-400">Resultado do exercício aos sócios</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Patrimônio Líquido ({ano})
              </span>
              <div className="text-sm font-extrabold text-emerald-700">
                {formatCurrency(patrimonioLiquido)}
              </div>
              <span className="text-[10px] text-slate-400">Valor contábil do capital próprio</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Dívida Líquida Contábil
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-slate-800">
                  {formatCurrency(dividaLiquida)}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">(Passivo − Caixa)</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Utilizada para conciliação EV ↔ Equity
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Cards de Síntese Consolidada por Múltiplos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Valor Ponderado (Consolidado Principal) */}
        <Card className="bg-gradient-to-br from-blue-900 via-[#0B1F3A] to-slate-900 text-white border-blue-800 shadow-md flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 border-b border-white/10 flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <span className="text-[10px] font-extrabold text-blue-300 uppercase tracking-wider bg-blue-500/20 px-2 py-0.5 rounded border border-blue-400/30">
                Consolidação Ponderada
              </span>
              <CardTitle className="text-base font-bold text-white mt-1.5">
                Valuation por Múltiplos
              </CardTitle>
            </div>
            <Badge className="bg-emerald-500 text-white font-bold text-xs">Valor Central</Badge>
          </CardHeader>

          <CardContent className="p-4 space-y-2">
            <span className="text-[10px] font-semibold text-blue-200 uppercase block">
              Média Ponderada dos Múltiplos Ativos
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-300">
              {formatCurrency(valorPonderado)}
            </div>
            <span className="text-[10px] text-slate-300 block">
              Soma dos pesos ativos: {somaPesosAtivos}% ({itensAtivos.length} múltiplos ativos)
            </span>
          </CardContent>
        </Card>

        {/* Card 2: Faixa de Negociação (Mínimo e Máximo) */}
        <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Dispersão de Mercado
              </span>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                Faixa de Negociação
              </CardTitle>
            </div>
            <Scale className="w-4 h-4 text-indigo-600" />
          </CardHeader>

          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Piso (Mínimo):</span>
              <strong className="text-slate-900">{formatCurrency(valorMinimo)}</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Teto (Máximo):</span>
              <strong className="text-slate-900">{formatCurrency(valorMaximo)}</strong>
            </div>
            <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Amplitude:</span>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-[10px]">
                {formatCurrency(faixaAmplitude)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Média Simples vs Mediana */}
        <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Estatística de Mercado
              </span>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                Média e Mediana
              </CardTitle>
            </div>
            <Coins className="w-4 h-4 text-emerald-600" />
          </CardHeader>

          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Média Aritmética:</span>
              <strong className="text-blue-700">{formatCurrency(valorMedio)}</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Mediana dos Múltiplos:</span>
              <strong className="text-emerald-700">{formatCurrency(valorMediana)}</strong>
            </div>
            <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 leading-tight">
              A mediana reduz o impacto de múltiplos extremos causados por margens muito baixas.
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Status e Calibragem dos Pesos */}
        <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                Calibragem
              </span>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                Pesos Atribuídos
              </CardTitle>
            </div>
            <SlidersHorizontal className="w-4 h-4 text-amber-600" />
          </CardHeader>

          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">Soma dos Pesos:</span>
              <Badge
                className={
                  somaPesosAtivos === 100
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                    : 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                }
              >
                {somaPesosAtivos}% {somaPesosAtivos === 100 ? '✓ Calibrado' : '⚠ Ajustar'}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {somaPesosAtivos === 100
                ? 'Os pesos somam exatamente 100%, conferindo rigor técnico à ponderação.'
                : 'A soma dos pesos dos múltiplos ativos difere de 100%. O cálculo normaliza a proporção automaticamente.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de pesos não calibrados */}
      {alertaPesos && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Aviso de ponderação:</strong> A soma atual dos pesos dos múltiplos ativos é de{' '}
            <strong>{somaPesosAtivos}%</strong>. Recomendamos ajustar os percentuais de cada
            múltiplo para totalizar 100%, ou utilizar o botão "Padrões Setoriais" para restabelecer
            os pesos recomendados para o setor de {segmentoSelecionado}.
          </div>
        </div>
      )}

      {/* 3. Tabela de Múltiplos Detalhada com Inputs Editáveis */}
      <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              Tabela de Múltiplos, Métricas-Base e Valores Implícitos
            </CardTitle>
            <CardDescription className="text-xs">
              Edite os múltiplos de referência e a ponderação conforme transações comparáveis
            </CardDescription>
          </div>

          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs">
            {itensAtivos.length} de {itens.length} múltiplos ativos no cálculo
          </Badge>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-12 text-center font-bold text-slate-700">Ativo</TableHead>
                <TableHead className="font-bold text-slate-700">Múltiplo</TableHead>
                <TableHead className="font-bold text-slate-700">Conceito / Métrica-Base</TableHead>
                <TableHead className="text-right font-bold text-slate-700">
                  Valor da Métrica ({ano})
                </TableHead>
                <TableHead className="w-32 text-center font-bold text-slate-700">
                  Múltiplo Ref. (x)
                </TableHead>
                <TableHead className="w-24 text-center font-bold text-slate-700">
                  Peso (%)
                </TableHead>
                <TableHead className="text-right font-bold text-slate-700">
                  Valor Implícito (R$)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => {
                const isZeroOuNeg = item.valorMetricaBase <= 0
                return (
                  <TableRow
                    key={item.key}
                    className={
                      !item.ativo
                        ? 'opacity-50 bg-slate-50/40'
                        : isZeroOuNeg
                          ? 'bg-amber-50/30'
                          : 'hover:bg-blue-50/20'
                    }
                  >
                    {/* Switch de Ativação */}
                    <TableCell className="text-center">
                      <Switch
                        checked={item.ativo}
                        onCheckedChange={(checked) => onToggleAtivo(item.key, checked)}
                      />
                    </TableCell>

                    {/* Nome do Múltiplo */}
                    <TableCell>
                      <div className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
                        <span>{item.sigla}</span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-slate-300 text-slate-600"
                        >
                          {item.tipoMetrica.startsWith('Enterprise') ? 'EV' : 'Equity'}
                        </Badge>
                      </div>
                      <div
                        className="text-[10px] text-slate-500 truncate max-w-[180px]"
                        title={item.descricao}
                      >
                        {item.nome}
                      </div>
                    </TableCell>

                    {/* Métrica Base */}
                    <TableCell>
                      <span className="font-semibold text-slate-700 block">
                        {item.nomeMetricaBase}
                      </span>
                      <span
                        className="text-[10px] text-slate-400 block truncate max-w-[220px]"
                        title={item.explicacao}
                      >
                        {item.explicacao}
                      </span>
                    </TableCell>

                    {/* Valor da Métrica da Empresa */}
                    <TableCell className="text-right font-mono font-bold text-slate-800">
                      {formatCurrency(item.valorMetricaBase)}
                      {isZeroOuNeg && (
                        <span className="block text-[9px] text-amber-700 font-sans font-semibold">
                          ⚠ Métrica nula/negativa
                        </span>
                      )}
                    </TableCell>

                    {/* Input do Múltiplo de Referência */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 focus-within:ring-1 focus-within:ring-blue-500">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="100"
                          value={multiplosRef[item.key] ?? item.multiploReferencia}
                          onChange={(e) =>
                            onMultiploRefChange(item.key, Math.max(0, Number(e.target.value) || 0))
                          }
                          disabled={!item.ativo}
                          className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right w-16"
                        />
                        <span className="text-[11px] font-semibold text-slate-500 ml-1">x</span>
                      </div>
                    </TableCell>

                    {/* Input do Peso (%) */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 focus-within:ring-1 focus-within:ring-blue-500">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={pesos[item.key] ?? item.pesoPercentual}
                          onChange={(e) =>
                            onPesoChange(
                              item.key,
                              Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            )
                          }
                          disabled={!item.ativo}
                          className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right w-12"
                        />
                        <span className="text-[11px] font-semibold text-slate-500 ml-1">%</span>
                      </div>
                    </TableCell>

                    {/* Valor Implícito Resultante */}
                    <TableCell className="text-right font-mono font-extrabold text-[#0B1F3A]">
                      {item.ativo && item.valorImplícitoEmpresa > 0 ? (
                        <span className="text-blue-700">
                          {formatCurrency(item.valorImplícitoEmpresa)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Rodapé da tabela com totais */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Para múltiplos de Preço (Equity), o Enterprise Value resultante adiciona a dívida
              líquida ({formatCurrency(dividaLiquida)}) para manter a homogeneidade comparativa.
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="text-slate-600">
              Total Pesos Ativos:{' '}
              <strong className={somaPesosAtivos === 100 ? 'text-emerald-700' : 'text-amber-700'}>
                {somaPesosAtivos}%
              </strong>
            </span>
            <span className="text-slate-800">
              Valuation Ponderado:{' '}
              <strong className="text-blue-700 text-sm font-extrabold font-mono">
                {formatCurrency(valorPonderado)}
              </strong>
            </span>
          </div>
        </div>
      </Card>

      {/* 4. Gráfico: Valor Implícito por Cada Múltiplo vs Linha Central */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Dispersão do Valor Implícito por Múltiplo vs Linha Central Ponderada
            </CardTitle>
            <CardDescription className="text-xs">
              Confronto visual do valor da empresa decorrente de cada métrica com a média ponderada
              central
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
              Valor Implícito
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-3 h-0.5 bg-emerald-600" />
              Linha Central ({formatCurrency(valorPonderado)})
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {dadosGraficoBarras.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nenhum múltiplo ativo ou com métrica base positiva para exibir no gráfico.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosGraficoBarras}
                  margin={{ top: 15, right: 25, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="sigla"
                    tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) =>
                      Math.abs(v) >= 1000000
                        ? `R$ ${(v / 1000000).toFixed(1)}M`
                        : Math.abs(v) >= 1000
                          ? `R$ ${(v / 1000).toFixed(0)}k`
                          : `R$ ${v}`
                    }
                  />
                  <RechartsTooltip
                    formatter={(val: any, _name: any, item: any) => [
                      formatCurrency(Number(val)),
                      `${item.payload.nome} (${item.payload.multiploStr}) · Peso: ${item.payload.pesoStr}`,
                    ]}
                    labelFormatter={(label) => `Múltiplo: ${label}`}
                  />
                  {valorPonderado > 0 && (
                    <ReferenceLine
                      y={valorPonderado}
                      stroke="#059669"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: `Central: ${formatCurrency(valorPonderado)}`,
                        position: 'top',
                        fill: '#059669',
                        fontSize: 11,
                        fontWeight: 'bold',
                      }}
                    />
                  )}
                  <Bar dataKey="valor" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={40}>
                    {dadosGraficoBarras.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2563EB' : '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Parecer consultivo explicativo dos múltiplos */}
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
              <span className="font-bold text-blue-900 block flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                Vantagens da Metodologia de Múltiplos
              </span>
              <p className="text-slate-700 leading-relaxed text-justify">
                A avaliação por múltiplos expressa como o mercado precifica empresas comparáveis com
                base no seu desempenho recente. Ela elimina incertezas de projeções longas e ancora
                a negociação em parâmetros reconhecidos por bancos de investimento e fundos de
                private equity.
              </p>
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1.5">
              <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Boas Práticas de Aplicação em Consultoria
              </span>
              <p className="text-slate-700 leading-relaxed text-justify">
                Empresas com margens atípicas ou com dívida elevada devem priorizar múltiplos de{' '}
                <strong>EV/EBITDA</strong> e <strong>EV/EBIT</strong>, que refletem a real
                capacidade operacional livre do endividamento da estrutura de capital.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default AbaMultiplosMercado
