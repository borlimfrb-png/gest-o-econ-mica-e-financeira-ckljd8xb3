import { describe, it, expect } from 'vitest'
import { extractUserGruposIds, resolverEmpresasPermitidas } from './vinculosEmpresas'
import { extractUserEmpresasAndGruposIds, extractUserEmpresasIds } from '@/contexts/AuthContext'
import type { AppUser } from '@/contexts/AuthContext'
import type { GrupoEmpresarialRecord } from '@/types/finance'

describe('vinculosEmpresas - Merge e Expansão de Vínculos (Individuais + Grupos Econômicos)', () => {
  const grupoAlpha: GrupoEmpresarialRecord = {
    id: 'grp-alpha',
    collectionId: 'grupos_empresariais',
    collectionName: 'grupos_empresariais',
    nome: 'Grupo Alpha',
    descricao: 'Holding Alpha',
    empresas: ['emp-1', 'emp-2'],
    created: '2024-01-01',
    updated: '2024-01-01',
  }

  const grupoBeta: GrupoEmpresarialRecord = {
    id: 'grp-beta',
    collectionId: 'grupos_empresariais',
    collectionName: 'grupos_empresariais',
    nome: 'Grupo Beta',
    descricao: 'Holding Beta',
    empresas: ['emp-2', 'emp-3', 'emp-4'],
    created: '2024-01-01',
    updated: '2024-01-01',
  }

  const todosGrupos: GrupoEmpresarialRecord[] = [grupoAlpha, grupoBeta]

  describe('extractUserGruposIds', () => {
    it('retorna vazio se o usuário for nulo ou indefinido', () => {
      expect(extractUserGruposIds(null)).toEqual([])
      expect(extractUserGruposIds(undefined)).toEqual([])
    })

    it('extrai grupos passados como array de strings', () => {
      const user = {
        id: 'u1',
        email: 'teste@exemplo.com',
        grupos_empresariais: ['grp-alpha', 'grp-beta'],
      } as unknown as AppUser

      expect(extractUserGruposIds(user)).toEqual(['grp-alpha', 'grp-beta'])
    })

    it('extrai grupos passados via expand', () => {
      const user = {
        id: 'u1',
        email: 'teste@exemplo.com',
        expand: {
          grupos_empresariais: [{ id: 'grp-alpha', nome: 'Alpha' } as any],
        },
      } as unknown as AppUser

      expect(extractUserGruposIds(user)).toEqual(['grp-alpha'])
    })

    it('deduplica IDs repetidos entre array e expand', () => {
      const user = {
        id: 'u1',
        email: 'teste@exemplo.com',
        grupos_empresariais: ['grp-alpha'],
        expand: {
          grupos_empresariais: [{ id: 'grp-alpha' } as any, { id: 'grp-beta' } as any],
        },
      } as unknown as AppUser

      expect(extractUserGruposIds(user)).toEqual(['grp-alpha', 'grp-beta'])
    })
  })

  describe('resolverEmpresasPermitidas', () => {
    it('retorna listas vazias quando o usuário for nulo', () => {
      const res = resolverEmpresasPermitidas({ user: null, gruposDisponiveis: todosGrupos })
      expect(res.empresasIndividuaisIds).toEqual([])
      expect(res.gruposVinculadosIds).toEqual([])
      expect(res.empresasDosGruposIds).toEqual([])
      expect(res.todasEmpresasIds).toEqual([])
    })

    it('usuário com apenas empresas individuais (retrocompatibilidade)', () => {
      const user = {
        id: 'u-legado',
        email: 'legado@exemplo.com',
        empresas: ['emp-10', 'emp-11'],
        empresa: 'emp-10',
      } as unknown as AppUser

      const res = resolverEmpresasPermitidas({ user, gruposDisponiveis: todosGrupos })
      expect(res.empresasIndividuaisIds).toEqual(['emp-10', 'emp-11'])
      expect(res.gruposVinculadosIds).toEqual([])
      expect(res.empresasDosGruposIds).toEqual([])
      expect(res.todasEmpresasIds).toEqual(['emp-10', 'emp-11'])
    })

    it('usuário vinculado apenas a um grupo econômico expande todas as empresas do grupo', () => {
      const user = {
        id: 'u-grupo',
        email: 'cliente@grupo.com',
        grupos_empresariais: ['grp-alpha'],
      } as unknown as AppUser

      const res = resolverEmpresasPermitidas({ user, gruposDisponiveis: todosGrupos })
      expect(res.empresasIndividuaisIds).toEqual([])
      expect(res.gruposVinculadosIds).toEqual(['grp-alpha'])
      expect(res.empresasDosGruposIds).toEqual(['emp-1', 'emp-2'])
      expect(res.todasEmpresasIds).toEqual(['emp-1', 'emp-2'])
    })

    it('usuário com empresas individuais E grupos vinculados tem merge deduplicado', () => {
      const user = {
        id: 'u-misto',
        email: 'misto@exemplo.com',
        empresas: ['emp-1', 'emp-5'], // emp-1 já está no grupo Alpha
        grupos_empresariais: ['grp-alpha', 'grp-beta'], // emp-2 compartilhada entre os grupos
      } as unknown as AppUser

      const res = resolverEmpresasPermitidas({ user, gruposDisponiveis: todosGrupos })
      expect(res.empresasIndividuaisIds).toEqual(['emp-1', 'emp-5'])
      expect(res.gruposVinculadosIds).toEqual(['grp-alpha', 'grp-beta'])
      // emp-1 e emp-2 (de Alpha) + emp-2, emp-3, emp-4 (de Beta)
      expect(res.empresasDosGruposIds).toEqual(['emp-1', 'emp-2', 'emp-3', 'emp-4'])
      // Todas deduplicadas
      expect(res.todasEmpresasIds).toEqual(['emp-1', 'emp-5', 'emp-2', 'emp-3', 'emp-4'])
    })

    it('expande grupos mesmo que o array gruposDisponiveis não seja fornecido se vier no user.expand', () => {
      const user = {
        id: 'u-expand',
        email: 'expand@exemplo.com',
        expand: {
          grupos_empresariais: [
            {
              id: 'grp-gamma',
              nome: 'Grupo Gamma',
              empresas: ['emp-99', 'emp-100'],
            } as any,
          ],
        },
      } as unknown as AppUser

      const res = resolverEmpresasPermitidas({ user })
      expect(res.gruposVinculadosIds).toEqual(['grp-gamma'])
      expect(res.empresasDosGruposIds).toEqual(['emp-99', 'emp-100'])
      expect(res.todasEmpresasIds).toEqual(['emp-99', 'emp-100'])
    })

    it('reproduz com precisão o caso real do usuário maic@imcal.com.br (vínculo individual multi-empresa)', () => {
      // Usuário real cadastrado no banco:
      // role: 'cliente', empresas: ['nhvab3tif4lil5i', 'z1pgfks1abh4s7c']
      // nhvab3tif4lil5i = MATIC MÓVEIS DE BEBE LTDA
      // z1pgfks1abh4s7c = CARGOMOVE TRANSPORTES E LOGISTICA LTDA
      const userMaic = {
        id: '0q9f21j2a3t3b6d',
        email: 'maic@imcal.com.br',
        name: 'Maic Ronny Imcal',
        role: 'cliente',
        ativo: true,
        empresa: 'nhvab3tif4lil5i',
        empresas: ['nhvab3tif4lil5i', 'z1pgfks1abh4s7c'],
        grupos_empresariais: [],
      } as unknown as AppUser

      const res = resolverEmpresasPermitidas({ user: userMaic, gruposDisponiveis: todosGrupos })
      expect(res.empresasIndividuaisIds).toEqual(['nhvab3tif4lil5i', 'z1pgfks1abh4s7c'])
      expect(res.todasEmpresasIds).toHaveLength(2)
      expect(res.todasEmpresasIds).toContain('nhvab3tif4lil5i')
      expect(res.todasEmpresasIds).toContain('z1pgfks1abh4s7c')

      // Na AuthContext e FilterContext
      const empresasIdsSessao = extractUserEmpresasAndGruposIds(userMaic)
      expect(empresasIdsSessao).toEqual(['nhvab3tif4lil5i', 'z1pgfks1abh4s7c'])
    })

    it('usuário cliente vinculado somente por grupo empresarial vê todas as empresas do grupo no login e sessão', () => {
      // Cliente vinculado ao Grupo Alpha (membros: emp-1, emp-2)
      const userGrupoApenas = {
        id: 'u-cliente-grupo',
        email: 'cliente.grupo@exemplo.com',
        role: 'cliente',
        ativo: true,
        empresas: [],
        grupos_empresariais: ['grp-alpha'],
        expand: {
          grupos_empresariais: [grupoAlpha as any],
        },
      } as unknown as AppUser

      const res = resolverEmpresasPermitidas({
        user: userGrupoApenas,
        gruposDisponiveis: [grupoAlpha],
      })
      expect(res.empresasIndividuaisIds).toEqual([])
      expect(res.gruposVinculadosIds).toEqual(['grp-alpha'])
      expect(res.empresasDosGruposIds).toEqual(['emp-1', 'emp-2'])
      expect(res.todasEmpresasIds).toEqual(['emp-1', 'emp-2'])

      // extractUserEmpresasAndGruposIds síncrono a partir do expand
      const idsSessao = extractUserEmpresasAndGruposIds(userGrupoApenas)
      expect(idsSessao).toEqual(['emp-1', 'emp-2'])
    })

    it('usuário com sobreposição entre vínculo individual e empresas de grupo econômico', () => {
      // Exemplo: individual tem emp-1, e grupo tem emp-1 e emp-2
      const userSobreposto = {
        id: 'u-sobreposto',
        email: 'sobreposto@exemplo.com',
        role: 'cliente',
        empresas: ['emp-1'],
        grupos_empresariais: ['grp-alpha'],
        expand: {
          grupos_empresariais: [grupoAlpha as any],
        },
      } as unknown as AppUser

      const res = resolverEmpresasPermitidas({
        user: userSobreposto,
        gruposDisponiveis: [grupoAlpha],
      })
      expect(res.empresasIndividuaisIds).toEqual(['emp-1'])
      expect(res.gruposVinculadosIds).toEqual(['grp-alpha'])
      expect(res.todasEmpresasIds).toEqual(['emp-1', 'emp-2'])

      const idsSessao = extractUserEmpresasAndGruposIds(userSobreposto)
      expect(idsSessao).toEqual(['emp-1', 'emp-2'])
    })
  })
})
