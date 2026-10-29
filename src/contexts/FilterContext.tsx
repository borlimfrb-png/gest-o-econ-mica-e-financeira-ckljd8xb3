import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  empresasService,
  gruposEmpresariaisService,
  balancosService,
  dreService,
  lancamentosService,
} from '@/services/financeService'
import pb from '@/lib/pocketbase/client'
import type { EmpresaRecord, GrupoEmpresarialRecord, BalancoRecord } from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from './AuthContext'

interface FilterContextType {
  empresas: EmpresaRecord[]
  grupos: GrupoEmpresarialRecord[]
  todasEntidades: EmpresaRecord[]
  selectedEmpresaId: string
  setSelectedEmpresaId: (id: string) => void
  selectedAno: number
  setSelectedAno: (ano: number) => void
  anosDisponiveis: number[]
  selectedEmpresa: EmpresaRecord | null
  isGrupoAtivo: boolean
  grupoAtivo: GrupoEmpresarialRecord | null
  empresasIdsAtivas: string[]
  balancosEmpresa: BalancoRecord[]
  isLoadingEmpresas: boolean
  reloadEmpresas: () => Promise<void>
  selectedCentroCustoId: string
  setSelectedCentroCustoId: (id: string) => void
  userEmpresasIds: string[]
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isAuthenticated,
    isAdmin,
    empresaVinculadaId,
    user,
    userEmpresasIds: authEmpresasIds,
  } = useAuth()

  // Lista de IDs de empresas vinculadas ao usuário autenticado (suporte a multi-empresas e campo legado)
  const userEmpresasIds: string[] = React.useMemo(() => {
    if (isAdmin) return []
    const list: string[] = []
    if (Array.isArray(authEmpresasIds) && authEmpresasIds.length > 0) {
      list.push(...authEmpresasIds)
    }
    if (Array.isArray(user?.empresas) && user.empresas.length > 0) {
      for (const item of user.empresas) {
        if (!item) continue
        if (typeof item === 'string') list.push(item.trim())
        else if (typeof item === 'object' && 'id' in item && (item as any).id) {
          list.push(String((item as any).id).trim())
        }
      }
    } else if (typeof (user as any)?.empresas === 'string' && (user as any).empresas.trim()) {
      const val = (user as any).empresas.trim()
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string') list.push(item.trim())
            else if (item && typeof item === 'object' && item.id) list.push(String(item.id).trim())
          }
        } else if (typeof parsed === 'string') {
          list.push(parsed.trim())
        }
      } catch {
        list.push(val)
      }
    }
    if (user?.expand?.empresas && Array.isArray(user.expand.empresas)) {
      list.push(
        ...user.expand.empresas.map((e) => (e?.id ? String(e.id).trim() : '')).filter(Boolean),
      )
    }
    if (user?.empresa) {
      const legado =
        typeof user.empresa === 'string'
          ? user.empresa.trim()
          : (user.empresa as any)?.id
            ? String((user.empresa as any).id).trim()
            : ''
      if (legado && !list.includes(legado)) {
        list.push(legado)
      }
    }
    if (user?.expand?.empresa?.id) {
      const expandLegado = String(user.expand.empresa.id).trim()
      if (expandLegado && !list.includes(expandLegado)) {
        list.push(expandLegado)
      }
    }
    if (empresaVinculadaId && !list.includes(empresaVinculadaId)) {
      list.push(empresaVinculadaId)
    }
    return Array.from(new Set(list.filter(Boolean)))
  }, [isAdmin, authEmpresasIds, user?.empresas, user?.expand, user?.empresa, empresaVinculadaId])

  const isCliente = user?.role === 'cliente'

  // Para usuário não-admin com empresa única fixada
  const empresaFixada =
    !isAdmin && !isCliente && userEmpresasIds.length === 1 ? userEmpresasIds[0] : null

  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [grupos, setGrupos] = useState<GrupoEmpresarialRecord[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(() => {
    return localStorage.getItem('filter_selected_empresa_id') || ''
  })

  // Sincronizar persistência no localStorage
  useEffect(() => {
    if (selectedEmpresaId) {
      localStorage.setItem('filter_selected_empresa_id', selectedEmpresaId)
    }
  }, [selectedEmpresaId])
  const [selectedAno, setSelectedAno] = useState<number>(2024)
  const [balancosEmpresa, setBalancosEmpresa] = useState<BalancoRecord[]>([])
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([2024, 2023])
  const [isLoadingEmpresas, setIsLoadingEmpresas] = useState<boolean>(true)
  const [selectedCentroCustoId, setSelectedCentroCustoId] = useState<string>(() => {
    return localStorage.getItem('filter_centro_custo_id') || 'todos'
  })

  useEffect(() => {
    if (selectedCentroCustoId) {
      localStorage.setItem('filter_centro_custo_id', selectedCentroCustoId)
    }
  }, [selectedCentroCustoId])

  const loadEmpresasEGrupos = async () => {
    if (!isAuthenticated) return
    try {
      setIsLoadingEmpresas(true)
      const [listEmpresasRaw, listGrupos] = await Promise.all([
        empresasService.getAll().catch((err) => {
          if (import.meta.env.DEV) {
            console.warn('[FilterContext] Falha ao listar todas as empresas:', err)
          }
          return [] as EmpresaRecord[]
        }),
        gruposEmpresariaisService.getAll().catch(() => [] as GrupoEmpresarialRecord[]),
      ])

      // Mapa para deduplicação e acesso rápido
      const empresasMap = new Map<string, EmpresaRecord>()
      for (const emp of listEmpresasRaw) {
        if (emp?.id) {
          empresasMap.set(emp.id, emp)
        }
      }

      // DETERMINISMO TOTAL PARA VÍNCULOS (BUSCA PREVENTIVA INDIVIDUAL E INCONDICIONAL):
      // Para cada ID de vínculo do usuário (userEmpresasIds) que não estiver presente na lista carregada,
      // fazer pb.collection('empresas').getOne(id) SEM nenhuma condição sobre nome/razão social,
      // e mesclar o resultado no empresasMap.
      if (userEmpresasIds.length > 0) {
        const idsAusentes = userEmpresasIds.filter((id) => !empresasMap.has(id))
        if (idsAusentes.length > 0) {
          const fetchedIndividuais = await Promise.all(
            idsAusentes.map(async (id) => {
              try {
                return await pb.collection('empresas').getOne<EmpresaRecord>(id)
              } catch (err) {
                console.warn(`[FilterContext] Falha ao recuperar empresa individual id=${id}:`, err)
                return null
              }
            }),
          )

          for (const emp of fetchedIndividuais) {
            if (emp && emp.id) {
              empresasMap.set(emp.id, emp)
            }
          }
        }
      }

      const todasEmpresasCarregadas = Array.from(empresasMap.values())

      let empresasFiltradas: EmpresaRecord[] = todasEmpresasCarregadas
      let gruposFiltrados: GrupoEmpresarialRecord[] = listGrupos

      // Para perfil cliente: montar a lista estritamente a partir dos vínculos do usuário;
      // manter o bloqueio de segurança (cliente só vê vínculos dele).
      if (isCliente) {
        if (userEmpresasIds.length > 0) {
          const listaCliente: EmpresaRecord[] = []
          for (const vId of userEmpresasIds) {
            const empRecord = empresasMap.get(vId)
            if (empRecord) {
              listaCliente.push(empRecord)
            }
          }
          empresasFiltradas = listaCliente
        } else {
          empresasFiltradas = []
        }
        gruposFiltrados = []
      } else if (!isAdmin && userEmpresasIds.length > 0) {
        empresasFiltradas = todasEmpresasCarregadas.filter((e) => userEmpresasIds.includes(e.id))
        gruposFiltrados = listGrupos.filter((g) =>
          (g.empresas || []).some((empId) => userEmpresasIds.includes(empId)),
        )
      }

      // Ordenar alfabeticamente pelo nome/nome_fantasia para consistência no seletor
      empresasFiltradas.sort((a, b) => {
        const nomeA = a.nome_fantasia || a.nome || ''
        const nomeB = b.nome_fantasia || b.nome || ''
        return nomeA.localeCompare(nomeB)
      })

      if (import.meta.env.DEV) {
        console.log(
          `[FilterContext dev] empresas disponíveis (${empresasFiltradas.length}) vs. vinculadas (${userEmpresasIds.length}):`,
          {
            perfil: user?.role,
            userEmpresasIds,
            empresasDisponiveis: empresasFiltradas.map((e) => ({
              id: e.id,
              nome: e.nome,
              nome_fantasia: e.nome_fantasia,
            })),
          },
        )
      }

      setEmpresas(empresasFiltradas)
      setGrupos(gruposFiltrados)

      const todasEntidadesIds = [
        ...empresasFiltradas.map((e) => e.id),
        ...gruposFiltrados.map((g) => `grupo-${g.id}`),
      ]

      if (todasEntidadesIds.length > 0) {
        // Se a empresa atualmente selecionada não pertencer à lista permitida, redefine.
        // Dá preferência ao valor salvo no localStorage se ele pertencer à lista permitida.
        setSelectedEmpresaId((prevId) => {
          if (prevId && todasEntidadesIds.includes(prevId)) {
            return prevId
          }
          const savedId = localStorage.getItem('filter_selected_empresa_id')
          if (savedId && todasEntidadesIds.includes(savedId)) {
            return savedId
          }
          return todasEntidadesIds[0]
        })
      } else {
        setSelectedEmpresaId('')
      }
    } catch (err) {
      console.error('Erro ao carregar empresas e grupos:', err)
    } finally {
      setIsLoadingEmpresas(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadEmpresasEGrupos()
    } else {
      setEmpresas([])
      setGrupos([])
      setSelectedEmpresaId('')
    }
  }, [
    isAuthenticated,
    isAdmin,
    isCliente,
    empresaVinculadaId,
    user?.role,
    user?.empresa,
    JSON.stringify(user?.empresas || []),
    JSON.stringify(authEmpresasIds || []),
    JSON.stringify(userEmpresasIds || []),
  ])

  // Realtime empresas
  useRealtime<EmpresaRecord>(
    'empresas',
    () => {
      loadEmpresasEGrupos()
    },
    isAuthenticated,
  )

  // Realtime grupos_empresariais
  useRealtime<GrupoEmpresarialRecord>(
    'grupos_empresariais',
    () => {
      loadEmpresasEGrupos()
    },
    isAuthenticated,
  )

  // Carregar anos disponíveis a partir de balancos, dre e lançamentos da empresa selecionada
  const loadExerciciosEmpresa = async (empresaId: string) => {
    if (!empresaId) return
    try {
      // Se for grupo ('grupo-XXX'), não busca por empresa específica ou busca balancos das empresas do grupo
      const isGrupo = empresaId.startsWith('grupo-')
      const targetEmpresaId = isGrupo ? undefined : empresaId

      const [bList, dreList, lancList] = await Promise.all([
        targetEmpresaId
          ? balancosService.getByEmpresa(targetEmpresaId).catch(() => [] as BalancoRecord[])
          : Promise.resolve([] as BalancoRecord[]),
        targetEmpresaId
          ? dreService.getByEmpresa(targetEmpresaId).catch(() => [])
          : Promise.resolve([]),
        targetEmpresaId
          ? lancamentosService.getAll({ empresaId: targetEmpresaId }).catch(() => [] as any[])
          : Promise.resolve([] as any[]),
      ])

      setBalancosEmpresa(bList)

      const anosBalancos = bList.map((b) => b.ano).filter(Boolean)
      const anosDre = dreList.map((d: any) => d.ano).filter(Boolean)
      const anosLancamentos = lancList
        .map((l: any) => {
          if (l.data) {
            const y = new Date(l.data).getFullYear()
            return isNaN(y) ? null : y
          }
          return null
        })
        .filter((y): y is number => typeof y === 'number' && y > 1900 && y < 2100)

      const anosCompletos = Array.from(
        new Set([...anosBalancos, ...anosDre, ...anosLancamentos]),
      ).sort((a, b) => b - a)

      if (anosCompletos.length > 0) {
        setAnosDisponiveis(anosCompletos)
        // Seleciona por padrão o ano mais recente que possua dados reais
        setSelectedAno((prevAno) => (anosCompletos.includes(prevAno) ? prevAno : anosCompletos[0]))
      } else {
        const anosPadrao = [new Date().getFullYear(), new Date().getFullYear() - 1]
        setAnosDisponiveis(anosPadrao)
        setSelectedAno((prevAno) => (anosPadrao.includes(prevAno) ? prevAno : anosPadrao[0]))
      }
    } catch (err) {
      console.error('Erro ao carregar exercícios da empresa:', err)
    }
  }

  useEffect(() => {
    if (selectedEmpresaId) {
      loadExerciciosEmpresa(selectedEmpresaId)
    }
  }, [selectedEmpresaId])

  // Realtime balancos
  useRealtime<BalancoRecord>(
    'balancos',
    () => {
      if (selectedEmpresaId) {
        loadExerciciosEmpresa(selectedEmpresaId)
      }
    },
    isAuthenticated,
  )

  // Realtime dre
  useRealtime(
    'dre',
    () => {
      if (selectedEmpresaId) {
        loadExerciciosEmpresa(selectedEmpresaId)
      }
    },
    isAuthenticated,
  )

  // Converte grupos em formato compatível com EmpresaRecord para renderização uniforme
  const entidadesGrupos: EmpresaRecord[] = grupos.map((g) => {
    const qtdEmpresas = (g.empresas || []).length
    return {
      id: `grupo-${g.id}`,
      collectionId: g.collectionId,
      collectionName: g.collectionName,
      created: g.created,
      updated: g.updated,
      nome: g.nome,
      nome_fantasia: `Grupo (${qtdEmpresas} ${qtdEmpresas === 1 ? 'empresa' : 'empresas'})`,
      cnpj: 'CONSOLIDADO',
      segmento: 'Outros' as any,
      observacoes: g.descricao || '',
      is_grupo: true,
      grupo_id: g.id,
      empresas_ids: g.empresas || [],
    } as EmpresaRecord
  })

  const todasEntidades = [...empresas, ...entidadesGrupos]

  const isGrupoAtivo = selectedEmpresaId.startsWith('grupo-')
  const grupoAtivo = isGrupoAtivo
    ? grupos.find((g) => `grupo-${g.id}` === selectedEmpresaId) || null
    : null

  const selectedEmpresa =
    todasEntidades.find((e) => e.id === selectedEmpresaId) ||
    empresas.find((e) => e.id === selectedEmpresaId) ||
    null

  // Lista desagregada de IDs de empresas ativas (para empresa única ou membros do grupo)
  // IMPORTANTE: Se o cliente tem selectedEmpresaId selecionada, ela é a empresa ativa.
  // Se ainda não houver selectedEmpresaId ou for grupo inválido, e o cliente tiver empresas vinculadas,
  // mantemos a primeira da lista como padrão até seleção, mas NUNCA forçamos apenas userEmpresasIds[0] se houver selectedEmpresaId válida.
  const empresasIdsAtivas: string[] =
    isGrupoAtivo && grupoAtivo && (grupoAtivo.empresas || []).length > 0
      ? grupoAtivo.empresas || []
      : selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
        ? [selectedEmpresaId]
        : empresaFixada
          ? [empresaFixada]
          : isCliente && userEmpresasIds.length > 0
            ? selectedEmpresaId && userEmpresasIds.includes(selectedEmpresaId)
              ? [selectedEmpresaId]
              : [userEmpresasIds[0]]
            : []

  return (
    <FilterContext.Provider
      value={{
        empresas,
        grupos,
        todasEntidades,
        selectedEmpresaId,
        setSelectedEmpresaId: (id: string) => {
          // Se for perfil cliente: restringe a seleção estritamente às empresas do seu vínculo
          if (isCliente) {
            if (userEmpresasIds.includes(id)) {
              setSelectedEmpresaId(id)
              localStorage.setItem('filter_selected_empresa_id', id)
            } else if (
              userEmpresasIds.length > 0 &&
              (!selectedEmpresaId || !userEmpresasIds.includes(selectedEmpresaId))
            ) {
              setSelectedEmpresaId(userEmpresasIds[0])
              localStorage.setItem('filter_selected_empresa_id', userEmpresasIds[0])
            }
            return
          }

          // Se for usuário com apenas uma empresa fixada, mantém ela
          if (empresaFixada) {
            setSelectedEmpresaId(empresaFixada)
            return
          }

          // Se for usuário não-admin com empresas vinculadas, só permite as suas
          if (!isAdmin && userEmpresasIds.length > 0) {
            const isGrupoPermitido =
              id.startsWith('grupo-') && grupos.some((g) => `grupo-${g.id}` === id)
            if (userEmpresasIds.includes(id) || isGrupoPermitido) {
              setSelectedEmpresaId(id)
            }
            return
          }

          setSelectedEmpresaId(id)
        },
        selectedAno,
        setSelectedAno,
        anosDisponiveis,
        selectedEmpresa,
        isGrupoAtivo,
        grupoAtivo,
        empresasIdsAtivas,
        balancosEmpresa,
        isLoadingEmpresas,
        reloadEmpresas: loadEmpresasEGrupos,
        selectedCentroCustoId,
        setSelectedCentroCustoId,
        userEmpresasIds,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter(): FilterContextType {
  const ctx = useContext(FilterContext)
  if (!ctx) {
    throw new Error('useFilter must be used within a FilterProvider')
  }
  return ctx
}
