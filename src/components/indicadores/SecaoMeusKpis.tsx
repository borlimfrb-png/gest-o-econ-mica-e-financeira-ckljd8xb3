import React, { useCallback, useEffect, useState } from 'react'
import { Target, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  kpisPersonalizadosService,
  KPI_METRICAS,
  kpiMetricaLabel,
  type KpiPersonalizadoRecord,
  type KpiMetrica,
  type KpiOperador,
} from '@/services/kpisPersonalizadosService'
import { formatCurrency, formatNumber } from '@/lib/financeCalculations'

export interface SecaoMeusKpisProps {
  empresaId: string | null
  anoAtivo: number
  /** Valores brutos do exercício ativo (consolidações já existentes dos hodômetros). */
  valoresAnoAtivo: {
    receitaBruta: number
    lucroLiquido: number
    ebitda: number
    roe: number | null
    margemLiquida: number | null
    margemBruta: number | null
    margemEbitda: number | null
    liquidezCorrente: number | null
    endividamentoGeral: number | null
  }
  /** Valores brutos do exercício anterior (delta), mesma base. */
  valoresAnoAnterior?: Partial<SecaoMeusKpisProps['valoresAnoAtivo']>
}

interface FormKpi {
  id?: string
  nome: string
  metrica_base: KpiMetrica
  operador: KpiOperador
  metrica_secundaria: KpiMetrica | ''
}

const FORM_VAZIO: FormKpi = {
  nome: '',
  metrica_base: 'receita',
  operador: 'nenhum',
  metrica_secundaria: '',
}

const OPERADORES: { value: KpiOperador; label: string }[] = [
  { value: 'nenhum', label: 'Somente a métrica base' },
  { value: 'divisao', label: '÷ (divisão)' },
  { value: 'multiplicacao', label: '× (multiplicação)' },
  { value: 'subtracao', label: '− (subtração)' },
  { value: 'soma', label: '+ (soma)' },
]

type ValorEntrada = { ok: true; valor: number } | { ok: false }

function extrairValor(
  metrica: KpiMetrica | '',
  v: SecaoMeusKpisProps['valoresAnoAtivo'],
): ValorEntrada {
  switch (metrica) {
    case 'receita':
      return v.receitaBruta > 0 ? { ok: true, valor: v.receitaBruta } : { ok: false }
    case 'lucro':
      return v.lucroLiquido !== 0 || v.receitaBruta > 0
        ? { ok: true, valor: v.lucroLiquido }
        : { ok: false }
    case 'ebitda':
      return v.ebitda !== 0 || v.receitaBruta > 0 ? { ok: true, valor: v.ebitda } : { ok: false }
    case 'roe':
    case 'margem_liquida':
    case 'margem_bruta':
    case 'margem_ebitda':
    case 'endividamento':
    case 'liquidez_corrente': {
      const map: Record<string, number | null> = {
        roe: v.roe,
        margem_liquida: v.margemLiquida,
        margem_bruta: v.margemBruta,
        margem_ebitda: v.margemEbitda,
        endividamento: v.endividamentoGeral,
        liquidez_corrente: v.liquidezCorrente,
      }
      const val = map[metrica]
      return val !== null && val !== undefined && Number.isFinite(val)
        ? { ok: true, valor: val }
        : { ok: false }
    }
    default:
      return { ok: false }
  }
}

function calcularFormula(
  kpi: Pick<KpiPersonalizadoRecord, 'metrica_base' | 'operador' | 'metrica_secundaria'>,
  v: SecaoMeusKpisProps['valoresAnoAtivo'],
): { valor: number | null; unidade: '%' | 'x' | 'R$' | 'p.p.'; formula: string } {
  const a = extrairValor(kpi.metrica_base, v)
  const op = (kpi.operador || 'nenhum') as KpiOperador
  const labelA = kpi.metrica_base ? kpiMetricaLabel(kpi.metrica_base) : ''

  if (op === 'nenhum' || !kpi.metrica_secundaria) {
    return {
      valor: a.ok ? a.valor : null,
      unidade: a.ok ? extrairUnidadeSimples(kpi.metrica_base, a.valor) : 'x',
      formula: labelA,
    }
  }

  const b = extrairValor(kpi.metrica_secundaria, v)
  const labelB = kpiMetricaLabel(kpi.metrica_secundaria)

  if (!a.ok || !b.ok)
    return { valor: null, unidade: 'x', formula: `${labelA} ${opSimbolo(op)} ${labelB}` }

  let valor: number
  switch (op) {
    case 'divisao':
      if (Math.abs(b.valor) < 1e-12)
        return { valor: null, unidade: 'x', formula: `${labelA} ÷ ${labelB}` }
      valor = a.valor / b.valor
      break
    case 'multiplicacao':
      valor = a.valor * b.valor
      break
    case 'subtracao':
      valor = a.valor - b.valor
      break
    case 'soma':
      valor = a.valor + b.valor
      break
    default:
      valor = a.valor
  }

  // Unidade derivada
  const ambosPercentual = ehPercentual(kpi.metrica_base) && ehPercentual(kpi.metrica_secundaria)
  const ambosMonetario = ehMonetario(kpi.metrica_base) && ehMonetario(kpi.metrica_secundaria)

  let unidade: '%' | 'x' | 'R$' | 'p.p.' = 'x'
  if (op === 'divisao') {
    unidade =
      ambosPercentual || (!ehMonetario(kpi.metrica_base) && !ehMonetario(kpi.metrica_secundaria))
        ? 'x'
        : 'x'
  } else if (op === 'multiplicacao') {
    unidade = 'x'
  } else if (op === 'subtracao' || op === 'soma') {
    unidade = ambosPercentual ? 'p.p.' : ambosMonetario ? 'R$' : 'x'
  }

  return { valor, unidade, formula: `${labelA} ${opSimbolo(op)} ${labelB}` }
}

function opSimbolo(op: KpiOperador): string {
  switch (op) {
    case 'divisao':
      return '÷'
    case 'multiplicacao':
      return '×'
    case 'subtracao':
      return '−'
    case 'soma':
      return '+'
    default:
      return ''
  }
}

function ehPercentual(m: KpiMetrica): boolean {
  return ['roe', 'margem_liquida', 'margem_bruta', 'margem_ebitda', 'endividamento'].includes(m)
}

function ehMonetario(m: KpiMetrica): boolean {
  return ['receita', 'lucro', 'ebitda'].includes(m)
}

function extrairUnidadeSimples(m: KpiMetrica, valor: number): '%' | 'x' | 'R$' {
  if (ehPercentual(m)) return '%'
  if (ehMonetario(m)) return 'R$'
  return 'x'
}

function formatarValorKpi(valor: number | null, unidade: '%' | 'x' | 'R$' | 'p.p.'): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  switch (unidade) {
    case '%':
      return `${formatNumber(valor, 1)}%`
    case 'p.p.':
      return `${formatNumber(valor, 1)} p.p.`
    case 'R$':
      return formatCurrency(valor)
    default:
      return `${formatNumber(valor, 2)}x`
  }
}

/**
 * Seção "Meus KPIs" (perfil interno): KPIs personalizados compostos por
 * métrica base + operador sobre as consolidações já existentes do painel.
 * CRUD completo via kpisPersonalizadosService.
 */
export function SecaoMeusKpis({ empresaId, anoAtivo, valoresAnoAtivo }: SecaoMeusKpisProps) {
  const [kpis, setKpis] = useState<KpiPersonalizadoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState<FormKpi>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setKpis([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    const lista = await kpisPersonalizadosService.getAll(empresaId)
    setKpis(lista.filter((k) => k.ativo !== false))
    setCarregando(false)
  }, [empresaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrirNovo = () => {
    setForm(FORM_VAZIO)
    setErro(null)
    setModalAberto(true)
  }

  const abrirEdicao = (kpi: KpiPersonalizadoRecord) => {
    setForm({
      id: kpi.id,
      nome: kpi.nome,
      metrica_base: kpi.metrica_base,
      operador: kpi.operador,
      metrica_secundaria: kpi.metrica_secundaria || '',
    })
    setErro(null)
    setModalAberto(true)
  }

  const salvar = async () => {
    if (!form.nome.trim()) {
      setErro('Informe o nome do KPI.')
      return
    }
    if (form.operador !== 'nenhum' && !form.metrica_secundaria) {
      setErro('Selecione a segunda métrica da fórmula.')
      return
    }
    if (!empresaId) {
      setErro('Nenhuma empresa ativa.')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        empresa: empresaId,
        nome: form.nome.trim(),
        metrica_base: form.metrica_base,
        operador: form.operador,
        metrica_secundaria: form.operador === 'nenhum' ? '' : form.metrica_secundaria,
        ativo: true,
      }
      if (form.id) {
        await kpisPersonalizadosService.update(form.id, payload)
      } else {
        await kpisPersonalizadosService.create(payload)
      }
      setModalAberto(false)
      await carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar o KPI.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (id: string) => {
    if (!window.confirm('Excluir este KPI personalizado? Esta ação não pode ser desfeita.')) return
    setExcluindoId(id)
    const ok = await kpisPersonalizadosService.remove(id)
    setExcluindoId(null)
    if (ok) await carregar()
  }

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
              Meus KPIs Personalizados
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Crie indicadores próprios combinando métricas do exercício {anoAtivo} (ex.: Receita ÷
            EBITDA). Sem dado disponível, exibimos “—” — nunca zero.
          </CardDescription>
        </div>
        <Button size="sm" onClick={abrirNovo} className="gap-1.5 h-8 text-xs cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          Novo KPI
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        {carregando ? (
          <div className="flex items-center justify-center py-6 text-xs text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando KPIs...
          </div>
        ) : kpis.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
            Nenhum KPI personalizado ainda. Clique em “Novo KPI” para criar o seu primeiro.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kpis.map((kpi) => {
              const { valor, unidade, formula } = calcularFormula(kpi, valoresAnoAtivo)
              return (
                <div
                  key={kpi.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                      {kpi.nome}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Editar ${kpi.nome}`}
                        onClick={() => abrirEdicao(kpi)}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir ${kpi.nome}`}
                        onClick={() => excluir(kpi.id)}
                        disabled={excluindoId === kpi.id}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer disabled:opacity-50"
                      >
                        {excluindoId === kpi.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Badge className="text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-800 w-fit">
                    {formula}
                  </Badge>
                  <div className="text-lg font-mono font-black text-[#0B1F3A] dark:text-white">
                    {formatarValorKpi(valor, unidade)}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Exercício {anoAtivo}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal de criação/edição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar KPI' : 'Novo KPI Personalizado'}</DialogTitle>
            <DialogDescription>
              Combine uma métrica base com um operador e uma segunda métrica. O valor é calculado
              sobre as consolidações do exercício ativo ({anoAtivo}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="kpi-nome" className="text-xs font-semibold">
                Nome do KPI
              </Label>
              <Input
                id="kpi-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Receita por EBITDA"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs font-semibold">Métrica A</Label>
                <Select
                  value={form.metrica_base}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, metrica_base: val as KpiMetrica }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {KPI_METRICAS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs font-semibold">Operador</Label>
                <Select
                  value={form.operador}
                  onValueChange={(val) => setForm((f) => ({ ...f, operador: val as KpiOperador }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERADORES.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs font-semibold">Métrica B</Label>
                <Select
                  value={form.metrica_secundaria || 'none'}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      metrica_secundaria: val === 'none' ? '' : (val as KpiMetrica),
                    }))
                  }
                  disabled={form.operador === 'nenhum'}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      —
                    </SelectItem>
                    {KPI_METRICAS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {erro && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{erro}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalAberto(false)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvar}
              disabled={salvando}
              className="cursor-pointer gap-1.5"
            >
              {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {form.id ? 'Salvar alterações' : 'Criar KPI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
