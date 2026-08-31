import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BENCHMARKS_SETORIAIS, type BenchmarkSetorValores } from '@/lib/benchmarks'
import { benchmarksService } from '@/services/benchmarksService'
import { useToast } from '@/hooks/use-toast'
import {
  Scale,
  RotateCcw,
  Save,
  CheckCircle2,
  Activity,
  TrendingDown,
  TrendingUp,
  Building2,
  Sparkles,
  Clock,
  HelpCircle,
  AlertCircle,
} from 'lucide-react'

interface ModalEditarBenchmarksProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  setorInicial?: string
  benchmarksMap: Record<string, BenchmarkSetorValores>
  onSaved?: (setor: string, novosValores: BenchmarkSetorValores) => void
}

export function ModalEditarBenchmarks({
  open,
  onOpenChange,
  setorInicial = 'Serviços',
  benchmarksMap,
  onSaved,
}: ModalEditarBenchmarksProps) {
  const { toast } = useToast()
  const [selectedSetor, setSelectedSetor] = useState<string>(setorInicial)
  const [formData, setFormData] = useState<BenchmarkSetorValores>(
    () => benchmarksMap[setorInicial] || BENCHMARKS_SETORIAIS['Serviços'],
  )
  const [saving, setSaving] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>('liquidez')

  // Atualizar o formulário quando o setor selecionado mudar
  useEffect(() => {
    if (open) {
      const targetSetor = selectedSetor || setorInicial || 'Serviços'
      const base =
        benchmarksMap[targetSetor] ||
        BENCHMARKS_SETORIAIS[targetSetor] ||
        BENCHMARKS_SETORIAIS['Outros']
      setFormData({ ...base })
    }
  }, [selectedSetor, open, benchmarksMap])

  // Quando abre com um setorInicial específico
  useEffect(() => {
    if (open && setorInicial) {
      setSelectedSetor(setorInicial)
    }
  }, [open, setorInicial])

  const handleChange = (field: keyof BenchmarkSetorValores, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: typeof value === 'string' ? (value === '' ? 0 : Number(value)) : value,
    }))
  }

  const handleTextChange = (field: keyof BenchmarkSetorValores, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Verificar se o setor atual diverge do padrão original de fábrica
  const isCustomizado = () => {
    const padrao = BENCHMARKS_SETORIAIS[selectedSetor]
    if (!padrao) return false
    return JSON.stringify(formData) !== JSON.stringify(padrao)
  }

  // Restaurar padrão de fábrica do setor selecionado
  const handleRestaurarPadrao = async () => {
    const padrao = BENCHMARKS_SETORIAIS[selectedSetor] || BENCHMARKS_SETORIAIS['Outros']
    if (!padrao) return

    setFormData({ ...padrao })
    try {
      setSaving(true)
      await benchmarksService.restorePadrao(selectedSetor)
      if (onSaved) onSaved(selectedSetor, padrao)
      toast({
        title: 'Valores Padrão Restaurados',
        description: `O setor ${selectedSetor} foi restaurado para os parâmetros de referência originais.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao restaurar',
        description: 'Não foi possível salvar a restauração do setor no banco.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Salvar alterações do setor
  const handleSalvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setSaving(true)
      // Calcular spread automático se usuário preencheu ROIC e WACC
      const roicVal = formData.roic ?? 0
      const waccVal = formData.wacc ?? 12
      const spreadCalc = Number((roicVal - waccVal).toFixed(2))

      const dadosParaSalvar: BenchmarkSetorValores = {
        ...formData,
        setor: selectedSetor,
        spread: spreadCalc,
      }

      await benchmarksService.saveSetor(selectedSetor, dadosParaSalvar)
      if (onSaved) onSaved(selectedSetor, dadosParaSalvar)

      toast({
        title: 'Benchmark Atualizado!',
        description: `Os parâmetros de referência para o setor ${selectedSetor} foram salvos com sucesso.`,
      })
      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao salvar benchmark:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao gravar as alterações do benchmark.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-slate-200">
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-[#0B1F3A] flex items-center gap-2">
                  Ajustar Benchmarks Setoriais de Mercado
                  <Badge className="bg-blue-100 text-blue-800 border-none text-[10px]">
                    Por Usuário
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Edite manualmente as metas e referências de cada setor para calibrar os gráficos,
                  radar e diagnósticos.
                </DialogDescription>
              </div>
            </div>

            {/* Seletor de Setor no Header do Modal */}
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Setor Alvo:
              </Label>
              <Select value={selectedSetor} onValueChange={(val) => setSelectedSetor(val)}>
                <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-300 w-[160px] text-blue-950">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(BENCHMARKS_SETORIAIS).map((s) => (
                    <SelectItem key={s} value={s} className="text-xs font-medium">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Informações do Setor Ativo */}
          <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-950">
                  Parâmetros de Referência para:{' '}
                  <span className="text-blue-700 underline">{selectedSetor}</span>
                </span>
                {isCustomizado() ? (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                    Personalizado
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                    Padrão de Mercado
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-1 max-w-xl">
                {formData.descricao || 'Defina as métricas ideais e medianas para o segmento.'}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestaurarPadrao}
              disabled={saving}
              className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 shrink-0 gap-1.5 shadow-2xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Restaurar Padrão
            </Button>
          </div>

          {/* Abas por Grupo de Indicadores */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 h-auto p-1 bg-slate-100/80 rounded-xl gap-1">
              <TabsTrigger
                value="liquidez"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-blue-700 shadow-2xs"
              >
                1. Liquidez
              </TabsTrigger>
              <TabsTrigger
                value="endividamento"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-amber-700 shadow-2xs"
              >
                2. Endividamento
              </TabsTrigger>
              <TabsTrigger
                value="rentabilidade"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700 shadow-2xs"
              >
                3. Rentabilidade
              </TabsTrigger>
              <TabsTrigger
                value="estrutura"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 shadow-2xs"
              >
                4. Estrutura
              </TabsTrigger>
              <TabsTrigger
                value="ebitda"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-purple-700 shadow-2xs"
              >
                5. EBITDA
              </TabsTrigger>
              <TabsTrigger
                value="eficiencia"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-cyan-700 shadow-2xs"
              >
                6. Eficiência
              </TabsTrigger>
              <TabsTrigger
                value="economicos"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700 shadow-2xs"
              >
                7. Econômicos
              </TabsTrigger>
            </TabsList>

            {/* 1. ABA LIQUIDEZ */}
            <TabsContent value="liquidez" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Liquidez Corrente (LC)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">AC / PC</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezCorrente ?? ''}
                    onChange={(e) => handleChange('liquidezCorrente', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Capacidade de honrar obrigações de curto prazo (ex: 1,50x).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Liquidez Seca (LS)</Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      (AC − Estoques) / PC
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezSeca ?? ''}
                    onChange={(e) => handleChange('liquidezSeca', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Liquidez sem depender da venda imediata de estoques (ex: 1,00x).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Liquidez Imediata (LI)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Caixa / PC</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezImediata ?? ''}
                    onChange={(e) => handleChange('liquidezImediata', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Disponibilidades imediatas frente às dívidas imediatas (ex: 0,25x).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Liquidez Geral (LG)</Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      (AC + RLP) / (PC + PNC)
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezGeral ?? ''}
                    onChange={(e) => handleChange('liquidezGeral', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Solvência total de curto e longo prazo (ex: 1,25x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 2. ABA ENDIVIDAMENTO */}
            <TabsContent value="endividamento" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Endividamento Geral (EG %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.endividamentoGeral ?? ''}
                    onChange={(e) => handleChange('endividamentoGeral', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Porcentagem do ativo total financiada por terceiros (ex: 50%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Composição do Endividamento (CE %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">PC / Passivo Total</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.composicaoEndividamento ?? ''}
                    onChange={(e) => handleChange('composicaoEndividamento', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Concentração da dívida no curto prazo (ex: 55%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Part. Cap. de Terceiros (PCT %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.participacaoCapitalTerceiros ?? ''}
                    onChange={(e) => handleChange('participacaoCapitalTerceiros', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Relação entre capital de terceiros e patrimônio líquido (ex: 100%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Imobilização do PL (IPL %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Imobilizado / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.imobilizacaoPL ?? ''}
                    onChange={(e) => handleChange('imobilizacaoPL', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Comprometimento do PL em ativos imobilizados fixos (ex: 50%).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 3. ABA RENTABILIDADE */}
            <TabsContent value="rentabilidade" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Margem Bruta (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">LB / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.margemBruta ?? ''}
                    onChange={(e) => handleChange('margemBruta', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">Lucro bruto sobre vendas (ex: 35%).</p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Margem Operacional (%)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">EBIT / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.margemOperacional ?? ''}
                    onChange={(e) => handleChange('margemOperacional', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">Eficiência das operações (ex: 12%).</p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Margem Líquida (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">LL / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.margemLiquida ?? ''}
                    onChange={(e) => handleChange('margemLiquida', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Lucro líquido final sobre vendas (ex: 10%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">ROE (Retorno PL %)</Label>
                    <span className="text-[10px] font-mono text-slate-400">LL / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.roe ?? ''}
                    onChange={(e) => handleChange('roe', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Rentabilidade dos sócios/acionistas (ex: 15%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      ROA (Retorno Ativo %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">LL / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.roa ?? ''}
                    onChange={(e) => handleChange('roa', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Rentabilidade dos ativos totais (ex: 8%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Giro do Ativo (x)</Label>
                    <span className="text-[10px] font-mono text-slate-400">RL / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.giroAtivo ?? ''}
                    onChange={(e) => handleChange('giroAtivo', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Eficiência de giro da receita sobre o ativo (ex: 1,00x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 4. ABA ESTRUTURA DE CAPITAL */}
            <TabsContent value="estrutura" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Autonomia Financeira (%)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">PL / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.autonomiaFinanceira ?? ''}
                    onChange={(e) => handleChange('autonomiaFinanceira', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Grau de independência com recursos próprios (ex: 50%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Dependência Financeira (%)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.dependenciaFinanceira ?? ''}
                    onChange={(e) => handleChange('dependenciaFinanceira', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Proporção do capital de terceiros no ativo (ex: 50%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Dívida / Equity (D/E x)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.dividaEquity ?? ''}
                    onChange={(e) => handleChange('dividaEquity', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Multiplicador da dívida sobre o patrimônio (ex: 1,00x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 5. ABA EBITDA */}
            <TabsContent value="ebitda" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Margem EBITDA (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">EBITDA / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.margemEbitda ?? ''}
                    onChange={(e) => handleChange('margemEbitda', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Geração operacional bruta de caixa em % da receita líquida (ex: 17%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Cobertura de Juros (x)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      EBITDA / Desp. Fin.
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.coberturaJuros ?? ''}
                    onChange={(e) => handleChange('coberturaJuros', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Vezes que o EBITDA cobre as despesas financeiras (ex: 3,5x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 6. ABA EFICIÊNCIA OPERACIONAL */}
            <TabsContent value="eficiencia" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      PMR (Recebimento - dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Clientes</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.pmr ?? ''}
                    onChange={(e) => handleChange('pmr', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prazo médio de recebimento de vendas a prazo (ex: 45 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      PME (Estocagem - dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Estoques</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.pme ?? ''}
                    onChange={(e) => handleChange('pme', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prazo médio de permanência dos estoques (ex: 30 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      PMP (Pagamento - dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Fornecedores</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.pmp ?? ''}
                    onChange={(e) => handleChange('pmp', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prazo médio de pagamento a fornecedores (ex: 40 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Ciclo Operacional (dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">PME + PMR</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.cicloOperacional ?? ''}
                    onChange={(e) => handleChange('cicloOperacional', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Tempo total da compra à venda recebida (ex: 75 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Ciclo Financeiro (dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">CO − PMP</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    value={formData.cicloFinanceiro ?? ''}
                    onChange={(e) => handleChange('cicloFinanceiro', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Período em que a operação requer caixa financiado (ex: 35 dias).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 7. ABA ECONÔMICOS & VALUATION */}
            <TabsContent value="economicos" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">ROIC (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      NOPAT / Cap. Investido
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.roic ?? ''}
                    onChange={(e) => handleChange('roic', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Retorno sobre o capital total investido (ex: 14%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">WACC (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">Custo Capital</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.wacc ?? ''}
                    onChange={(e) => handleChange('wacc', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Custo médio ponderado de capital (ex: 12%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 bg-rose-50/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-rose-950">Spread Econômico (%)</Label>
                    <span className="text-[10px] font-mono text-rose-700">ROIC − WACC</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    disabled
                    value={Number(((formData.roic ?? 0) - (formData.wacc ?? 12)).toFixed(1))}
                    className="h-9 text-xs font-mono font-bold bg-white text-rose-800"
                  />
                  <p className="text-[10px] text-rose-700">
                    Calculado automaticamente (positivo indica criação de riqueza).
                  </p>
                </div>
              </div>

              {/* Campo de Descrição do Setor */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">
                  Descrição e Características do Setor {selectedSetor}
                </Label>
                <Textarea
                  rows={2}
                  value={formData.descricao ?? ''}
                  onChange={(e) => handleTextChange('descricao', e.target.value)}
                  placeholder="Descreva as particularidades e modelo de negócio deste setor..."
                  className="text-xs resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Valores persistem na sua conta e atualizam o painel em tempo real.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs h-9 border-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSalvar}
              disabled={saving}
              className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-xs"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
export default ModalEditarBenchmarks
