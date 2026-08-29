import type { NotaFiscalRecord } from '@/types/finance'
import { formatCnpj } from './financeCalculations'

export interface DadosDanfse {
  nota: NotaFiscalRecord
  prestador: {
    razaoSocial: string
    nomeFantasia?: string
    cnpj: string
    inscricaoMunicipal?: string
    inscricaoEstadual?: string
    endereco?: string
    cidade?: string
    estado?: string
    cep?: string
    telefone?: string
    email?: string
    regimeTributario?: string
  }
  tomador: {
    razaoSocial: string
    nomeFantasia?: string
    cnpj: string
    endereco?: string
    cidade?: string
    estado?: string
    cep?: string
    telefone?: string
    email?: string
  }
}

/**
 * Gera string XML padrão ABRASF v2.03 para download.
 */
export function gerarXmlNfse(dados: DadosDanfse): string {
  const { nota, prestador, tomador } = dados

  if (
    nota.status === 'Cancelada' &&
    nota.xml_cancelamento &&
    nota.xml_cancelamento.trim().startsWith('<?xml')
  ) {
    return nota.xml_cancelamento
  }

  if (nota.xml_conteudo && nota.xml_conteudo.trim().startsWith('<?xml')) {
    return nota.xml_conteudo
  }

  const cleanNum = (v: number | undefined) => (Number(v) || 0).toFixed(2)
  const dtEmissao = nota.data_emissao
    ? new Date(nota.data_emissao).toISOString()
    : new Date().toISOString()
  const competencia = nota.competencia ? nota.competencia.slice(0, 10) : dtEmissao.slice(0, 10)

  return `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse versao="2.03">
    <InfNfse Id="NFSE${nota.numero}">
      <Numero>${nota.numero}</Numero>
      <CodigoVerificacao>${nota.codigo_verificacao || 'N/A'}</CodigoVerificacao>
      <DataEmissao>${dtEmissao}</DataEmissao>
      <NaturezaOperacao>${nota.natureza_operacao || '1'}</NaturezaOperacao>
      <RegimeEspecialTributacao>1</RegimeEspecialTributacao>
      <OptanteSimplesNacional>${prestador.regimeTributario?.includes('Simples') ? '1' : '2'}</OptanteSimplesNacional>
      <IncentivadorCultural>2</IncentivadorCultural>
      <Competencia>${competencia}</Competencia>
      <ChaveAcesso>${nota.chave_acesso || ''}</ChaveAcesso>
      <Servico>
        <Valores>
          <ValorServicos>${cleanNum(nota.valor_servicos)}</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>${cleanNum(nota.valor_pis)}</ValorPis>
          <ValorCofins>${cleanNum(nota.valor_cofins)}</ValorCofins>
          <ValorInss>${cleanNum(nota.valor_inss)}</ValorInss>
          <ValorIr>${cleanNum(nota.valor_ir)}</ValorIr>
          <ValorCsll>${cleanNum(nota.valor_csll)}</ValorCsll>
          <OutrasRetencoes>${cleanNum(nota.outras_retencoes)}</OutrasRetencoes>
          <ValorIss>${cleanNum(nota.valor_iss)}</ValorIss>
          <Aliquota>${cleanNum(nota.aliquota_iss || 5.0)}</Aliquota>
          <DescontoIncondicionado>${cleanNum(nota.desconto_incondicionado)}</DescontoIncondicionado>
          <DescontoCondicionado>0.00</DescontoCondicionado>
          <ValorLiquidoNfse>${cleanNum(nota.valor_liquido)}</ValorLiquidoNfse>
        </Valores>
        <IssRetido>${nota.iss_retido ? '1' : '2'}</IssRetido>
        <ItemListaServico>${nota.item_cnae || '6920-6/01'}</ItemListaServico>
        <CodigoCnae>${(nota.item_cnae || '6920601').replace(/\D/g, '')}</CodigoCnae>
        <CodigoTributacaoMunicipio>${nota.codigo_servico_municipal || '0107'}</CodigoTributacaoMunicipio>
        <Discriminacao><![CDATA[${nota.discriminacao}]]></Discriminacao>
        <CodigoMunicipio>3550308</CodigoMunicipio>
      </Servico>
      <PrestadorServico>
        <IdentificacaoPrestador>
          <CpfCnpj><Cnpj>${prestador.cnpj.replace(/\D/g, '')}</Cnpj></CpfCnpj>
          <InscricaoMunicipal>${prestador.inscricaoMunicipal || 'ISENTO'}</InscricaoMunicipal>
        </IdentificacaoPrestador>
        <RazaoSocial>${prestador.razaoSocial}</RazaoSocial>
        <Endereco>
          <Endereco>${prestador.endereco || ''}</Endereco>
          <Cidade>${prestador.cidade || ''}</Cidade>
          <Uf>${prestador.estado || ''}</Uf>
          <Cep>${(prestador.cep || '').replace(/\D/g, '')}</Cep>
        </Endereco>
        <Contato>
          <Telefone>${(prestador.telefone || '').replace(/\D/g, '')}</Telefone>
          <Email>${prestador.email || ''}</Email>
        </Contato>
      </PrestadorServico>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj><Cnpj>${tomador.cnpj.replace(/\D/g, '')}</Cnpj></CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${tomador.razaoSocial}</RazaoSocial>
        <Endereco>
          <Endereco>${tomador.endereco || ''}</Endereco>
          <Cidade>${tomador.cidade || ''}</Cidade>
          <Uf>${tomador.estado || ''}</Uf>
          <Cep>${(tomador.cep || '').replace(/\D/g, '')}</Cep>
        </Endereco>
        <Contato>
          <Telefone>${(tomador.telefone || '').replace(/\D/g, '')}</Telefone>
          <Email>${tomador.email || ''}</Email>
        </Contato>
      </TomadorServico>
      <OrgaoGerador>
        <CodigoMunicipio>3550308</CodigoMunicipio>
        <Uf>${prestador.estado || 'SP'}</Uf>
      </OrgaoGerador>
    </InfNfse>
  </Nfse>
</CompNfse>`
}

/**
 * Dispara o download de um arquivo no navegador.
 */
export function downloadArquivo(
  conteudo: string,
  nomeArquivo: string,
  tipoMime: string = 'text/plain',
) {
  const blob = new Blob([conteudo], { type: tipoMime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Formata moeda BRL
 */
export function formatBrlMoeda(v: number | undefined | null): string {
  const val = Number(v) || 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}
