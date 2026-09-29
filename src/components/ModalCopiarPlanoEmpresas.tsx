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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  planoContasService,
  contasService,
  centrosService,
  tiposDespesaService,
} from '@/services/financeService'
import {
  planoContasLoteService,
  type ResultadoCopiarPlanoEmpresa,
} from '@/services/planoContasLoteService'
import type {
  EmpresaRecord,
  PlanoContaRecord,
  ContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  TipoConta,
} from '@/types/finance'
import {
  Copy,
  AlertTriangle,
  Loader2,
  Search,
  Building2,
  ArrowRight,
  FolderSync,
  Layers,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react'

export interface ModalCopiarPlanoEmpresasProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresas: EmpresaRecord[]
  empresaDestinoPadraoId?: string
  onSuccess: () => void
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

export const ModalCopiarPlanoEmpresas: React.FC<ModalCopiarPlanoEmpresasProps> = ({
  open,
  onOpenChange,
  empresas,
  empresaDestinoPadraoId,
  onSuccess,
}) => {
  const { toast } = useToast()

  // Seleção de empresas
  const [origemId, setOrigemId] = useState<string>('')
  const [destinoId, setDestinoId] = useState<string>('')

  // Opções de cópia
  const [modo, setModo] = useState<'adicionar' | 'substituir'>('adicionar')
  const [copiarCentrosCusto, setCopiarCentrosCusto] = useState(true)
  const [confirmarSubstituicao, setConfirmarSubstituicao] = useState(false)

  // Dados carregados para prévia
  const [loadingPrevia, setLoadingPrevia] = useState(false)
  const [itensOrigem, setItensOrigem] = useState<PlanoContaRecord[]>([])
  const [itensDestino, setItensDestino] = useState<PlanoContaRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [tipos, setTipos] = useState<TipoDespesaRecord[]>([])

  // Filtros da prévia
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  // Estado de execução
  const [executando, setExecutando] = useState(false)
  const [progresso, setProgresso] = useState<{
    fase: string
    atual: number
    total: number
    percentual: number
  } | null>(null)

  // Inicializa seletores ao abrir
  useEffect(() => {
    if (!open) {
      setConfirmarSubstituicao(false)
      setProgresso(null)
      return
    }

    const dest = empresaDestinoPadraoId || (empresas.length > 0 ? empresas[0].id : '')
    setDestinoId(dest)

    // Origem: pega uma empresa diferente do destino se possível
    const outra = empresas.find((e) => e.id !== dest)
    setOrigemId(outra ? outra.id : '')
    setModo('adicionar')
    setConfirmarSubstituicao(false)
  }, [open, empresaDestinoPadraoId, empresas])

  // Lookups
  const contaMap = useMemo(() => {
    const m = new Map<string, ContaRecord>()
    for (const c of contas) m.set(c.id, c)
    return m
  }, [contas])

  const centroMap = useMemo(() => {
    const m = new Map<string, CentroRecord>()
    for (const ce of centros) m.set(ce.id, ce)
    return m
  }, [centros])

  const tipoMap = useMemo(() => {
    const m = new Map<string, TipoDespesaRecord>()
    for (const t of tipos) m.set(t.id, t)
    return m
  }, [tipos])

  // Carrega itens da origem e do destino para calcular prévia
  useEffect(() => {
    if (!open || !origemId || !destinoId || origemId === destinoId) {
      setItensOrigem([])
      setItensDestino([])
      return
    }

    let isCurrent = true
    setLoadingPrevia(true)

    Promise.all([
      planoContasService.getAll({ empresaId: origemId }),
      planoContasService.getAll({ empresaId: destinoId }),
      contasService.getAll(),
      centrosService.getAll(),
      tiposDespesaService.getAll(),
    ])
      .then(([origemList, destinoList, contasList, centrosList, tiposList]) => {
        if (!isCurrent) return
        setItensOrigem(origemList)
        setItensDestino(destinoList)
        setContas(contasList)
        setCentros(centrosList)
        setTipos(tiposList)
      })
      .catch((err) => {
        if (!isCurrent) return
        console.error('Erro ao carregar pré-visualização:', err)
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar prévia',
          description: 'Não foi possível carregar os planos das empresas selecionadas.',
        })
      })
      .finally(() => {
        if (isCurrent) setLoadingPrevia(false)
      })

    return () => {
      isCurrent = false
    }
  }, [open, origemId, destinoId, toast])

  const empresaOrigem = useMemo(() => empresas.find((e) => e.id === origemId), [empresas, origemId])
  const empresaDestino = useMemo(
    () => empresas.find((e) => e.id === destinoId),
    [empresas, destinoId],
  )

  // Cálculo de pré-visualização: quantas serão copiadas e quantas puladas
  const previaCalculada = useMemo(() => {
    if (!origemId || !destinoId || origemId === destinoId) {
      return {
        totalOrigem: 0,
        totalDestinoAtual: itensDestino.length,
        totalSeraoAdicionadas: 0,
        totalSeraoPuladas: 0,
        agrupamentoPorTipo: {} as Record<TipoConta, { novas: number; puladas: number }>,
      }
    }

    // Se modo substituir: todas da origem serão copiadas
    if (modo === 'substituir') {
      const agrupamento: Record<TipoConta, { novas: number; puladas: number }> = {
        Ativo: { novas: 0, puladas: 0 },
        Passivo: { novas: 0, puladas: 0 },
        'Patrimônio Líquido': { novas: 0, puladas: 0 },
        Receita: { novas: 0, puladas: 0 },
        Despesa: { novas: 0, puladas: 0 },
      }

      for (const it of itensOrigem) {
        const c = it.expand?.conta || contaMap.get(it.conta)
        const tipo: TipoConta = c?.tipo || 'Despesa'
        if (agrupamento[tipo]) {
          agrupamento[tipo].novas++
        }
      }

      return {
        totalOrigem: itensOrigem.length,
        totalDestinoAtual: itensDestino.length,
        totalSeraoAdicionadas: itensOrigem.length,
        totalSeraoPuladas: 0,
        agrupamentoPorTipo: agrupamento,
      }
    }

    // Modo adicionar: calcular quem já existe no destino
    const codigosDestino = new Set<string>()
    const tuplasDestino = new Set<string>()

    for (const it of itensDestino) {
      if (it.codigo_empresa && it.codigo_empresa.trim()) {
        codigosDestino.add(normalizar(it.codigo_empresa))
      }
      const c = it.expand?.conta || contaMap.get(it.conta)
      const ce = it.expand?.centro || centroMap.get(it.centro)
      if (c?.nome) {
        tuplasDestino.add(`${normalizar(c.nome)}::${normalizar(ce?.nome || '')}`)
      }
    }

    let novas = 0
    let puladas = 0
    const agrupamento: Record<TipoConta, { novas: number; puladas: number }> = {
      Ativo: { novas: 0, puladas: 0 },
      Passivo: { novas: 0, puladas: 0 },
      'Patrimônio Líquido': { novas: 0, puladas: 0 },
      Receita: { novas: 0, puladas: 0 },
      Despesa: { novas: 0, puladas: 0 },
    }

    for (const it of itensOrigem) {
      const c = it.expand?.conta || contaMap.get(it.conta)
      const ce = it.expand?.centro || centroMap.get(it.centro)
      const tipo: TipoConta = c?.tipo || 'Despesa'

      const codNorm = it.codigo_empresa ? normalizar(it.codigo_empresa) : ''
      const tuplaNorm = `${normalizar(c?.nome || '')}::${normalizar(ce?.nome || '')}`

      const jaExiste =
        (codNorm && codigosDestino.has(codNorm)) || (c?.nome && tuplasDestino.has(tuplaNorm))

      if (jaExiste) {
        puladas++
        if (agrupamento[tipo]) agrupamento[tipo].puladas++
      } else {
        novas++
        if (agrupamento[tipo]) agrupamento[tipo].novas++
      }
    }

    return {
      totalOrigem: itensOrigem.length,
      totalDestinoAtual: itensDestino.length,
      totalSeraoAdicionadas: novas,
      totalSeraoPuladas: puladas,
      agrupamentoPorTipo: agrupamento,
    }
  }, [origemId, destinoId, modo, itensOrigem, itensDestino, contaMap, centroMap])

  // Itens da origem filtrados para a tabela de pré-visualização
  const itensOrigemFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itensOrigem.filter((it) => {
      const c = it.expand?.conta || contaMap.get(it.conta)
      const ce = it.expand?.centro || centroMap.get(it.centro)
      const tp =
        it.expand?.tipo_despesa || (it.tipo_despesa ? tipoMap.get(it.tipo_despesa) : undefined)

      if (filtroTipo !== 'todos' && c?.tipo !== filtroTipo) {
        return false
      }

      if (!q) return true

      const codigo = (it.codigo || '').toLowerCase()
      const codigoEmpresa = (it.codigo_empresa || '').toLowerCase()
      const nomeConta = (c?.nome || '').toLowerCase()
      const grupoConta = (c?.grupo || '').toLowerCase()
      const nomeCentro = (ce?.nome || '').toLowerCase()
      const nomeTipo = (tp?.nome || '').toLowerCase()
      const desc = (it.descricao || '').toLowerCase()

      return (
        codigo.includes(q) ||
        codigoEmpresa.includes(q) ||
        nomeConta.includes(q) ||
        grupoConta.includes(q) ||
        nomeCentro.includes(q) ||
        nomeTipo.includes(q) ||
        desc.includes(q)
      )
    })
  }, [itensOrigem, busca, filtroTipo, contaMap, centroMap, tipoMap])

  // Execução da cópia
  const handleExecutarCopia = async () => {
    if (!origemId || !destinoId) {
      toast({
        variant: 'destructive',
        title: 'Selecione as empresas',
        description: 'Informe tanto a empresa de origem quanto a de destino.',
      })
      return
    }

    if (origemId === destinoId) {
      toast({
        variant: 'destructive',
        title: 'Empresas iguais',
        description: 'A empresa de origem e destino devem ser diferentes.',
      })
      return
    }

    if (itensOrigem.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Plano de origem vazio',
        description: 'A empresa de origem não possui contas no plano para copiar.',
      })
      return
    }

    // Se for modo substituir e ainda não tiver clicado no checkbox de confirmação
    if (modo === 'substituir' && !confirmarSubstituicao) {
      toast({
        variant: 'destructive',
        title: 'Confirmação obrigatória',
        description:
          'Marque a caixa de confirmação para autorizar a substituição destrutiva do plano de contas.',
      })
      return
    }

    setExecutando(true)
    setProgresso({ fase: 'Iniciando cópia...', atual: 0, total: itensOrigem.length, percentual: 5 })

    try {
      const resultado: ResultadoCopiarPlanoEmpresa =
        await planoContasLoteService.copiarPlanoEntreEmpresas({
          origemEmpresaId: origemId,
          destinoEmpresaId: destinoId,
          modo,
          copiarCentrosCusto,
          onProgress: (p) => setProgresso(p),
        })

      const resumoMsg: string[] = []
      if (resultado.totalCopiados > 0) {
        resumoMsg.push(`${resultado.totalCopiados} conta(s) copiada(s)`)
      }
      if (resultado.totalIgnoradosDuplicados > 0) {
        resumoMsg.push(`${resultado.totalIgnoradosDuplicados} já existiam (puladas)`)
      }
      if (resultado.totalRemovidosAnteriores > 0) {
        resumoMsg.push(`${resultado.totalRemovidosAnteriores} anterior(es) removida(s)`)
      }
      if (resultado.totalErros > 0) {
        resumoMsg.push(`${resultado.totalErros} erro(s)`)
      }

      toast({
        title:
          resultado.totalErros > 0
            ? 'Cópia concluída com ressalvas'
            : 'Plano de Contas copiado com sucesso!',
        description: `${resumoMsg.join(', ')}. Destino: ${empresaDestino?.nome || ''}.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro na cópia de plano:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na cópia',
        description: err?.message || 'Ocorreu um erro ao copiar o plano de contas entre empresas.',
      })
    } finally {
      setExecutando(false)
      setProgresso(null)
    }
  }

  const podeExecutar =
    !executando &&
    !loadingPrevia &&
    !!origemId &&
    !!destinoId &&
    origemId !== destinoId &&
    itensOrigem.length > 0 &&
    (modo !== 'substituir' || confirmarSubstituicao)

  return (
    <Dialog open={open} onOpenChange={executando ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] flex flex-col bg-white p-0 gap-0 overflow-hidden">
        {/* Cabeçalho */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                Copiar Plano de Contas entre Empresas
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Replique a estrutura contábil e operacional de uma empresa existente para outra,
                mantendo a integridade dos dados e o isolamento multi-tenant.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Seletor de Origem e Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl items-center">
            {/* Origem */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Empresa de Origem (de onde virá) *
              </Label>
              <Select
                value={origemId}
                onValueChange={(val) => setOrigemId(val)}
                disabled={executando}
              >
                <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                  <SelectValue placeholder="Selecione a empresa de origem" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem
                      key={emp.id}
                      value={emp.id}
                      disabled={emp.id === destinoId}
                      className="text-xs"
                    >
                      {emp.nome} ({emp.segmento || 'Empresa'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] text-slate-500 block">
                {itensOrigem.length} conta(s) cadastrada(s)
              </span>
            </div>

            {/* Destino */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Empresa de Destino (para onde copiar) *
              </Label>
              <Select
                value={destinoId}
                onValueChange={(val) => setDestinoId(val)}
                disabled={executando}
              >
                <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                  <SelectValue placeholder="Selecione a empresa de destino" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem
                      key={emp.id}
                      value={emp.id}
                      disabled={emp.id === origemId}
                      className="text-xs"
                    >
                      {emp.nome} ({emp.segmento || 'Empresa'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] text-slate-500 block">
                {itensDestino.length} conta(s) atualmente no destino
              </span>
            </div>
          </div>

          {/* Opções de Cópia */}
          <div className="p-3.5 border border-slate-200 rounded-xl space-y-3 bg-white">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Modo de Operação
            </span>

            <RadioGroup
              value={modo}
              onValueChange={(val: 'adicionar' | 'substituir') => {
                setModo(val)
                if (val !== 'substituir') setConfirmarSubstituicao(false)
              }}
              disabled={executando}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              {/* Opção Adicionar */}
              <label
                htmlFor="modo-adicionar"
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  modo === 'adicionar'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <RadioGroupItem value="adicionar" id="modo-adicionar" className="mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-xs font-semibold block">
                    Adicionar às existentes (Recomendado)
                  </strong>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Copia novas contas da origem e pula códigos ou nomes que já existam na empresa
                    de destino, sem apagar nenhum dado atual.
                  </p>
                </div>
              </label>

              {/* Opção Substituir */}
              <label
                htmlFor="modo-substituir"
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  modo === 'substituir'
                    ? 'border-red-500 bg-red-50/60 text-red-950'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <RadioGroupItem
                  value="substituir"
                  id="modo-substituir"
                  className="mt-0.5 text-red-600"
                />
                <div className="space-y-0.5">
                  <strong className="text-xs font-semibold block text-red-700 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    Substituir plano existente (Destrutivo)
                  </strong>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Remove todas as contas atuais do plano da empresa de destino antes de recriar as
                    contas a partir da origem.
                  </p>
                </div>
              </label>
            </RadioGroup>

            {/* Opção Vínculo com Centros de Custo */}
            <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5">
              <Checkbox
                id="copiar-centros"
                checked={copiarCentrosCusto}
                onCheckedChange={(c) => setCopiarCentrosCusto(!!c)}
                disabled={executando}
                className="mt-0.5"
              />
              <label
                htmlFor="copiar-centros"
                className="text-[11px] text-slate-700 cursor-pointer leading-tight select-none"
              >
                <strong>Preservar e replicar centros de custo:</strong> se marcado, os centros de
                custo vinculados na origem serão mapeados para centros de mesmo nome na empresa de
                destino (ou criados caso inexistentes). Se desmarcado, utiliza centros padrão
                coerentes com o tipo da conta.
              </label>
            </div>
          </div>

          {/* Aviso Destrutivo em Vermelho caso modo Substituir */}
          {modo === 'substituir' && itensDestino.length > 0 && (
            <Alert variant="destructive" className="bg-red-50 border-red-300 text-red-900 py-3">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div className="ml-2">
                <AlertTitle className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                  Atenção: Operação Destrutiva na Empresa de Destino
                </AlertTitle>
                <AlertDescription className="text-[11px] text-red-800 mt-1 leading-relaxed">
                  A empresa de destino <strong>{empresaDestino?.nome}</strong> já possui{' '}
                  <strong>{itensDestino.length} conta(s)</strong> cadastradas no plano de contas. Ao
                  confirmar a substituição, estes registros serão{' '}
                  <strong>excluídos permanentemente</strong> e substituídos pelas{' '}
                  <strong>{itensOrigem.length} conta(s)</strong> da empresa de origem.
                  <div className="mt-2.5 pt-2 border-t border-red-200 flex items-center gap-2">
                    <Checkbox
                      id="check-confirmar-substituicao"
                      checked={confirmarSubstituicao}
                      onCheckedChange={(c) => setConfirmarSubstituicao(!!c)}
                      disabled={executando}
                      className="border-red-400 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                    />
                    <label
                      htmlFor="check-confirmar-substituicao"
                      className="font-bold text-red-950 cursor-pointer text-xs select-none"
                    >
                      Estou ciente de que os vínculos anteriores do destino serão removidos e desejo
                      continuar.
                    </label>
                  </div>
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Cards de Pré-Visualização / Totais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">
                Contas na Origem
              </span>
              <strong className="text-sm font-bold text-[#0B1F3A]">
                {previaCalculada.totalOrigem}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] font-semibold uppercase text-emerald-700 block">
                Serão Adicionadas
              </span>
              <strong className="text-sm font-bold text-emerald-900">
                {previaCalculada.totalSeraoAdicionadas}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200">
              <span className="text-[10px] font-semibold uppercase text-amber-700 block">
                {modo === 'substituir' ? 'Removidas do Destino' : 'Puladas (Já Existem)'}
              </span>
              <strong className="text-sm font-bold text-amber-900">
                {modo === 'substituir'
                  ? previaCalculada.totalDestinoAtual
                  : previaCalculada.totalSeraoPuladas}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200">
              <span className="text-[10px] font-semibold uppercase text-blue-700 block">
                Total Final Estimado
              </span>
              <strong className="text-sm font-bold text-blue-900">
                {modo === 'substituir'
                  ? previaCalculada.totalSeraoAdicionadas
                  : previaCalculada.totalDestinoAtual + previaCalculada.totalSeraoAdicionadas}
              </strong>
            </div>
          </div>

          {/* Breakdown por Tipo / Grupo de Contas */}
          <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-lg flex flex-wrap gap-3 items-center justify-between">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Distribuição por Tipo na Origem:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {(
                ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa'] as TipoConta[]
              ).map((tipo) => {
                const info = previaCalculada.agrupamentoPorTipo[tipo]
                const qtd = info ? info.novas + info.puladas : 0
                if (qtd === 0) return null
                return (
                  <Badge
                    key={tipo}
                    variant="outline"
                    className={`text-[10px] font-medium px-2 py-0.5 border ${
                      TIPO_CONTA_BADGE[tipo] || ''
                    }`}
                  >
                    {tipo}: {qtd}
                    {modo === 'adicionar' && info?.puladas > 0 && (
                      <span className="text-[9px] opacity-75 ml-1">
                        ({info.puladas} existentes)
                      </span>
                    )}
                  </Badge>
                )
              })}
            </div>
          </div>

          {/* Barra de Filtros e Busca na Prévia */}
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filtrar contas da origem por código, nome, centro..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 text-xs pl-8 bg-white"
                disabled={executando}
              />
            </div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 font-medium focus:ring-1 focus:ring-blue-600 w-full sm:w-44"
              disabled={executando}
            >
              <option value="todos">Todos os tipos</option>
              <option value="Ativo">Ativo</option>
              <option value="Passivo">Passivo</option>
              <option value="Patrimônio Líquido">Patrimônio Líquido</option>
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>
          </div>

          {/* Tabela de Prévia das Contas da Origem */}
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[240px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                <tr className="text-slate-600 font-semibold text-[11px]">
                  <th className="py-2 px-3 w-16">Cód.</th>
                  <th className="py-2 px-3">Conta Contábil</th>
                  <th className="py-2 px-3">Tipo / Grupo</th>
                  <th className="py-2 px-3">Centro de Custo</th>
                  <th className="py-2 px-3">Cód. Empresa</th>
                  <th className="py-2 px-3 w-28">Ação Prevista</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingPrevia ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-1" />
                      Carregando dados das empresas...
                    </td>
                  </tr>
                ) : itensOrigemFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Nenhuma conta localizada para cópia com os critérios selecionados.
                    </td>
                  </tr>
                ) : (
                  itensOrigemFiltrados.map((it) => {
                    const c = it.expand?.conta || contaMap.get(it.conta)
                    const ce = it.expand?.centro || centroMap.get(it.centro)
                    const tp =
                      it.expand?.tipo_despesa ||
                      (it.tipo_despesa ? tipoMap.get(it.tipo_despesa) : undefined)
                    const tipo: TipoConta = c?.tipo || 'Despesa'

                    // Verifica se já existe no destino
                    const codNorm = it.codigo_empresa ? normalizar(it.codigo_empresa) : ''
                    const tuplaNorm = `${normalizar(c?.nome || '')}::${normalizar(ce?.nome || '')}`
                    const jaExiste =
                      modo === 'adicionar' &&
                      itensDestino.some((destIt) => {
                        const destCod = destIt.codigo_empresa
                          ? normalizar(destIt.codigo_empresa)
                          : ''
                        const destC = destIt.expand?.conta || contaMap.get(destIt.conta)
                        const destCe = destIt.expand?.centro || centroMap.get(destIt.centro)
                        const destTupla = `${normalizar(destC?.nome || '')}::${normalizar(
                          destCe?.nome || '',
                        )}`
                        return (codNorm && destCod === codNorm) || tuplaNorm === destTupla
                      })

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-500 font-semibold text-[11px]">
                          {it.codigo || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <strong className="text-slate-900 block font-semibold">
                            {c?.nome || 'Conta sem nome'}
                          </strong>
                          {it.descricao && (
                            <span className="text-[10px] text-slate-500 block truncate max-w-xs">
                              {it.descricao}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              className={`text-[9px] font-semibold px-1.5 py-0 border w-fit ${
                                TIPO_CONTA_BADGE[tipo] || ''
                              }`}
                            >
                              {tipo}
                            </Badge>
                            {c?.grupo && (
                              <span className="text-[10px] text-slate-500">{c.grupo}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium">
                          {ce?.nome || '—'}
                          {tp?.nome && (
                            <span className="block text-[10px] text-slate-500">{tp.nome}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                          {it.codigo_empresa || '—'}
                        </td>
                        <td className="py-2 px-3">
                          {modo === 'substituir' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Criar
                            </span>
                          ) : jaExiste ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Pular (existe)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Adicionar
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Progresso durante a cópia */}
          {progresso && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5 animate-fadeIn">
              <div className="flex justify-between text-xs font-semibold text-blue-900">
                <span>{progresso.fase}</span>
                <span>{progresso.percentual}%</span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-150"
                  style={{ width: `${progresso.percentual}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Multi-tenant isolado: os registros gerados pertencerão à empresa destino.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={executando}
              className="text-xs h-9"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleExecutarCopia}
              disabled={!podeExecutar}
              className={`text-xs h-9 font-semibold text-white shadow-xs gap-1.5 ${
                modo === 'substituir'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {executando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Copiando Plano...
                </>
              ) : modo === 'substituir' ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Confirmar Substituição do Plano
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Plano de Contas
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
