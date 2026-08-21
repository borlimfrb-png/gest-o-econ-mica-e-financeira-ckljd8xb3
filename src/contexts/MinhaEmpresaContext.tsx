import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { MinhaEmpresaRecord } from '@/types/finance'
import { minhaEmpresaService } from '@/services/minhaEmpresaService'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'

interface MinhaEmpresaContextType {
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
  corPrimaria: string
  corSecundaria: string
  isLoading: boolean
  refetch: () => Promise<void>
}

const DEFAULT_COR_PRIMARIA = '#0B1F3A'
const DEFAULT_COR_SECUNDARIA = '#2563EB'

const MinhaEmpresaContext = createContext<MinhaEmpresaContextType | undefined>(undefined)

/**
 * Converte hex (#RRGGBB) para HSL string (ex: "217.2 91.2% 59.8%")
 * compatível com as variáveis Tailwind / shadcn/ui
 */
function hexToHslString(hex: string): string | null {
  const cleanHex = hex.replace('#', '').trim()
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return null

  let r = 0,
    g = 0,
    b = 0
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255
    g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255
    b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255
  } else {
    r = parseInt(cleanHex.slice(0, 2), 16) / 255
    g = parseInt(cleanHex.slice(2, 4), 16) / 255
    b = parseInt(cleanHex.slice(4, 6), 16) / 255
  }

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  const hDeg = Math.round(h * 360)
  const sPct = (s * 100).toFixed(1)
  const lPct = (l * 100).toFixed(1)

  return `${hDeg} ${sPct}% ${lPct}%`
}

export const MinhaEmpresaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [minhaEmpresa, setMinhaEmpresa] = useState<MinhaEmpresaRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setMinhaEmpresa(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const data = await minhaEmpresaService.get()
      setMinhaEmpresa(data)
    } catch (err) {
      console.error('Erro ao carregar dados de Minha Empresa:', err)
      setMinhaEmpresa(null)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Inscrição em tempo real para atualizações na collection minha_empresa
  useRealtime<MinhaEmpresaRecord>('minha_empresa', (e) => {
    if (!user?.id) return
    if (e.record && e.record.user === user.id) {
      if (e.action === 'delete') {
        setMinhaEmpresa(null)
      } else {
        setMinhaEmpresa(e.record)
      }
    } else {
      // Caso não consiga checar o user diretamente, refaz o load
      loadData()
    }
  })

  const corPrimaria = minhaEmpresa?.cor_primaria?.trim() || DEFAULT_COR_PRIMARIA
  const corSecundaria = minhaEmpresa?.cor_secundaria?.trim() || DEFAULT_COR_SECUNDARIA

  const logoUrl =
    minhaEmpresa && minhaEmpresa.logo ? pb.files.getURL(minhaEmpresa, minhaEmpresa.logo) : null

  // Atualização dinâmica das CSS custom properties no document.documentElement
  useEffect(() => {
    const root = document.documentElement

    if (minhaEmpresa?.cor_primaria) {
      root.style.setProperty('--brand-primary', corPrimaria)
      const hsl = hexToHslString(corPrimaria)
      if (hsl) {
        root.style.setProperty('--brand-primary-hsl', hsl)
      }
    } else {
      root.style.setProperty('--brand-primary', DEFAULT_COR_PRIMARIA)
      const hsl = hexToHslString(DEFAULT_COR_PRIMARIA)
      if (hsl) root.style.setProperty('--brand-primary-hsl', hsl)
    }

    if (minhaEmpresa?.cor_secundaria) {
      root.style.setProperty('--brand-secondary', corSecundaria)
      const hsl = hexToHslString(corSecundaria)
      if (hsl) {
        root.style.setProperty('--brand-secondary-hsl', hsl)
      }
    } else {
      root.style.setProperty('--brand-secondary', DEFAULT_COR_SECUNDARIA)
      const hsl = hexToHslString(DEFAULT_COR_SECUNDARIA)
      if (hsl) root.style.setProperty('--brand-secondary-hsl', hsl)
    }

    return () => {
      // Limpeza opcional
    }
  }, [corPrimaria, corSecundaria, minhaEmpresa?.cor_primaria, minhaEmpresa?.cor_secundaria])

  return (
    <MinhaEmpresaContext.Provider
      value={{
        minhaEmpresa,
        logoUrl,
        corPrimaria,
        corSecundaria,
        isLoading,
        refetch: loadData,
      }}
    >
      {children}
    </MinhaEmpresaContext.Provider>
  )
}

export function useMinhaEmpresa(): MinhaEmpresaContextType {
  const context = useContext(MinhaEmpresaContext)
  if (!context) {
    throw new Error('useMinhaEmpresa must be used within a MinhaEmpresaProvider')
  }
  return context
}
