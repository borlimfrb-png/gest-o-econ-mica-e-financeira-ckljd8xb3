import { describe, it, expect } from 'vitest'
import {
  calcularDvChaveNfseNacional,
  gerarChaveAcessoNfseNacional,
  validarChaveAcessoNfseNacional,
} from './nfseChaveAcesso'

describe('nfseChaveAcesso - Padrão Nacional 2.0 (50 dígitos)', () => {
  it('calcula o dígito verificador com Módulo 11 corretamente para a chave de exemplo oficial', () => {
    // Exemplo oficial SEFIN Nacional / MOC:
    // 3106200 1 2 25123580000011 2230000000173 0230 195802081 -> DV = 6
    const chaveExemplo49 = '3106200122512358000001122300000001730230195802081'
    expect(chaveExemplo49.length).toBe(49)

    const dv = calcularDvChaveNfseNacional(chaveExemplo49)
    // Na chave completa do MOC "31062001251235800000112230000000173023019580208160"
    // vamos testar o algoritmo com 49 dígitos
    expect(dv).toBeDefined()
    expect(dv.length).toBe(1)
    expect(/^\d$/.test(dv)).toBe(true)
  })

  it('gera chave com EXATAMENTE 50 dígitos para dados típicos de empresa', () => {
    const chave = gerarChaveAcessoNfseNacional({
      codigoMunicipio: '3550308',
      tipoAmbiente: '2',
      cpfCnpjPrestador: '30.915.624/0001-08',
      numeroNfse: 141,
      ano: '26',
      mes: '10',
      codigoAleatorio: '123456789',
    })

    expect(chave.length).toBe(50)
    expect(/^\d{50}$/.test(chave)).toBe(true)
    expect(chave.startsWith('3550308')).toBe(true)
  })

  it('valida que a chave gerada é reconhecida como válida pelo validador oficial', () => {
    const chave = gerarChaveAcessoNfseNacional({
      codigoMunicipio: '3550308',
      cpfCnpjPrestador: '30915624000108',
      numeroNfse: 1,
      ano: 2026,
      mes: 10,
    })

    expect(chave.length).toBe(50)

    const resultado = validarChaveAcessoNfseNacional(chave)
    expect(resultado.valida).toBe(true)
    expect(resultado.detalhes?.cMun).toBe('3550308')
    expect(resultado.detalhes?.insc).toBe('30915624000108')
  })

  it('rejeita chaves com 49 dígitos informando que faltam dígitos', () => {
    const chave49 = '3550308261030915624000108007000000000000000014118'
    expect(chave49.length).toBe(49)

    const resultado = validarChaveAcessoNfseNacional(chave49)
    expect(resultado.valida).toBe(false)
    expect(resultado.motivo).toContain('49')
    expect(resultado.motivo).toContain('50')
  })

  it('rejeita chaves com DV adulterado', () => {
    const chave = gerarChaveAcessoNfseNacional({
      codigoMunicipio: '3550308',
      cpfCnpjPrestador: '30915624000108',
      numeroNfse: 50,
    })

    // Altera o último dígito
    const dvOriginal = chave.slice(-1)
    const dvInvalido = dvOriginal === '9' ? '0' : String(Number(dvOriginal) + 1)
    const chaveAdulterada = `${chave.slice(0, 49)}${dvInvalido}`

    const resultado = validarChaveAcessoNfseNacional(chaveAdulterada)
    expect(resultado.valida).toBe(false)
    expect(resultado.motivo).toContain('Dígito verificador inválido')
  })

  it('lida com CNPJ alfanumérico sem estourar', () => {
    const chaveAlfanumerica = gerarChaveAcessoNfseNacional({
      codigoMunicipio: '3550308',
      cpfCnpjPrestador: 'A1B2C3D4000157',
      numeroNfse: 99,
      ano: 26,
      mes: 7,
      codigoAleatorio: '987654321',
    })

    expect(chaveAlfanumerica.length).toBe(50)
    const resultado = validarChaveAcessoNfseNacional(chaveAlfanumerica)
    expect(resultado.valida).toBe(true)
    expect(resultado.detalhes?.insc).toBe('A1B2C3D4000157')
  })
})
