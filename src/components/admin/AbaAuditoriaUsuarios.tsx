import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, ShieldCheck } from 'lucide-react'
import {
  auditoriaUsuariosService,
  type AcaoAuditoriaUsuario,
  type AuditoriaUsuarioItem,
  type FiltroUsuarioOption,
} from '@/services/auditoriaUsuariosService'
import { useAuth } from '@/contexts/AuthContext'
import { usuariosService } from '@/services/usuariosService'

const LABELS_ACAO: Record<AcaoAuditoriaUsuario, string> = {
  login: 'Login',
  logout: 'Logout',
  cadastro_usuario: 'Cadastro de usuário',
  edicao_usuario: 'Edição de usuário',
  exclusao_usuario: 'Exclusão de usuário',
  ativar_desativar_usuario: 'Ativar/Desativar usuário',
  redefinicao_senha: 'Redefinição de senha',
  permissao_perfil: 'Permissões por perfil',
  ferramentas_habilitadas: 'Ferramentas habilitadas',
  importacao: 'Importação',
  outro: 'Outro',
}

const CORES_ACAO: Record<AcaoAuditoriaUsuario, string> = {
  login: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  logout: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cadastro_usuario: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  edicao_usuario: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  exclusao_usuario: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  ativar_desativar_usuario:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  redefinicao_senha: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  permissao_perfil: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  ferramentas_habilitadas: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  importacao: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  outro: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const TODAS_ACOES = Object.keys(LABELS_ACAO) as AcaoAuditoriaUsuario[]
const POR_PAGINA = 25

function formatarDataHora(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return `${data} ${hora}`
}

export function AbaAuditoriaUsuarios() {
  const { user } = useAuth()
  const [itens, setItens] = useState<AuditoriaUsuarioItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [filtroAcao, setFiltroAcao] = useState<'todas' | AcaoAuditoriaUsuario>('todas')
  const [buscaUsuarios, setBuscaUsuarios] = useState('')
  const [usuariosFiltro, setUsuariosFiltro] = useState<FiltroUsuarioOption[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const res = await auditoriaUsuariosService.listar({
        usuarioId: filtroUsuario,
        acao: filtroAcao,
        page,
        perPage: POR_PAGINA,
      })
      setItens(res.itens)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o log de auditoria.')
      setItens([])
    } finally {
      setCarregando(false)
    }
  }, [filtroUsuario, filtroAcao, page])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Usuários para o filtro: TODOS os usuários do sistema (mesma coleção users,
  // com paginação completa — padrão das outras abas da tela) unidos aos autores
  // que aparecem no log (cobre usuários excluídos que ainda têm eventos).
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      let doLog: FiltroUsuarioOption[] = []
      try {
        doLog = await auditoriaUsuariosService.listarUsuariosFiltro()
      } catch {
        doLog = []
      }
      try {
        const lista = await usuariosService.getAll()
        const mapa = new Map<string, FiltroUsuarioOption>()
        for (const u of lista) {
          mapa.set(u.id, { id: u.id, nome: u.name || u.email || u.id })
        }
        for (const op of doLog) {
          if (!mapa.has(op.id)) mapa.set(op.id, op)
        }
        if (cancelado) return
        setUsuariosFiltro(
          Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        )
      } catch {
        if (cancelado) return
        setUsuariosFiltro(doLog)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  const opcoesUsuario = useMemo(() => {
    const termo = buscaUsuarios.trim().toLowerCase()
    const base = usuariosFiltro.map((u) => ({
      id: u.id,
      nome: u.nome || u.id,
    }))
    if (!termo) return base
    return base.filter((u) => u.nome.toLowerCase().includes(termo))
  }, [usuariosFiltro, buscaUsuarios])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          Log de Auditoria de Usuários
        </CardTitle>
        <CardDescription>
          Histórico das ações dos usuários: logins, redefinições de senha, alterações de permissões
          por perfil, ferramentas habilitadas e gestão de usuários.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Usuário</Label>
            <Select
              value={filtroUsuario}
              onValueChange={(v) => {
                setFiltroUsuario(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os usuários</SelectItem>
                {opcoesUsuario.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={buscaUsuarios}
              onChange={(e) => setBuscaUsuarios(e.target.value)}
              placeholder="Buscar usuário no filtro…"
              className="h-8 w-[240px] text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Ação</Label>
            <Select
              value={filtroAcao}
              onValueChange={(v) => {
                setFiltroAcao(v as 'todas' | AcaoAuditoriaUsuario)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as ações</SelectItem>
                {TODAS_ACOES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {LABELS_ACAO[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-slate-500">
            {total} registro{total === 1 ? '' : 's'}
          </div>
        </div>

        {erro && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {erro}
          </div>
        )}

        {/* Tabela */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-[190px]">Ação</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : itens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                    Nenhum registro encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                itens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatarDataHora(item.created)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.autor_nome || item.autor_email || '—'}
                      </div>
                      {item.autor_email && item.autor_nome ? (
                        <div className="text-xs text-slate-500">{item.autor_email}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${CORES_ACAO[item.acao] || CORES_ACAO.outro} border-0`}>
                        {LABELS_ACAO[item.acao] || 'Outro'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {item.detalhes || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Página {page} de {Math.max(1, totalPages)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || carregando}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || carregando}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
