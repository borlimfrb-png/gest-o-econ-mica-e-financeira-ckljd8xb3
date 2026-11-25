/**
 * Parsing e formatação de valores numéricos pt-BR para inputs de digitação
 * (Balanço Patrimonial, DRE etc.).
 *
 * Extraído de src/components/ui/input-valor-brl.tsx para ser testável sem DOM.
 */

/** Interpreta o texto digitado como número, aceitando pt-BR e EN sem ambiguidade. */
export function parseNumeroBrl(texto: string): number | undefined {
  const bruto = texto.trim()
  if (!bruto) return undefined

  const temVirgula = bruto.includes(',')
  const temPonto = bruto.includes('.')

  if (temVirgula && temPonto) {
    // Os dois separadores: o último que aparece é o decimal; o outro é milhar.
    const decimalEhVirgula = bruto.lastIndexOf(',') > bruto.lastIndexOf('.')
    const normalizado = decimalEhVirgula
      ? bruto.replace(/\./g, '').replace(',', '.')
      : bruto.replace(/,/g, '')
    const num = Number(normalizado)
    return Number.isNaN(num) ? undefined : num
  }

  if (temVirgula) {
    // Vírgula sozinha é decimal pt-BR ("1,5" => 1.5; "1,234" => 1.234).
    const num = Number(bruto.replace(/\./g, '').replace(',', '.'))
    return Number.isNaN(num) ? undefined : num
  }

  if (temPonto) {
    const partes = bruto.split('.')
    if (partes.length > 2) {
      // Vários pontos: são todos milhares ("1.234.567").
      const num = Number(bruto.replace(/\./g, ''))
      return Number.isNaN(num) ? undefined : num
    }
    const decimal = partes[1]
    if (decimal === '') return Number(partes[0])
    // Ponto único: decimal se o grupo após ele tiver 1-2 dígitos (1234.56),
    // milhar se tiver exatamente 3 (1.234).
    if (decimal.length === 3) {
      const num = Number(bruto.replace(/\./g, ''))
      return Number.isNaN(num) ? undefined : num
    }
    const num = Number(bruto)
    return Number.isNaN(num) ? undefined : num
  }

  const num = Number(bruto)
  return Number.isNaN(num) ? undefined : num
}

/** Formata em pt-BR: ponto para milhar, vírgula para decimal (1.234,56). */
export function formatarNumeroBrl(valor: number | undefined | null): string {
  if (valor === undefined || valor === null || Number.isNaN(valor)) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}
