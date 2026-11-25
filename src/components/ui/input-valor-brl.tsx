import { useEffect, useState } from 'react'
import type { KeyboardEvent, FocusEvent } from 'react'
import { Input } from '@/components/ui/input'
import { parseNumeroBrl, formatarNumeroBrl } from '@/lib/inputValorBrl'

/**
 * Input de valores monetários com experiência de digitação pt-BR:
 *
 * - Digitação fluida: enquanto o usuário digita, o campo mostra exatamente o
 *   que foi digitado (estado bruto local, sem reformatar a cada tecla).
 * - Aceita "1.234,56" (padrão pt-BR), "1234.56" (ponto como decimal) e "1,234.56"
 *   (padrão EN com milhar) sem ambiguidade.
 * - Ao sair do campo (blur), formata em pt-BR (1.234,56).
 * - `onValueChange(number | undefined)` — o estado da tela continua numérico,
 *   igual ao contrato anterior (`Number(e.target.value)`), então nenhuma fórmula
 *   ou tela externa muda de comportamento.
 *
 * Sem persistência a cada tecla: o valor só sobe para o estado da tela (que só
 * grava no backend no submit do formulário).
 */

interface InputValorBrlProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type'
> {
  /** Valor numérico atual (undefined = vazio). */
  value?: number | null
  /** Chamado com o número parseado, ou undefined quando o campo fica vazio. */
  onValueChange?: (valor: number | undefined) => void
}

export function InputValorBrl({
  value,
  onValueChange,
  onBlur,
  onKeyDown,
  ...props
}: InputValorBrlProps) {
  // Texto bruto enquanto o usuário digita (nunca reformatado embaixo dele).
  const [texto, setTexto] = useState<string>(() => (value != null ? String(value) : ''))

  // Quando o valor muda por fora (ex.: troca de mês/registro no modal),
  // sincroniza o texto bruto com o novo valor — mas não atrapalha a digitação.
  useEffect(() => {
    setTexto((anterior) => {
      const parseado = parseNumeroBrl(anterior)
      const igual =
        (value == null && (anterior === '' || parseado === undefined)) ||
        (value != null && parseado !== undefined && Math.abs(parseado - value) < 1e-9)
      return igual ? anterior : value != null ? String(value) : ''
    })
  }, [value])

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const num = parseNumeroBrl(texto)
    if (texto.trim() === '' || num === undefined) {
      setTexto('')
      onValueChange?.(undefined)
    } else {
      // Formatação pt-BR só no blur: a digitação nunca é interrompida.
      setTexto(formatarNumeroBrl(num))
      onValueChange?.(num)
    }
    onBlur?.(e)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e)
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={(e) => {
        const bruto = e.target.value
        // Aceita dígitos, separadores pt-BR/EN e sinal negativo.
        if (!/^-?[\d.,]*$/.test(bruto)) return
        setTexto(bruto)
        onValueChange?.(parseNumeroBrl(bruto))
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}

export default InputValorBrl
