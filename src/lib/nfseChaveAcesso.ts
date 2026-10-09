/**
 * Utilitários para geração e validação da Chave de Acesso Nacional da NFS-e
 * (Padrão Nacional 2.0 / SEFIN / Receita Federal / ADN).
 *
 * Estrutura oficial da Chave de Acesso Nacional NFS-e (50 posições):
 * [01..07] cMun  (7 dígitos)  - Código IBGE do município emissor/incidência
 * [08..08] tpAmb (1 dígito)   - Tipo do ambiente gerador (1=Próprio Município, 2=Sefin Nacional NFS-e)
 * [09..09] tpInsc(1 dígito)   - Tipo de inscrição do prestador (1=CPF, 2=CNPJ)
 * [10..23] Insc  (14 dígitos) - CNPJ (14) ou CPF (3 zeros à esquerda + 11) - suporte alfanumérico
 * [24..36] nNFSe (13 dígitos) - Número sequencial da NFS-e (zero-padded)
 * [37..40] AAMM  (4 dígitos)  - Ano (2) e Mês (2) da emissão
 * [41..49] cNFSe (9 dígitos)  - Código numérico aleatório de segurança
 * [50..50] cDV   (1 dígito)   - Dígito Verificador Módulo 11 (pesos cíclicos de 2 a 9 da direita p/ esquerda)
 * Total: EXATAMENTE 50 caracteres (49 posições de payload + 1 dígito verificador).
 */

/**
 * Calcula o Dígito Verificador (cDV) Módulo 11 para as primeiras 49 posições da chave NFS-e.
 *
 * Regra oficial:
 * 1. Percorre os 49 caracteres da direita para a esquerda (índices 48 até 0).
 * 2. Converte caractere para número com ASCII - 48 (dígitos '0'-'9' => 0..9; letras 'A'-'Z' => 17..42).
 * 3. Multiplica pelo peso no ciclo [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, ...].
 * 4. Soma todos os produtos e calcula o resto da divisão por 11.
 * 5. Se o resto for 0 ou 1, DV = 0; senão DV = 11 - resto.
 */
export function calcularDvChaveNfseNacional(chave49: string): string {
  if (!chave49 || chave49.length < 49) {
    throw new Error(
      `A chave base deve ter 49 caracteres para cálculo do DV (recebido: ${chave49?.length || 0}).`,
    )
  }

  const base49 = chave49.slice(0, 49)
  let soma = 0
  let peso = 2

  for (let i = 48; i >= 0; i--) {
    const code = base49.charCodeAt(i)
    // Se for '0'-'9', code - 48 dá 0..9
    // Se for 'A'-'Z', code - 48 dá 17..42 (regra oficial novo CNPJ alfanumérico)
    const valor = code - 48
    soma += valor * peso
    peso = peso === 9 ? 2 : peso + 1
  }

  const resto = soma % 11
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto
  return String(dv)
}

export interface GerarChaveNfseNacionalParams {
  codigoMunicipio?: string // 7 dígitos IBGE (padrão São Paulo: 3550308)
  tipoAmbiente?: string | number // 1=Próprio / 2=Nacional (default 2)
  tipoInscricao?: '1' | '2' // 1=CPF, 2=CNPJ (calculado se omitido)
  cpfCnpjPrestador: string
  numeroNfse: number | string
  ano?: number | string // YYYY ou YY
  mes?: number | string // MM (1..12)
  codigoAleatorio?: string | number // 9 dígitos numéricos (gerado aleatoriamente se omitido)
}

/**
 * Monta e retorna a Chave de Acesso Nacional NFS-e com EXATAMENTE 50 dígitos.
 */
export function gerarChaveAcessoNfseNacional(params: GerarChaveNfseNacionalParams): string {
  const cMun = (params.codigoMunicipio || '3550308').replace(/\D/g, '').padEnd(7, '0').slice(0, 7)

  const tpAmbStr = String(params.tipoAmbiente || '2').trim()
  const tpAmb = tpAmbStr.includes('1') && !tpAmbStr.includes('2') ? '1' : '2'

  const docLimpo = (params.cpfCnpjPrestador || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  const isCpf = docLimpo.length <= 11
  const tpInsc = params.tipoInscricao || (isCpf ? '1' : '2')
  const insc14 = docLimpo.padStart(14, '0').slice(-14)

  const numLimpo = String(params.numeroNfse || 1).replace(/\D/g, '') || '1'
  const nNfse13 = numLimpo.padStart(13, '0').slice(-13)

  const now = new Date()
  let anoStr = params.ano !== undefined ? String(params.ano) : String(now.getFullYear())
  if (anoStr.length === 4) anoStr = anoStr.slice(-2)
  const ano2 = anoStr.padStart(2, '0').slice(-2)

  let mesStr = params.mes !== undefined ? String(params.mes) : String(now.getMonth() + 1)
  const mes2 = mesStr.padStart(2, '0').slice(-2)
  const aamm = `${ano2}${mes2}`

  let cNFSe9 = ''
  if (params.codigoAleatorio !== undefined) {
    cNFSe9 = String(params.codigoAleatorio).replace(/\D/g, '').padStart(9, '0').slice(-9)
  } else {
    // Gera 9 dígitos aleatórios numéricos
    const rnd = Math.floor(100000000 + Math.random() * 900000000)
    cNFSe9 = String(rnd).slice(0, 9)
  }

  const chave49 = `${cMun}${tpAmb}${tpInsc}${insc14}${nNfse13}${aamm}${cNFSe9}`
  if (chave49.length !== 49) {
    throw new Error(
      `Erro interno na montagem da chave: comprimento parcial ${chave49.length} diferente de 49.`,
    )
  }

  const cDV = calcularDvChaveNfseNacional(chave49)
  const chaveFinal50 = `${chave49}${cDV}`

  if (chaveFinal50.length !== 50) {
    throw new Error(
      `Erro interno: chave gerada possui ${chaveFinal50.length} dígitos, esperado 50.`,
    )
  }

  return chaveFinal50
}

/**
 * Validador completo da chave de acesso NFS-e nacional (50 dígitos).
 */
export function validarChaveAcessoNfseNacional(chave: string): {
  valida: boolean
  motivo?: string
  detalhes?: {
    cMun: string
    tpAmb: string
    tpInsc: string
    insc: string
    nNFSe: string
    aamm: string
    cNFSe: string
    cDV: string
    dvCalculado: string
  }
} {
  if (!chave || typeof chave !== 'string') {
    return { valida: false, motivo: 'Chave não informada ou vazia.' }
  }

  // Remove espaços ou caracteres de formatação
  let limpa = chave.trim().replace(/\s+/g, '')
  if (limpa.toUpperCase().startsWith('NFS')) {
    limpa = limpa.slice(3)
  }

  if (limpa.length !== 50) {
    return {
      valida: false,
      motivo: `A chave possui ${limpa.length} caracteres. O Padrão Nacional da NFS-e exige EXATAMENTE 50 dígitos.`,
    }
  }

  const cMun = limpa.slice(0, 7)
  const tpAmb = limpa.slice(7, 8)
  const tpInsc = limpa.slice(8, 9)
  const insc = limpa.slice(9, 23)
  const nNFSe = limpa.slice(23, 36)
  const aamm = limpa.slice(36, 40)
  const cNFSe = limpa.slice(40, 49)
  const cDV = limpa.slice(49, 50)

  if (!/^\d{7}$/.test(cMun)) {
    return { valida: false, motivo: 'Código do município inválido nos 7 primeiros dígitos.' }
  }

  const chave49 = limpa.slice(0, 49)
  const dvCalculado = calcularDvChaveNfseNacional(chave49)

  if (cDV !== dvCalculado) {
    return {
      valida: false,
      motivo: `Dígito verificador inválido: informado ${cDV}, esperado ${dvCalculado}.`,
      detalhes: { cMun, tpAmb, tpInsc, insc, nNFSe, aamm, cNFSe, cDV, dvCalculado },
    }
  }

  return {
    valida: true,
    detalhes: { cMun, tpAmb, tpInsc, insc, nNFSe, aamm, cNFSe, cDV, dvCalculado },
  }
}
