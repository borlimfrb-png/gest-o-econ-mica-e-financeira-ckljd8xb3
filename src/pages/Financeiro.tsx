import React, { useState, useEffect, useMemo } from 'react'
import { empresasService } from '@/services/financeService'
import { recebiveisService, type ParcelaPreview } from '@/services/recebiveisService'
import type { EmpresaRecord } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar as CalendarIcon,
  Building,
  DollarSign,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Hash,
  Calculator,
  ArrowRight,
  RefreshCw,
  Clock,
  Layers,
  Mail,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNavigate } from 'react-router-dom'

// Formata data YYYY-MM-DD para dd/mm/aaaa
function formatarDataBr(dataStr?: string): string {
  if (!dataStr) return '—'
  const partes = dataStr.slice(0, 10).split('-')
  if (partes.length === 3) {
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }
  return dataStr
}

// Formata número para moeda brasileira R$ 1.234,56
function formatarMoeda(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

// Formata input monetário a partir de string com máscara R$
function parseValorMonetario(input: string): number {
  const limpo = input.replace(/[^\d]/g, '')
  if (!limpo) return 0
  return Number(limpo) / 100
}

function formatarInputMoeda(val: number): string {
  if (val === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

function dataHojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Financeiro() {
  const { toast } = useToast()
  const navigate = useNavigate()

  // Lista de empresas
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(true)

  // Formulário Gerador
  const [empresaId, setEmpresaId] = useState<string>('')
  const [dataInicio, setDataInicio] = useState<string>(dataHojeIso())
  const [diaVencimento, setDiaVencimento] = useState<number>(10)
  const [valorInput, setValorInput] = useState<string>('')
  const [meses, setMeses] = useState<number>(12)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [enviarLembreteGlobal, setEnviarLembreteGlobal] = useState<boolean>(false)
  const [agendarNfseGlobal, setAgendarNfseGlobal] = useState<boolean>(true)

  // Parcelas Calculadas (Preview em memória)
  const [parcelasGeradas, setParcelasGeradas] = useState<ParcelaPreview[]>([])
  const [saving, setSaving] = useState(false)

  // Carrega empresas
  useEffect(() => {
    async function loadEmpresas() {
      try {
        setLoadingEmpresas(true)
        const list = await empresasService.getAll()
        setEmpresas(list)
        if (list.length > 0) {
          setEmpresaId(list[0].id)
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err)
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar empresas',
          description: 'Não foi possível carregar a lista de empresas cadastradas.',
        })
      } finally {
        setLoadingEmpresas(false)
      }
    }
    loadEmpresas()
  }, [])

  // Empresa selecionada
  const empresaSelecionada = useMemo(() => {
    return empresas.find((e) => e.id === empresaId)
  }, [empresas, empresaId])

  // Total geral das parcelas geradas
  const totalGeralCalculado = useMemo(() => {
    return parcelasGeradas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
  }, [parcelasGeradas])

  // Handlers do Formulário
  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseValorMonetario(raw)
    setValorInput(parsed > 0 ? formatarInputMoeda(parsed) : '')
    if (formErrors.valor) {
      setFormErrors((prev) => ({ ...prev, valor: '' }))
    }
  }

  const validateGerador = (): boolean => {
    const errs: Record<string, string> = {}
    if (!empresaId) {
      errs.empresa = 'Selecione uma empresa'
    }
    if (!dataInicio) {
      errs.dataInicio = 'Informe a data de início dos serviços'
    }
    if (!diaVencimento || diaVencimento < 1 || diaVencimento > 28) {
      errs.diaVencimento = 'O dia de vencimento deve estar entre 1 e 28'
    }
    const val = parseValorMonetario(valorInput)
    if (!val || val <= 0) {
      errs.valor = 'Informe o valor da parcela maior que zero'
    }
    if (!meses || meses < 1 || meses > 120) {
      errs.meses = 'A quantidade de meses deve ser entre 1 e 120'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Gera parcelas em memória
  const handleGerarParcelas = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateGerador()) return

    const valorNumerico = parseValorMonetario(valorInput)
    const preview = recebiveisService
      .calcularPreviewParcelas({
        empresa: empresaId,
        data_inicio_servicos: dataInicio,
        dia_vencimento: diaVencimento,
        valor: valorNumerico,
        meses: Number(meses),
        lembrete_agendado: enviarLembreteGlobal,
        nfse_automatica_agendada: agendarNfseGlobal,
      })
      .map((p) => ({
        ...p,
        lembrete_agendado: enviarLembreteGlobal,
        nfse_automatica_agendada: agendarNfseGlobal,
      }))
    setParcelasGeradas(preview)

    toast({
      title: 'Parcelas calculadas com sucesso',
      description: `${preview.length} parcelas foram geradas. Confira a tabela abaixo e clique em Confirmar e Salvar.`,
    })
  }

  // Salva no backend
  const handleConfirmarESalvar = async () => {
    if (!empresaId || parcelasGeradas.length === 0) return

    setSaving(true)
    try {
      const valorNumerico = parseValorMonetario(valorInput)
      await recebiveisService.gerarParcelas(
        {
          empresa: empresaId,
          data_inicio_servicos: dataInicio,
          dia_vencimento: diaVencimento,
          valor: valorNumerico,
          meses: Number(meses),
        },
        parcelasGeradas,
      )

      toast({
        title: 'Recebíveis gravados com sucesso!',
        description: `Foram salvas ${parcelasGeradas.length} parcelas no valor total de ${formatarMoeda(totalGeralCalculado)} para ${empresaSelecionada?.nome || 'a empresa'}.`,
      })

      // Redireciona para a página de baixa após salvar
      setTimeout(() => {
        navigate('/baixa-recebiveis')
      }, 800)
    } catch (err: any) {
      console.error('Erro ao salvar parcelas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar parcelas',
        description: err?.message || 'Não foi possível gravar as parcelas no banco de dados.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleLembreteParcela = (index: number, checked: boolean) => {
    setParcelasGeradas((prev) =>
      prev.map((p, i) => (i === index ? { ...p, lembrete_agendado: checked } : p)),
    )
  }

  const handleToggleTodosLembretes = (checked: boolean) => {
    setEnviarLembreteGlobal(checked)
    setParcelasGeradas((prev) => prev.map((p) => ({ ...p, lembrete_agendado: checked })))
  }

  // Limpar formulário e visualização
  const handleLimpar = () => {
    setParcelasGeradas([])
    setValorInput('')
    setMeses(12)
    setDiaVencimento(10)
    setDataInicio(dataHojeIso())
    setEnviarLembreteGlobal(false)
    setFormErrors({})
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Financeiro · Gerador de Recebimentos Anuais
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Gere contratos e recebimentos de forma rápida com parcelas mensais pré-calculadas.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate('/baixa-recebiveis')}
          className="h-8 text-xs font-semibold text-blue-700 bg-white border-blue-200 hover:bg-blue-50 gap-1.5 shadow-2xs self-start sm:self-auto"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Ir para Baixa dos Recebíveis
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>

      {/* Grid: Formulário Gerador e Preview Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulário (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                Configurar Contrato / Parcelas
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Informe a empresa, valor e vigência para gerar o cronograma de recebíveis.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleGerarParcelas} className="space-y-4">
                {formErrors.general && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 border-red-200 text-red-800 py-2"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-xs font-medium">
                      {formErrors.general}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Seletor de Empresa */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="fin-empresa"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    Empresa *
                  </Label>
                  <Select
                    value={empresaId}
                    onValueChange={(val) => {
                      setEmpresaId(val)
                      if (formErrors.empresa) {
                        setFormErrors((prev) => ({ ...prev, empresa: '' }))
                      }
                    }}
                    disabled={loadingEmpresas}
                  >
                    <SelectTrigger id="fin-empresa" className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome} {emp.segmento ? `(${emp.segmento})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.empresa && (
                    <p className="text-[11px] text-red-600 font-medium">{formErrors.empresa}</p>
                  )}
                </div>

                {/* Data de Início dos Serviços */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="fin-inicio"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                    Data de Início dos Serviços *
                  </Label>
                  <Input
                    id="fin-inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value)
                      if (formErrors.dataInicio) {
                        setFormErrors((prev) => ({ ...prev, dataInicio: '' }))
                      }
                    }}
                    className="h-9 text-xs bg-white"
                  />
                  {formErrors.dataInicio && (
                    <p className="text-[11px] text-red-600 font-medium">{formErrors.dataInicio}</p>
                  )}
                </div>

                {/* Linha com Dia do Vencimento e Quantidade de Meses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Dia de Vencimento (1 a 28) */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="fin-dia"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Dia de Vencimento (1-28) *
                    </Label>
                    <Input
                      id="fin-dia"
                      type="number"
                      min={1}
                      max={28}
                      placeholder="10"
                      value={diaVencimento}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        setDiaVencimento(isNaN(v) ? ('' as any) : v)
                        if (formErrors.diaVencimento) {
                          setFormErrors((prev) => ({ ...prev, diaVencimento: '' }))
                        }
                      }}
                      className="h-9 text-xs bg-white font-mono font-bold"
                    />
                    {formErrors.diaVencimento && (
                      <p className="text-[11px] text-red-600 font-medium">
                        {formErrors.diaVencimento}
                      </p>
                    )}
                  </div>

                  {/* Quantidade de Meses */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="fin-meses"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Quantidade de Meses *
                    </Label>
                    <Input
                      id="fin-meses"
                      type="number"
                      min={1}
                      max={120}
                      placeholder="12"
                      value={meses}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        setMeses(isNaN(v) ? ('' as any) : v)
                        if (formErrors.meses) {
                          setFormErrors((prev) => ({ ...prev, meses: '' }))
                        }
                      }}
                      className="h-9 text-xs bg-white font-mono font-bold"
                    />
                    {formErrors.meses && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.meses}</p>
                    )}
                  </div>
                </div>

                {/* Atalhos de Meses */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    Atalhos:
                  </span>
                  {[6, 12, 24, 36].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMeses(m)}
                      className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition-colors border ${
                        meses === m
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m} meses {m === 12 ? '(1 ano)' : m === 24 ? '(2 anos)' : ''}
                    </button>
                  ))}
                </div>

                {/* Valor da Parcela (R$) */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="fin-valor"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    Valor da Parcela Mensal (R$) *
                  </Label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fin-valor"
                      type="text"
                      placeholder="R$ 0,00"
                      value={valorInput}
                      onChange={handleValorChange}
                      className="h-9 text-xs pl-8 font-mono font-bold text-slate-900"
                    />
                  </div>
                  {formErrors.valor && (
                    <p className="text-[11px] text-red-600 font-medium">{formErrors.valor}</p>
                  )}
                </div>

                {/* Checkbox Geral de Lembrete por E-mail */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/70 flex items-start gap-2.5">
                  <Checkbox
                    id="fin-lembrete-global"
                    checked={enviarLembreteGlobal}
                    onCheckedChange={(checked) => handleToggleTodosLembretes(Boolean(checked))}
                    className="mt-0.5 border-blue-400 data-[state=checked]:bg-blue-600"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="fin-lembrete-global"
                      className="text-xs font-bold text-blue-950 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      Enviar lembretes de vencimento por e-mail
                    </label>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Envia e-mail automático para o cliente 3 dias antes de cada vencimento com os
                      dados bancários e PIX para pagamento.
                    </p>
                  </div>
                </div>

                {/* Checkbox Agendar Emissão Automática de NFSe no Vencimento */}
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-start gap-2.5">
                  <Checkbox
                    id="fin-agendar-nfse"
                    checked={agendarNfseGlobal}
                    onCheckedChange={(checked) => {
                      const v = Boolean(checked)
                      setAgendarNfseGlobal(v)
                      setParcelasGeradas((prev) =>
                        prev.map((p) => ({ ...p, nfse_automatica_agendada: v })),
                      )
                    }}
                    className="mt-0.5 border-emerald-400 data-[state=checked]:bg-emerald-600"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="fin-agendar-nfse"
                      className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Agendar emissão automática de NFSe no vencimento da parcela
                    </label>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      O cron do sistema transmitirá e autorizará a Nota Fiscal de Serviços
                      automaticamente na data de vencimento da parcela.
                    </p>
                  </div>
                </div>

                {/* Ações */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLimpar}
                    className="h-8 text-xs text-slate-500 hover:text-slate-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Limpar
                  </Button>

                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                    disabled={loadingEmpresas || empresas.length === 0}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Gerar Parcelas
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card Resumo do Contrato */}
          {parcelasGeradas.length > 0 && (
            <Card className="bg-gradient-to-br from-blue-900 to-[#0B1F3A] text-white border-blue-800 shadow-md">
              {' '}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-300" />
                    <span className="text-xs font-bold truncate max-w-[200px]">
                      {empresaSelecionada?.nome || 'Empresa'}
                    </span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                    {parcelasGeradas.length} Parcelas
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-blue-200 uppercase font-semibold block">
                      Início dos Serviços
                    </span>
                    <span className="font-bold text-white mt-0.5 block">
                      {formatarDataBr(dataInicio)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-200 uppercase font-semibold block">
                      Vencimento Mensal
                    </span>
                    <span className="font-bold text-white mt-0.5 block">
                      Todo dia {diaVencimento}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-200 uppercase font-semibold block">
                      Valor Unitário
                    </span>
                    <span className="font-bold text-white mt-0.5 block font-mono">
                      {formatarMoeda(parseValorMonetario(valorInput))}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-300 uppercase font-bold block">
                      Total Contrato
                    </span>
                    <span className="font-bold text-emerald-300 mt-0.5 block text-sm font-mono">
                      {formatarMoeda(totalGeralCalculado)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabela de Parcelas Calculadas (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                    Cronograma de Recebimentos Calculados
                  </CardTitle>
                  {parcelasGeradas.length > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-bold"
                    >
                      {parcelasGeradas.length} parcelas
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">
                  {parcelasGeradas.length > 0
                    ? `Confira o cronograma de ${empresaSelecionada?.nome || 'empresa'} e confirme para salvar no sistema.`
                    : 'Preencha o formulário e clique em "Gerar Parcelas" para visualizar o cronograma.'}
                </CardDescription>
              </div>

              {parcelasGeradas.length > 0 && (
                <Button
                  onClick={handleConfirmarESalvar}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? 'Gravando parcelas...' : 'Confirmar e Salvar'}
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {parcelasGeradas.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <CalendarIcon className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhuma parcela gerada ainda</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Configure os dados ao lado (empresa, início, vencimento, valor e meses) e clique
                    em <strong>"Gerar Parcelas"</strong> para calcular o cronograma anual.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                        <th className="py-3 px-3.5 text-center w-20">Nº Parcela</th>
                        <th className="py-3 px-3.5">Data de Vencimento</th>
                        <th className="py-3 px-3.5 text-right">Valor da Parcela (R$)</th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                        <th className="py-3 px-3 text-center">Lembrete por E-mail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parcelasGeradas.map((p, index) => (
                        <tr key={p.parcela} className="hover:bg-slate-50/80 transition-colors">
                          {/* Nº Parcela */}
                          <td className="py-2.5 px-3.5 text-center font-mono font-bold text-blue-700">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 border border-blue-200">
                              {String(p.parcela).padStart(2, '0')}
                            </span>
                          </td>

                          {/* Data de Vencimento */}
                          <td className="py-2.5 px-3.5 font-medium text-slate-800">
                            <span className="flex items-center gap-1.5">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                              {formatarDataBr(p.vencimento)}
                            </span>
                          </td>

                          {/* Valor */}
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                            {formatarMoeda(p.valor)}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3.5 text-center">
                            <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[10px] px-2 py-0.5">
                              Pendente
                            </Badge>
                          </td>

                          {/* Checkbox Lembrete por E-mail */}
                          <td className="py-2.5 px-3 text-center">
                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                              <Checkbox
                                checked={p.lembrete_agendado || false}
                                onCheckedChange={(checked) =>
                                  handleToggleLembreteParcela(index, Boolean(checked))
                                }
                                className="border-slate-300 data-[state=checked]:bg-blue-600"
                              />
                              <span className="text-[11px] text-slate-600">
                                {p.lembrete_agendado ? 'Agendado (3 dias)' : 'Sem lembrete'}
                              </span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Rodapé com Total Geral */}
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-800">
                        <td colSpan={2} className="py-3.5 px-4 text-xs uppercase tracking-wide">
                          Total Geral ({parcelasGeradas.length} parcela
                          {parcelasGeradas.length !== 1 ? 's' : ''})
                        </td>
                        <td className="py-3.5 px-3.5 text-right text-sm font-mono text-emerald-700 font-bold">
                          {formatarMoeda(totalGeralCalculado)}
                        </td>
                        <td colSpan={2} className="py-3.5 px-3.5 text-center">
                          <Button
                            onClick={handleConfirmarESalvar}
                            disabled={saving}
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 shadow-2xs"
                          >
                            Salvar
                          </Button>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
