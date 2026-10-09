/**
 * Gerador canônico de PDF para DANFSE NFS-e Padrão Nacional em formato Base64.
 * Gera documento PDF 1.4 canônico vetorial sem dependências externas pesadas,
 * perfeitamente compatível com a decodificação Goja ($filesystem.fileFromBytes) do PocketBase.
 */

import type { NotaFiscalRecord } from '@/types/finance'
import { formatBrlMoeda } from '@/lib/nfseXmlGenerator'

export interface DanfsePdfParams {
  nota: NotaFiscalRecord
  prestador: {
    razaoSocial: string
    cnpj: string
    inscricaoMunicipal?: string
    cidade?: string
    estado?: string
  }
  tomador: {
    razaoSocial: string
    cnpj: string
    email?: string
  }
}

/**
 * Escapa strings literais para a sintaxe de texto do formato PDF: \( \) \\
 */
function escapePdfText(str: string): string {
  if (!str) return ''
  // Normaliza caracteres acentuados para ASCII compatível com WinAnsi/StandardEncoding do PDF
  const semAcentos = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
  return semAcentos.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/**
 * Constrói um arquivo PDF 1.4 de página A4 única contendo o DANFSE Nacional estruturado.
 * Retorna a string Base64 limpa do binário PDF gerado.
 */
export function gerarDanfsePdfBase64(params: DanfsePdfParams): string {
  const { nota, prestador, tomador } = params

  const numNota = String(nota.numero || 1)
  const serie = String(nota.dps_serie || nota.serie || '1')
  const chave = String(nota.chave_acesso || 'N/A')
  const codVerif = String(nota.codigo_verificacao || 'N/A')
  const dtEmissao = nota.data_emissao
    ? nota.data_emissao.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const vServicos = formatBrlMoeda(nota.valor_servicos || 0)
  const vIss = formatBrlMoeda(nota.valor_iss || 0)
  const vLiq = formatBrlMoeda(nota.valor_liquido || 0)
  const discriminacao = (
    nota.discriminacao ||
    'Prestacao de servicos profissionais de consultoria economica e financeira.'
  ).slice(0, 280)

  // Layout A4: 595.28 x 841.89 pt
  // Stream de comandos PDF com fontes padrão Helvetica
  const streamCommands = [
    // Header fundo azul escuro
    '0.043 0.122 0.227 rg',
    '30 760 535 55 re f',
    // Header texto
    '1 1 1 rg',
    'BT /F2 14 Tf 45 795 Td (DANFSE - Documento Auxiliar da NFS-e Nacional) Tj ET',
    'BT /F1 9 Tf 45 780 Td (Padrao Nacional 2.0 - Emissao em Homologacao / Producao) Tj ET',

    // Quadro Dados Principais
    '0.95 0.96 0.98 rg',
    '30 670 535 80 re f',
    '0.8 0.85 0.90 RG 1 w',
    '30 670 535 80 re S',

    '0 0 0 rg',
    `BT /F2 11 Tf 45 730 Td (Numero da NFS-e: ${escapePdfText(numNota)}) Tj ET`,
    `BT /F1 9 Tf 220 730 Td (Serie: ${escapePdfText(serie)}) Tj ET`,
    `BT /F1 9 Tf 320 730 Td (Data de Emissao: ${escapePdfText(dtEmissao)}) Tj ET`,
    `BT /F1 9 Tf 45 710 Td (Codigo de Verificacao: ${escapePdfText(codVerif)}) Tj ET`,
    `BT /F2 8 Tf 45 688 Td (Chave de Acesso Nacional:) Tj ET`,
    `BT /F1 8 Tf 45 677 Td (${escapePdfText(chave)}) Tj ET`,

    // Prestador
    '0.92 0.94 0.97 rg',
    '30 580 535 80 re f',
    '0.8 0.85 0.9 RG 1 w',
    '30 580 535 80 re S',
    '0.043 0.122 0.227 rg',
    'BT /F2 10 Tf 45 642 Td (DADOS DO PRESTADOR DE SERVICOS) Tj ET',
    '0.1 0.1 0.1 rg',
    `BT /F2 9 Tf 45 624 Td (Razao Social: ${escapePdfText(prestador.razaoSocial)}) Tj ET`,
    `BT /F1 9 Tf 45 608 Td (CNPJ: ${escapePdfText(prestador.cnpj)}  -  IM: ${escapePdfText(prestador.inscricaoMunicipal || 'ISENTO')}) Tj ET`,
    `BT /F1 8 Tf 45 592 Td (Municipio: ${escapePdfText(prestador.cidade || 'Sao Paulo')} / ${escapePdfText(prestador.estado || 'SP')}) Tj ET`,

    // Tomador
    '0.92 0.94 0.97 rg',
    '30 490 535 80 re f',
    '0.8 0.85 0.9 RG 1 w',
    '30 490 535 80 re S',
    '0.043 0.122 0.227 rg',
    'BT /F2 10 Tf 45 552 Td (DADOS DO TOMADOR DE SERVICOS) Tj ET',
    '0.1 0.1 0.1 rg',
    `BT /F2 9 Tf 45 534 Td (Razao Social: ${escapePdfText(tomador.razaoSocial)}) Tj ET`,
    `BT /F1 9 Tf 45 518 Td (CPF/CNPJ: ${escapePdfText(tomador.cnpj)}) Tj ET`,
    `BT /F1 8 Tf 45 502 Td (E-mail: ${escapePdfText(tomador.email || 'Nao informado')}) Tj ET`,

    // Discriminacao dos Servicos
    '0.98 0.98 0.99 rg',
    '30 360 535 120 re f',
    '0.8 0.85 0.9 RG 1 w',
    '30 360 535 120 re S',
    '0.043 0.122 0.227 rg',
    'BT /F2 10 Tf 45 462 Td (DISCRIMINACAO DOS SERVICOS PRESTADOS) Tj ET',
    '0.2 0.2 0.2 rg',
    `BT /F1 8 Tf 45 440 Td (${escapePdfText(discriminacao.slice(0, 85))}) Tj ET`,
    `BT /F1 8 Tf 45 425 Td (${escapePdfText(discriminacao.slice(85, 170))}) Tj ET`,
    `BT /F1 8 Tf 45 410 Td (${escapePdfText(discriminacao.slice(170, 255))}) Tj ET`,
    `BT /F1 8 Tf 45 395 Td (${escapePdfText(discriminacao.slice(255, 340))}) Tj ET`,

    // Valores e Retencoes
    '0.92 0.95 0.99 rg',
    '30 250 535 100 re f',
    '0.15 0.35 0.7 RG 1 w',
    '30 250 535 100 re S',
    '0.043 0.122 0.227 rg',
    'BT /F2 10 Tf 45 332 Td (VALORES TRIBUTARIOS E TOTAIS) Tj ET',
    '0.1 0.1 0.1 rg',
    `BT /F1 9 Tf 45 310 Td (Valor dos Servicos: ${escapePdfText(vServicos)}) Tj ET`,
    `BT /F1 9 Tf 230 310 Td (ISSQN Apurado: ${escapePdfText(vIss)}) Tj ET`,
    `BT /F1 9 Tf 45 292 Td (Aliquota ISS: ${nota.aliquota_iss || 5.0}%  -  ISS Retido: ${nota.iss_retido ? 'Sim' : 'Nao'}) Tj ET`,
    '0.04 0.45 0.27 rg',
    `BT /F2 12 Tf 45 268 Td (VALOR LIQUIDO A PAGAR: ${escapePdfText(vLiq)}) Tj ET`,

    // Rodapé
    '0.4 0.4 0.4 rg',
    'BT /F1 7 Tf 45 220 Td (Documento Auxiliar emitido em conformidade com o Padrao Nacional da NFS-e. Consulta oficial: www.nfse.gov.br) Tj ET',
    'BT /F1 7 Tf 45 208 Td (Gestao Economica e Financeira - Borlim Consultoria Empresarial) Tj ET',
  ].join('\n')

  const streamLength = streamCommands.length

  const objects = [
    // 1: Catalog
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    // 2: Pages
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    // 3: Page
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj',
    // 4: Contents Stream
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamCommands}\nendstream\nendobj`,
    // 5: Font F1 (Helvetica)
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    // 6: Font F2 (Helvetica-Bold)
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj',
  ]

  let pdfText = '%PDF-1.4\n'
  const xrefOffsets: number[] = [0] // obj 0 offset is 0

  for (const obj of objects) {
    xrefOffsets.push(pdfText.length)
    pdfText += obj + '\n'
  }

  const startxref = pdfText.length
  pdfText += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    const offStr = String(xrefOffsets[i]).padStart(10, '0')
    pdfText += `${offStr} 00000 n \n`
  }

  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`

  // Converte a string binária do PDF em base64 puro
  const bytes = new Uint8Array(pdfText.length)
  for (let i = 0; i < pdfText.length; i++) {
    bytes[i] = pdfText.charCodeAt(i) & 0xff
  }

  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return btoa(binary)
}
