import React, { createContext, useContext, useState, useEffect } from 'react'
import { empresasService, balancosService } from '@/services/financeService'
import type { EmpresaRecord, BalancoRecord } from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from './AuthContext'

interface FilterContextType {
  empresas: EmpresaRecord[]
  selectedEmpresaId: string
  setSelectedEmpresaId: (id: string) => void
  selectedAno: number
  setSelectedAno: (ano: number) => void
  anosDisponiveis: number[]
  selectedEmpresa: EmpresaRecord | null
  balancosEmpresa: BalancoRecord[]
  isLoadingEmpresas: boolean
  reloadEmpresas: () => Promise<void>
  selectedCentroCustoId: string
  setSelectedCentroCustoId: (id: string) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
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

  const loadEmpresas = async () => {
    if (!isAuthenticated) return
    try {
      setIsLoadingEmpresas(true)
      const list = await empresasService.getAll()
      setEmpresas(list)
      if (list.length > 0) {
        if (!selectedEmpresaId || !list.some((e) => e.id === selectedEmpresaId)) {
          setSelectedEmpresaId(list[0].id)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar empresas:', err)
    } finally {
      setIsLoadingEmpresas(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadEmpresas()
    } else {
      setEmpresas([])
      setSelectedEmpresaId('')
    }
  }, [isAuthenticated])

  // Realtime empresas
  useRealtime<EmpresaRecord>(
    'empresas',
    () => {
      loadEmpresas()
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

  const selectedEmpresa = empresas.find((e) => e.id === selectedEmpresaId) || null

  return (
    <FilterContext.Provider
      value={{
        empresas,
        selectedEmpresaId,
        setSelectedEmpresaId,
        selectedAno,
        setSelectedAno,
        anosDisponiveis,
        selectedEmpresa,
        balancosEmpresa,
        isLoadingEmpresas,
        reloadEmpresas: loadEmpresas,
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
