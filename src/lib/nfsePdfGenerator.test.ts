import { describe, it, expect } from 'vitest'
import { gerarDanfsePdfBase64 } from './nfsePdfGenerator'
import type { NotaFiscalRecord } from '@/types/finance'

describe('nfsePdfGenerator - DANFSe v2.0 Oficial', () => {
  it('deve gerar PDF Base64 canônico válido com a estrutura v2.0 oficial', () => {
    const mockNota: Partial<NotaFiscalRecord> = {
      id: 'rec_137',
      numero: 137,
      dps_numero: 117,
      dps_serie: '70000',
      chave_acesso: '35245012230915624000108000000000013726101497594680',
      codigo_verificacao: 'ABC123XYZ',
      data_emissao: '2026-10-02T14:52:30.000Z',
      competencia: '2026-10-02',
      valor_servicos: 3000,
      valor_liquido: 3000,
      valor_iss: 0,
      aliquota_iss: 0,
      iss_retido: false,
      codigo_tributacao_nacional: '17.19.01',
      codigo_servico_municipal: '-',
      discriminacao: 'CONSULTORIA FINANCEIRA E CONTÁBIL.',
      tipo_ambiente: '2 - Homologacao',
    }

    const base64 = gerarDanfsePdfBase64({
      nota: mockNota as NotaFiscalRecord,
      prestador: {
        razaoSocial: 'BORLIM CONSULTORIA EMPRESARIAL LTDA',
        cnpj: '30.915.624/0001-08',
        inscricaoMunicipal: '-',
        cidade: 'Jaci',
        estado: 'SP',
        telefone: '(17) 99765-0672',
        email: 'flavio@borlim.com.br',
      },
      tomador: {
        razaoSocial: 'C.R.M. MULTIELETRICA MATERIAIS ELETRICOS - LTDA',
        cnpj: '05.208.559/0001-25',
        inscricaoMunicipal: '-',
        cidade: 'São José do Rio Preto',
        estado: 'SP',
        telefone: '-',
        email: 'financeiro4@multieletrica.com.br',
      },
    })

    expect(base64).toBeDefined()
    expect(typeof base64).toBe('string')
    expect(base64.length).toBeGreaterThan(500)

    // Decodifica Base64 e valida se tem a assinatura de PDF 1.4
    const decoded = atob(base64)
    expect(decoded.startsWith('%PDF-1.4')).toBe(true)
    expect(decoded.includes('%%EOF')).toBe(true)

    // Verifica que contém os termos essenciais do DANFSe v2.0
    expect(decoded.includes('DANFSe v2.0')).toBe(true)
    expect(decoded.includes('Documento Auxiliar da NFS-e')).toBe(true)
    expect(decoded.includes('CHAVE DE ACESSO DA NFS-e')).toBe(true)
    expect(decoded.includes('BORLIM CONSULTORIA EMPRESARIAL LTDA')).toBe(true)
    expect(decoded.includes('TRIBUTACAO IBS/CBS')).toBe(true)
    expect(decoded.includes('VALOR TOTAL DA NFS-e')).toBe(true)
    expect(decoded.includes('VALOR DA OPERACAO / SERVICO')).toBe(true)
    expect(decoded.includes('DATA CIENTIFICACAO:')).toBe(true)
  })
})
