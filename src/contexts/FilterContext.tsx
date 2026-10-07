import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  empresasService,
  gruposEmpresariaisService,
  balancosService,
  dreService,
  lancamentosService,
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

      const empresaFixada =
        (!isAdmin && empresaVinculadaId) || (user?.role === 'cliente' && user?.empresa)
          ? empresaVinculadaId || user?.empresa || null
          : null

      if (empresaFixada) {
        empresasFiltradas = listEmpresas.filter((e) => e.id === empresaFixada)
        // Grupos que contenham a empresa do usuário
        gruposFiltrados = listGrupos.filter((g) => (g.empresas || []).includes(empresaFixada))
      }

      setEmpresas(empresasFiltradas)
      setGrupos(gruposFiltrados)

      // Se usuário for comum/cliente e tiver empresa vinculada, pré-seleciona e fixa nela
      if (empresaFixada) {
        setSelectedEmpresaId(empresaFixada)
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

  return (
    <FilterContext.Provider
      value={{
        empresas,
        grupos,
        todasEntidades,
        selectedEmpresaId,
        setSelectedEmpresaId: (id: string) => {
          // Se for usuário comum ou cliente, não permite trocar empresa para outra diferente da vinculada
          const fixada =
            (!isAdmin && empresaVinculadaId) || (user?.role === 'cliente' && user?.empresa)
              ? empresaVinculadaId || user?.empresa
              : null
          if (fixada) {
            setSelectedEmpresaId(fixada)
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
