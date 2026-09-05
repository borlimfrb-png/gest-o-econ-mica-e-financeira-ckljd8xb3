/**
 * Modelagem e utilitários do Novo Padrão Nacional NFS-e (SEFIN / ADN / Receita Federal)
 * Conforme Nota Técnica Nacional v1.01 e regras do DPS (Declaração de Prestação de Serviços).
 */

export interface DpsPrestadorInput {
  cnpj: string
  inscricaoMunicipal?: string
  razaoSocial: string
  nomeFantasia?: string
  regimeTributario?: string // 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI'
  codigoMunicipio?: string // 7 dígitos IBGE (padrão São Paulo: 3550308)
  uf?: string
  telefone?: string
  email?: string
}

export interface DpsTomadorInput {
  tipoPessoa: 'PJ' | 'PF' | 'Exterior'
  cpfCnpj: string
  razaoSocial: string
  nomeFantasia?: string
  inscricaoMunicipal?: string
  inscricaoEstadual?: string
  email?: string
  telefone?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  codigoMunicipio?: string
  cidade?: string
  estado?: string
  cep?: string
}

export interface DpsItemServicoInput {
  item: number
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  codigoTributacaoNacional: string // ex: "010701" ou item LC 116
  desconto?: number
  aliquotaIss?: number
}

export interface DpsValoresInput {
  valorServicos: number
  aliquotaIss: number
  valorIss: number
  issRetido: boolean
  valorPis: number
  valorCofins: number
  valorInss: number
  valorIr: number
  valorCsll: number
  outrasRetencoes: number
  descontoIncondicionado: number
  valorLiquido: number
}

export interface GerarDpsNacionalOptions {
  tipoAmbiente: '1' | '2' // 1 - Produção, 2 - Homologação
  serie: string
  numeroDps: number
  competencia: string // YYYY-MM-DD
  municipioPrestacao?: string // IBGE 7 dígitos
  prestador: DpsPrestadorInput
  tomador: DpsTomadorInput
  itens: DpsItemServicoInput[]
  valores: DpsValoresInput
  discriminacaoGeral?: string
  versaoAplicativo?: string
}

/**
 * Constrói o ID único oficial de 45 dígitos do DPS Nacional:
 * 'DPS' + CodMun (7) + tpInsc (1: 1=CNPJ, 2=CPF) + CpfCnpj (14) + Serie (5) + NumDPS (15)
 */
export function gerarIdDpsNacional(
  codMunicipio: string,
  cpfCnpjPrestador: string,
  serie: string,
  numeroDps: number,
): string {
  const mun = (codMunicipio || '3550308').replace(/\D/g, '').padEnd(7, '0').slice(0, 7)
  const docLimpo = cpfCnpjPrestador.replace(/\D/g, '')
  const tpInsc = docLimpo.length <= 11 ? '2' : '1'
  const doc14 = docLimpo.padStart(14, '0').slice(-14)
  const serie5 = (serie || '1').replace(/\D/g, '') || '1'
  const seriePad = serie5.padStart(5, '0').slice(-5)
  const num15 = String(numeroDps).padStart(15, '0').slice(-15)

  return `DPS${mun}${tpInsc}${doc14}${seriePad}${num15}`
}

/**
 * Mapeia o regime tributário para o código oficial do DPS:
 * 1 - Simples Nacional (Microempresa ou EPP)
 * 2 - Simples Nacional - MEI
 * 3 - Não Optante pelo Simples Nacional (Lucro Presumido / Lucro Real)
 */
export function mapearOpcaoSimplesNacional(regime?: string): '1' | '2' | '3' {
  if (!regime) return '1'
  const r = regime.toLowerCase()
  if (r.includes('mei')) return '2'
  if (r.includes('simples')) return '1'
  return '3'
}

/**
 * Gera o payload JSON canônico do DPS Nacional v1.01
 */
export function gerarPayloadDpsNacional(options: GerarDpsNacionalOptions) {
  const dataHoraEmissao = new Date().toISOString()
  const codMunPrestador = options.prestador.codigoMunicipio?.replace(/\D/g, '') || '3550308'
  const codMunPrestacao =
    (options.municipioPrestacao || codMunPrestador).replace(/\D/g, '') || '3550308'
  const prestadorDoc = options.prestador.cnpj.replace(/\D/g, '')
  const dpsId = gerarIdDpsNacional(codMunPrestador, prestadorDoc, options.serie, options.numeroDps)

  const tomadorDoc = options.tomador.cpfCnpj.replace(/\D/g, '')
  const isCnpjTomador = tomadorDoc.length > 11

  const opSimpNac = mapearOpcaoSimplesNacional(options.prestador.regimeTributario)

  // Itens de serviço consolidados
  const itensFormatados = options.itens.map((it) => ({
    nItem: it.item,
    xDescServ: it.descricao,
    qServ: Number(it.quantidade || 1).toFixed(4),
    vUnit: Number(it.valorUnitario || 0).toFixed(2),
    vServ: Number(it.valorTotal || 0).toFixed(2),
    cTribNac: (it.codigoTributacaoNacional || '010701').replace(/\D/g, ''),
    vDescIncond: Number(it.desconto || 0).toFixed(2),
  }))

  const payload = {
    versao: '1.01',
    dps: {
      infDPS: {
        Id: dpsId,
        tpAmb: options.tipoAmbiente, // 1=Producao, 2=Homologacao
        dhEmi: dataHoraEmissao,
        verAplic: options.versaoAplicativo || 'BORLIM_NFSE_NACIONAL_2.0',
        serie: options.serie || '1',
        nDPS: String(options.numeroDps),
        dCompet: options.competencia.slice(0, 10),
        tpEmit: '1', // 1=Prestador, 2=Tomador, 3=Intermediario
        cLocEmi: codMunPrestador,
        prest: {
          CNPJ: prestadorDoc,
          IM: options.prestador.inscricaoMunicipal || undefined,
          xNome: options.prestador.razaoSocial,
          xFant: options.prestador.nomeFantasia || undefined,
          regTrib: {
            opSimpNac,
            regEspTrib: '0', // 0=Nenhum, 1=Ato Cooperado, 2=Estimativa, etc.
          },
        },
        toma: {
          [isCnpjTomador ? 'CNPJ' : 'CPF']: tomadorDoc,
          xNome: options.tomador.razaoSocial,
          IM: options.tomador.inscricaoMunicipal || undefined,
          end: {
            xLgr: options.tomador.logradouro || 'NÃO INFORMADO',
            nro: options.tomador.numero || 'SN',
            xCpl: options.tomador.complemento || undefined,
            xBairro: options.tomador.bairro || 'CENTRO',
            cMun:
              (options.tomador.codigoMunicipio || codMunPrestacao).replace(/\D/g, '') || '3550308',
            UF: options.tomador.estado || 'SP',
            CEP: (options.tomador.cep || '01000-000').replace(/\D/g, ''),
          },
          fone: options.tomador.telefone ? options.tomador.telefone.replace(/\D/g, '') : undefined,
          email: options.tomador.email || undefined,
        },
        serv: {
          locPrest: {
            cLocPrestacao: codMunPrestacao,
          },
          cServ: {
            cTribNac: options.itens[0]?.codigoTributacaoNacional?.replace(/\D/g, '') || '010701',
            xDescServ:
              options.discriminacaoGeral ||
              options.itens
                .map((i) => `${i.item}. ${i.descricao} (Qtd: ${i.quantidade})`)
                .join('\n'),
          },
          itensServ: itensFormatados,
        },
        valores: {
          vServPrest: {
            vServ: Number(options.valores.valorServicos || 0).toFixed(2),
            vDescIncond: Number(options.valores.descontoIncondicionado || 0).toFixed(2),
          },
          trib: {
            tribMun: {
              tribISSQN: opSimpNac === '1' || opSimpNac === '2' ? '1' : '1', // 1=Operação tributável
              tpRetISSQN: options.valores.issRetido ? '1' : '2', // 1=Retido pelo tomador, 2=Não retido
              pAliq: Number(options.valores.aliquotaIss || 0).toFixed(2),
              vISSQN: Number(options.valores.valorIss || 0).toFixed(2),
            },
            tribFed: {
              piscofins: {
                vPIS: Number(options.valores.valorPis || 0).toFixed(2),
                vCOFINS: Number(options.valores.valorCofins || 0).toFixed(2),
              },
              vINSS: Number(options.valores.valorInss || 0).toFixed(2),
              vIR: Number(options.valores.valorIr || 0).toFixed(2),
              vCSLL: Number(options.valores.valorCsll || 0).toFixed(2),
              vOutrasRet: Number(options.valores.outrasRetencoes || 0).toFixed(2),
            },
            totTrib: {
              indTotTrib: '0', // Não informado ou calculado pelo ADN
            },
          },
          vLiq: Number(options.valores.valorLiquido || 0).toFixed(2),
        },
      },
    },
  }

  return {
    dpsId,
    payload,
    xml: gerarXmlDpsNacional(payload),
  }
}

/**
 * Serializa o payload JSON do DPS Nacional v1.01 em XML conforme padrão SPED/ADN
 */
export function gerarXmlDpsNacional(payloadWrapper: any): string {
  const inf = payloadWrapper?.dps?.infDPS
  if (!inf) return ''

  const safeXml = (str?: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const tomaDoc = inf.toma.CNPJ ? `<CNPJ>${inf.toma.CNPJ}</CNPJ>` : `<CPF>${inf.toma.CPF}</CPF>`

  const itensXml = (inf.serv.itensServ || [])
    .map(
      (it: any) => `        <itemServ>
          <nItem>${it.nItem}</nItem>
          <xDescServ>${safeXml(it.xDescServ)}</xDescServ>
          <qServ>${it.qServ}</qServ>
          <vUnit>${it.vUnit}</vUnit>
          <vServ>${it.vServ}</vServ>
          <cTribNac>${it.cTribNac}</cTribNac>
        </itemServ>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="${payloadWrapper.versao || '1.01'}">
  <infDPS Id="${inf.Id}">
    <tpAmb>${inf.tpAmb}</tpAmb>
    <dhEmi>${inf.dhEmi}</dhEmi>
    <verAplic>${safeXml(inf.verAplic)}</verAplic>
    <serie>${inf.serie}</serie>
    <nDPS>${inf.nDPS}</nDPS>
    <dCompet>${inf.dCompet}</dCompet>
    <tpEmit>${inf.tpEmit}</tpEmit>
    <cLocEmi>${inf.cLocEmi}</cLocEmi>
    <prest>
      <CNPJ>${inf.prest.CNPJ}</CNPJ>
      ${inf.prest.IM ? `<IM>${safeXml(inf.prest.IM)}</IM>` : ''}
      <xNome>${safeXml(inf.prest.xNome)}</xNome>
      <regTrib>
        <opSimpNac>${inf.prest.regTrib.opSimpNac}</opSimpNac>
        <regEspTrib>${inf.prest.regTrib.regEspTrib}</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${tomaDoc}
      <xNome>${safeXml(inf.toma.xNome)}</xNome>
      <end>
        <xLgr>${safeXml(inf.toma.end.xLgr)}</xLgr>
        <nro>${safeXml(inf.toma.end.nro)}</nro>
        ${inf.toma.end.xCpl ? `<xCpl>${safeXml(inf.toma.end.xCpl)}</xCpl>` : ''}
        <xBairro>${safeXml(inf.toma.end.xBairro)}</xBairro>
        <cMun>${inf.toma.end.cMun}</cMun>
        <UF>${inf.toma.end.UF}</UF>
        <CEP>${inf.toma.end.CEP}</CEP>
      </end>
      ${inf.toma.fone ? `<fone>${inf.toma.fone}</fone>` : ''}
      ${inf.toma.email ? `<email>${safeXml(inf.toma.email)}</email>` : ''}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${inf.serv.locPrest.cLocPrestacao}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${inf.serv.cServ.cTribNac}</cTribNac>
        <xDescServ><![CDATA[${inf.serv.cServ.xDescServ}]]></xDescServ>
      </cServ>
      <itens>
${itensXml}
      </itens>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${inf.valores.vServPrest.vServ}</vServ>
        <vDescIncond>${inf.valores.vServPrest.vDescIncond}</vDescIncond>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>${inf.valores.trib.tribMun.tribISSQN}</tribISSQN>
          <tpRetISSQN>${inf.valores.trib.tribMun.tpRetISSQN}</tpRetISSQN>
          <pAliq>${inf.valores.trib.tribMun.pAliq}</pAliq>
          <vISSQN>${inf.valores.trib.tribMun.vISSQN}</vISSQN>
        </tribMun>
        <tribFed>
          <piscofins>
            <vPIS>${inf.valores.trib.tribFed.piscofins.vPIS}</vPIS>
            <vCOFINS>${inf.valores.trib.tribFed.piscofins.vCOFINS}</vCOFINS>
          </piscofins>
          <vINSS>${inf.valores.trib.tribFed.vINSS}</vINSS>
          <vIR>${inf.valores.trib.tribFed.vIR}</vIR>
          <vCSLL>${inf.valores.trib.tribFed.vCSLL}</vCSLL>
          <vOutrasRet>${inf.valores.trib.tribFed.vOutrasRet}</vOutrasRet>
        </tribFed>
        <totTrib>
          <indTotTrib>${inf.valores.trib.totTrib.indTotTrib}</indTotTrib>
        </totTrib>
      </trib>
      <vLiq>${inf.valores.vLiq}</vLiq>
    </valores>
  </infDPS>
</DPS>`
}

/**
 * Validação semântica e estrutural das regras locais do DPS Nacional v1.01
 */
export function validarDpsNacionalLocal(options: GerarDpsNacionalOptions): {
  valido: boolean
  erros: string[]
  avisos: string[]
} {
  const erros: string[] = []
  const avisos: string[] = []

  // 1. Prestador
  const cnpjPrest = options.prestador.cnpj.replace(/\D/g, '')
  if (!cnpjPrest || cnpjPrest.length !== 14) {
    erros.push('CNPJ do Prestador inválido: deve possuir 14 dígitos.')
  }
  if (!options.prestador.razaoSocial?.trim()) {
    erros.push('Razão Social do Prestador é obrigatória no DPS.')
  }

  // 2. Tomador
  const docToma = options.tomador.cpfCnpj.replace(/\D/g, '')
  if (docToma.length !== 11 && docToma.length !== 14) {
    erros.push('CPF/CNPJ do Tomador inválido: deve possuir 11 dígitos (PF) ou 14 dígitos (PJ).')
  }
  if (!options.tomador.razaoSocial?.trim()) {
    erros.push('Razão Social/Nome do Tomador é obrigatório.')
  }
  if (!options.tomador.logradouro?.trim()) {
    erros.push('Endereço (logradouro) do Tomador é obrigatório no padrão nacional.')
  }

  // 3. Itens de serviço
  if (!options.itens || options.itens.length === 0) {
    erros.push('A NFS-e deve possuir pelo menos um item de serviço detalhado.')
  } else {
    options.itens.forEach((it, idx) => {
      if (!it.descricao?.trim()) {
        erros.push(`Item ${idx + 1}: A descrição do serviço é obrigatória.`)
      }
      if (it.valorUnitario <= 0) {
        erros.push(`Item ${idx + 1}: O valor unitário deve ser maior que zero.`)
      }
      if (!it.codigoTributacaoNacional) {
        erros.push(`Item ${idx + 1}: O código de tributação nacional (CNAE/LC 116) é obrigatório.`)
      }
    })
  }

  // 4. Valores
  if (options.valores.valorServicos <= 0) {
    erros.push('O valor total dos serviços deve ser superior a zero.')
  }
  if (options.valores.aliquotaIss < 0 || options.valores.aliquotaIss > 100) {
    erros.push('A alíquota de ISS deve estar entre 0% e 100%.')
  }

  // Avisos
  if (!options.prestador.inscricaoMunicipal) {
    avisos.push('Inscrição Municipal do prestador não informada. Pode ser exigida pelo município.')
  }
  if (!options.tomador.email) {
    avisos.push('E-mail do tomador não informado. O cliente não receberá aviso automático.')
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  }
}
