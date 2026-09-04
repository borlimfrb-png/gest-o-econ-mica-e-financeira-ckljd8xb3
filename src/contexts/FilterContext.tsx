import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  empresasService,
  gruposEmpresariaisService,
  balancosService,
} from '@/services/financeService'
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
  balancosEmpresa: BalancoRecord[]
  isLoadingEmpresas: boolean
  reloadEmpresas: () => Promise<void>
  selectedCentroCustoId: string
  setSelectedCentroCustoId: (id: string) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, empresaVinculadaId, user } = useAuth()
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [grupos, setGrupos] = useState<GrupoEmpresarialRecord[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
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
      const [listEmpresas, listGrupos] = await Promise.all([
        empresasService.getAll(),
        gruposEmpresariaisService.getAll().catch(() => [] as GrupoEmpresarialRecord[]),
      ])

      // Se for usuário de empresa (não admin), garante filtragem estrita pela empresa vinculada
      let empresasFiltradas = listEmpresas
      let gruposFiltrados = listGrupos

      if (!isAdmin && empresaVinculadaId) {
        empresasFiltradas = listEmpresas.filter((e) => e.id === empresaVinculadaId)
        // Grupos que contenham a empresa do usuário
        gruposFiltrados = listGrupos.filter((g) => (g.empresas || []).includes(empresaVinculadaId))
      }

      setEmpresas(empresasFiltradas)
      setGrupos(gruposFiltrados)

      // Se usuário for comum e tiver empresa vinculada, fixa nela
      if (!isAdmin && empresaVinculadaId) {
        setSelectedEmpresaId(empresaVinculadaId)
      } else {
        const todasEntidadesIds = [
          ...empresasFiltradas.map((e) => e.id),
          ...gruposFiltrados.map((g) => `grupo-${g.id}`),
        ]

        if (todasEntidadesIds.length > 0) {
          if (!selectedEmpresaId || !todasEntidadesIds.includes(selectedEmpresaId)) {
            setSelectedEmpresaId(todasEntidadesIds[0])
          }
        }
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
  }, [isAuthenticated, isAdmin, empresaVinculadaId, user?.role, user?.empresa])

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

  // Carregar balanços da empresa selecionada para saber anos disponíveis
  const loadBalancosEmpresa = async (empresaId: string) => {
    if (!empresaId) return
    try {
      const bList = await balancosService.getByEmpresa(empresaId)
      setBalancosEmpresa(bList)
      const anos = Array.from(new Set(bList.map((b) => b.ano))).sort((a, b) => b - a)
      if (anos.length > 0) {
        setAnosDisponiveis(anos)
        if (!anos.includes(selectedAno)) {
          setSelectedAno(anos[0])
        }
      } else {
        setAnosDisponiveis([2024, 2023])
      }
    } catch (err) {
      console.error('Erro ao carregar balanços da empresa:', err)
    }
  }

  useEffect(() => {
    if (selectedEmpresaId) {
      loadBalancosEmpresa(selectedEmpresaId)
    }
  }, [selectedEmpresaId])

  // Realtime balancos
  useRealtime<BalancoRecord>(
    'balancos',
    () => {
      if (selectedEmpresaId) {
        loadBalancosEmpresa(selectedEmpresaId)
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

  return (
    <FilterContext.Provider
      value={{
        empresas,
        grupos,
        todasEntidades,
        selectedEmpresaId,
        setSelectedEmpresaId: (id: string) => {
          // Se for usuário comum, não permite trocar empresa para outra diferente da vinculada
          if (!isAdmin && empresaVinculadaId) {
            setSelectedEmpresaId(empresaVinculadaId)
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
        balancosEmpresa,
        isLoadingEmpresas,
        reloadEmpresas: loadEmpresasEGrupos,
        selectedCentroCustoId,
        setSelectedCentroCustoId,
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
