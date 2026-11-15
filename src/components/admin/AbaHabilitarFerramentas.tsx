import React, { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { ferramentasService } from '@/services/ferramentasUsuariosService'
import { CATALOGO_FERRAMENTAS, getFerramentaCatalogo } from '@/lib/ferramentasCatalogo'

/** Todos os ids do catálogo — deriva de CATALOGO_FERRAMENTAS para nunca divergir. */
const IDS_CATALOGO = CATALOGO_FERRAMENTAS.map((f) => f.id as string)
import { extractUserGruposIds } from '@/lib/vinculosEmpresas'
import type { UserRecord } from '@/types/finance'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Search, Wrench, RotateCw, Shield, Eye, Building2, Layers } from 'lucide-react'

/**
 * Aba "Habilitar Ferramentas" de /admin/usuarios.
 *
 * Lista os usuários com toggles por ferramenta do catálogo (CATALOGO_FERRAMENTAS).
 * Persistência: coleção ferramentas_usuarios, campo `ferramentas_desabilitadas`
 * (JSON — lista de módulos DESLIGADOS; sem registro = tudo habilitado).
 * Administrador nunca é editável (acesso irrestrito de gestão).
 */
const AbaHabilitarFerramentas: React.FC = () => {
  const { toast } = useToast()

  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [registros, setRegistros] = useState<Record<string, Set<string>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [salvandoUserId, setSalvandoUserId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const carregar = async () => {
    try {
      setIsLoading(true)
      const [uList, registrosList] = await Promise.all([
        (async () => {
          const { usuariosService } = await import('@/services/usuariosService')
          return usuariosService.getAll()
        })(),
        ferramentasService.getAll(),
      ])
      setUsuarios(uList)
      const mapa: Record<string, Set<string>> = {}
      for (const r of registrosList) {
        const lista = Array.isArray(r.ferramentas_desabilitadas) ? r.ferramentas_desabilitadas : []
        mapa[r.user] = new Set(lista)
      }
      setRegistros(mapa)
    } catch (err: any) {
      console.error('Erro ao carregar habilitações de ferramentas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: err?.message || 'Não foi possível carregar a habilitação de ferramentas.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const usuariosFiltrados = useMemo(() => {
    const termo = searchTerm.toLowerCase()
    return usuarios.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(termo) ||
        (u.email || '').toLowerCase().includes(termo),
    )
  }, [usuarios, searchTerm])

  const desabilitadasDe = (userId: string): Set<string> => registros[userId] || new Set()

  const qtdDesabilitadas = (userId: string): number => desabilitadasDe(userId).size

  const isFerramentaOn = (userId: string, ferramentaId: string): boolean =>
    !desabilitadasDe(userId).has(ferramentaId)

  const toggleFerramenta = async (user: UserRecord, ferramentaId: string, ligar: boolean) => {
    const atual = new Set(desabilitadasDe(user.id))
    if (ligar) {
      atual.delete(ferramentaId)
    } else {
      atual.add(ferramentaId)
    }

    // Persiste TODOS os ids atualmente desligados (inclui ids legados que já
    // estavam no registro, mesmo fora do catálogo atual). Filtrar por
    // TODAS_FERRAMENTAS_IDS aqui apagava silenciosamente ids ausentes dessa
    // lista (ex.: cliente_balanco), revertendo o toggle sem avisar.
    const novaLista = Array.from(atual)
    setRegistros((prev) => ({ ...prev, [user.id]: atual }))
    setSalvandoUserId(user.id)
    try {
      await ferramentasService.salvar(user.id, novaLista)
      toast({
        title: ligar ? 'Ferramenta habilitada' : 'Ferramenta desabilitada',
        description: `${getFerramentaCatalogo(ferramentaId)?.nome || ferramentaId} — ${user.name || user.email}.`,
      })
    } catch (err: any) {
      // rollback visual
      setRegistros((prev) => ({ ...prev, [user.id]: desabilitadasDe(user.id) }))
      console.error('Erro ao salvar habilitação de ferramenta:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível gravar a habilitação da ferramenta.',
      })
    } finally {
      setSalvandoUserId(null)
    }
  }

  const habilitarTudo = async (user: UserRecord) => {
    setRegistros((prev) => ({ ...prev, [user.id]: new Set() }))
    setSalvandoUserId(user.id)
    try {
      await ferramentasService.salvar(user.id, [])
      toast({
        title: 'Todas as ferramentas habilitadas',
        description: `${user.name || user.email} tem acesso a todo o catálogo.`,
      })
    } catch (err: any) {
      console.error('Erro ao habilitar todas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível gravar a habilitação.',
      })
    } finally {
      setSalvandoUserId(null)
    }
  }

  const nomePerfil = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'financeiro':
        return 'Financeiro'
      case 'comercial':
        return 'Comercial'
      case 'cliente':
        return 'Cliente'
      default:
        return 'Usuário Empresa'
    }
  }

  const iconePerfil = (role?: string) => {
    if (role === 'admin') return <Shield className="w-3 h-3" />
    if (role === 'cliente') return <Eye className="w-3 h-3" />
    return <Building2 className="w-3 h-3" />
  }

  return (
    <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
      <CardHeader className="py-3.5 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            Habilitar Ferramentas por Usuário
          </CardTitle>
          <CardDescription className="text-xs">
            Desabilite ferramentas do menu de cada usuário. Sem registro = tudo habilitado. A
            alteração vale na próxima navegação do usuário.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={carregar}
          disabled={isLoading}
          className="border-slate-300 hover:bg-slate-100"
        >
          <RotateCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar usuário por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {isLoading ? (
          <div className="py-8 flex flex-col items-center gap-2 text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Carregando usuários...</span>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-xs">
            Nenhum usuário encontrado com o termo buscado.
          </p>
        ) : (
          <div className="space-y-2">
            {usuariosFiltrados.map((u) => {
              const isUserAdmin = u.role === 'admin'
              const qtdOff = qtdDesabilitadas(u.id)
              const expandido = expandidoId === u.id
              const gruposIds = extractUserGruposIds(u as any)

              return (
                <div
                  key={u.id}
                  className="border border-slate-200 rounded-lg bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandidoId(expandido ? null : u.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1.5">
                          {u.name || 'Sem nome'}
                          {isUserAdmin && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0 px-1 gap-1">
                              <Shield className="w-3 h-3" />
                              acesso total
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] py-0 px-1.5 gap-1">
                        {iconePerfil(u.role)}
                        {nomePerfil(u.role)}
                      </Badge>
                      {gruposIds.length > 0 && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0 px-1.5 gap-1">
                          <Layers className="w-3 h-3" />
                          {gruposIds.length} grupo(s)
                        </Badge>
                      )}
                      <Badge
                        className={
                          qtdOff === 0
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] py-0 px-1.5'
                            : 'bg-amber-100 text-amber-800 border-amber-200 text-[10px] py-0 px-1.5'
                        }
                      >
                        {qtdOff === 0 ? 'Tudo habilitado' : `${qtdOff} desabilitada(s)`}
                      </Badge>
                    </div>
                  </button>

                  {expandido && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                      {isUserAdmin ? (
                        <p className="text-[11px] text-slate-500 italic">
                          Administrador tem acesso irrestrito — a habilitação não se aplica.
                        </p>
                      ) : (
                        <>
                          {u.role === 'cliente' && (
                            <p className="text-[11px] text-slate-500 mb-2">
                              Perfil Cliente: os toggles controlam o hub do cliente (Análise
                              Econômica e Financeira) e o menu dele. Sem nenhuma ferramenta
                              desabilitada, o cliente vê tudo como hoje.
                            </p>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                              Ferramentas do catálogo ({CATALOGO_FERRAMENTAS.length})
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={salvandoUserId === u.id || qtdOff === 0}
                              onClick={() => habilitarTudo(u)}
                              className="h-6 text-[10px] px-2 bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Habilitar todas
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {CATALOGO_FERRAMENTAS.map((f) => {
                              const on = isFerramentaOn(u.id, f.id as string)
                              return (
                                <div
                                  key={f.id}
                                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-xs transition-colors ${
                                    on
                                      ? 'bg-white border-slate-200'
                                      : 'bg-amber-50/70 border-amber-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-800 truncate">
                                      {f.nome}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {f.descricao}
                                    </div>
                                  </div>
                                  <Switch
                                    checked={on}
                                    disabled={salvandoUserId === u.id}
                                    onCheckedChange={(checked) =>
                                      toggleFerramenta(u, f.id, checked)
                                    }
                                    className="data-[state=checked]:bg-emerald-600 shrink-0"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AbaHabilitarFerramentas
