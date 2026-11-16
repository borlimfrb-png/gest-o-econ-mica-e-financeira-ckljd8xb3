import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  dbOtimizacaoService,
  type Diagnostico,
  type ResultadoOtimizacao,
} from '@/services/dbOtimizacaoService'
import { ultimaOtimizacao, type OtimizacaoLogRecord } from '@/services/dbOtimizacaoLogService'
import {
  Database,
  Gauge,
  Table2,
  ListChecks,
  Sparkles,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Lightbulb,
  Search as Search_Icon,
  CalendarClock,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const fmtNum = new Intl.NumberFormat('pt-BR')

function CardResumo({
  icone: Icone,
  titulo,
  valor,
  descricao,
  cor,
}: {
  icone: React.ComponentType<{ className?: string }>
  titulo: string
  valor: string
  descricao: string
  cor: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cor}`}>
            <Icone className="w-5 h-5" />
          </div>
          <CardTitle className="text-sm font-semibold text-slate-600">{titulo}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-3xl font-bold text-[#0B1F3A]">{valor}</p>
        <p className="text-xs text-slate-500 mt-1">{descricao}</p>
      </CardContent>
    </Card>
  )
}

function EstadoVazio() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Database className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-[#0B1F3A]">Nenhuma análise executada ainda</h2>
        <p className="text-sm text-slate-600 max-w-md">
          Clique em <strong>"Analisar banco de dados"</strong> para o Borlim examinar as principais
          coleções do sistema: ele conta os registros, confere os índices que já existem e aponta
          quais "atalhos de busca" (índices) podem ser criados para as telas abrirem mais rápido.
          Nada é alterado na análise — os índices só são criados quando você aplica as otimizações.
        </p>
      </CardContent>
    </Card>
  )
}

function Carregando() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function useAutomacaoStatus() {
  const [data, setData] = useState<OtimizacaoLogRecord | null>(null)
  const [isCarregando, setIsCarregando] = useState(true)
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    let cancelado = false
    ultimaOtimizacao('automatico').then((r) => {
      if (!cancelado) {
        setData(r)
        setIsCarregando(false)
      }
    })
    return () => {
      cancelado = true
    }
  }, [versao])
  return {
    data,
    isCarregando,
    recarregar: () => setVersao((v) => v + 1),
  }
}

function CardAutomacao() {
  const { data, isCarregando, recarregar } = useAutomacaoStatus()
  if (isCarregando) {
    return (
      <Card className="border-slate-200">
        <CardContent className="flex items-center gap-3 py-4">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    )
  }
  const ultima = data
  return (
    <Card className="border-slate-200">
      <CardContent className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-violet-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-[#0B1F3A]">
              Otimização automática semanal
              <Badge
                variant="outline"
                className="ml-2 bg-violet-50 text-violet-700 border-violet-200"
              >
                ativa
              </Badge>
            </p>
            {ultima ? (
              <p className="text-xs text-slate-600 mt-0.5">
                Última otimização automática:{' '}
                <strong>{fmtDataHora.format(new Date(ultima.created))}</strong> —{' '}
                {ultima.aplicados.length} índice(s) aplicado(s), {ultima.falhas.length} falha(s).
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5 italic">
                Ainda não executou — o cron roda todo domingo às 03:00.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {ultima && (
            <span className="text-xs text-slate-400 hidden md:inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {ultima.executado_por || 'Cron Semanal'}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={recarregar}
            className="cursor-pointer text-slate-500 hover:text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminOtimizacao() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [confirmarAberto, setConfirmarAberto] = useState(false)
  const [resultado, setResultado] = useState<ResultadoOtimizacao | null>(null)

  // Apenas role admin pode acessar (mesmo padrão de /admin/usuarios e /admin/auditoria)
  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const analisar = async () => {
    try {
      setAnalisando(true)
      const res = await dbOtimizacaoService.diagnosticar()
      setDiagnostico(res)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao analisar o banco de dados',
        description: err?.message || 'Falha desconhecida.',
      })
    } finally {
      setAnalisando(false)
    }
  }

  const aplicar = async () => {
    try {
      setAplicando(true)
      const res = await dbOtimizacaoService.otimizar()
      setResultado(res)
      setDiagnostico({ sucesso: true, status: res.depois, colecoes: res.diagnostico.colecoes })
      setConfirmarAberto(false)

      const pendentesDepois = res.depois?.indices_pendentes ?? 0
      if (res.sucesso) {
        toast({
          title: 'Otimização concluída',
          description:
            res.aplicados.length > 0
              ? `Índices criados: ${res.aplicados.join(', ')}.`
              : 'Nenhum índice faltando — o banco já está otimizado.',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Otimização parcial',
          description:
            `Aplicados: ${res.aplicados.length}. Falhas: ${res.falhas.length}` +
            (res.falhas.length > 0 ? ` — ${res.falhas[0].motivo}` : '') +
            (pendentesDepois > 0 ? `. Pendentes restantes: ${pendentesDepois}.` : '.'),
        })
      }
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao aplicar otimizações',
        description: err?.message || 'Falha desconhecida.',
      })
    } finally {
      setAplicando(false)
    }
  }

  const status = diagnostico?.status

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 md:p-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shrink-0">
            <Gauge className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0B1F3A]">Otimização do Banco de Dados</h1>
            <p className="text-sm text-slate-600">
              Ferramenta de manutenção: analisa coleções e índices para as telas carregarem mais
              rápido.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={analisar} disabled={analisando || aplicando} className="cursor-pointer">
            {analisando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando…
              </>
            ) : (
              <>
                <Search_Icon className="w-4 h-4 mr-2" /> Analisar banco de dados
              </>
            )}
          </Button>
          <Button
            onClick={() => setConfirmarAberto(true)}
            disabled={analisando || aplicando || !diagnostico || status?.indices_pendentes === 0}
            className="cursor-pointer bg-emerald-600 hover:bg-emerald-700"
          >
            {aplicando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aplicando…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Aplicar otimizações
              </>
            )}
          </Button>
        </div>
      </div>

      <CardAutomacao />

      {/* Explicação em linguagem de produto */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-[#0B1F3A] mb-1">O que esta ferramenta faz?</p>
            <p>
              Com o tempo, o banco de dados acumula milhares de lançamentos, balanços e notas. Sem
              um <strong>"atalho de busca" (índice)</strong>, o sistema precisa percorrer registro
              por registro para achar o que a tela pede — como procurar um nome num livro sem usar o
              índice remissivo. Aqui o Borlim sugere e cria esses atalhos nas coleções mais usadas
              (por empresa, por ano, por usuário), deixando o Dashboard, o DRE e as demais telas
              mais rápidos. A análise não altera nada; os índices só são criados quando você clica
              em <strong>Aplicar otimizações</strong>, e aplicar duas vezes não duplica nada.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Estado vazio antes da primeira análise */}
      {!diagnostico && !analisando && <EstadoVazio />}

      {/* Skeleton enquanto analisa */}
      {analisando && !diagnostico && <Carregando />}

      {/* Resultado */}
      {diagnostico && status && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <CardResumo
              icone={Table2}
              titulo="Coleções analisadas"
              valor={fmtNum.format(status.colecoes_analisadas)}
              descricao="Principais coleções do sistema examinadas"
              cor="bg-blue-100 text-blue-600"
            />
            <CardResumo
              icone={Database}
              titulo="Registros analisados"
              valor={fmtNum.format(status.registros_totais)}
              descricao="Soma de registros das coleções analisadas"
              cor="bg-emerald-100 text-emerald-600"
            />
            <CardResumo
              icone={ListChecks}
              titulo="Índices pendentes"
              valor={fmtNum.format(status.indices_pendentes)}
              descricao={
                status.indices_pendentes === 0
                  ? 'Banco já otimizado — nada a aplicar'
                  : 'Atalhos de busca recomendados e ainda não criados'
              }
              cor={
                status.indices_pendentes === 0
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-amber-100 text-amber-600'
              }
            />
          </div>

          {resultado && (resultado.aplicados.length > 0 || resultado.falhas.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> Resultado da última otimização
                </CardTitle>
                <CardDescription>
                  {resultado.aplicados.length} índice(s) criado(s)
                  {resultado.falhas.length > 0 ? ` · ${resultado.falhas.length} falha(s)` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {resultado.aplicados.map((ind) => (
                  <div key={ind} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">{ind}</code>
                  </div>
                ))}
                {resultado.falhas.map((f) => (
                  <div key={f.indice} className="flex items-center gap-2 text-sm text-slate-700">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">{f.indice}</code>
                    <span className="text-xs text-red-600">{f.motivo}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tabela por coleção */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento por coleção</CardTitle>
              <CardDescription>
                Registros, índices existentes e recomendações de índice para cada coleção.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coleção</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead>Índices existentes</TableHead>
                    <TableHead>Recomendações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnostico.colecoes.map((col) => (
                    <TableRow key={col.colecao}>
                      <TableCell className="font-medium text-[#0B1F3A]">{col.colecao}</TableCell>
                      <TableCell className="text-right">{fmtNum.format(col.registros)}</TableCell>
                      <TableCell>
                        {col.indices.length === 0 ? (
                          <span className="text-xs text-slate-400">Nenhum</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {col.indices.map((i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                                {i}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {col.recomendacoes.length === 0 ? (
                          col.indices_recomendados_presentes.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Em dia
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )
                        ) : (
                          <div className="space-y-1">
                            {col.recomendacoes.map((r) => (
                              <div key={r.indice} className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="text-xs text-slate-700">
                                  Criar <code className="bg-amber-50 rounded px-1">{r.indice}</code>{' '}
                                  ({r.rotulo})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Dica final */}
          <Card>
            <CardContent className="flex items-start gap-3 pt-4">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                <strong className="text-[#0B1F3A]">Dica:</strong> rode a análise de vez em quando —
                especialmente após grandes importações de balancetes ou lançamentos. Os índices são
                criados uma única vez e passam a valer para todas as telas automaticamente.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Confirmação */}
      <Dialog open={confirmarAberto} onOpenChange={setConfirmarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar otimizações no banco de dados?</DialogTitle>
            <DialogDescription>
              Serão criados <strong>{status?.indices_pendentes ?? 0} índice(s)</strong> de busca nas
              coleções listadas acima. A operação é segura e não altera nenhum registro — apenas
              cria "atalhos" para as consultas ficarem mais rápidas. Se um índice já existir, ele
              não é duplicado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmarAberto(false)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={aplicar}
              disabled={aplicando}
              className="cursor-pointer bg-emerald-600 hover:bg-emerald-700"
            >
              {aplicando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aplicando…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
