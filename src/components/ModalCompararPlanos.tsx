import React, { useState, useEffect, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  planoContasService,
  contasService,
  centrosService,
  tiposDespesaService,
} from '@/services/financeService'
import type {
  EmpresaRecord,
  PlanoContaRecord,
  ContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  TipoConta,
} from '@/types/finance'
import { sanitizeNomeArquivo } from '@/lib/exportacaoPlanoContas'
import {
  GitCompare,
  ArrowRightLeft,
  Download,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  HelpCircle,
  Loader2,
  Filter,
} from 'lucide-react'

export interface ModalCompararPlanosProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresas: EmpresaRecord[]
  empresaInicialId?: string
}

interface ItemComparado {
  id: string
  codigoA?: string
  codigoB?: string
  contaNome: string
  contaCodigo?: string
  tipoConta: TipoConta
  centroNomeA?: string
  centroNomeB?: string
  tipoDespesaNomeA?: string
  tipoDespesaNomeB?: string
  presenteEmA: boolean
  presenteEmB: boolean
  temDivergencia: boolean
  divergenciaDetalhe?: string
}

const TIPO_CONTA_BADGE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200',
}

function normalizar(str?: string | null): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export const ModalCompararPlanos: React.FC<ModalCompararPlanosProps> = ({
  open,
  onOpenChange,
  empresas,
  empresaInicialId,
}) => {
  const { toast } = useToast()

  // IDs das duas empresas selecionadas
  const [empresaAId, setEmpresaAId] = useState<string>('')
  const [empresaBId, setEmpresaBId] = useState<string>('')

  // Dados carregados
  const [loading, setLoading] = useState(false)
  const [itensA, setItensA] = useState<PlanoContaRecord[]>([])
  const [itensB, setItensB] = useState<PlanoContaRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [tipos, setTipos] = useState<TipoDespesaRecord[]>([])

  // Filtros internos do modal
  const [busca, setBusca] = useState('')
  const [abaAtiva, setAbaAtiva] = useState<'todas' | 'soA' | 'soB' | 'comum' | 'divergencias'>(
    'todas',
  )
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  // Inicializa seletores de empresa quando o modal abre
  useEffect(() => {
    if (!open) return
    const initialA = empresaInicialId || (empresas.length > 0 ? empresas[0].id : '')
    setEmpresaAId(initialA)

    const outra = empresas.find((e) => e.id !== initialA)
    setEmpresaBId(outra ? outra.id : '')
  }, [open, empresaInicialId, empresas])

  // Lookups globais de Conta, Centro e Tipo de Despesa
  const contaMap = useMemo(() => {
    const m = new Map<string, ContaRecord>()
    for (const c of contas) m.set(c.id, c)
    return m
  }, [contas])

  const centroMap = useMemo(() => {
    const m = new Map<string, CentroRecord>()
    for (const c of centros) m.set(c.id, c)
    return m
  }, [centros])

  const tipoMap = useMemo(() => {
    const m = new Map<string, TipoDespesaRecord>()
    for (const t of tipos) m.set(t.id, t)
    return m
  }, [tipos])

  // Carrega catálogo global e itens das duas empresas selecionadas
  const carregarComparativo = async () => {
    if (!empresaAId || !empresaBId) return
    setLoading(true)
    try {
      const [listA, listB, contasList, centrosList, tiposList] = await Promise.all([
        planoContasService.getAll({ empresaId: empresaAId }),
        planoContasService.getAll({ empresaId: empresaBId }),
        contasService.getAll(),
        centrosService.getAll(),
        tiposDespesaService.getAll(),
      ])
      setItensA(listA)
      setItensB(listB)
      setContas(contasList)
      setCentros(centrosList)
      setTipos(tiposList)
    } catch (err) {
      console.error('Erro ao carregar dados do comparativo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no comparativo',
        description: 'Não foi possível carregar os planos de contas das empresas selecionadas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && empresaAId && empresaBId && empresaAId !== empresaBId) {
      carregarComparativo()
    } else {
      setItensA([])
      setItensB([])
    }
  }, [open, empresaAId, empresaBId])

  const empresaA = useMemo(() => empresas.find((e) => e.id === empresaAId), [empresas, empresaAId])
  const empresaB = useMemo(() => empresas.find((e) => e.id === empresaBId), [empresas, empresaBId])

  // Inverte seleção de A e B
  const handleInverterEmpresas = () => {
    const oldA = empresaAId
    const oldB = empresaBId
    setEmpresaAId(oldB)
    setEmpresaBId(oldA)
  }

  // Montagem da matriz de comparação
  // 1. Mapeia por chave conceitual da conta (nome normalizado + tipo) e também cruza códigos contábeis/plano
  const comparacao = useMemo(() => {
    if (!empresaAId || !empresaBId || empresaAId === empresaBId) {
      return {
        itens: [] as ItemComparado[],
        totalA: 0,
        totalB: 0,
        soA: 0,
        soB: 0,
        emComum: 0,
        divergencias: 0,
      }
    }

    // Mapa de itens de A por contaId e por nomeNormalizado
    const mapaItensA = new Map<string, PlanoContaRecord[]>()
    for (const it of itensA) {
      const arr = mapaItensA.get(it.conta) || []
      arr.push(it)
      mapaItensA.set(it.conta, arr)
    }

    // Mapa de itens de B por contaId
    const mapaItensB = new Map<string, PlanoContaRecord[]>()
    for (const it of itensB) {
      const arr = mapaItensB.get(it.conta) || []
      arr.push(it)
      mapaItensB.set(it.conta, arr)
    }

    // Identificar contas presentes em A e contas em B
    // Além do ID de Conta, agrupamos por Nome normalizado de Conta para detectar mesmo nome com IDs distintos
    const contasNormalizadasMap = new Map<
      string,
      { nome: string; tipo: TipoConta; codigo?: string }
    >()
    const contasUsadasEmA = new Set<string>()
    const contasUsadasEmB = new Set<string>()

    const codigoPlanoA = new Map<string, string>() // chave: normConta -> codigos plano A
    const codigoPlanoB = new Map<string, string>() // chave: normConta -> codigos plano B
    const centrosA = new Map<string, string>()
    const centrosB = new Map<string, string>()
    const tiposA = new Map<string, string>()
    const tiposB = new Map<string, string>()

    for (const it of itensA) {
      const c = contaMap.get(it.conta)
      if (!c) continue
      const norm = normalizar(c.nome)
      contasUsadasEmA.add(norm)
      if (!contasNormalizadasMap.has(norm)) {
        contasNormalizadasMap.set(norm, { nome: c.nome, tipo: c.tipo, codigo: c.codigo })
      }
      if (it.codigo) {
        const prev = codigoPlanoA.get(norm)
        codigoPlanoA.set(norm, prev ? `${prev}, ${it.codigo}` : it.codigo)
      }
      const ce = centroMap.get(it.centro)
      if (ce) centrosA.set(norm, ce.nome)
      const tp = it.tipo_despesa ? tipoMap.get(it.tipo_despesa) : undefined
      if (tp) tiposA.set(norm, tp.nome)
    }

    for (const it of itensB) {
      const c = contaMap.get(it.conta)
      if (!c) continue
      const norm = normalizar(c.nome)
      contasUsadasEmB.add(norm)
      if (!contasNormalizadasMap.has(norm)) {
        contasNormalizadasMap.set(norm, { nome: c.nome, tipo: c.tipo, codigo: c.codigo })
      }
      if (it.codigo) {
        const prev = codigoPlanoB.get(norm)
        codigoPlanoB.set(norm, prev ? `${prev}, ${it.codigo}` : it.codigo)
      }
      const ce = centroMap.get(it.centro)
      if (ce) centrosB.set(norm, ce.nome)
      const tp = it.tipo_despesa ? tipoMap.get(it.tipo_despesa) : undefined
      if (tp) tiposB.set(norm, tp.nome)
    }

    // Todas as chaves únicas de contas
    const todasChaves = new Set<string>([...contasUsadasEmA, ...contasUsadasEmB])

    // Também verificar contas que tenham o mesmo código de conta cadastrado, mas nomes divergentes
    // ex: Conta código "1.1.01" chamada "Caixa" em A vs "Caixa Geral" em B
    const codigosContasA = new Map<string, string>() // codigo -> normConta
    for (const norm of contasUsadasEmA) {
      const c = contasNormalizadasMap.get(norm)
      if (c?.codigo && c.codigo.trim()) {
        codigosContasA.set(c.codigo.trim().toLowerCase(), norm)
      }
    }

    const itensComparados: ItemComparado[] = []
    let soA = 0
    let soB = 0
    let emComum = 0
    let divergencias = 0

    for (const norm of todasChaves) {
      const meta = contasNormalizadasMap.get(norm)!
      const emA = contasUsadasEmA.has(norm)
      const emB = contasUsadasEmB.has(norm)

      const codA = codigoPlanoA.get(norm)
      const codB = codigoPlanoB.get(norm)
      const ceA = centrosA.get(norm)
      const ceB = centrosB.get(norm)
      const tpA = tiposA.get(norm)
      const tpB = tiposB.get(norm)

      let temDivergencia = false
      let divergenciaDetalhe: string | undefined

      if (emA && emB) {
        emComum++
        // Divergência de Centro ou Tipo de Despesa entre empresas
        const diffs: string[] = []
        if (ceA && ceB && ceA !== ceB) {
          diffs.push(`Centros distintos: "${ceA}" vs "${ceB}"`)
        }
        if (tpA !== tpB && (tpA || tpB)) {
          diffs.push(`Tipos de despesa: "${tpA || '—'}" vs "${tpB || '—'}"`)
        }
        if (diffs.length > 0) {
          temDivergencia = true
          divergenciaDetalhe = diffs.join(' · ')
          divergencias++
        }
      } else if (emA) {
        soA++
      } else {
        soB++
      }

      itensComparados.push({
        id: norm,
        codigoA: codA,
        codigoB: codB,
        contaNome: meta.nome,
        contaCodigo: meta.codigo,
        tipoConta: meta.tipo,
        centroNomeA: ceA,
        centroNomeB: ceB,
        tipoDespesaNomeA: tpA,
        tipoDespesaNomeB: tpB,
        presenteEmA: emA,
        presenteEmB: emB,
        temDivergencia,
        divergenciaDetalhe,
      })
    }

    // Ordenação alfabética por tipo e depois por nome da conta
    itensComparados.sort((a, b) => {
      if (a.tipoConta !== b.tipoConta) return a.tipoConta.localeCompare(b.tipoConta)
      return a.contaNome.localeCompare(b.contaNome)
    })

    return {
      itens: itensComparados,
      totalA: itensA.length,
      totalB: itensB.length,
      soA,
      soB,
      emComum,
      divergencias,
    }
  }, [itensA, itensB, contaMap, centroMap, tipoMap, empresaAId, empresaBId])

  // Filtragem da lista
  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return comparacao.itens.filter((item) => {
      // Filtro por tipo de conta
      if (filtroTipo !== 'todos' && item.tipoConta !== filtroTipo) {
        return false
      }

      // Filtro por aba
      if (abaAtiva === 'soA' && !(item.presenteEmA && !item.presenteEmB)) return false
      if (abaAtiva === 'soB' && !(item.presenteEmB && !item.presenteEmA)) return false
      if (abaAtiva === 'comum' && !(item.presenteEmA && item.presenteEmB)) return false
      if (abaAtiva === 'divergencias' && !item.temDivergencia) return false

      // Busca texto
      if (!q) return true
      return (
        item.contaNome.toLowerCase().includes(q) ||
        (item.contaCodigo || '').toLowerCase().includes(q) ||
        (item.codigoA || '').toLowerCase().includes(q) ||
        (item.codigoB || '').toLowerCase().includes(q) ||
        (item.centroNomeA || '').toLowerCase().includes(q) ||
        (item.centroNomeB || '').toLowerCase().includes(q) ||
        (item.divergenciaDetalhe || '').toLowerCase().includes(q)
      )
    })
  }, [comparacao.itens, busca, abaAtiva, filtroTipo])

  // Exportar Comparativo para CSV
  const handleExportarCsvComparativo = () => {
    if (comparacao.itens.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum dado para exportar',
        description: 'Selecione duas empresas com planos para exportar a comparação.',
      })
      return
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const nomeA = empresaA?.nome || 'Empresa-A'
    const nomeB = empresaB?.nome || 'Empresa-B'
    const dataStr = new Date().toISOString().slice(0, 10)
    const fileName = `comparativo-planos-${sanitizeNomeArquivo(nomeA)}-vs-${sanitizeNomeArquivo(nomeB)}-${dataStr}.csv`

    const colunas = [
      'Conta Contábil',
      'Código Ref.',
      'Tipo de Conta',
      `Presente em ${nomeA}`,
      `Código em ${nomeA}`,
      `Centro em ${nomeA}`,
      `Presente em ${nomeB}`,
      `Código em ${nomeB}`,
      `Centro em ${nomeB}`,
      'Situação Comparativa',
      'Observação / Divergência',
    ]

    const linhas: string[] = []
    linhas.push(colunas.map(escapeCsv).join(';'))

    for (const it of comparacao.itens) {
      let situacao = 'Em comum'
      if (it.presenteEmA && !it.presenteEmB) {
        situacao = `Presente apenas em ${nomeA}`
      } else if (it.presenteEmB && !it.presenteEmA) {
        situacao = `Presente apenas em ${nomeB}`
      } else if (it.temDivergencia) {
        situacao = 'Em comum com divergência'
      }

      linhas.push(
        [
          it.contaNome,
          it.contaCodigo || '',
          it.tipoConta,
          it.presenteEmA ? 'SIM' : 'NÃO',
          it.codigoA || '',
          it.centroNomeA || '',
          it.presenteEmB ? 'SIM' : 'NÃO',
          it.codigoB || '',
          it.centroNomeB || '',
          situacao,
          it.divergenciaDetalhe || '',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    toast({
      title: 'Comparativo exportado com sucesso',
      description: `Arquivo CSV comparando ${nomeA} vs ${nomeB} baixado com sucesso.`,
    })
  }

  const temDuasEmpresas = empresas.length >= 2

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[920px] max-h-[92vh] flex flex-col bg-white p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                Relatório Comparativo de Planos de Contas entre Empresas
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Compare contas presentes, ausentes e divergências estruturais entre duas empresas do
                seu catálogo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {!temDuasEmpresas ? (
            <div className="p-8 text-center space-y-3 bg-amber-50/60 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
              <h3 className="text-sm font-bold text-amber-900">
                É necessário ter pelo menos 2 empresas cadastradas
              </h3>
              <p className="text-xs text-amber-800 max-w-md mx-auto">
                Para comparar planos de contas, cadastre uma segunda empresa no menu Empresas.
                Atualmente você possui apenas {empresas.length} empresa(s).
              </p>
            </div>
          ) : (
            <>
              {/* Seletores de Empresa A e Empresa B */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Empresa A */}
                <div className="flex-1 w-full space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Empresa A (Origem / Referência)
                  </label>
                  <Select value={empresaAId} onValueChange={setEmpresaAId}>
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                      <SelectValue placeholder="Selecione a Empresa A" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome} ({emp.segmento || 'Empresa'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Botão de inversão */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleInverterEmpresas}
                  title="Inverter Empresa A e B"
                  className="h-8 w-8 p-0 rounded-full text-slate-500 hover:text-blue-700 hover:bg-white self-center sm:mt-5"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>

                {/* Empresa B */}
                <div className="flex-1 w-full space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Empresa B (Comparada)
                  </label>
                  <Select value={empresaBId} onValueChange={setEmpresaBId}>
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                      <SelectValue placeholder="Selecione a Empresa B" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome} ({emp.segmento || 'Empresa'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {empresaAId === empresaBId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Selecione duas empresas diferentes para comparar seus planos de contas.
                  </span>
                </div>
              )}

              {/* Cards de Resumo Numérico */}
              {empresaAId && empresaBId && empresaAId !== empresaBId && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Card className="bg-blue-50/50 border-blue-200 shadow-2xs">
                    <CardContent className="p-3">
                      <span className="text-[10px] font-semibold text-blue-700 uppercase block">
                        Total {empresaA?.nome?.slice(0, 10) || 'A'}
                      </span>
                      <strong className="text-base font-bold text-blue-900">
                        {comparacao.totalA} contas
                      </strong>
                    </CardContent>
                  </Card>

                  <Card className="bg-purple-50/50 border-purple-200 shadow-2xs">
                    <CardContent className="p-3">
                      <span className="text-[10px] font-semibold text-purple-700 uppercase block">
                        Total {empresaB?.nome?.slice(0, 10) || 'B'}
                      </span>
                      <strong className="text-base font-bold text-purple-900">
                        {comparacao.totalB} contas
                      </strong>
                    </CardContent>
                  </Card>

                  <Card className="bg-amber-50/60 border-amber-200 shadow-2xs">
                    <CardContent className="p-3">
                      <span className="text-[10px] font-semibold text-amber-800 uppercase block">
                        Ausentes em B
                      </span>
                      <strong className="text-base font-bold text-amber-900">
                        {comparacao.soA}
                      </strong>
                    </CardContent>
                  </Card>

                  <Card className="bg-rose-50/60 border-rose-200 shadow-2xs">
                    <CardContent className="p-3">
                      <span className="text-[10px] font-semibold text-rose-800 uppercase block">
                        Ausentes em A
                      </span>
                      <strong className="text-base font-bold text-rose-900">
                        {comparacao.soB}
                      </strong>
                    </CardContent>
                  </Card>

                  <Card className="bg-emerald-50/60 border-emerald-200 shadow-2xs">
                    <CardContent className="p-3">
                      <span className="text-[10px] font-semibold text-emerald-800 uppercase block">
                        Em Comum
                      </span>
                      <strong className="text-base font-bold text-emerald-900">
                        {comparacao.emComum}
                        {comparacao.divergencias > 0 && (
                          <span className="text-xs font-normal text-amber-700 ml-1">
                            ({comparacao.divergencias} div.)
                          </span>
                        )}
                      </strong>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Barra de Filtros + Abas */}
              {empresaAId && empresaBId && empresaAId !== empresaBId && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                    <div className="relative flex-1 w-full">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar por nome da conta, código ou centro..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="h-8 text-xs pl-8 bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                        className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2 text-slate-700 font-medium focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="todos">Todos os tipos</option>
                        <option value="Ativo">Ativo</option>
                        <option value="Passivo">Passivo</option>
                        <option value="Patrimônio Líquido">Patrimônio Líquido</option>
                        <option value="Receita">Receita</option>
                        <option value="Despesa">Despesa</option>
                      </select>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportarCsvComparativo}
                        disabled={comparacao.itens.length === 0}
                        className="h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        Exportar CSV
                      </Button>
                    </div>
                  </div>

                  {/* Tabs de Filtro Rápido */}
                  <Tabs
                    value={abaAtiva}
                    onValueChange={(val) => setAbaAtiva(val as any)}
                    className="w-full"
                  >
                    <TabsList className="grid grid-cols-5 h-8 bg-slate-100 p-0.5">
                      <TabsTrigger value="todas" className="text-[11px] py-1">
                        Todas ({comparacao.itens.length})
                      </TabsTrigger>
                      <TabsTrigger value="soA" className="text-[11px] py-1 text-amber-700">
                        Só em A ({comparacao.soA})
                      </TabsTrigger>
                      <TabsTrigger value="soB" className="text-[11px] py-1 text-purple-700">
                        Só em B ({comparacao.soB})
                      </TabsTrigger>
                      <TabsTrigger value="comum" className="text-[11px] py-1 text-emerald-700">
                        Em Comum ({comparacao.emComum})
                      </TabsTrigger>
                      <TabsTrigger value="divergencias" className="text-[11px] py-1 text-rose-700">
                        Divergências ({comparacao.divergencias})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Tabela de Comparação */}
              {empresaAId && empresaBId && empresaAId !== empresaBId && (
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Carregando e comparando planos...</span>
                    </div>
                  ) : itensFiltrados.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      Nenhuma conta encontrada para o filtro selecionado.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                        <tr className="text-slate-600 font-semibold text-[11px]">
                          <th className="py-2 px-3">Conta Contábil</th>
                          <th className="py-2 px-3">Tipo</th>
                          <th className="py-2 px-3">
                            <span className="text-blue-700 font-bold">
                              {empresaA?.nome || 'Empresa A'}
                            </span>
                          </th>
                          <th className="py-2 px-3">
                            <span className="text-purple-700 font-bold">
                              {empresaB?.nome || 'Empresa B'}
                            </span>
                          </th>
                          <th className="py-2 px-3">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itensFiltrados.map((item) => {
                          const statusA = item.presenteEmA
                          const statusB = item.presenteEmB

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3">
                                <strong className="text-slate-900 block font-semibold">
                                  {item.contaNome}
                                </strong>
                                {item.contaCodigo && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    Ref: {item.contaCodigo}
                                  </span>
                                )}
                              </td>

                              <td className="py-2 px-3">
                                <Badge
                                  className={`text-[9px] font-semibold px-1.5 py-0 border w-fit ${
                                    TIPO_CONTA_BADGE[item.tipoConta] || ''
                                  }`}
                                >
                                  {item.tipoConta}
                                </Badge>
                              </td>

                              {/* Coluna Empresa A */}
                              <td className="py-2 px-3">
                                {statusA ? (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Presente ({item.codigoA || 'PC'})</span>
                                    </div>
                                    {item.centroNomeA && (
                                      <span className="text-[10px] text-slate-500">
                                        Centro: {item.centroNomeA}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                                    <MinusCircle className="w-3.5 h-3.5" />
                                    <span>Ausente</span>
                                  </div>
                                )}
                              </td>

                              {/* Coluna Empresa B */}
                              <td className="py-2 px-3">
                                {statusB ? (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-purple-700 font-semibold text-[11px]">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Presente ({item.codigoB || 'PC'})</span>
                                    </div>
                                    {item.centroNomeB && (
                                      <span className="text-[10px] text-slate-500">
                                        Centro: {item.centroNomeB}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                                    <MinusCircle className="w-3.5 h-3.5" />
                                    <span>Ausente</span>
                                  </div>
                                )}
                              </td>

                              {/* Situação */}
                              <td className="py-2 px-3">
                                {statusA && statusB ? (
                                  item.temDivergencia ? (
                                    <div className="flex flex-col">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 w-fit"
                                      >
                                        Divergência
                                      </Badge>
                                      <span
                                        className="text-[9px] text-amber-900 mt-0.5 max-w-[160px] truncate"
                                        title={item.divergenciaDetalhe}
                                      >
                                        {item.divergenciaDetalhe}
                                      </span>
                                    </div>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 w-fit"
                                    >
                                      Em Comum
                                    </Badge>
                                  )
                                ) : statusA ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-blue-50 text-blue-800 border-blue-200 w-fit"
                                  >
                                    Só em {empresaA?.nome?.slice(0, 8) || 'A'}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-purple-50 text-purple-800 border-purple-200 w-fit"
                                  >
                                    Só em {empresaB?.nome?.slice(0, 8) || 'B'}
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Comparação analítica isolada por empresa e usuário.</span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 w-full sm:w-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
