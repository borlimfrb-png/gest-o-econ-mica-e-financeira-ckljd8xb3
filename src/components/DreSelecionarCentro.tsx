import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DreSelecionarCentroProps {
  centros: { id: string; nome: string }[]
  valor: string | null
  onChange: (centroId: string | null) => void
  disabled?: boolean
}

/**
 * Seletor compacto de centro de custo embutido na linha de conta do DRE
 * Gerencial. Permite classificar a conta sem sair da tela (mesmo mecanismo
 * da tela Plano de Contas: grava o campo `centro` da conta via contasService).
 */
export function DreSelecionarCentro({
  centros,
  valor,
  onChange,
  disabled,
}: DreSelecionarCentroProps) {
  return (
    <Select
      value={valor || '__sem__'}
      onValueChange={(v) => onChange(v === '__sem__' ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger
        className="h-5.5 w-[140px] text-[10px] px-2 bg-white/80 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 gap-1"
        title="Centro de Custo da conta (clique para classificar)"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Sem centro" />
      </SelectTrigger>
      <SelectContent>
        {centros.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-xs">
            {c.nome}
          </SelectItem>
        ))}
        <SelectItem value="__sem__" className="text-xs text-slate-500">
          Sem centro
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
