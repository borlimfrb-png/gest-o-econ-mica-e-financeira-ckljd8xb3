import React from 'react'
import { SelectItem } from '@/components/ui/select'
import type { EmpresaRecord } from '@/types/finance'

interface SelectEmpresaOuGrupoItemsProps {
  todasEntidades?: EmpresaRecord[]
  empresas: EmpresaRecord[]
}

export const SelectEmpresaOuGrupoItems: React.FC<SelectEmpresaOuGrupoItemsProps> = ({
  todasEntidades,
  empresas,
}) => {
  if (todasEntidades && todasEntidades.length > 0) {
    const grupos = todasEntidades.filter((e) => e.is_grupo)
    const empresasIndividuais = todasEntidades.filter((e) => !e.is_grupo)

    return (
      <>
        {grupos.length > 0 && (
          <div className="px-2 py-1 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/70 border-b border-indigo-100/50 mb-1 rounded-xs">
            Grupos Econômicos Consolidados
          </div>
        )}
        {grupos.map((grupo) => (
          <SelectItem
            key={grupo.id}
            value={grupo.id}
            className="text-xs font-semibold text-indigo-900 focus:bg-indigo-50"
          >
            <span className="flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase tracking-wider">
                Grupo
              </span>
              <span>{grupo.nome}</span>
              <span className="text-[10px] text-indigo-500 font-normal">
                ({grupo.empresas_ids?.length || 0} emp.)
              </span>
            </span>
          </SelectItem>
        ))}
        {grupos.length > 0 && empresasIndividuais.length > 0 && (
          <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-y border-slate-100 my-1">
            Empresas Individuais
          </div>
        )}
        {empresasIndividuais.map((emp) => (
          <SelectItem key={emp.id} value={emp.id} className="text-xs">
            {emp.nome} ({emp.segmento})
          </SelectItem>
        ))}
      </>
    )
  }

  return (
    <>
      {empresas.map((emp) => (
        <SelectItem key={emp.id} value={emp.id} className="text-xs">
          {emp.nome} ({emp.segmento})
        </SelectItem>
      ))}
    </>
  )
}
