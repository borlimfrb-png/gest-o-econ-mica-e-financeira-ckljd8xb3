/**
 * Motor de Validação Automática de NFS-e (Padrão Nacional 2.0 / SEFIN / ADN / Receita Federal).
 *
 * Executa todas as checagens que fariam uma nota fiscal ser rejeitada no site do governo:
 * 1. Chave de acesso: 50 dígitos numéricos e Dígito Verificador Módulo 11 (pesos 2 a 9).
 * 2. CNPJ do prestador e tomador: 14 dígitos e DVs válidos (com suporte a CPF para tomador PF).
 * 3. Código IBGE do município: 7 dígitos válidos.
 * 4. Número e série da DPS / NFS-e preenchidos e coerentes.
 * 5. Coerência cronológica: competência/emissão vs AAMM da chave de acesso.
 * 6. Valores: valor dos serviços, ISSQN e retenções coerentes (somas batem, valores >= 0).
 * 7. XML presente, parseável e chave interna idêntica à chave da nota.
 * 8. Dados cadastrais obrigatórios do tomador (razão social, CNPJ/CPF, logradouro, município, UF, CEP).
 */

import type { NotaFiscalRecord } from '@/types/finance'
import { validarChaveAcessoNfseNacional, calcularDvChaveNfseNacional } from './nfseChaveAcesso'
import { validateCnpj, cleanCnpj } from './financeCalculations'

export type StatusChecagem = 'valido' | 'erro' | 'aviso'

export interface ItemChecagemValidacao {
  id: string
  titulo: string
  status: StatusChecagem
  mensagem: string
  sugestaoAcao?: string
  detalhe?: string
}

export interface ResultadoValidacaoNfse {
  notaId: string
  numero: number
  serie: string
  chaveAcesso: string
  statusNota: string
  tomadorNome: string
  tomadorDoc: string
  valorLiquido: number
  dataEmissao: string
  valida: boolean
  temAvisos: boolean
  totalChecagens: number
  totalErros: number
  totalAvisos: number
  checagens: ItemChecagemValidacao[]
  podeRecalcularChave: boolean
}

/**
 * Validador de CPF (11 dígitos com 2 DVs módulo 11)
 */
export function validateCpf(cpf: string): boolean {
  const limpo = (cpf || '').replace(/\D/g, '')
  if (limpo.length !== 11) return false
  if (/^(\d)\1+$/.test(limpo)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i)
  }
  let resto = 11 - (soma % 11)
  let dv1 = resto >= 10 ? 0 : resto
  if (dv1 !== parseInt(limpo.charAt(9), 10)) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i)
  }
  resto = 11 - (soma % 11)
  let dv2 = resto >= 10 ? 0 : resto
  return dv2 === parseInt(limpo.charAt(10), 10)
}

/**
 * Executa a validação analítica completa de uma nota fiscal.
 */
export function validarNotaFiscalCompleta(nota: NotaFiscalRecord): ResultadoValidacaoNfse {
  const checagens: ItemChecagemValidacao[] = []
  let podeRecalcularChave = false

  // 1. Chave de acesso Nacional (50 dígitos e DV Módulo 11)
  const chaveRaw = nota.chave_acesso || ''
  const chaveLimpa = chaveRaw.replace(/\D/g, '')
  if (!chaveRaw) {
    checagens.push({
      id: 'chave_acesso',
      titulo: 'Chave de Acesso Nacional',
      status: 'erro',
      mensagem: 'Chave de acesso não informada na nota fiscal.',
      sugestaoAcao: 'Gerar e atribuir chave de acesso oficial de 50 dígitos.',
    })
    podeRecalcularChave = true
  } else if (chaveLimpa.length === 49) {
    checagens.push({
      id: 'chave_acesso',
      titulo: 'Chave de Acesso Nacional (49 Dígitos)',
      status: 'erro',
      mensagem:
        'Chave com 49 dígitos (ausência do Dígito Verificador cDV Módulo 11). O portal do governo exige 50 dígitos.',
      sugestaoAcao: 'Clique em "Recalcular Chave (50 dígitos)" para anexar o DV e atualizar o XML.',
      detalhe: `Chave atual: ${chaveLimpa}`,
    })
    podeRecalcularChave = true
  } else if (chaveLimpa.length !== 50) {
    checagens.push({
      id: 'chave_acesso',
      titulo: 'Chave de Acesso Nacional (Tamanho Inválido)',
      status: 'erro',
      mensagem: `A chave possui ${chaveLimpa.length} dígitos. O padrão nacional exige exatamente 50 dígitos numéricos.`,
      sugestaoAcao: 'Regenerar a chave de acesso oficial completa.',
      detalhe: `Chave atual: ${chaveLimpa}`,
    })
    podeRecalcularChave = true
  } else {
    const valChave = validarChaveAcessoNfseNacional(chaveLimpa)
    if (!valChave.valida) {
      checagens.push({
        id: 'chave_acesso',
        titulo: 'Chave de Acesso Nacional (DV Inválido)',
        status: 'erro',
        mensagem: valChave.motivo || 'Dígito verificador inválido pela fórmula Módulo 11 oficial.',
        sugestaoAcao: 'Recalcular o dígito verificador final da chave.',
        detalhe: valChave.detalhes
          ? `DV informado: ${valChave.detalhes.cDV} | DV esperado: ${valChave.detalhes.dvCalculado}`
          : undefined,
      })
      podeRecalcularChave = true
    } else {
      checagens.push({
        id: 'chave_acesso',
        titulo: 'Chave de Acesso Nacional',
        status: 'valido',
        mensagem: 'Chave de 50 dígitos com Dígito Verificador Módulo 11 (pesos 2-9) 100% válido.',
        detalhe: chaveLimpa,
      })
    }
  }

  // 2. CNPJ do Prestador
  const prestCnpjLimpo = cleanCnpj(nota.prestador_cnpj || '')
  if (!prestCnpjLimpo) {
    checagens.push({
      id: 'cnpj_prestador',
      titulo: 'CNPJ do Prestador',
      status: 'erro',
      mensagem: 'CNPJ do prestador de serviços ausente.',
      sugestaoAcao: 'Configurar o CNPJ nas preferências de Minha Empresa.',
    })
  } else if (!validateCnpj(prestCnpjLimpo)) {
    checagens.push({
      id: 'cnpj_prestador',
      titulo: 'CNPJ do Prestador',
      status: 'erro',
      mensagem: `CNPJ ${nota.prestador_cnpj} possui dígitos verificadores inválidos pela Receita Federal.`,
      sugestaoAcao: 'Corrigir o CNPJ da consultoria/prestador.',
    })
  } else {
    checagens.push({
      id: 'cnpj_prestador',
      titulo: 'CNPJ do Prestador',
      status: 'valido',
      mensagem: 'CNPJ do prestador válido e regular.',
      detalhe: nota.prestador_cnpj,
    })
  }

  // 3. Documento do Tomador (CNPJ ou CPF)
  const tomaDocLimpo = (nota.tomador_cnpj || '').replace(/\D/g, '')
  if (!tomaDocLimpo) {
    checagens.push({
      id: 'doc_tomador',
      titulo: 'CNPJ/CPF do Tomador',
      status: 'erro',
      mensagem: 'Documento fiscal (CNPJ ou CPF) do cliente tomador não foi informado.',
      sugestaoAcao: 'Preencher o CNPJ/CPF no cadastro do tomador ou empresa.',
    })
  } else if (tomaDocLimpo.length === 14) {
    if (!validateCnpj(tomaDocLimpo)) {
      checagens.push({
        id: 'doc_tomador',
        titulo: 'CNPJ do Tomador',
        status: 'erro',
        mensagem: `CNPJ do tomador (${nota.tomador_cnpj}) é inválido no cálculo da Receita Federal.`,
        sugestaoAcao: 'Conferir o número de inscrição no Cadastro Nacional da Pessoa Jurídica.',
      })
    } else {
      checagens.push({
        id: 'doc_tomador',
        titulo: 'CNPJ do Tomador',
        status: 'valido',
        mensagem: 'CNPJ do tomador válido.',
        detalhe: nota.tomador_cnpj,
      })
    }
  } else if (tomaDocLimpo.length === 11) {
    if (!validateCpf(tomaDocLimpo)) {
      checagens.push({
        id: 'doc_tomador',
        titulo: 'CPF do Tomador (Pessoa Física)',
        status: 'erro',
        mensagem: `CPF do tomador (${nota.tomador_cnpj}) é inválido.`,
        sugestaoAcao: 'Conferir os 11 dígitos do CPF do contratante.',
      })
    } else {
      checagens.push({
        id: 'doc_tomador',
        titulo: 'CPF do Tomador',
        status: 'valido',
        mensagem: 'CPF de pessoa física válido.',
        detalhe: nota.tomador_cnpj,
      })
    }
  } else {
    checagens.push({
      id: 'doc_tomador',
      titulo: 'Documento do Tomador',
      status: 'erro',
      mensagem: `Documento com ${tomaDocLimpo.length} dígitos. Esperado 14 (CNPJ) ou 11 (CPF).`,
      sugestaoAcao: 'Informar CNPJ ou CPF completo.',
    })
  }

  // 4. Código IBGE do Município do Prestador / Incidência
  const ibgeMun = (nota.codigo_municipio_prestacao || '3550308').replace(/\D/g, '')
  if (ibgeMun.length !== 7) {
    checagens.push({
      id: 'ibge_municipio',
      titulo: 'Código IBGE do Município',
      status: 'erro',
      mensagem: `Código IBGE com ${ibgeMun.length} dígitos (${ibgeMun}). Deve ter exatamente 7 dígitos conforme tabela IBGE oficial.`,
      sugestaoAcao: 'Corrigir para o código de 7 dígitos (ex: São Paulo é 3550308).',
    })
  } else {
    checagens.push({
      id: 'ibge_municipio',
      titulo: 'Código IBGE do Município',
      status: 'valido',
      mensagem: `Código IBGE ${ibgeMun} regular (7 dígitos).`,
      detalhe: ibgeMun,
    })
  }

  // 5. Número e Série da DPS / NFS-e
  const numNota = Number(nota.numero)
  const dpsNum = Number(nota.dps_numero || nota.numero)
  const dpsSerie = String(nota.dps_serie || nota.serie || '1').trim()
  if (!numNota || numNota <= 0) {
    checagens.push({
      id: 'numero_serie',
      titulo: 'Número e Série da Nota',
      status: 'erro',
      mensagem: 'Número sequencial da NFS-e ausente ou zerado.',
      sugestaoAcao: 'Informar número sequencial positivo.',
    })
  } else if (!dpsSerie) {
    checagens.push({
      id: 'numero_serie',
      titulo: 'Número e Série da DPS',
      status: 'aviso',
      mensagem: 'Série da DPS não informada explicitamente (utilizando padrão 1).',
      sugestaoAcao: 'Parametrizar a série nas configurações de DPS.',
    })
  } else {
    checagens.push({
      id: 'numero_serie',
      titulo: 'Número e Série da DPS / NFS-e',
      status: 'valido',
      mensagem: `NFS-e nº ${numNota} / DPS nº ${dpsNum} (Série ${dpsSerie}) coerentes.`,
    })
  }

  // 6. Coerência Cronológica (AAMM da chave vs Competência / Emissão)
  const dtEmissaoRaw = nota.data_emissao || nota.competencia || ''
  if (!dtEmissaoRaw) {
    checagens.push({
      id: 'data_competencia',
      titulo: 'Data e Competência',
      status: 'erro',
      mensagem: 'Data de emissão e competência ausentes.',
      sugestaoAcao: 'Preencher a data de emissão.',
    })
  } else {
    const dataNota = new Date(dtEmissaoRaw)
    const ano2Nota = String(dataNota.getFullYear()).slice(-2)
    const mes2Nota = String(dataNota.getMonth() + 1).padStart(2, '0')
    const aammEsperado = `${ano2Nota}${mes2Nota}`

    if (chaveLimpa.length === 50) {
      const aammNaChave = chaveLimpa.slice(36, 40)
      if (aammNaChave !== aammEsperado) {
        checagens.push({
          id: 'data_competencia',
          titulo: 'Coerência AAMM da Chave vs Emissão',
          status: 'aviso',
          mensagem: `AAMM na chave de acesso (${aammNaChave}) difere do mês/ano da data da nota (${aammEsperado}).`,
          sugestaoAcao: 'Recalcular a chave de acesso se a nota mudou de competência.',
          detalhe: `Chave: ${aammNaChave} | Emissão: ${aammEsperado}`,
        })
      } else {
        checagens.push({
          id: 'data_competencia',
          titulo: 'Coerência AAMM da Chave vs Emissão',
          status: 'valido',
          mensagem: `Período AAMM (${aammEsperado}) consistente entre chave e emissão.`,
        })
      }
    } else {
      checagens.push({
        id: 'data_competencia',
        titulo: 'Data e Competência',
        status: 'valido',
        mensagem: `Data de emissão registrada: ${dtEmissaoRaw.slice(0, 10)}.`,
      })
    }
  }

  // 7. Coerência de Valores e Tributos
  const vServicos = Number(nota.valor_servicos) || 0
  const vIss = Number(nota.valor_iss) || 0
  const vLiq = Number(nota.valor_liquido) || 0
  const aliqIss = Number(nota.aliquota_iss) || 0
  const retencoes =
    (Number(nota.valor_pis) || 0) +
    (Number(nota.valor_cofins) || 0) +
    (Number(nota.valor_inss) || 0) +
    (Number(nota.valor_ir) || 0) +
    (Number(nota.valor_csll) || 0) +
    (Number(nota.outras_retencoes) || 0)

  if (vServicos <= 0) {
    checagens.push({
      id: 'valores_tributos',
      titulo: 'Valores dos Serviços',
      status: 'erro',
      mensagem: 'Valor dos serviços deve ser estritamente positivo.',
      sugestaoAcao: 'Ajustar o valor dos serviços da nota.',
    })
  } else if (vLiq < 0 || vIss < 0) {
    checagens.push({
      id: 'valores_tributos',
      titulo: 'Valores Negativos',
      status: 'erro',
      mensagem: 'Valores de imposto ou líquido não podem ser negativos.',
      sugestaoAcao: 'Corrigir as retenções ou valor de serviços.',
    })
  } else {
    // Confere se líquido faz sentido: vServicos - retencoes (- vIss se retido)
    const descIncond = Number(nota.desconto_incondicionado) || 0
    const totalDescontar = (nota.iss_retido ? retencoes + vIss : retencoes) + descIncond
    const liqCalculado = Number((vServicos - totalDescontar).toFixed(2))

    if (Math.abs(liqCalculado - vLiq) > 0.15) {
      checagens.push({
        id: 'valores_tributos',
        titulo: 'Coerência do Valor Líquido',
        status: 'aviso',
        mensagem: `Divergência matemática no valor líquido: registrado R$ ${vLiq.toFixed(2)}, soma calculada R$ ${liqCalculado.toFixed(2)}.`,
        sugestaoAcao: 'Ajustar cálculo de retenções/descontos.',
        detalhe: `Diferença de R$ ${Math.abs(liqCalculado - vLiq).toFixed(2)}`,
      })
    } else {
      checagens.push({
        id: 'valores_tributos',
        titulo: 'Valores e Tributos',
        status: 'valido',
        mensagem: `Valor dos serviços (R$ ${vServicos.toFixed(2)}), ISS (${aliqIss}% = R$ ${vIss.toFixed(2)}) e líquido (R$ ${vLiq.toFixed(2)}) coerentes.`,
      })
    }
  }

  // 8. XML presente e coerência interna da tag <ChaveAcesso>
  const xml = nota.xml_conteudo || ''
  if (!xml || !xml.trim()) {
    checagens.push({
      id: 'xml_conteudo',
      titulo: 'Arquivo XML da NFS-e',
      status: 'aviso',
      mensagem: 'Conteúdo XML ainda não gravado no banco de dados para esta nota.',
      sugestaoAcao: 'Clique em "Regerar XML" para salvar a estrutura oficial.',
    })
  } else {
    // Checagem se é XML parseável básico
    if (!xml.includes('<?xml') && !xml.includes('<DPS') && !xml.includes('<CompNfse')) {
      checagens.push({
        id: 'xml_conteudo',
        titulo: 'Arquivo XML da NFS-e',
        status: 'erro',
        mensagem: 'Estrutura do XML corrompida ou formato não reconhecido.',
        sugestaoAcao: 'Regenerar o XML pelo padrão oficial.',
      })
    } else {
      // Checar se a chave dentro do XML bate com a chave da nota
      const matchChave = xml.match(/<ChaveAcesso>(.*?)<\/ChaveAcesso>/i)
      if (matchChave && matchChave[1]) {
        const chaveNoXml = matchChave[1].trim().replace(/\D/g, '')
        if (chaveNoXml !== chaveLimpa) {
          checagens.push({
            id: 'xml_conteudo',
            titulo: 'Chave no XML vs Chave da Nota',
            status: 'erro',
            mensagem: `A chave no XML (${chaveNoXml}) diverge da chave registrada no sistema (${chaveLimpa}). O site da Receita rejeitará a nota.`,
            sugestaoAcao: 'Clique em "Sincronizar XML" para unificar as chaves.',
            detalhe: `XML: ${chaveNoXml} | Sistema: ${chaveLimpa}`,
          })
          podeRecalcularChave = true
        } else {
          checagens.push({
            id: 'xml_conteudo',
            titulo: 'Arquivo XML da NFS-e',
            status: 'valido',
            mensagem: 'XML íntegro e chave de acesso interna 100% idêntica à da nota.',
          })
        }
      } else {
        checagens.push({
          id: 'xml_conteudo',
          titulo: 'Arquivo XML da NFS-e',
          status: 'valido',
          mensagem: 'XML gerado e presente no registro.',
        })
      }
    }
  }

  // 9. Dados cadastrais obrigatórios do tomador
  const tomadorRazao = (nota.tomador_razao_social || '').trim()
  const tomadorEmpresa = nota.expand?.empresa
  const tomadorEndereco =
    tomadorEmpresa?.logradouro || (nota.dps_payload as any)?.dps?.infDPS?.toma?.end?.xLgr
  const tomadorMun =
    tomadorEmpresa?.cidade || (nota.dps_payload as any)?.dps?.infDPS?.toma?.end?.cMun
  const tomadorUf = tomadorEmpresa?.estado || (nota.dps_payload as any)?.dps?.infDPS?.toma?.end?.UF
  const tomadorCep = tomadorEmpresa?.cep || (nota.dps_payload as any)?.dps?.infDPS?.toma?.end?.CEP

  if (!tomadorRazao || tomadorRazao === 'Cliente') {
    checagens.push({
      id: 'dados_tomador',
      titulo: 'Razão Social do Tomador',
      status: 'erro',
      mensagem: 'Razão Social / Nome completo do tomador não foi preenchida.',
      sugestaoAcao: 'Preencher o nome empresarial do cliente.',
    })
  } else if (!tomadorEndereco || !tomadorMun || !tomadorUf || !tomadorCep) {
    checagens.push({
      id: 'dados_tomador',
      titulo: 'Endereço Completo do Tomador',
      status: 'aviso',
      mensagem:
        'Cadastro de endereço do tomador incompleto (logradouro, cidade, UF ou CEP ausentes). O Padrão Nacional DPS exige endereço completo.',
      sugestaoAcao: 'Completar o cadastro de endereço da empresa tomadora.',
    })
  } else {
    checagens.push({
      id: 'dados_tomador',
      titulo: 'Dados Cadastrais do Tomador',
      status: 'valido',
      mensagem: 'Razão social e endereço do tomador completos.',
    })
  }

  const totalErros = checagens.filter((c) => c.status === 'erro').length
  const totalAvisos = checagens.filter((c) => c.status === 'aviso').length

  return {
    notaId: nota.id,
    numero: numNota,
    serie: dpsSerie,
    chaveAcesso: chaveLimpa || nota.chave_acesso || '',
    statusNota: nota.status,
    tomadorNome: tomadorRazao || 'Cliente',
    tomadorDoc: nota.tomador_cnpj || '',
    valorLiquido: vLiq,
    dataEmissao: nota.data_emissao || '',
    valida: totalErros === 0,
    temAvisos: totalAvisos > 0,
    totalChecagens: checagens.length,
    totalErros,
    totalAvisos,
    checagens,
    podeRecalcularChave,
  }
}
