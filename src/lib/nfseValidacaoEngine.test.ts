import { describe, it, expect } from 'vitest'
import { validarNotaFiscalCompleta, validateCpf } from './nfseValidacaoEngine'
import { gerarChaveAcessoNfseNacional, calcularDvChaveNfseNacional } from './nfseChaveAcesso'
import type { NotaFiscalRecord } from '@/types/finance'

describe('Motor de Validação de NFS-e (nfseValidacaoEngine)', () => {
  it('deve validar CPFs válidos e rejeitar inválidos', () => {
    expect(validateCpf('11144477735')).toBe(true)
    expect(validateCpf('111.444.777-35')).toBe(true)
    expect(validateCpf('11111111111')).toBe(false) // repetidos
    expect(validateCpf('12345678900')).toBe(false) // DV errado
  })

  it('deve identificar chave de acesso com 49 dígitos como erro de ausência de DV', () => {
    // Chave de 49 caracteres sem o DV final
    const base49 = '355030822000000000001000000000000012405123456789'
    expect(base49.length).toBe(49)

    const notaMock = {
      id: 'nota_teste_49',
      numero: 1,
      serie: '1',
      chave_acesso: base49,
      status: 'Emitida',
      prestador_cnpj: '00.000.000/0001-00', // CNPJ inválido ou genérico
      tomador_cnpj: '00.000.000/0001-91',
      tomador_razao_social: 'Cliente ABC Ltda',
      codigo_municipio_prestacao: '3550308',
      valor_servicos: 1000,
      valor_liquido: 950,
      data_emissao: '2024-05-10 10:00:00',
    } as unknown as NotaFiscalRecord

    const res = validarNotaFiscalCompleta(notaMock)
    expect(res.valida).toBe(false)
    expect(res.podeRecalcularChave).toBe(true)

    const checagemChave = res.checagens.find((c) => c.id === 'chave_acesso')
    expect(checagemChave).toBeDefined()
    expect(checagemChave?.status).toBe('erro')
    expect(checagemChave?.mensagem).toContain('49 dígitos')
  })

  it('deve aprovar chave de acesso oficial de 50 dígitos com DV correto', () => {
    const chave50 = gerarChaveAcessoNfseNacional({
      codigoMunicipio: '3550308',
      tipoAmbiente: '2',
      cpfCnpjPrestador: '11222333000181',
      numeroNfse: 100,
      ano: 2024,
      mes: 5,
      codigoAleatorio: '987654321',
    })
    expect(chave50.length).toBe(50)

    const notaMock = {
      id: 'nota_teste_50',
      numero: 100,
      serie: '1',
      chave_acesso: chave50,
      status: 'Emitida',
      prestador_cnpj: '11.222.333/0001-81',
      tomador_cnpj: '11.222.333/0001-81',
      tomador_razao_social: 'Cliente Regular S.A.',
      codigo_municipio_prestacao: '3550308',
      valor_servicos: 5000,
      aliquota_iss: 5,
      valor_iss: 250,
      valor_liquido: 4750,
      data_emissao: '2024-05-15 12:00:00',
      xml_conteudo: `<?xml version="1.0"?><DPS><ChaveAcesso>${chave50}</ChaveAcesso></DPS>`,
      expand: {
        empresa: {
          logradouro: 'Av Paulista',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01310-100',
        },
      },
    } as unknown as NotaFiscalRecord

    const res = validarNotaFiscalCompleta(notaMock)
    expect(res.valida).toBe(true)
    expect(res.totalErros).toBe(0)

    const checagemChave = res.checagens.find((c) => c.id === 'chave_acesso')
    expect(checagemChave?.status).toBe('valido')
  })
})
