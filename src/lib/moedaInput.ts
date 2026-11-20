/**
 * Formatação de entrada de moeda (R$) do editor de metas.
 * Aceita "1.234,56", "1234,56", "1234.56" e "1234" — sempre normaliza para
 * vírgula decimal ao exibir (pt-BR).
 */

export function parseValorMoeda(v: string): number {
  const s = String(v ?? '').trim()
  if (!s) return 0
  // Tem vírgula: vírgula é decimal; pontos são milhar (remove)
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  // Sem vírgula: ponto isolado seguido de exatamente 2 dígitos = decimal
  if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1) {
    return parseFloat(s) || 0
  }
  // Caso contrário: número simples (pontos tratados como milhar)
  return parseFloat(s.replace(/\./g, '')) || 0
}

/** Valor numérico -> texto de edição pt-BR (ex.: 1500000 -> "1500000" cru). */
export function formatarValorParaEdicao(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor) || valor <= 0) return ''
  return String(valor)
}
