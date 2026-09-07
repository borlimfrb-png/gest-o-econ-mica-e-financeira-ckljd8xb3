import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  auditoriaSegurancaService,
  type AuditoriaSegurancaRecord,
  type DetalheAuditoriaColecao,
} from '@/services/auditoriaSegurancaService'
import {
  ShieldCheck,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  Clock,
  Layers,
  Lock,
  Search,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function AdminAuditoria() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [executando, setExecutando] = useState(false)
  const [historico, setHistorico] = useState<AuditoriaSegurancaRecord[]>([])
  const [auditoriaAtiva, setAuditoriaAtiva] = useState<AuditoriaSegurancaRecord | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'conforme' | 'atencao'>('todos')
  const [detalheModalColecao, setDetalheModalColecao] = useState<DetalheAuditoriaColecao | null>(
    null,
  )

  const carregarDados = async () => {
    try {
      setLoading(true)
      const lista = await auditoriaSegurancaService.listar()
      setHistorico(lista)
      if (lista.length > 0) {
        setAuditoriaAtiva(lista[0])
      } else {
        setAuditoriaAtiva(null)
      }
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar auditorias',
        description: err?.message || 'Falha ao buscar registros de segurança.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && user.role === 'admin') {
      carregarDados()
    }
  }, [user])

  // Apenas role admin pode acessar
  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const handleDispararVerificacao = async () => {
    try {
      setExecutando(true)
      const res = await auditoriaSegurancaService.dispararVerificacaoManual()
      if (res.success) {
        toast({
          title: 'Auditoria Concluída',
          description: `Verificação manual concluída. Conformes: ${res.relatorio.total_conformes}, Divergências: ${res.relatorio.total_divergencias}`,
        })
        await carregarDados()
      }
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro na verificação',
        description: err?.message || 'Não foi possível disparar a auditoria de segurança.',
      })
    } finally {
      setExecutando(false)
    }
  }

  // Detalhes da auditoria ativa
  const detalhesLista: DetalheAuditoriaColecao[] = Array.isArray(auditoriaAtiva?.detalhes)
    ? (auditoriaAtiva?.detalhes as DetalheAuditoriaColecao[])
    : []

  const itensFiltrados = detalhesLista.filter((item) => {
    const matchBusca =
      item.colecao.toLowerCase().includes(busca.toLowerCase()) ||
      item.categoria.toLowerCase().includes(busca.toLowerCase())
    if (!matchBusca) return false
    if (filtroStatus === 'conforme') return item.conforme
    if (filtroStatus === 'atencao') return !item.conforme
    return true
  })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Auditoria de Segurança & Perfis
            </h1>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              Admin
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Inspeção e conformidade das regras de acesso (RLS) e isolamento multi-tenant por perfil.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading || executando}
            className="gap-1.5 text-xs text-slate-700 border-slate-300"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={handleDispararVerificacao}
            disabled={executando}
            className="gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            {executando ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Disparar Verificação Manual
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      {auditoriaAtiva ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500 uppercase">
                Status Geral
              </CardDescription>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                {auditoriaAtiva.status_geral === 'ok' ? (
                  <>
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    <span className="text-emerald-700">Conforme</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-6 h-6 text-amber-600" />
                    <span className="text-amber-700">Divergência</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-500">
              Executado por:{' '}
              <span className="font-medium text-slate-700">
                {auditoriaAtiva.executado_por || 'Sistema'}
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500 uppercase">
                Total Verificado
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                {auditoriaAtiva.total_colecoes}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-500">
              Coleções de dados sensíveis avaliadas
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500 uppercase">
                Conformes
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                {auditoriaAtiva.total_conformes}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-500">
              Regras perfeitamente alinhadas ao baseline
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500 uppercase">
                Divergências
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-amber-600" />
                {auditoriaAtiva.total_divergencias}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-500">
              Regras com permissão divergente do padrão
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Conteúdo Principal: Tabela ou Estado Vazio */}
      {!loading && historico.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Nenhuma verificação de auditoria registrada ainda
            </h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              A rotina automatizada executa no <strong>dia 1 de cada mês às 06:00 (UTC)</strong>{' '}
              para checar as regras de isolamento por perfil nas 25+ coleções críticas. Você também
              pode disparar a primeira verificação agora mesmo.
            </p>
            <Button
              onClick={handleDispararVerificacao}
              disabled={executando}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="w-4 h-4 fill-current" />
              Disparar Primeira Verificação Manual
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200/80 shadow-xs">
          <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600" />
                  Conformidade das Coleções do Sistema
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Verificação realizada em{' '}
                  <span className="font-semibold text-slate-700">
                    {auditoriaAtiva?.data_verificacao
                      ? new Date(auditoriaAtiva.data_verificacao + 'T00:00:00').toLocaleDateString(
                          'pt-BR',
                        )
                      : '-'}
                  </span>
                </CardDescription>
              </div>

              {/* Filtros e Busca */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Filtrar coleção..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="h-8 pl-8 text-xs border-slate-300"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setFiltroStatus('todos')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      filtroStatus === 'todos'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Todos ({detalhesLista.length})
                  </button>
                  <button
                    onClick={() => setFiltroStatus('conforme')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      filtroStatus === 'conforme'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Conformes ({detalhesLista.filter((i) => i.conforme).length})
                  </button>
                  <button
                    onClick={() => setFiltroStatus('atencao')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      filtroStatus === 'atencao'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Atenção ({detalhesLista.filter((i) => !i.conforme).length})
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="text-xs font-bold text-slate-700">Coleção</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">
                      Categoria de Segurança
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-right">
                      Ação
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-500">
                        Nenhuma coleção encontrada com o filtro selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itensFiltrados.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-xs font-semibold text-slate-900">
                          {item.colecao}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{item.categoria}</TableCell>
                        <TableCell className="text-center">
                          {item.conforme ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-[11px] font-bold gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Conforme
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[11px] font-bold gap-1">
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                              Atenção
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetalheModalColecao(item)}
                            className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          >
                            Ver Regras
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico das Últimas Execuções */}
      {historico.length > 1 && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Histórico de Execuções Anteriores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {historico.slice(0, 8).map((hist) => (
                <Button
                  key={hist.id}
                  variant={auditoriaAtiva?.id === hist.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAuditoriaAtiva(hist)}
                  className={`h-8 text-xs gap-1.5 ${
                    auditoriaAtiva?.id === hist.id
                      ? 'bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  {hist.data_verificacao} ({hist.total_conformes}/{hist.total_colecoes})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal para Visualizar Regras da Coleção */}
      <Dialog
        open={Boolean(detalheModalColecao)}
        onOpenChange={(open) => !open && setDetalheModalColecao(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Lock className="w-4 h-4 text-blue-600" />
              Regras RLS: {detalheModalColecao?.colecao}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {detalheModalColecao?.categoria} • Status:{' '}
              <strong
                className={detalheModalColecao?.conforme ? 'text-emerald-600' : 'text-amber-600'}
              >
                {detalheModalColecao?.conforme ? 'Conforme' : 'Atenção / Divergência'}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {detalheModalColecao && (
            <div className="space-y-3 py-2 text-xs">
              {detalheModalColecao.erro ? (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                  {detalheModalColecao.erro}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-1">List Rule:</span>
                    <code className="text-[11px] font-mono text-slate-800 break-all">
                      {detalheModalColecao.regrasAtuais?.list || '(Vazia / Restrita)'}
                    </code>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-1">View Rule:</span>
                    <code className="text-[11px] font-mono text-slate-800 break-all">
                      {detalheModalColecao.regrasAtuais?.view || '(Vazia / Restrita)'}
                    </code>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-1">Create Rule:</span>
                    <code className="text-[11px] font-mono text-slate-800 break-all">
                      {detalheModalColecao.regrasAtuais?.create || '(Vazia / Restrita)'}
                    </code>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-1">Update Rule:</span>
                    <code className="text-[11px] font-mono text-slate-800 break-all">
                      {detalheModalColecao.regrasAtuais?.update || '(Vazia / Restrita)'}
                    </code>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-1">Delete Rule:</span>
                    <code className="text-[11px] font-mono text-slate-800 break-all">
                      {detalheModalColecao.regrasAtuais?.delete || '(Vazia / Restrita)'}
                    </code>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
