import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  ArrowUpDown,
  TrendingUp,
  Percent,
  Activity,
  AlertCircle,
  Info,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import { setoresService, type SalvarSetorInput } from '@/services/setoresService'
import { empresasService } from '@/services/financeService'
import type { SetorRecord, EmpresaRecord, FaixasIndicadoresSetor } from '@/types/finance'

interface FormState {
  nome: string
  descricao: string
  ativo: boolean
  ordem: number
  ev_ebitda: number
  pl: number
  pvp: number
  ev_receita: number
  ev_ebit: number
  p_ebitda: number
  // Faixas principais
  margemLiquida: number
  margemBruta: number
  margemEbitda: number
  roe: number
  roa: number
  liquidezCorrente: number
  liquidezSeca: number
  endividamentoGeral: number
  giroAtivo: number
  coberturaJuros: number
  pmr: number
  pmp: number
  pme: number
}

const FORM_INICIAL: FormState = {
  nome: '',
  descricao: '',
  ativo: true,
  ordem: 50,
  ev_ebitda: 6.0,
  pl: 9.5,
  pvp: 1.7,
  ev_receita: 1.0,
  ev_ebit: 8.0,
  p_ebitda: 5.0,
  margemLiquida: 8.0,
  margemBruta: 35.0,
  margemEbitda: 17.0,
  roe: 15.0,
  roa: 7.5,
  liquidezCorrente: 1.4,
  liquidezSeca: 1.0,
  endividamentoGeral: 50.0,
  giroAtivo: 1.0,
  coberturaJuros: 3.5,
  pmr: 45,
  pmp: 40,
  pme: 45,
}

export default function CadastroSetores() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [setores, setSetores] = useState<SetorRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos')

  // Modal formulário
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSetor, setEditingSetor] = useState<SetorRecord | null>(null)
  const [formData, setFormData] = useState<FormState>(FORM_INICIAL)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  // Modal confirmação de exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [setorToDelete, setSetorToDelete] = useState<SetorRecord | null>(null)
  const [deletando, setDeletando] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  // Carregar dados
  const carregarDados = useCallback(async () => {
    try {
      setLoading(true)
      const [listSetores, listEmpresas] = await Promise.all([
        setoresService.getAll(),
        empresasService.getAll(),
      ])
      setSetores(listSetores)
      setEmpresas(listEmpresas)
    } catch (err) {
      console.error('Erro ao carregar setores:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar a lista de setores.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Realtime updates na coleção 'setores'
  useRealtime<SetorRecord>('setores', () => {
    carregarDados()
  })

  // Mapeamento de contagem de empresas por setor
  const contagemEmpresasPorSetor = useMemo(() => {
    const mapa = new Map<string, number>()
    empresas.forEach((emp) => {
      const s = (emp.setor || '').trim().toLowerCase()
      if (s) {
        mapa.set(s, (mapa.get(s) || 0) + 1)
      }
    })
    return mapa
  }, [empresas])

  // Lista filtrada
  const setoresFiltrados = useMemo(() => {
    return setores.filter((s) => {
      if (filtroStatus === 'ativos' && !s.ativo) return false
      if (filtroStatus === 'inativos' && s.ativo) return false

      if (termoBusca.trim()) {
        const q = termoBusca.toLowerCase()
        const matchNome = s.nome.toLowerCase().includes(q)
        const matchDesc = (s.descricao || '').toLowerCase().includes(q)
        if (!matchNome && !matchDesc) return false
      }

      return true
    })
  }, [setores, filtroStatus, termoBusca])

  // Estatísticas
  const estatisticas = useMemo(() => {
    const total = setores.length
    const ativos = setores.filter((s) => s.ativo).length
    const inativos = total - ativos
    const comEmpresas = setores.filter(
      (s) => (contagemEmpresasPorSetor.get(s.nome.trim().toLowerCase()) || 0) > 0,
    ).length
    return { total, ativos, inativos, comEmpresas }
  }, [setores, contagemEmpresasPorSetor])

  // Handlers formulário
  const abrirCriacao = () => {
    setEditingSetor(null)
    const proximaOrdem = setores.length > 0 ? Math.max(...setores.map((s) => s.ordem || 0)) + 1 : 1
    setFormData({
      ...FORM_INICIAL,
      ordem: proximaOrdem,
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const abrirEdicao = (setor: SetorRecord) => {
    setEditingSetor(setor)
    const faixas: FaixasIndicadoresSetor = setor.faixas_indicadores || {}
    setFormData({
      nome: setor.nome,
      descricao: setor.descricao || '',
      ativo: setor.ativo,
      ordem: setor.ordem ?? 50,
      ev_ebitda: setor.ev_ebitda ?? 6.0,
      pl: setor.pl ?? 9.5,
      pvp: setor.pvp ?? 1.7,
      ev_receita: setor.ev_receita ?? 1.0,
      ev_ebit: setor.ev_ebit ?? 8.0,
      p_ebitda: setor.p_ebitda ?? 5.0,
      margemLiquida: faixas.margemLiquida ?? 8.0,
      margemBruta: faixas.margemBruta ?? 35.0,
      margemEbitda: faixas.margemEbitda ?? 17.0,
      roe: faixas.roe ?? 15.0,
      roa: faixas.roa ?? 7.5,
      liquidezCorrente: faixas.liquidezCorrente ?? 1.4,
      liquidezSeca: faixas.liquidezSeca ?? 1.0,
      endividamentoGeral: faixas.endividamentoGeral ?? 50.0,
      giroAtivo: faixas.giroAtivo ?? 1.0,
      coberturaJuros: faixas.coberturaJuros ?? 3.5,
      pmr: faixas.pmr ?? 45,
      pmp: faixas.pmp ?? 40,
      pme: faixas.pme ?? 45,
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const validarForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.nome.trim()) {
      errors.nome = 'O nome do setor é obrigatório.'
    } else {
      // Verificar se nome já existe para outro ID
      const jaExiste = setores.some(
        (s) =>
          s.nome.trim().toLowerCase() === formData.nome.trim().toLowerCase() &&
          (!editingSetor || s.id !== editingSetor.id),
      )
      if (jaExiste) {
        errors.nome = 'Já existe um setor cadastrado com este nome.'
      }
    }

    if (formData.ev_ebitda <= 0) errors.ev_ebitda = 'O múltiplo deve ser maior que zero.'
    if (formData.pl <= 0) errors.pl = 'O múltiplo deve ser maior que zero.'

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validarForm()) return

    try {
      setSalvando(true)
      const input: SalvarSetorInput = {
        id: editingSetor?.id,
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim(),
        ativo: formData.ativo,
        ordem: Number(formData.ordem),
        padrao_sistema: editingSetor?.padrao_sistema ?? false,
        ev_ebitda: Number(formData.ev_ebitda),
        pl: Number(formData.pl),
        pvp: Number(formData.pvp),
        ev_receita: Number(formData.ev_receita),
        ev_ebit: Number(formData.ev_ebit),
        p_ebitda: Number(formData.p_ebitda),
        faixas_indicadores: {
          margemLiquida: Number(formData.margemLiquida),
          margemBruta: Number(formData.margemBruta),
          margemEbitda: Number(formData.margemEbitda),
          roe: Number(formData.roe),
          roa: Number(formData.roa),
          liquidezCorrente: Number(formData.liquidezCorrente),
          liquidezSeca: Number(formData.liquidezSeca),
          endividamentoGeral: Number(formData.endividamentoGeral),
          giroAtivo: Number(formData.giroAtivo),
          coberturaJuros: Number(formData.coberturaJuros),
          pmr: Number(formData.pmr),
          pmp: Number(formData.pmp),
          pme: Number(formData.pme),
        },
      }

      await setoresService.save(input)
      toast({
        title: editingSetor ? 'Setor atualizado!' : 'Setor cadastrado!',
        description: `O setor "${input.nome}" foi gravado com sucesso.`,
      })
      setModalOpen(false)
      carregarDados()
    } catch (err: any) {
      console.error('Erro ao salvar setor:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao salvar o setor.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtivo = async (setor: SetorRecord) => {
    try {
      await setoresService.toggleAtivo(setor.id, setor.ativo)
      toast({
        title: setor.ativo ? 'Setor inativado' : 'Setor ativado',
        description: `O setor "${setor.nome}" agora está ${!setor.ativo ? 'ativo' : 'inativo'}.`,
      })
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao alternar status',
        description: err?.message || 'Não foi possível alterar o status do setor.',
        variant: 'destructive',
      })
    }
  }

  const abrirConfirmacaoExclusao = (setor: SetorRecord) => {
    setSetorToDelete(setor)
    setErroExclusao(null)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmarExclusao = async () => {
    if (!setorToDelete) return
    try {
      setDeletando(true)
      await setoresService.delete(setorToDelete.id)
      toast({
        title: 'Setor excluído',
        description: `O setor "${setorToDelete.nome}" foi removido com sucesso.`,
      })
      setDeleteConfirmOpen(false)
      setSetorToDelete(null)
      carregarDados()
    } catch (err: any) {
      console.error('Erro ao excluir setor:', err)
      setErroExclusao(err?.message || 'Erro ao excluir setor.')
    } finally {
      setDeletando(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
              Cadastro de Setores de Mercado
            </h1>
            <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
              {setores.length} Setores
            </Badge>
          </div>
          <p className="text-xs text-[#5B6B7F] mt-1">
            Gerencie o catálogo completo de setores econômicos, calibração de múltiplos de mercado
            (EV/EBITDA, P/L, P/VP) e faixas de referência financeira utilizadas no sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-9 text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Link to="/planejamento/setores">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Setores (Mercado)
            </Link>
          </Button>

          <Button
            onClick={abrirCriacao}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Setor
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total de Setores
              </p>
              <p className="text-2xl font-bold text-[#0B1F3A] mt-1">{estatisticas.total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Setores Ativos
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{estatisticas.ativos}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Setores Inativos
              </p>
              <p className="text-2xl font-bold text-slate-600 mt-1">{estatisticas.inativos}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Setores com Empresas
              </p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{estatisticas.comEmpresas}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar setor por nome ou descrição..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                <Button
                  size="sm"
                  variant={filtroStatus === 'todos' ? 'default' : 'ghost'}
                  onClick={() => setFiltroStatus('todos')}
                  className={`h-7 px-2.5 text-xs font-semibold ${
                    filtroStatus === 'todos' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Todos ({setores.length})
                </Button>
                <Button
                  size="sm"
                  variant={filtroStatus === 'ativos' ? 'default' : 'ghost'}
                  onClick={() => setFiltroStatus('ativos')}
                  className={`h-7 px-2.5 text-xs font-semibold ${
                    filtroStatus === 'ativos' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Ativos ({estatisticas.ativos})
                </Button>
                <Button
                  size="sm"
                  variant={filtroStatus === 'inativos' ? 'default' : 'ghost'}
                  onClick={() => setFiltroStatus('inativos')}
                  className={`h-7 px-2.5 text-xs font-semibold ${
                    filtroStatus === 'inativos' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Inativos ({estatisticas.inativos})
                </Button>
              </div>

              <UiTooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={carregarDados}
                    disabled={loading}
                    className="h-8 w-8 p-0 border-slate-200"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recarregar dados</TooltipContent>
              </UiTooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Setores */}
      <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Ordem</th>
                <th className="py-3 px-4 min-w-[200px]">Setor</th>
                <th className="py-3 px-3 text-center min-w-[80px]">Status</th>
                <th className="py-3 px-3 text-center min-w-[90px]">Empresas</th>
                <th className="py-3 px-3 text-center">EV/EBITDA</th>
                <th className="py-3 px-3 text-center">P/L</th>
                <th className="py-3 px-3 text-center">P/VP</th>
                <th className="py-3 px-3 text-center">EV/Rec</th>
                <th className="py-3 px-3 text-center">Margem Líq.</th>
                <th className="py-3 px-3 text-center">ROE</th>
                <th className="py-3 px-3 text-center">Liq. Corr.</th>
                <th className="py-3 px-4 text-right w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && setores.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Carregando setores de mercado...
                  </td>
                </tr>
              ) : setoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">
                        Nenhum setor cadastrado ou encontrado
                      </p>
                      <p className="text-xs text-slate-500">
                        {termoBusca
                          ? 'Nenhum resultado corresponde à sua busca. Tente outros termos.'
                          : 'Crie seu primeiro setor para calibrar múltiplos e benchmarks no sistema.'}
                      </p>
                      {!termoBusca && (
                        <Button
                          onClick={abrirCriacao}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs mt-2"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Criar Primeiro Setor
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                setoresFiltrados.map((setor) => {
                  const qtdEmpresas =
                    contagemEmpresasPorSetor.get(setor.nome.trim().toLowerCase()) || 0
                  const faixas: FaixasIndicadoresSetor = setor.faixas_indicadores || {}

                  return (
                    <tr
                      key={setor.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !setor.ativo ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                        {setor.ordem ?? '-'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{setor.nome}</span>
                            {setor.padrao_sistema && (
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent>Setor padrão de mercado</TooltipContent>
                              </UiTooltip>
                            )}
                          </div>
                          {setor.descricao && (
                            <span className="text-[11px] text-slate-500 line-clamp-1 max-w-sm">
                              {setor.descricao}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold cursor-pointer select-none transition-colors ${
                            setor.ativo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                          onClick={() => handleToggleAtivo(setor)}
                        >
                          {setor.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {qtdEmpresas > 0 ? (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 text-[10px] font-bold">
                            {qtdEmpresas} {qtdEmpresas === 1 ? 'empresa' : 'empresas'}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-blue-700">
                        {setor.ev_ebitda ? `${setor.ev_ebitda.toFixed(1)}x` : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {setor.pl ? `${setor.pl.toFixed(1)}x` : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {setor.pvp ? `${setor.pvp.toFixed(1)}x` : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {setor.ev_receita ? `${setor.ev_receita.toFixed(1)}x` : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-emerald-700 font-medium">
                        {faixas.margemLiquida !== undefined
                          ? `${Number(faixas.margemLiquida).toFixed(1)}%`
                          : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {faixas.roe !== undefined ? `${Number(faixas.roe).toFixed(1)}%` : '-'}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {faixas.liquidezCorrente !== undefined
                          ? Number(faixas.liquidezCorrente).toFixed(2)
                          : '-'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <UiTooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirEdicao(setor)}
                                className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar múltiplos e faixas</TooltipContent>
                          </UiTooltip>

                          <UiTooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirConfirmacaoExclusao(setor)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {qtdEmpresas > 0
                                ? 'Em uso por empresas (não pode ser excluído)'
                                : 'Excluir setor'}
                            </TooltipContent>
                          </UiTooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Formulário (Criar / Editar) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              {editingSetor ? `Editar Setor: ${editingSetor.nome}` : 'Cadastrar Novo Setor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure o nome do setor, múltiplos de mercado e faixas médias para balizar as
              análises de valuation e comparativo setorial.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-4">
            <Tabs defaultValue="dados_gerais" className="w-full">
              <TabsList className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="dados_gerais" className="text-xs font-semibold">
                  Dados Gerais
                </TabsTrigger>
                <TabsTrigger value="multiplos" className="text-xs font-semibold">
                  Múltiplos de Mercado (6)
                </TabsTrigger>
                <TabsTrigger value="faixas" className="text-xs font-semibold">
                  Faixas Típicas & Benchmarks
                </TabsTrigger>
              </TabsList>

              {/* ABA 1: DADOS GERAIS */}
              <TabsContent value="dados_gerais" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="setor-nome" className="text-xs font-semibold text-slate-700">
                    Nome do Setor *
                  </Label>
                  <Input
                    id="setor-nome"
                    placeholder="Ex: Farmacêutico, Logística e Transporte..."
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className={`h-9 text-xs ${formErrors.nome ? 'border-red-500' : ''}`}
                  />
                  {formErrors.nome && (
                    <p className="text-[11px] text-red-600 font-medium">{formErrors.nome}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setor-descricao" className="text-xs font-semibold text-slate-700">
                    Descrição do Ramo Econômico (opcional)
                  </Label>
                  <Textarea
                    id="setor-descricao"
                    placeholder="Breve descrição dos tipos de negócios e perfil de operação enquadrados neste setor..."
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="text-xs min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="setor-ordem" className="text-xs font-semibold text-slate-700">
                      Ordem de Exibição
                    </Label>
                    <Input
                      id="setor-ordem"
                      type="number"
                      value={formData.ordem}
                      onChange={(e) => setFormData({ ...formData, ordem: Number(e.target.value) })}
                      className="h-9 text-xs"
                    />
                    <p className="text-[10px] text-slate-500">
                      Ordem nos menus suspensos e listagens (menor número aparece antes).
                    </p>
                  </div>

                  <div className="space-y-1.5 flex flex-col justify-center">
                    <Label className="text-xs font-semibold text-slate-700">Status do Setor</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        checked={formData.ativo}
                        onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        {formData.ativo ? 'Setor Ativo (disponível)' : 'Setor Inativo (oculto)'}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ABA 2: MÚLTIPLOS DE MERCADO */}
              <TabsContent value="multiplos" className="space-y-3 pt-3">
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 leading-relaxed">
                    Estes múltiplos são a referência inicial para as avaliações por Múltiplos de
                    Mercado no módulo Valuation e na tela Setores (Mercado).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">EV / EBITDA (x)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.ev_ebitda}
                      onChange={(e) =>
                        setFormData({ ...formData, ev_ebitda: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      Valor da Firma / Geração de Caixa
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      P / L (Preço / Lucro) (x)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.pl}
                      onChange={(e) =>
                        setFormData({ ...formData, pl: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      Valor de Mercado / Lucro Líquido
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      P / VP (Preço / Valor Patrimonial) (x)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.pvp}
                      onChange={(e) =>
                        setFormData({ ...formData, pvp: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      Valor de Mercado / Patrimônio Líquido
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      EV / Receita Bruta (x)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.ev_receita}
                      onChange={(e) =>
                        setFormData({ ...formData, ev_receita: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      Valor da Firma / Faturamento Bruto
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">EV / EBIT (x)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.ev_ebit}
                      onChange={(e) =>
                        setFormData({ ...formData, ev_ebit: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      Valor da Firma / Lucro Operacional
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">P / EBITDA (x)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.p_ebitda}
                      onChange={(e) =>
                        setFormData({ ...formData, p_ebitda: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400">Valor dos Sócios / EBITDA</span>
                  </div>
                </div>
              </TabsContent>

              {/* ABA 3: FAIXAS TÍPICAS */}
              <TabsContent value="faixas" className="space-y-3 pt-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-700">
                    Faixas médias e medianas observadas no mercado brasileiro para o setor.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Margem Líquida (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.margemLiquida}
                      onChange={(e) =>
                        setFormData({ ...formData, margemLiquida: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Margem Bruta (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.margemBruta}
                      onChange={(e) =>
                        setFormData({ ...formData, margemBruta: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Margem EBITDA (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.margemEbitda}
                      onChange={(e) =>
                        setFormData({ ...formData, margemEbitda: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">ROE (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.roe}
                      onChange={(e) =>
                        setFormData({ ...formData, roe: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">ROA (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.roa}
                      onChange={(e) =>
                        setFormData({ ...formData, roa: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Giro do Ativo (x)
                    </Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={formData.giroAtivo}
                      onChange={(e) =>
                        setFormData({ ...formData, giroAtivo: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Liquidez Corrente
                    </Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={formData.liquidezCorrente}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          liquidezCorrente: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Liquidez Seca</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={formData.liquidezSeca}
                      onChange={(e) =>
                        setFormData({ ...formData, liquidezSeca: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Endividamento Geral (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.endividamentoGeral}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endividamentoGeral: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Cobertura Juros (x)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.coberturaJuros}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          coberturaJuros: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      PMR (Recebimento - dias)
                    </Label>
                    <Input
                      type="number"
                      value={formData.pmr}
                      onChange={(e) =>
                        setFormData({ ...formData, pmr: parseInt(e.target.value, 10) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      PMP (Pagamento - dias)
                    </Label>
                    <Input
                      type="number"
                      value={formData.pmp}
                      onChange={(e) =>
                        setFormData({ ...formData, pmp: parseInt(e.target.value, 10) || 0 })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 bg-white pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={salvando}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9"
              >
                {salvando ? 'Salvando...' : editingSetor ? 'Salvar Alterações' : 'Cadastrar Setor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Setor?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                Tem certeza que deseja remover o setor{' '}
                <strong className="text-slate-900 font-bold">{setorToDelete?.nome}</strong> do
                sistema?
              </p>
              {erroExclusao && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {erroExclusao}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletando} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              disabled={deletando}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {deletando ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
