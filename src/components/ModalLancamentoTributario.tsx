import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart,
  TrendingUp,
  Calculator,
  Calendar,
  FileText,
  Building2,
  DollarSign,
  Percent,
} from 'lucide-react'
import type {
  TipoLancamentoTributario,
  TributoLancamentoInput,
  TributoLancamentoRecord,
} from '@/types/finance'
import { formatCurrency } from '@/lib/financeCalculations'
import { parseNumeroBrl } from '@/lib/inputValorBrl'
import { InputValorBrl } from '@/components/ui/input-valor-brl'

interface ModalLancamentoTributarioProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: TipoLancamentoTributario
  empresaId: string
  lancamentoEmEdicao: TributoLancamentoRecord | null
  onSalvo: () => void
  onSalvar: (dados: TributoLancamentoInput, id?: string) => Promise<boolean>
}

export function ModalLancamentoTributario({
  open,
  onOpenChange,
  tipo,
  empresaId,
  lancamentoEmEdicao,
  onSalvo,
  onSalvar,
}: ModalLancamentoTributarioProps) {
  const isEdicao = !!lancamentoEmEdicao
  const isEntrada = tipo === 'entrada'

  const [fornecedorTomador, setFornecedorTomador] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [numeroNota, setNumeroNota] = useState('')
  const [cfop, setCfop] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [valorMercadoria, setValorMercadoria] = useState('')

  // ICMS
  const [baseIcms, setBaseIcms] = useState('')
  const [aliquotaIcms, setAliquotaIcms] = useState('18')
  const [valorIcms, setValorIcms] = useState('')

  // IPI
  const [baseIpi, setBaseIpi] = useState('')
  const [aliquotaIpi, setAliquotaIpi] = useState('0')
  const [valorIpi, setValorIpi] = useState('')

  // PIS
  const [basePis, setBasePis] = useState('')
  const [aliquotaPis, setAliquotaPis] = useState('1.65')
  const [valorPis, setValorPis] = useState('')

  // COFINS
  const [baseCofins, setBaseCofins] = useState('')
  const [aliquotaCofins, setAliquotaCofins] = useState('7.60')
  const [valorCofins, setValorCofins] = useState('')

  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Quando abre para edição ou novo
  React.useEffect(() => {
    if (open) {
      setErro(null)
      if (lancamentoEmEdicao) {
        setFornecedorTomador(lancamentoEmEdicao.fornecedor_tomador || '')
        setCnpjCpf(lancamentoEmEdicao.cnpj_cpf || '')
        setNumeroNota(lancamentoEmEdicao.numero_nota || '')
        setCfop(lancamentoEmEdicao.cfop || '')
        setData(
          lancamentoEmEdicao.data
            ? lancamentoEmEdicao.data.split('T')[0]
            : new Date().toISOString().split('T')[0],
        )
        const vm = Number(lancamentoEmEdicao.valor_mercadoria) || 0
        setValorMercadoria(vm ? String(vm) : '')

        // ICMS
        setBaseIcms(lancamentoEmEdicao.base_icms ? String(lancamentoEmEdicao.base_icms) : '')
        setAliquotaIcms(
          lancamentoEmEdicao.aliquota_icms !== undefined
            ? String(lancamentoEmEdicao.aliquota_icms)
            : '18',
        )
        setValorIcms(lancamentoEmEdicao.valor_icms ? String(lancamentoEmEdicao.valor_icms) : '')

        // IPI
        setBaseIpi(lancamentoEmEdicao.base_ipi ? String(lancamentoEmEdicao.base_ipi) : '')
        setAliquotaIpi(
          lancamentoEmEdicao.aliquota_ipi !== undefined
            ? String(lancamentoEmEdicao.aliquota_ipi)
            : '0',
        )
        setValorIpi(lancamentoEmEdicao.valor_ipi ? String(lancamentoEmEdicao.valor_ipi) : '')

        // PIS
        setBasePis(lancamentoEmEdicao.base_pis ? String(lancamentoEmEdicao.base_pis) : '')
        setAliquotaPis(
          lancamentoEmEdicao.aliquota_pis !== undefined
            ? String(lancamentoEmEdicao.aliquota_pis)
            : '1.65',
        )
        setValorPis(lancamentoEmEdicao.valor_pis ? String(lancamentoEmEdicao.valor_pis) : '')

        // COFINS
        setBaseCofins(lancamentoEmEdicao.base_cofins ? String(lancamentoEmEdicao.base_cofins) : '')
        setAliquotaCofins(
          lancamentoEmEdicao.aliquota_cofins !== undefined
            ? String(lancamentoEmEdicao.aliquota_cofins)
            : '7.60',
        )
        setValorCofins(
          lancamentoEmEdicao.valor_cofins ? String(lancamentoEmEdicao.valor_cofins) : '',
        )

        setObservacoes(lancamentoEmEdicao.observacoes || '')
      } else {
        // Form limpo
        setFornecedorTomador('')
        setCnpjCpf('')
        setNumeroNota('')
        setCfop(isEntrada ? '1102' : '5102')
        setData(new Date().toISOString().split('T')[0])
        setValorMercadoria('')
        setBaseIcms('')
        setAliquotaIcms('18')
        setValorIcms('')
        setBaseIpi('')
        setAliquotaIpi('0')
        setValorIpi('')
        setBasePis('')
        setAliquotaPis('1.65')
        setValorPis('')
        setBaseCofins('')
        setAliquotaCofins('7.60')
        setValorCofins('')
        setObservacoes('')
      }
    }
  }, [open, lancamentoEmEdicao, isEntrada])

  // Recalcular impostos quando valor da mercadoria ou alíquotas mudarem
  const aplicarCalculoAutomatico = (vMerc?: number) => {
    const v = vMerc !== undefined ? vMerc : (parseNumeroBrl(valorMercadoria) ?? 0)
    if (v > 0) {
      // Base padrão = valor mercadoria se vazia
      const bIcms = baseIcms !== '' ? (parseNumeroBrl(baseIcms) ?? 0) : v
      const aIcms = parseNumeroBrl(aliquotaIcms) ?? 0
      setBaseIcms(String(bIcms))
      setValorIcms((Math.round(((bIcms * aIcms) / 100) * 100) / 100).toFixed(2))

      const bIpi = baseIpi !== '' ? (parseNumeroBrl(baseIpi) ?? 0) : v
      const aIpi = parseNumeroBrl(aliquotaIpi) ?? 0
      setBaseIpi(String(bIpi))
      setValorIpi((Math.round(((bIpi * aIpi) / 100) * 100) / 100).toFixed(2))

      const bPis = basePis !== '' ? (parseNumeroBrl(basePis) ?? 0) : v
      const aPis = parseNumeroBrl(aliquotaPis) ?? 0
      setBasePis(String(bPis))
      setValorPis((Math.round(((bPis * aPis) / 100) * 100) / 100).toFixed(2))

      const bCofins = baseCofins !== '' ? (parseNumeroBrl(baseCofins) ?? 0) : v
      const aCofins = parseNumeroBrl(aliquotaCofins) ?? 0
      setBaseCofins(String(bCofins))
      setValorCofins((Math.round(((bCofins * aCofins) / 100) * 100) / 100).toFixed(2))
    }
  }

  const handleValorMercadoriaChange = (val: number | undefined) => {
    setValorMercadoria(val === undefined ? '' : String(val))
    if (val !== undefined && val > 0) {
      aplicarCalculoAutomatico(val)
    }
  }

  const handleRecalcularImposto = (tributo: 'icms' | 'ipi' | 'pis' | 'cofins') => {
    const v = parseNumeroBrl(valorMercadoria) ?? 0
    if (tributo === 'icms') {
      const b = baseIcms !== '' ? (parseNumeroBrl(baseIcms) ?? 0) : v
      const a = parseNumeroBrl(aliquotaIcms) ?? 0
      setValorIcms((Math.round(((b * a) / 100) * 100) / 100).toFixed(2))
    } else if (tributo === 'ipi') {
      const b = baseIpi !== '' ? (parseNumeroBrl(baseIpi) ?? 0) : v
      const a = parseNumeroBrl(aliquotaIpi) ?? 0
      setValorIpi((Math.round(((b * a) / 100) * 100) / 100).toFixed(2))
    } else if (tributo === 'pis') {
      const b = basePis !== '' ? (parseNumeroBrl(basePis) ?? 0) : v
      const a = parseNumeroBrl(aliquotaPis) ?? 0
      setValorPis((Math.round(((b * a) / 100) * 100) / 100).toFixed(2))
    } else if (tributo === 'cofins') {
      const b = baseCofins !== '' ? (parseNumeroBrl(baseCofins) ?? 0) : v
      const a = parseNumeroBrl(aliquotaCofins) ?? 0
      setValorCofins((Math.round(((b * a) / 100) * 100) / 100).toFixed(2))
    }
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (!fornecedorTomador.trim()) {
      setErro(isEntrada ? 'Informe o nome do fornecedor.' : 'Informe o nome do tomador / cliente.')
      return
    }

    const valMerc = parseNumeroBrl(valorMercadoria)
    if (valMerc === undefined || valMerc <= 0) {
      setErro('Informe um valor de mercadoria válido maior que zero.')
      return
    }

    if (!data) {
      setErro('Informe a data da operação.')
      return
    }

    setSalvando(true)
    try {
      const payload: TributoLancamentoInput = {
        empresa: empresaId,
        tipo,
        fornecedor_tomador: fornecedorTomador.trim(),
        cnpj_cpf: cnpjCpf.trim() || undefined,
        numero_nota: numeroNota.trim() || undefined,
        cfop: cfop.trim() || undefined,
        data: `${data} 12:00:00`,
        valor_mercadoria: valMerc,
        // ICMS
        base_icms: baseIcms !== '' ? (parseNumeroBrl(baseIcms) ?? 0) : valMerc,
        aliquota_icms: aliquotaIcms !== '' ? (parseNumeroBrl(aliquotaIcms) ?? 0) : 0,
        valor_icms: valorIcms !== '' ? (parseNumeroBrl(valorIcms) ?? 0) : 0,
        // IPI
        base_ipi: baseIpi !== '' ? (parseNumeroBrl(baseIpi) ?? 0) : valMerc,
        aliquota_ipi: aliquotaIpi !== '' ? (parseNumeroBrl(aliquotaIpi) ?? 0) : 0,
        valor_ipi: valorIpi !== '' ? (parseNumeroBrl(valorIpi) ?? 0) : 0,
        // PIS
        base_pis: basePis !== '' ? (parseNumeroBrl(basePis) ?? 0) : valMerc,
        aliquota_pis: aliquotaPis !== '' ? (parseNumeroBrl(aliquotaPis) ?? 0) : 0,
        valor_pis: valorPis !== '' ? (parseNumeroBrl(valorPis) ?? 0) : 0,
        // COFINS
        base_cofins: baseCofins !== '' ? (parseNumeroBrl(baseCofins) ?? 0) : valMerc,
        aliquota_cofins: aliquotaCofins !== '' ? (parseNumeroBrl(aliquotaCofins) ?? 0) : 0,
        valor_cofins: valorCofins !== '' ? (parseNumeroBrl(valorCofins) ?? 0) : 0,
        observacoes: observacoes.trim() || undefined,
      }

      const sucesso = await onSalvar(payload, lancamentoEmEdicao?.id)
      if (sucesso) {
        onSalvo()
        onOpenChange(false)
      } else {
        setErro('Ocorreu uma falha ao salvar o lançamento no banco de dados.')
      }
    } catch (err: any) {
      console.error(err)
      setErro(err?.message || 'Falha ao salvar lançamento.')
    } finally {
      setSalvando(false)
    }
  }

  // Totais de impostos calculados no formulário
  const somaImpostos =
    (parseNumeroBrl(valorIcms) ?? 0) +
    (parseNumeroBrl(valorIpi) ?? 0) +
    (parseNumeroBrl(valorPis) ?? 0) +
    (parseNumeroBrl(valorCofins) ?? 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                isEntrada ? 'bg-amber-600' : 'bg-blue-600'
              }`}
            >
              {isEntrada ? (
                <ShoppingCart className="w-5 h-5" />
              ) : (
                <TrendingUp className="w-5 h-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#0B1F3A]">
                {isEdicao ? 'Editar' : 'Novo'} Lançamento de{' '}
                {isEntrada ? 'Entrada (Compra)' : 'Saída (Venda)'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {isEntrada
                  ? 'Registro de notas de compras e insumos para apuração de créditos tributários'
                  : 'Registro de notas de vendas para apuração de débitos fiscais'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {erro && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {erro}
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-5 py-2">
          {/* Dados Gerais da Operação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fornecedor" className="text-xs font-semibold text-slate-700">
                {isEntrada ? 'Fornecedor / Emitente *' : 'Tomador / Cliente *'}
              </Label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="fornecedor"
                  placeholder={
                    isEntrada ? 'Ex: Fornecedor de Matéria-Prima Ltda' : 'Ex: Cliente Comercial S/A'
                  }
                  value={fornecedorTomador}
                  onChange={(e) => setFornecedorTomador(e.target.value)}
                  className="pl-9 text-xs font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnpj" className="text-xs font-semibold text-slate-700">
                CNPJ / CPF
              </Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="num_nota" className="text-xs font-semibold text-slate-700">
                Número da Nota (NF-e)
              </Label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="num_nota"
                  placeholder="Ex: 001234"
                  value={numeroNota}
                  onChange={(e) => setNumeroNota(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfop" className="text-xs font-semibold text-slate-700">
                CFOP
              </Label>
              <Input
                id="cfop"
                placeholder={isEntrada ? 'Ex: 1102 / 2102' : 'Ex: 5102 / 6102'}
                value={cfop}
                onChange={(e) => setCfop(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data_operacao" className="text-xs font-semibold text-slate-700">
                Data da Operação *
              </Label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="data_operacao"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="pl-9 text-xs font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="valor_mercadoria"
                  className="text-xs font-bold text-slate-900 flex items-center gap-1.5"
                >
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Valor Total da Mercadoria / Operação (R$) *
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => aplicarCalculoAutomatico()}
                  className="h-6 text-[11px] text-blue-600 hover:text-blue-800 p-0 font-semibold gap-1"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Recalcular Bases
                </Button>
              </div>
              <InputValorBrl
                id="valor_mercadoria"
                placeholder="0,00"
                value={parseNumeroBrl(valorMercadoria)}
                onValueChange={handleValorMercadoriaChange}
                className="text-sm font-bold text-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Seção dos 4 Tributos: ICMS, IPI, PIS e COFINS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-blue-600" />
                Impostos Destacados ({isEntrada ? 'Créditos Fiscais' : 'Débitos Fiscais'})
              </h4>
              <Badge variant="outline" className="text-[11px] font-semibold text-slate-600">
                Total Tributos: {formatCurrency(somaImpostos)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Card ICMS */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-xs text-blue-900">ICMS</span>
                  <span className="text-[10px] text-slate-400">Circulação Mercadorias</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">Base (R$)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(baseIcms)}
                      onValueChange={(v) => setBaseIcms(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('icms')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Alíquota (%)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(aliquotaIcms)}
                      onValueChange={(v) => setAliquotaIcms(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('icms')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-semibold text-blue-700">
                      Valor (R$)
                    </Label>
                    <InputValorBrl
                      value={parseNumeroBrl(valorIcms)}
                      onValueChange={(v) => setValorIcms(v === undefined ? '' : String(v))}
                      className="h-8 text-xs font-bold text-blue-800 bg-blue-50/50"
                    />
                  </div>
                </div>
              </div>

              {/* Card IPI */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-xs text-purple-900">IPI</span>
                  <span className="text-[10px] text-slate-400">Produtos Industrializados</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">Base (R$)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(baseIpi)}
                      onValueChange={(v) => setBaseIpi(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('ipi')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Alíquota (%)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(aliquotaIpi)}
                      onValueChange={(v) => setAliquotaIpi(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('ipi')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-semibold text-purple-700">
                      Valor (R$)
                    </Label>
                    <InputValorBrl
                      value={parseNumeroBrl(valorIpi)}
                      onValueChange={(v) => setValorIpi(v === undefined ? '' : String(v))}
                      className="h-8 text-xs font-bold text-purple-800 bg-purple-50/50"
                    />
                  </div>
                </div>
              </div>

              {/* Card PIS */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-xs text-emerald-900">PIS</span>
                  <span className="text-[10px] text-slate-400">Integração Social</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">Base (R$)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(basePis)}
                      onValueChange={(v) => setBasePis(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('pis')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Alíquota (%)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(aliquotaPis)}
                      onValueChange={(v) => setAliquotaPis(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('pis')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-semibold text-emerald-700">
                      Valor (R$)
                    </Label>
                    <InputValorBrl
                      value={parseNumeroBrl(valorPis)}
                      onValueChange={(v) => setValorPis(v === undefined ? '' : String(v))}
                      className="h-8 text-xs font-bold text-emerald-800 bg-emerald-50/50"
                    />
                  </div>
                </div>
              </div>

              {/* Card COFINS */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-xs text-indigo-900">COFINS</span>
                  <span className="text-[10px] text-slate-400">Financiamento Seguridade</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">Base (R$)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(baseCofins)}
                      onValueChange={(v) => setBaseCofins(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('cofins')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Alíquota (%)</Label>
                    <InputValorBrl
                      value={parseNumeroBrl(aliquotaCofins)}
                      onValueChange={(v) => setAliquotaCofins(v === undefined ? '' : String(v))}
                      onBlur={() => handleRecalcularImposto('cofins')}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-semibold text-indigo-700">
                      Valor (R$)
                    </Label>
                    <InputValorBrl
                      value={parseNumeroBrl(valorCofins)}
                      onValueChange={(v) => setValorCofins(v === undefined ? '' : String(v))}
                      className="h-8 text-xs font-bold text-indigo-800 bg-indigo-50/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="obs" className="text-xs font-semibold text-slate-700">
              Observações / Justificativa Fiscal
            </Label>
            <Textarea
              id="obs"
              rows={2}
              placeholder="Ex: Nota fiscal referente a insumos com crédito integral de ICMS e PIS/COFINS..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando}
              className={`text-xs font-bold text-white shadow-xs ${
                isEntrada ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {salvando ? 'Salvando...' : isEdicao ? 'Salvar Alterações' : 'Registrar Lançamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
