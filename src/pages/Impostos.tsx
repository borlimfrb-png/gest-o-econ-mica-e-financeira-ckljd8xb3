import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import {
  configuracoesTributariasService,
  produtosService,
  fichasTecnicasService,
} from '@/services/formacaoPrecoService'
import {
  ConfiguracaoTributariaRecord,
  ConfiguracaoTributariaInput,
  RegimeTributarioFormacaoPreco,
  ProdutoRecord,
  FichaTecnicaRecord,
} from '@/types/finance'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Percent,
  Calculator,
  Building2,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function Impostos() {
  const { toast } = useToast()
  const { empresas, selectedEmpresaId, setSelectedEmpresaId } = useFilter()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existingConfig, setExistingConfig] = useState<ConfiguracaoTributariaRecord | null>(null)

  // Form states
  const [regime, setRegime] = useState<RegimeTributarioFormacaoPreco>('Simples Nacional')
  const [aliquotaSimples, setAliquotaSimples] = useState<number>(6.0)
  const [anexoSimples, setAnexoSimples] = useState<string>('Anexo I - Comércio')
  const [faixaSimples, setFaixaSimples] = useState<string>('1ª Faixa (até R$ 180.000,00)')

  // Lucro Real / Presumido
  const [aliquotaPis, setAliquotaPis] = useState<number>(0.65)
  const [aliquotaCofins, setAliquotaCofins] = useState<number>(3.0)
  const [aliquotaIcms, setAliquotaIcms] = useState<number>(18.0)
  const [aliquotaIpi, setAliquotaIpi] = useState<number>(0.0)
  const [aliquotaIss, setAliquotaIss] = useState<number>(0.0)
  const [aliquotaIrpj, setAliquotaIrpj] = useState<number>(1.2)
  const [aliquotaCsll, setAliquotaCsll] = useState<number>(1.08)
  const [outrosImpostos, setOutrosImpostos] = useState<number>(0.0)
  const [observacoes, setObservacoes] = useState<string>('')

  // Simulador de Preço
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>('custom')
  const [custoBaseSimulacao, setCustoBaseSimulacao] = useState<number>(50.0)
  const [margemDesejadaSimulacao, setMargemDesejadaSimulacao] = useState<number>(30.0)
  const [despesasVariaveisSimulacao, setDespesasVariaveisSimulacao] = useState<number>(0.0) // ex: comissão / frete

  // Empresa atual selecionada
  const empresaAtual = useMemo(() => {
    return empresas.find((e) => e.id === selectedEmpresaId) || null
  }, [empresas, selectedEmpresaId])

  // Carrega configurações tributárias da empresa selecionada
  const carregarConfiguracao = useCallback(
    async (empresaId: string) => {
      if (!empresaId) return
      setLoading(true)
      try {
        const config = await configuracoesTributariasService.getByEmpresa(empresaId)
        if (config) {
          setExistingConfig(config)
          setRegime(config.regime_tributario || 'Simples Nacional')
          setAliquotaSimples(config.aliquota_simples_efetiva ?? 6.0)
          setAnexoSimples(config.anexo_simples || 'Anexo I - Comércio')
          setFaixaSimples(config.faixa_simples || '1ª Faixa (até R$ 180.000,00)')
          setAliquotaPis(config.aliquota_pis ?? 0.65)
          setAliquotaCofins(config.aliquota_cofins ?? 3.0)
          setAliquotaIcms(config.aliquota_icms ?? 18.0)
          setAliquotaIpi(config.aliquota_ipi ?? 0.0)
          setAliquotaIss(config.aliquota_iss ?? 0.0)
          setAliquotaIrpj(config.aliquota_irpj ?? 1.2)
          setAliquotaCsll(config.aliquota_csll ?? 1.08)
          setOutrosImpostos(config.outros_impostos ?? 0.0)
          setObservacoes(config.observacoes || '')
        } else {
          setExistingConfig(null)
          // Valores default coerentes de acordo com a empresa se não houver registro
          setRegime('Simples Nacional')
          setAliquotaSimples(6.0)
          setAnexoSimples('Anexo I - Comércio')
          setFaixaSimples('1ª Faixa (até R$ 180.000,00)')
          setAliquotaPis(0.65)
          setAliquotaCofins(3.0)
          setAliquotaIcms(18.0)
          setAliquotaIpi(0.0)
          setAliquotaIss(0.0)
          setAliquotaIrpj(1.2)
          setAliquotaCsll(1.08)
          setOutrosImpostos(0.0)
          setObservacoes('')
        }
      } catch (err) {
        console.error('Erro ao carregar configuração tributária:', err)
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar as configurações de impostos da empresa.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  // Carregar produtos e fichas para o simulador
  const carregarProdutosEFichas = useCallback(async () => {
    try {
      const [listaProd, listaFichas] = await Promise.all([
        produtosService.getAll(),
        fichasTecnicasService.getAll(),
      ])
      setProdutos(listaProd)
      setFichas(listaFichas)
    } catch (err) {
      console.error('Erro ao carregar produtos/fichas:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedEmpresaId) {
      carregarConfiguracao(selectedEmpresaId)
      carregarProdutosEFichas()
    }
  }, [selectedEmpresaId, carregarConfiguracao, carregarProdutosEFichas])

  // Ao mudar o regime para preset comum
  const aplicarPresetRegime = (novoRegime: RegimeTributarioFormacaoPreco) => {
    setRegime(novoRegime)
    if (novoRegime === 'Simples Nacional') {
      setAliquotaSimples(6.0)
      setAnexoSimples('Anexo I - Comércio')
      setFaixaSimples('1ª Faixa (até R$ 180.000,00)')
    } else if (novoRegime === 'Lucro Presumido') {
      setAliquotaPis(0.65)
      setAliquotaCofins(3.0)
      setAliquotaIcms(18.0)
      setAliquotaIpi(0.0)
      setAliquotaIss(0.0)
      setAliquotaIrpj(1.2) // Ex: Comércio com presunção 8% * 15% = 1.2%
      setAliquotaCsll(1.08) // Ex: Comércio 12% * 9% = 1.08%
      setOutrosImpostos(0.0)
    } else if (novoRegime === 'Lucro Real') {
      setAliquotaPis(1.65)
      setAliquotaCofins(7.6)
      setAliquotaIcms(18.0)
      setAliquotaIpi(0.0)
      setAliquotaIss(0.0)
      setAliquotaIrpj(0.0) // No Lucro Real direto, IRPJ/CSLL incide sobre o LALUR, mas pode-se embutir provisão
      setAliquotaCsll(0.0)
      setOutrosImpostos(0.0)
    }
  }

  // Carga tributária total calculada
  const cargaTributariaTotal = useMemo(() => {
    if (regime === 'Simples Nacional') {
      return Number((aliquotaSimples || 0).toFixed(4))
    }
    const soma =
      (aliquotaPis || 0) +
      (aliquotaCofins || 0) +
      (aliquotaIcms || 0) +
      (aliquotaIpi || 0) +
      (aliquotaIss || 0) +
      (aliquotaIrpj || 0) +
      (aliquotaCsll || 0) +
      (outrosImpostos || 0)
    return Number(soma.toFixed(4))
  }, [
    regime,
    aliquotaSimples,
    aliquotaPis,
    aliquotaCofins,
    aliquotaIcms,
    aliquotaIpi,
    aliquotaIss,
    aliquotaIrpj,
    aliquotaCsll,
    outrosImpostos,
  ])

  // Fator "por dentro" = 1 / (1 - carga/100)
  // Exemplo: se carga = 18%, fator = 1 / (1 - 0.18) = 1.2195 (acréscimo de ~21.95%)
  const fatorPorDentro = useMemo(() => {
    const cargaDec = cargaTributariaTotal / 100
    if (cargaDec >= 1) return 1
    return Number((1 / (1 - cargaDec)).toFixed(4))
  }, [cargaTributariaTotal])

  const percentualEmbutido = useMemo(() => {
    if (fatorPorDentro <= 1) return 0
    return Number(((fatorPorDentro - 1) * 100).toFixed(2))
  }, [fatorPorDentro])

  // Atualização do produto selecionado no simulador
  const handleSelectProduto = (prodId: string) => {
    setSelectedProdutoId(prodId)
    if (prodId === 'custom') {
      return
    }
    const prod = produtos.find((p) => p.id === prodId)
    if (!prod) return

    // Tentar achar ficha técnica para puxar custo
    const ficha = fichas.find((f) => f.produto === prodId)
    if (ficha && ficha.custo_total > 0) {
      setCustoBaseSimulacao(ficha.custo_total)
      setMargemDesejadaSimulacao(ficha.margem_lucro_desejada || prod.margem_lucro_padrao || 30)
    } else if (prod.custo_unitario > 0) {
      setCustoBaseSimulacao(prod.custo_unitario)
      setMargemDesejadaSimulacao(prod.margem_lucro_padrao || 30)
    }
  }

  // Cálculos do simulador de formação de preço
  // Preço sem impostos = Custo / (1 - (Margem% + DespVar%)/100) [Margem sobre venda]
  // Preço com impostos = Custo / (1 - (Margem% + DespVar% + CargaTrib%)/100)
  // Markup Multiplicador = Preço Final / Custo
  const simulacao = useMemo(() => {
    const custo = Number(custoBaseSimulacao) || 0
    const margem = Number(margemDesejadaSimulacao) || 0
    const despVar = Number(despesasVariaveisSimulacao) || 0
    const cargaTrib = Number(cargaTributariaTotal) || 0

    // Divisor para preço sem impostos (considerando margem sobre a venda líquida)
    const divisorSemImposto = 1 - (margem + despVar) / 100
    const precoSemImposto =
      divisorSemImposto > 0.01 && custo > 0 ? custo / divisorSemImposto : custo * (1 + margem / 100)

    // Divisor completo "por dentro" com impostos
    const somaDeducoes = (margem + despVar + cargaTrib) / 100
    let precoFinal = 0
    let precoPorFora = 0
    let markupDivisor = 1
    let markupMultiplicador = 1

    if (somaDeducoes < 0.99 && somaDeducoes > 0) {
      precoFinal = custo / (1 - somaDeducoes)
      markupDivisor = 1 - somaDeducoes
      markupMultiplicador = custo > 0 ? precoFinal / custo : 1
    } else {
      // Caso exceda 100%, fallback cálculo por fora
      precoFinal = precoSemImposto * (1 + cargaTrib / 100)
    }

    precoPorFora = precoSemImposto * (1 + cargaTrib / 100)

    const valorImpostos = (precoFinal * cargaTrib) / 100
    const valorMargemLucro = (precoFinal * margem) / 100
    const valorDespesasVar = (precoFinal * despVar) / 100

    return {
      custo,
      margem,
      despVar,
      cargaTrib,
      precoSemImposto,
      precoFinal,
      precoPorFora,
      valorImpostos,
      valorMargemLucro,
      valorDespesasVar,
      markupDivisor,
      markupMultiplicador,
    }
  }, [
    custoBaseSimulacao,
    margemDesejadaSimulacao,
    despesasVariaveisSimulacao,
    cargaTributariaTotal,
  ])

  // Salvar configuração
  const handleSalvar = async () => {
    if (!selectedEmpresaId) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para salvar a configuração de impostos.',
        variant: 'destructive',
      })
      return
    }

    if (cargaTributariaTotal >= 100) {
      toast({
        title: 'Carga tributária inválida',
        description: 'A soma dos impostos não pode ser igual ou superior a 100%.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: ConfiguracaoTributariaInput = {
        empresa: selectedEmpresaId,
        regime_tributario: regime,
        aliquota_simples_efetiva: regime === 'Simples Nacional' ? aliquotaSimples : undefined,
        anexo_simples: regime === 'Simples Nacional' ? anexoSimples : undefined,
        faixa_simples: regime === 'Simples Nacional' ? faixaSimples : undefined,
        aliquota_pis: regime !== 'Simples Nacional' ? aliquotaPis : 0,
        aliquota_cofins: regime !== 'Simples Nacional' ? aliquotaCofins : 0,
        aliquota_icms: regime !== 'Simples Nacional' ? aliquotaIcms : 0,
        aliquota_ipi: regime !== 'Simples Nacional' ? aliquotaIpi : 0,
        aliquota_iss: regime !== 'Simples Nacional' ? aliquotaIss : 0,
        aliquota_irpj: regime !== 'Simples Nacional' ? aliquotaIrpj : 0,
        aliquota_csll: regime !== 'Simples Nacional' ? aliquotaCsll : 0,
        outros_impostos: regime !== 'Simples Nacional' ? outrosImpostos : 0,
        carga_tributaria_total: cargaTributariaTotal,
        fator_por_dentro: fatorPorDentro,
        observacoes: observacoes.trim(),
      }

      const saved = await configuracoesTributariasService.saveOrUpdate(payload)
      setExistingConfig(saved)

      toast({
        title: 'Configurações de Impostos Salvas!',
        description: `Configuração para ${empresaAtual?.razao_social || 'a empresa'} atualizada com sucesso (${regime} - ${cargaTributariaTotal}%).`,
      })
    } catch (err) {
      console.error('Erro ao salvar configuração tributária:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações tributárias. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Seletor de Empresa e Indicadores Chave */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Impostos & Tributação no Preço de Venda
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Formação de Preço
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">
                Configure o regime tributário da empresa e as alíquotas incidentes para o cálculo
                preciso do preço sugerido nas fichas técnicas.
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Empresa */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-700">Empresa Selecionada</span>
            <span className="text-[11px] text-slate-500">Configuração individual por CNPJ</span>
          </div>
          <Select
            value={selectedEmpresaId}
            onValueChange={(val) => {
              setSelectedEmpresaId(val)
            }}
          >
            <SelectTrigger className="w-[240px] bg-slate-50 border-slate-300 font-medium text-slate-800">
              <Building2 className="w-4 h-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.razao_social || emp.nome_fantasia || 'Sem Nome'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Regime Vigente</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">{regime}</h3>
              <span className="text-[11px] text-slate-500">
                {regime === 'Simples Nacional'
                  ? anexoSimples.split(' - ')[0]
                  : 'Tributação por dentro'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Carga Tributária Total</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">
                {cargaTributariaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%
              </h3>
              <span className="text-[11px] text-slate-500">Soma das alíquotas incidentes</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-slate-500">Fator "Por Dentro"</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Fator de gross-up para recomposição da base tributária: 1 / (1 - Carga%).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <h3 className="text-2xl font-bold text-indigo-600 mt-0.5">
                {fatorPorDentro.toFixed(4)}
              </h3>
              <span className="text-[11px] text-emerald-600 font-medium">
                +{percentualEmbutido}% no preço líquido
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Status no Sistema</p>
              <div className="mt-1 flex items-center gap-1.5">
                {existingConfig ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Pendente de Salvar
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                {existingConfig
                  ? `Atualizado em ${new Date(existingConfig.updated).toLocaleDateString('pt-BR')}`
                  : 'Usando padrões iniciais'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Configurações do Regime e Alíquotas (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Regime Tributário & Alíquotas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Defina como os impostos da empresa devem compor a formação de preço.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="font-semibold text-xs text-slate-700">
                  {empresaAtual?.razao_social || 'Empresa Geral'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* Seleção do Regime */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Escolha o Regime Tributário
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      'Simples Nacional',
                      'Lucro Presumido',
                      'Lucro Real',
                    ] as RegimeTributarioFormacaoPreco[]
                  ).map((reg) => {
                    const isSelected = regime === reg
                    return (
                      <button
                        key={reg}
                        type="button"
                        onClick={() => aplicarPresetRegime(reg)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">{reg}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <span className="text-[10px] text-slate-500 line-clamp-1">
                          {reg === 'Simples Nacional'
                            ? 'Guia Única DAS'
                            : reg === 'Lucro Presumido'
                              ? 'PIS/COFINS Cumulativo + IRPJ/CSLL'
                              : 'PIS/COFINS Não-Cumulativo'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Formulário Específico: Simples Nacional */}
              {regime === 'Simples Nacional' && (
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-4 animate-in fade-in-50 duration-200">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-xs font-semibold">
                      Simples Nacional
                    </Badge>
                    <span className="text-xs text-slate-600 font-medium">
                      Guia Única DAS (Alíquota Efetiva)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="anexo-simples" className="text-xs text-slate-700 font-medium">
                        Anexo do Simples
                      </Label>
                      <Select value={anexoSimples} onValueChange={setAnexoSimples}>
                        <SelectTrigger id="anexo-simples" className="bg-white">
                          <SelectValue placeholder="Selecione o anexo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Anexo I - Comércio">
                            Anexo I - Comércio (4,0% a 19,0%)
                          </SelectItem>
                          <SelectItem value="Anexo II - Indústria">
                            Anexo II - Indústria (4,5% a 30,0%)
                          </SelectItem>
                          <SelectItem value="Anexo III - Serviços">
                            Anexo III - Serviços (6,0% a 33,0%)
                          </SelectItem>
                          <SelectItem value="Anexo IV - Serviços Específicos">
                            Anexo IV - Serviços Específicos (4,5% a 33,0%)
                          </SelectItem>
                          <SelectItem value="Anexo V - Serviços Fator R">
                            Anexo V - Serviços Fator R (15,5% a 30,5%)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="faixa-simples" className="text-xs text-slate-700 font-medium">
                        Faixa de Faturamento RBT12
                      </Label>
                      <Select value={faixaSimples} onValueChange={setFaixaSimples}>
                        <SelectTrigger id="faixa-simples" className="bg-white">
                          <SelectValue placeholder="Selecione a faixa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1ª Faixa (até R$ 180.000,00)">
                            1ª Faixa (até R$ 180 mil/ano)
                          </SelectItem>
                          <SelectItem value="2ª Faixa (R$ 180.000 a R$ 360.000)">
                            2ª Faixa (R$ 180 mil a R$ 360 mil)
                          </SelectItem>
                          <SelectItem value="3ª Faixa (R$ 360.000 a R$ 720.000)">
                            3ª Faixa (R$ 360 mil a R$ 720 mil)
                          </SelectItem>
                          <SelectItem value="4ª Faixa (R$ 720.000 a R$ 1.800.000)">
                            4ª Faixa (R$ 720 mil a R$ 1,8 mi)
                          </SelectItem>
                          <SelectItem value="5ª Faixa (R$ 1.800.000 a R$ 3.600.000)">
                            5ª Faixa (R$ 1,8 mi a R$ 3,6 mi)
                          </SelectItem>
                          <SelectItem value="6ª Faixa (R$ 3.600.000 a R$ 4.800.000)">
                            6ª Faixa (R$ 3,6 mi a R$ 4,8 mi)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="aliquota-simples"
                        className="text-xs font-bold text-slate-800"
                      >
                        Alíquota Efetiva do DAS a aplicar na Formação de Preço (%)
                      </Label>
                      <span className="text-xs font-bold text-blue-700">{aliquotaSimples}%</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="aliquota-simples"
                        type="number"
                        step="0.01"
                        min="0"
                        max="99.9"
                        value={aliquotaSimples}
                        onChange={(e) => setAliquotaSimples(parseFloat(e.target.value) || 0)}
                        className="bg-white pr-8 font-semibold text-slate-800 text-sm"
                        placeholder="Ex: 6.00"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Informe a alíquota apurada no PGDAS-D mensal do seu extrato para precificação
                      exata.
                    </p>
                  </div>
                </div>
              )}

              {/* Formulário Lucro Presumido e Lucro Real */}
              {(regime === 'Lucro Presumido' || regime === 'Lucro Real') && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-800 text-white hover:bg-slate-800 text-xs font-semibold">
                        {regime}
                      </Badge>
                      <span className="text-xs text-slate-600 font-medium">
                        Discriminação individual de tributos sobre a receita
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => aplicarPresetRegime(regime)}
                      className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restaurar padrão
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* PIS */}
                    <div className="space-y-1">
                      <Label htmlFor="pis" className="text-xs font-medium text-slate-700">
                        PIS (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="pis"
                          type="number"
                          step="0.01"
                          min="0"
                          value={aliquotaPis}
                          onChange={(e) => setAliquotaPis(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {regime === 'Lucro Real' ? 'Normal: 1,65%' : 'Normal: 0,65%'}
                      </span>
                    </div>

                    {/* COFINS */}
                    <div className="space-y-1">
                      <Label htmlFor="cofins" className="text-xs font-medium text-slate-700">
                        COFINS (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="cofins"
                          type="number"
                          step="0.01"
                          min="0"
                          value={aliquotaCofins}
                          onChange={(e) => setAliquotaCofins(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {regime === 'Lucro Real' ? 'Normal: 7,60%' : 'Normal: 3,00%'}
                      </span>
                    </div>

                    {/* ICMS */}
                    <div className="space-y-1">
                      <Label htmlFor="icms" className="text-xs font-medium text-slate-700">
                        ICMS (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="icms"
                          type="number"
                          step="0.01"
                          min="0"
                          value={aliquotaIcms}
                          onChange={(e) => setAliquotaIcms(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">Ex: 18%, 12%, 7%</span>
                    </div>

                    {/* IPI */}
                    <div className="space-y-1">
                      <Label htmlFor="ipi" className="text-xs font-medium text-slate-700">
                        IPI (%) (se indústria)
                      </Label>
                      <div className="relative">
                        <Input
                          id="ipi"
                          type="number"
                          step="0.01"
                          min="0"
                          value={aliquotaIpi}
                          onChange={(e) => setAliquotaIpi(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">0% se comércio/serviço</span>
                    </div>

                    {/* ISS */}
                    <div className="space-y-1">
                      <Label htmlFor="iss" className="text-xs font-medium text-slate-700">
                        ISS (%) (se serviço)
                      </Label>
                      <div className="relative">
                        <Input
                          id="iss"
                          type="number"
                          step="0.01"
                          min="0"
                          value={aliquotaIss}
                          onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">Geralmente 2% a 5%</span>
                    </div>

                    {/* IRPJ (provisão sobre receita) */}
                    <div className="space-y-1">
                      <Label htmlFor="irpj" className="text-xs font-medium text-slate-700">
                        IRPJ (%) provisão
                      </Label>
                      <div className="relative">
                        <Input
                          id="irpj"
                          type="number"
                          step="0.01"
                          min="0"
                          value={aliquotaIrpj}
                          onChange={(e) => setAliquotaIrpj(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">Comércio: ~1,20%</span>
                    </div>

                    {/* CSLL (provisão sobre receita) */}
                    <div className="space-y-1">
                      <Label htmlFor="csll" className="text-xs font-medium text-slate-700">
                        CSLL (%) provisão
                      </Label>
                      <div className="relative">
                        <Input
                          id="csll"
                          type="number"
                          step="0.01"
                          min="0"
                          value={aliquotaCsll}
                          onChange={(e) => setAliquotaCsll(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">Comércio: ~1,08%</span>
                    </div>

                    {/* Outros Impostos / Taxas */}
                    <div className="space-y-1">
                      <Label htmlFor="outros" className="text-xs font-medium text-slate-700">
                        Outros / FCP (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="outros"
                          type="number"
                          step="0.01"
                          min="0"
                          value={outrosImpostos}
                          onChange={(e) => setOutrosImpostos(parseFloat(e.target.value) || 0)}
                          className="bg-white pr-7 text-xs font-semibold"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">Fundo de Combate à Pobreza</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div className="space-y-1.5">
                <Label htmlFor="observacoes" className="text-xs font-medium text-slate-700">
                  Notas / Observações Fiscais
                </Label>
                <Textarea
                  id="observacoes"
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Alíquota referente ao exercício 2025 com redução de base de cálculo..."
                  className="bg-white text-xs resize-none"
                />
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Carga Total:{' '}
                  <span className="font-bold text-slate-800">{cargaTributariaTotal}%</span>
                </div>
                <Button
                  onClick={handleSalvar}
                  disabled={saving || loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar Configurações Tributárias'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Guia Didático Rápido */}
          <Card className="bg-slate-50/70 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600" />
                Como os impostos impactam o Preço de Venda?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2 pt-0">
              <p>
                No Brasil, os tributos sobre vendas (ICMS, PIS, COFINS, ISS e DAS) são cobrados{' '}
                <strong>"por dentro"</strong>, o que significa que o imposto incide sobre o próprio
                valor final de venda (incluindo o próprio imposto).
              </p>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
                <div>Fórmula de Formação por Dentro:</div>
                <div className="text-blue-700 font-bold">
                  Preço de Venda = Custo / [1 - (Margem% + Desp. Variáveis% + Impostos%) / 100]
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Simulador de Formação de Preço com Impostos (5 colunas) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-amber-200/80 shadow-xs bg-linear-to-b from-amber-50/20 to-white">
            <CardHeader className="pb-3 border-b border-amber-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-amber-600" />
                    Simulador de Preço de Venda
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Veja em tempo real o preço calculado com base na carga tributária configurada.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Seleção do Produto ou Modo Manual */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">
                  Carregar Dados de um Produto (Opcional)
                </Label>
                <Select value={selectedProdutoId} onValueChange={handleSelectProduto}>
                  <SelectTrigger className="bg-white text-xs">
                    <SelectValue placeholder="Digitar custo manualmente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">-- Digitar Custo Manualmente --</SelectItem>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ''}
                        {p.nome} (Custo: R$ {(p.custo_unitario || 0).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Parâmetros do Simulador */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="custo-simulacao" className="text-xs font-medium text-slate-700">
                    Custo Base (R$)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">
                      R$
                    </span>
                    <Input
                      id="custo-simulacao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoBaseSimulacao}
                      onChange={(e) => {
                        setSelectedProdutoId('custom')
                        setCustoBaseSimulacao(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white pl-8 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="margem-simulacao" className="text-xs font-medium text-slate-700">
                    Margem Desejada (%)
                  </Label>
                  <div className="relative">
                    <Input
                      id="margem-simulacao"
                      type="number"
                      step="0.5"
                      min="0"
                      max="90"
                      value={margemDesejadaSimulacao}
                      onChange={(e) => setMargemDesejadaSimulacao(parseFloat(e.target.value) || 0)}
                      className="bg-white pr-7 text-xs font-bold text-emerald-700"
                    />
                    <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="desp-var" className="text-xs font-medium text-slate-700">
                  Despesas Variáveis Adicionais (% sobre venda - ex: Comissões, Cartão)
                </Label>
                <div className="relative">
                  <Input
                    id="desp-var"
                    type="number"
                    step="0.1"
                    min="0"
                    value={despesasVariaveisSimulacao}
                    onChange={(e) => setDespesasVariaveisSimulacao(parseFloat(e.target.value) || 0)}
                    className="bg-white pr-7 text-xs font-medium"
                    placeholder="0.00"
                  />
                  <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                    %
                  </span>
                </div>
              </div>

              {/* Resultado Destaque: Preço Sugerido */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>PREÇO DE VENDA SUGERIDO (COM IMPOSTOS)</span>
                  <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-500">
                    Por Dentro
                  </Badge>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    R${' '}
                    {simulacao.precoFinal.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs text-emerald-400 font-medium">
                    Markup: {simulacao.markupMultiplicador.toFixed(2)}x
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Sem Impostos (Líquido):</span>
                    <span className="font-semibold text-slate-200">
                      R${' '}
                      {simulacao.precoSemImposto.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Total de Impostos Embutidos:</span>
                    <span className="font-semibold text-amber-300">
                      R${' '}
                      {simulacao.valorImpostos.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ({cargaTributariaTotal}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Breakdown da Composição do Preço */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Breakdown do Preço de Venda
                </h4>

                <div className="space-y-1.5 text-xs">
                  {/* Custo */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60">
                    <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      Custo do Produto / Ficha
                    </span>
                    <div className="text-right font-bold text-slate-800">
                      R$ {simulacao.custo.toFixed(2)}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        (
                        {simulacao.precoFinal > 0
                          ? ((simulacao.custo / simulacao.precoFinal) * 100).toFixed(1)
                          : 0}
                        %)
                      </span>
                    </div>
                  </div>

                  {/* Margem de Lucro */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <span className="text-emerald-900 flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Margem de Lucro Bruta ({simulacao.margem}%)
                    </span>
                    <div className="text-right font-bold text-emerald-700">
                      R$ {simulacao.valorMargemLucro.toFixed(2)}
                    </div>
                  </div>

                  {/* Impostos */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                    <span className="text-amber-900 flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      Carga Tributária ({cargaTributariaTotal}%)
                    </span>
                    <div className="text-right font-bold text-amber-700">
                      R$ {simulacao.valorImpostos.toFixed(2)}
                    </div>
                  </div>

                  {/* Despesas Variáveis */}
                  {simulacao.despVar > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/50 border border-indigo-100">
                      <span className="text-indigo-900 flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        Despesas Variáveis ({simulacao.despVar}%)
                      </span>
                      <div className="text-right font-bold text-indigo-700">
                        R$ {simulacao.valorDespesasVar.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Comparativo: Por Dentro vs Por Fora */}
              <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>Comparativo de Métodos:</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Cálculo "Por Dentro" (Recomendado Fiscal):</span>
                  <span className="font-bold text-blue-700">
                    R$ {simulacao.precoFinal.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Cálculo Simples "Por Fora":</span>
                  <span>R$ {simulacao.precoPorFora.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
