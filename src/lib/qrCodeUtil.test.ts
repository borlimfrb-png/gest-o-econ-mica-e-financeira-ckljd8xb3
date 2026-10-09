import { describe, it, expect } from 'vitest'
import { generateQrMatrix } from './qrCodeUtil'

describe('qrCodeUtil', () => {
  it('gera matriz bidimensional de booleanos para URL válida', () => {
    const url =
      'https://www.nfse.gov.br/consultapublica?chave=35240230915624000108000000000000000000000000000100'
    const matrix = generateQrMatrix(url)
    expect(Array.isArray(matrix)).toBe(true)
    expect(matrix.length).toBeGreaterThan(20)
    expect(matrix[0].length).toBe(matrix.length)
    expect(typeof matrix[0][0]).toBe('boolean')
  })

  it('inclui os localizadores de padrão nos cantos superiores e inferior esquerdo', () => {
    const matrix = generateQrMatrix('https://www.nfse.gov.br')
    const size = matrix.length

    // Canto superior esquerdo (0,0) deve ter o quadrado escuro externo 7x7
    expect(matrix[0][0]).toBe(true)
    expect(matrix[0][6]).toBe(true)
    expect(matrix[6][0]).toBe(true)
    expect(matrix[6][6]).toBe(true)

    // Canto superior direito
    expect(matrix[0][size - 1]).toBe(true)
    expect(matrix[0][size - 7]).toBe(true)

    // Canto inferior esquerdo
    expect(matrix[size - 1][0]).toBe(true)
    expect(matrix[size - 7][0]).toBe(true)
  })

  it('lida com texto vazio fornecendo matriz padrão', () => {
    const matrix = generateQrMatrix('')
    expect(Array.isArray(matrix)).toBe(true)
    expect(matrix.length).toBeGreaterThan(0)
  })
})
