import type { AppUser } from '@/contexts/AuthContext'
import type { GrupoEmpresarialRecord } from '@/types/finance'

export interface ResolucaoVinculosOptions {
  user: AppUser | null | undefined
  gruposDisponiveis?: GrupoEmpresarialRecord[]
}

/**
 * Extrai IDs diretos de grupos vinculados ao usuário.
 * Suporta array de IDs (string[]), objetos expandidos e eventuais serializações JSON.
 */
export function extractUserGruposIds(user: AppUser | null | undefined): string[] {
  if (!user) return []
  const ids: string[] = []

  const rawGrupos = (user as any).grupos_empresariais
  if (Array.isArray(rawGrupos)) {
    for (const item of rawGrupos) {
      if (!item) continue
      if (typeof item === 'string') {
        ids.push(item.trim())
      } else if (typeof item === 'object' && 'id' in item && item.id) {
        ids.push(String(item.id).trim())
      }
    }
  } else if (typeof rawGrupos === 'string' && rawGrupos.trim()) {
    const val = rawGrupos.trim()
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') ids.push(item.trim())
          else if (item && typeof item === 'object' && item.id) ids.push(String(item.id).trim())
        }
      } else if (typeof parsed === 'string') {
        ids.push(parsed.trim())
      }
    } catch {
      ids.push(val)
    }
  }

  // Expand de grupos_empresariais
  const expandGrupos = user.expand?.grupos_empresariais
  if (Array.isArray(expandGrupos)) {
    for (const item of expandGrupos) {
      if (!item) continue
      const id = typeof item === 'object' && 'id' in item ? String(item.id).trim() : ''
      if (id && !ids.includes(id)) {
        ids.push(id)
      }
    }
  }

  return Array.from(new Set(ids.filter(Boolean)))
}

/**
 * Expande e mescla os vínculos de um usuário:
 * - Empresas individuais vinculadas (campo `empresas`, campo legado `empresa`)
 * - Empresas pertencentes aos grupos vinculados (campo `grupos_empresariais`)
 * Retorna uma lista de IDs deduplicada, preservando a retrocompatibilidade.
 */
export function resolverEmpresasPermitidas(options: ResolucaoVinculosOptions): {
  empresasIndividuaisIds: string[]
  gruposVinculadosIds: string[]
  empresasDosGruposIds: string[]
  todasEmpresasIds: string[]
} {
  const { user, gruposDisponiveis = [] } = options
  if (!user) {
    return {
      empresasIndividuaisIds: [],
      gruposVinculadosIds: [],
      empresasDosGruposIds: [],
      todasEmpresasIds: [],
    }
  }

  // 1. Extração de empresas individuais
  const empresasIndividuaisIds: string[] = []
  if (Array.isArray(user.empresas)) {
    for (const item of user.empresas) {
      if (!item) continue
      if (typeof item === 'string') {
        empresasIndividuaisIds.push(item.trim())
      } else if (typeof item === 'object' && 'id' in item && (item as any).id) {
        empresasIndividuaisIds.push(String((item as any).id).trim())
      }
    }
  } else if (typeof (user as any).empresas === 'string' && (user as any).empresas.trim()) {
    const val = (user as any).empresas.trim()
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') empresasIndividuaisIds.push(item.trim())
          else if (item && typeof item === 'object' && item.id)
            empresasIndividuaisIds.push(String(item.id).trim())
        }
      } else if (typeof parsed === 'string') {
        empresasIndividuaisIds.push(parsed.trim())
      }
    } catch {
      empresasIndividuaisIds.push(val)
    }
  }

  if (user.expand?.empresas && Array.isArray(user.expand.empresas)) {
    for (const item of user.expand.empresas) {
      if (!item) continue
      const id = typeof item === 'object' && 'id' in item ? String(item.id).trim() : ''
      if (id && !empresasIndividuaisIds.includes(id)) {
        empresasIndividuaisIds.push(id)
      }
    }
  }

  const legadoId =
    typeof user.empresa === 'string'
      ? user.empresa.trim()
      : (user.empresa as any)?.id
        ? String((user.empresa as any).id).trim()
        : ''
  if (legadoId && !empresasIndividuaisIds.includes(legadoId)) {
    empresasIndividuaisIds.push(legadoId)
  }

  if (user.expand?.empresa?.id) {
    const expandEmpresaId = String(user.expand.empresa.id).trim()
    if (expandEmpresaId && !empresasIndividuaisIds.includes(expandEmpresaId)) {
      empresasIndividuaisIds.push(expandEmpresaId)
    }
  }

  const cleanIndividuais = Array.from(new Set(empresasIndividuaisIds.filter(Boolean)))

  // 2. Extração de grupos vinculados
  const gruposVinculadosIds = extractUserGruposIds(user)

  // 3. Expansão das empresas pertencentes aos grupos vinculados
  const empresasDosGruposIds: string[] = []

  // 3a. A partir de user.expand.grupos_empresariais (se veio expandido no usuário)
  if (user.expand?.grupos_empresariais && Array.isArray(user.expand.grupos_empresariais)) {
    for (const g of user.expand.grupos_empresariais) {
      if (!g) continue
      if (Array.isArray(g.empresas)) {
        for (const empId of g.empresas) {
          if (empId) empresasDosGruposIds.push(String(empId).trim())
        }
      }
      if (g.expand?.empresas && Array.isArray(g.expand.empresas)) {
        for (const e of g.expand.empresas) {
          if (e?.id) empresasDosGruposIds.push(String(e.id).trim())
        }
      }
    }
  }

  // 3b. A partir dos gruposDisponiveis (passados na chamada)
  for (const g of gruposDisponiveis) {
    if (!g?.id) continue
    if (gruposVinculadosIds.includes(g.id)) {
      if (Array.isArray(g.empresas)) {
        for (const empId of g.empresas) {
          if (empId) empresasDosGruposIds.push(String(empId).trim())
        }
      }
      if (g.expand?.empresas && Array.isArray(g.expand.empresas)) {
        for (const e of g.expand.empresas) {
          if (e?.id) empresasDosGruposIds.push(String(e.id).trim())
        }
      }
    }
  }

  const cleanEmpresasGrupos = Array.from(new Set(empresasDosGruposIds.filter(Boolean)))

  // 4. Merge total deduplicado
  const todasEmpresasIds = Array.from(new Set([...cleanIndividuais, ...cleanEmpresasGrupos]))

  return {
    empresasIndividuaisIds: cleanIndividuais,
    gruposVinculadosIds,
    empresasDosGruposIds: cleanEmpresasGrupos,
    todasEmpresasIds,
  }
}
