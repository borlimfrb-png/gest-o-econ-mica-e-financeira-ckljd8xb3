import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { NotaFiscalRecord } from '@/types/finance'
import { formatBrlMoeda } from '@/lib/nfseXmlGenerator'
import { formatCnpj } from '@/lib/financeCalculations'
import { DanfseQrCode } from '@/components/DanfseQrCode'
import { useToast } from '@/hooks/use-toast'

export interface DanfseA4DocumentProps {
  nota: NotaFiscalRecord
  minhaEmpresa?: any
  empresaCliente?: any
  tomadorRef?: any
  id?: string
}

/**
 * Layout Fiel do DANFSe v2.0 Oficial (Documento Auxiliar da NFS-e - Padrão Nacional)
 * Replicado fielmente conforme modelo oficial da Receita Federal / SEFIN Nacional:
 *
 * 1. Cabeçalho canônico:
 *    - Logo NFS-e oficial / "DANFSe v2.0" + "Documento Auxiliar da NFS-e"
 *    - À direita: "Município: ... · Ambiente Gerador: 2 · Tipo de Ambiente: 1 (ou 2)"
 * 2. Bloco CHAVE DE ACESSO DA NFS-e destacada com QR Code e texto oficial de autenticidade
 * 3. Bloco de Dados de Identificação da NFS-e:
 *    NÚMERO DA NFS-e · COMPETÊNCIA · DATA E HORA DA EMISSÃO · NÚMERO DA DPS · SÉRIE DA DPS · DATA E HORA DA EMISSÃO DA DPS · SITUAÇÃO DA NFS-e · FINALIDADE
 * 4. Bloco PRESTADOR / FORNECEDOR (com indicador "EMITENTE DA NFS-e / Prestador"):
 *    CNPJ/CPF/NIF · Indicador Municipal (Inscrição) · Telefone · Nome / Nome Empresarial · Município / Sigla UF · Código IBGE / CEP · Endereço · E-mail · Simples Nacional · Regime de Apuração
 * 5. Bloco TOMADOR / ADQUIRENTE:
 *    CNPJ/CPF/NIF · Indicador Municipal · Telefone · Nome · Município/UF · Código IBGE/CEP · Endereço · E-mail
 *    + DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e
 *    + INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e
 * 6. Bloco SERVIÇO PRESTADO:
 *    Código de Tributação Nacional/Municipal · Código da NBS · Local da Prestação/Sigla UF/País · Item da lista · Descrição do Serviço
 * 7. Bloco TRIBUTAÇÃO MUNICIPAL (ISSQN):
 *    Tipo de Tributação do ISSQN · Município/UF/País de Incidência · BC ISSQN · Alíquota Aplicada · Retenção do ISSQN · ISSQN Apurado
 * 8. Bloco TRIBUTAÇÃO FEDERAL (EXCETO CBS):
 *    IRRF · Contribuição Previdenciária - Retida · Contribuições Sociais - Retidas · PIS Débito · COFINS Débito · Descrição Contrib. Sociais - Retidas
 * 9. Bloco TRIBUTAÇÃO IBS/CBS:
 *    CST / cClassTrib · Indicador de Operação / Cód IBGE / Mun / UF · Exclusões e Reduções · BC Após Exclusões · Red. Alíq IBS/CBS · Alíq IBS UF/Mun · Alíq Efetiva Mun · Valor Apurado Mun · Alíq Efetiva Est · Valor Apurado Est · Valor Total Apurado IBS · Alíquota CBS · Alíq Efetiva CBS · Valor Total Apurado CBS
 * 10. Bloco VALOR TOTAL DA NFS-e:
 *     VALOR DA OPERAÇÃO / SERVIÇO · Desconto Incondicionado · Desconto Condicionado · Total das Retenções · VALOR LÍQUIDO DA NFS-e · Total do IBS/CBS · VALOR LÍQUIDO DA NFS-e + IBS/CBS
 * 11. Bloco INFORMAÇÕES COMPLEMENTARES (Lei 12.741/2012 e mensagens fiscais)
 * 12. Canhoto inferior: DATA CIENTIFICAÇÃO · IDENTIFICAÇÃO E ASSINATURA · N° NFS-e / CHAVE NFS-e
 *
 * Campos sem valor aparecem como "-" (hífen).
 */
export const DanfseA4Document: React.FC<DanfseA4DocumentProps> = ({
  nota,
  minhaEmpresa,
  empresaCliente,
  tomadorRef,
  id = 'danfse-nacional-a4-document',
}) => {
  const { toast } = useToast()
  const [copiado, setCopiado] = useState(false)

  // Identificação do ambiente de homologação
  const isHomologacao =
    nota.tipo_ambiente?.includes('2') ||
    nota.tipo_ambiente?.toLowerCase().includes('homolog') ||
    nota.modo_emissao?.toLowerCase().includes('homolog') ||
    nota.modo_emissao?.toLowerCase().includes('simula') ||
    !nota.tipo_ambiente

  const isCancelada = nota.status === 'Cancelada'
  const isSubstituida = nota.status === 'Substituída'

  // Chave de acesso de 50 dígitos
  const chaveAcesso = (nota.chave_acesso || '').replace(/\D/g, '')

  // Formatação de data e hora
  const formatDataHora = (dataStr?: string) => {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    if (isNaN(d.getTime())) {
      const s = dataStr.slice(0, 10).split('-')
      if (s.length === 3) return `${s[2]}/${s[1]}/${s[0]}`
      return dataStr
    }
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDataSimples = (dataStr?: string) => {
    if (!dataStr) return '-'
    const s = dataStr.slice(0, 10).split('-')
    if (s.length === 3) return `${s[2]}/${s[1]}/${s[0]}`
    return dataStr
  }

  const copiarChave = () => {
    if (chaveAcesso) {
      navigator.clipboard.writeText(chaveAcesso)
      setCopiado(true)
      toast({
        title: 'Chave copiada!',
        description: 'Chave de acesso nacional copiada para a área de transferência.',
      })
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  // Resolução de dados do PRESTADOR (minha_empresa da consultoria)
  const prestador = {
    razaoSocial:
      nota.prestador_razao_social ||
      minhaEmpresa?.razao_social ||
      minhaEmpresa?.nome_fantasia ||
      'BORLIM CONSULTORIA EMPRESARIAL LTDA',
    cnpj: nota.prestador_cnpj || minhaEmpresa?.cnpj || '30.915.624/0001-08',
    inscricaoMunicipal:
      nota.prestador_inscricao_municipal || minhaEmpresa?.inscricao_municipal || '-',
    logradouro: minhaEmpresa?.logradouro || 'RUA ORLANDO BENEDETTI',
    numero: minhaEmpresa?.numero || '1041',
    complemento: minhaEmpresa?.complemento,
    bairro: minhaEmpresa?.bairro || 'JARDIM SAO BENEDITO II',
    municipio: minhaEmpresa?.cidade || 'Jaci',
    uf: minhaEmpresa?.estado || 'SP',
    cep: minhaEmpresa?.cep || '15.156-022',
    telefone:
      minhaEmpresa?.telefone_comercial || minhaEmpresa?.celular_whatsapp || '(17) 99765-0672',
    email:
      minhaEmpresa?.email_financeiro || minhaEmpresa?.email_comercial || 'flavio@borlim.com.br',
    codigoIbge: minhaEmpresa?.codigo_ibge || '35.24501',
    simplesNacional:
      minhaEmpresa?.regime_tributario?.includes('Simples') || !minhaEmpresa?.regime_tributario
        ? 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)'
        : 'Não Optante',
    regimeApuracaoSN: 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
  }

  // Resolução de dados do TOMADOR (empresa cliente)
  const tomadorRefDados = tomadorRef || nota.expand?.tomador_ref
  const empCliente = empresaCliente || nota.expand?.empresa
  const tomador = {
    razaoSocial:
      nota.tomador_razao_social ||
      tomadorRefDados?.razao_social ||
      empCliente?.nome ||
      'C.R.M. MULTIELETRICA MATERIAIS ELETRICOS - LTDA',
    cnpjCpf:
      nota.tomador_cnpj || tomadorRefDados?.cpf_cnpj || empCliente?.cnpj || '05.208.559/0001-25',
    inscricaoMunicipal:
      tomadorRefDados?.inscricao_municipal || empCliente?.inscricao_municipal || '-',
    logradouro: tomadorRefDados?.logradouro || empCliente?.logradouro || 'DOUTOR ANILOEL NAZARETH',
    numero: tomadorRefDados?.numero || empCliente?.numero || '5400',
    complemento: tomadorRefDados?.complemento || empCliente?.complemento || 'ANEXO 5350',
    bairro:
      tomadorRefDados?.bairro || empCliente?.bairro || 'PARQUE RESIDENCIAL COMENDADOR MANCOR DAUD',
    municipio: tomadorRefDados?.cidade || empCliente?.cidade || 'São José do Rio Preto',
    uf: tomadorRefDados?.estado || empCliente?.estado || 'SP',
    cep: tomadorRefDados?.cep || empCliente?.cep || '15.070-565',
    telefone: tomadorRefDados?.telefone || empCliente?.telefone || '-',
    email:
      nota.tomador_email ||
      tomadorRefDados?.email ||
      empCliente?.email ||
      'financeiro4@multieletrica.com.br',
    codigoIbge: tomadorRefDados?.codigo_municipio || empCliente?.codigo_ibge || '35.49805',
  }

  // Números e referências
  const numNota = String(nota.numero || 137)
  const serieDps = String(nota.dps_serie || nota.serie || '70000')
  const numDps = String(nota.dps_numero || nota.numero || '117')
  const dataEmissaoFormatada = formatDataHora(nota.data_emissao || new Date().toISOString())
  const competenciaFormatada = formatDataSimples(
    nota.competencia || nota.data_emissao || '2026-10-02',
  )

  // Código de tributação e serviços
  const codTribNacional = nota.codigo_tributacao_nacional || '17.19.01'
  const codTribMunicipal = nota.codigo_servico_municipal || '-'
  const descItemServico =
    codTribNacional.startsWith('17.19') || codTribNacional === '010701'
      ? 'Contabilidade, inclusive serviços técnicos e auxiliares.'
      : 'Serviços de consultoria e gestão empresarial.'
  const discriminacaoTexto = nota.discriminacao || 'CONSULTORIA FINANCEIRA E CONTÁBIL.'

  // Valores
  const vServicosNum = Number(nota.valor_servicos) || 0
  const vServicos = formatBrlMoeda(vServicosNum)
  const vLiqNum = Number(nota.valor_liquido) || vServicosNum
  const vLiq = formatBrlMoeda(vLiqNum)
  const vIssNum = Number(nota.valor_iss) || 0
  const vIss = vIssNum > 0 ? formatBrlMoeda(vIssNum) : '-'
  const aliqIssStr = nota.aliquota_iss ? `${Number(nota.aliquota_iss).toFixed(2)}%` : '-'
  const retencaoIss = nota.iss_retido ? 'Retido' : 'Não Retido'

  // Retenções federais
  const vIrNum = Number(nota.valor_ir) || 0
  const vInssNum = Number(nota.valor_inss) || 0
  const vCsllNum = Number(nota.valor_csll) || 0
  const vPisNum = Number(nota.valor_pis) || 0
  const vCofinsNum = Number(nota.valor_cofins) || 0
  const totalRetFederais = vIrNum + vInssNum + vCsllNum + vPisNum + vCofinsNum

  const vDescIncond =
    nota.desconto_incondicionado && Number(nota.desconto_incondicionado) > 0
      ? formatBrlMoeda(nota.desconto_incondicionado)
      : '-'

  const situacaoNfse = isCancelada
    ? 'NFS-e Cancelada'
    : isSubstituida
      ? 'NFS-e Substituída'
      : 'NFS-e Gerada'

  // Endereço completo prestador
  const enderecoPrestador = `${prestador.logradouro}, ${prestador.numero}${prestador.complemento ? `, ${prestador.complemento}` : ''}, ${prestador.bairro}`
  // Endereço completo tomador
  const enderecoTomador = `${tomador.logradouro}, ${tomador.numero}${tomador.complemento ? `, ${tomador.complemento}` : ''}, ${tomador.bairro}`

  return (
    <div
      id={id}
      className="relative bg-white text-black font-sans text-[9px] leading-tight select-text print:p-0 print:m-0 print:border-none print:shadow-none"
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '6mm 8mm',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* Tarja de Homologação / Simulação */}
      {isHomologacao && !isCancelada && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
        >
          <div className="transform -rotate-30 select-none text-center font-black uppercase tracking-widest text-amber-500/15 text-5xl sm:text-6xl border-4 border-dashed border-amber-500/20 px-8 py-4 rounded-2xl">
            SEM VALOR FISCAL
            <span className="block text-2xl sm:text-3xl font-bold tracking-wider mt-1 text-amber-500/20">
              AMBIENTE DE HOMOLOGAÇÃO
            </span>
          </div>
        </div>
      )}

      {/* Marca d'água de Cancelamento */}
      {isCancelada && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
        >
          <div className="transform -rotate-30 select-none text-center font-black uppercase tracking-widest text-red-600/20 text-6xl sm:text-7xl border-8 border-red-600/30 px-10 py-6 rounded-2xl">
            NFS-E CANCELADA
            <span className="block text-2xl font-bold mt-2">SEM EFICÁCIA JURÍDICA</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CABEÇALHO SUPERIOR OFICIAL                                             */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1">
        <div className="grid grid-cols-12 items-stretch divide-x divide-black">
          {/* Logo / Título */}
          <div className="col-span-7 p-2 flex items-center gap-3">
            {/* Logo NFS-e oficial estilizado em SVG */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-start leading-none">
                <span className="text-2xl font-black tracking-tighter text-[#0b5c53]">NFSe</span>
                <span className="text-[7px] text-gray-700 tracking-tight leading-none mt-0.5">
                  Nota Fiscal de
                  <br />
                  serviço eletrônica
                </span>
              </div>
            </div>
            <div className="flex-1 text-center">
              <h1 className="font-bold text-[13px] tracking-tight uppercase leading-none">
                DANFSe v2.0
              </h1>
              <p className="text-[11px] font-normal mt-0.5 leading-tight">
                Documento Auxiliar da NFS-e
              </p>
            </div>
          </div>

          {/* Dados do Município e Ambiente */}
          <div className="col-span-5 p-1.5 flex flex-col justify-center text-[8.5px] leading-tight space-y-0.5">
            <div>
              <span className="font-bold">Município:</span> {prestador.municipio} - {prestador.uf}
            </div>
            <div>
              <span className="font-bold">Ambiente Gerador:</span> 2
            </div>
            <div>
              <span className="font-bold">Tipo de Ambiente:</span> {isHomologacao ? '2' : '1'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CHAVE DE ACESSO DA NFS-e + QR CODE                                     */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 p-1.5">
        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-9 space-y-1">
            <div className="font-bold text-[8.5px] uppercase tracking-wide">
              CHAVE DE ACESSO DA NFS-e
            </div>
            <div className="font-mono text-[9px] font-bold tracking-tight select-all break-all text-black">
              {chaveAcesso || '35245012230915624000108000000000013726101497594680'}
            </div>
            <p className="text-[7.5px] text-gray-700 leading-snug pt-0.5">
              A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela
              consulta da chave de acesso no portal nacional da NFS-e
            </p>
            {chaveAcesso && (
              <button
                type="button"
                onClick={copiarChave}
                className="inline-flex items-center gap-1 text-[7.5px] font-semibold text-gray-600 hover:text-black border border-gray-400 px-1.5 py-0.5 rounded print:hidden mt-0.5"
                title="Copiar chave de acesso"
              >
                {copiado ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
                {copiado ? 'Copiada!' : 'Copiar Chave'}
              </button>
            )}
          </div>
          <div className="col-span-3 flex justify-end">
            <div className="flex flex-col items-center">
              <DanfseQrCode
                chaveAcesso={chaveAcesso}
                size={76}
                className="p-0.5 border-black rounded-none shadow-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. QUADRO DE IDENTIFICAÇÃO DA NFS-e E DPS                                  */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1">
        <div className="grid grid-cols-3 divide-x divide-y divide-black text-[8px]">
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">NÚMERO DA NFS-e</span>
            <span className="font-bold text-[9px]">{numNota}</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">COMPETÊNCIA DA NFS-e</span>
            <span className="text-[8.5px]">{competenciaFormatada}</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">
              DATA E HORA DA EMISSÃO DA NFS-e
            </span>
            <span className="text-[8.5px]">{dataEmissaoFormatada}</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">NÚMERO DA DPS</span>
            <span className="text-[8.5px]">{numDps}</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">SÉRIE DA DPS</span>
            <span className="text-[8.5px]">{serieDps}</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">
              DATA E HORA DA EMISSÃO DA DPS
            </span>
            <span className="text-[8.5px]">{dataEmissaoFormatada}</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">EMITENTE DA NFS-e</span>
            <span className="text-[8.5px]">Prestador</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">SITUAÇÃO DA NFS-e</span>
            <span className="text-[8.5px] font-semibold">{situacaoNfse}</span>
          </div>
          <div className="p-1">
            <span className="font-bold block uppercase text-[7.5px]">FINALIDADE</span>
            <span className="text-[8.5px]">-</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PRESTADOR / FORNECEDOR                                                 */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-y divide-black">
          <div className="col-span-3 p-1 font-bold bg-gray-50 flex items-center">
            PRESTADOR / FORNECEDOR
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">CNPJ / CPF / NIF</span>
            <span className="font-mono text-[8.5px]">{formatCnpj(prestador.cnpj)}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Indicador Municipal (Inscrição)</span>
            <span className="text-[8.5px]">{prestador.inscricaoMunicipal}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Telefone</span>
            <span className="text-[8.5px]">{prestador.telefone}</span>
          </div>

          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">Nome / Nome Empresarial</span>
            <span className="font-bold text-[8.5px]">{prestador.razaoSocial}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Município / Sigla UF</span>
            <span className="text-[8.5px]">
              {prestador.municipio} / {prestador.uf}
            </span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Código IBGE / CEP</span>
            <span className="text-[8.5px]">
              {prestador.codigoIbge} / {prestador.cep}
            </span>
          </div>

          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">Endereço</span>
            <span className="text-[8.5px]">{enderecoPrestador}</span>
          </div>
          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">E-mail</span>
            <span className="text-[8.5px]">{prestador.email}</span>
          </div>

          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">
              Simples Nacional na Data de Competência
            </span>
            <span className="text-[8.5px] truncate block" title={prestador.simplesNacional}>
              {prestador.simplesNacional}
            </span>
          </div>
          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">
              Regime de Apuração Tributária pelo SN
            </span>
            <span className="text-[8.5px] truncate block" title={prestador.regimeApuracaoSN}>
              {prestador.regimeApuracaoSN}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TOMADOR / ADQUIRENTE                                                   */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-y divide-black">
          <div className="col-span-3 p-1 font-bold bg-gray-50 flex items-center">
            TOMADOR / ADQUIRENTE
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">CNPJ / CPF / NIF</span>
            <span className="font-mono text-[8.5px]">{formatCnpj(tomador.cnpjCpf)}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Indicador Municipal (Inscrição)</span>
            <span className="text-[8.5px]">{tomador.inscricaoMunicipal}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Telefone</span>
            <span className="text-[8.5px]">{tomador.telefone}</span>
          </div>

          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">Nome / Nome Empresarial</span>
            <span className="font-bold text-[8.5px]">{tomador.razaoSocial}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Município / Sigla UF</span>
            <span className="text-[8.5px]">
              {tomador.municipio} / {tomador.uf}
            </span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Código IBGE / CEP</span>
            <span className="text-[8.5px]">
              {tomador.codigoIbge} / {tomador.cep}
            </span>
          </div>

          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">Endereço</span>
            <span className="text-[8.5px]">{enderecoTomador}</span>
          </div>
          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">E-mail</span>
            <span className="text-[8.5px]">{tomador.email}</span>
          </div>

          <div className="col-span-12 p-1 text-center font-bold text-[7.5px] bg-white">
            DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e
          </div>
          <div className="col-span-12 p-1 text-center font-bold text-[7.5px] bg-white">
            INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. SERVIÇO PRESTADO                                                       */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-y divide-black">
          <div className="col-span-3 p-1 font-bold bg-gray-50 flex items-center">
            SERVIÇO PRESTADO
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">
              Código de Tributação Nacional/Municipal
            </span>
            <span className="text-[8.5px]">
              {codTribNacional} / {codTribMunicipal}
            </span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Código da NBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">
              Local da Prestação / Sigla UF / País
            </span>
            <span className="text-[8.5px]">
              {prestador.municipio} / {prestador.uf} / -
            </span>
          </div>

          <div className="col-span-12 p-1 text-[8.5px]">{descItemServico}</div>

          <div className="col-span-12 p-1 space-y-0.5">
            <span className="font-bold block text-[7.5px]">Descrição do Serviço</span>
            <p className="text-[8.5px] whitespace-pre-wrap">{discriminacaoTexto}</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. TRIBUTAÇÃO MUNICIPAL (ISSQN)                                            */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-y divide-black">
          <div className="col-span-4 p-1 font-bold bg-gray-50 flex items-center">
            TRIBUTAÇÃO MUNICIPAL (ISSQN)
          </div>
          <div className="col-span-4 p-1">
            <span className="font-bold block text-[7.5px]">Tipo de Tributação do ISSQN</span>
            <span className="text-[8.5px]">Operação Tributável</span>
          </div>
          <div className="col-span-4 p-1">
            <span className="font-bold block text-[7.5px]">
              Município / Sigla UF / País de Incidência do ISSQN
            </span>
            <span className="text-[8.5px]">
              {prestador.municipio} / {prestador.uf} / -
            </span>
          </div>

          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">BC ISSQN</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Alíquota Aplicada</span>
            <span className="text-[8.5px]">{aliqIssStr}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Retenção do ISSQN</span>
            <span className="text-[8.5px]">{retencaoIss}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">ISSQN Apurado</span>
            <span className="text-[8.5px]">{vIss}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8. TRIBUTAÇÃO FEDERAL (EXCETO CBS)                                        */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-y divide-black">
          <div className="col-span-3 p-1 font-bold bg-gray-50 flex items-center">
            TRIBUTAÇÃO FEDERAL (EXCETO CBS)
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">IRRF</span>
            <span className="text-[8.5px]">{vIrNum > 0 ? formatBrlMoeda(vIrNum) : '-'}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">
              Contribuição Previdenciária - Retida
            </span>
            <span className="text-[8.5px]">{vInssNum > 0 ? formatBrlMoeda(vInssNum) : '-'}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Contribuições Sociais - Retidas</span>
            <span className="text-[8.5px]">{vCsllNum > 0 ? formatBrlMoeda(vCsllNum) : '-'}</span>
          </div>

          <div className="col-span-4 p-1">
            <span className="font-bold block text-[7.5px]">PIS - Débito Apuração Própria</span>
            <span className="text-[8.5px]">{vPisNum > 0 ? formatBrlMoeda(vPisNum) : '-'}</span>
          </div>
          <div className="col-span-4 p-1">
            <span className="font-bold block text-[7.5px]">COFINS - Débito Apuração Própria</span>
            <span className="text-[8.5px]">
              {vCofinsNum > 0 ? formatBrlMoeda(vCofinsNum) : '-'}
            </span>
          </div>
          <div className="col-span-4 p-1">
            <span className="font-bold block text-[7.5px]">
              Descrição Contrib. Sociais - Retidas
            </span>
            <span className="text-[8.5px]">0 - PIS/COFINS/CSLL Não Retidos</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 9. TRIBUTAÇÃO IBS/CBS                                                     */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-y divide-black">
          <div className="col-span-3 p-1 font-bold bg-gray-50 flex items-center">
            TRIBUTAÇÃO IBS/CBS
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">CST / cClassTrib</span>
            <span className="text-[8.5px]">- / -</span>
          </div>
          <div className="col-span-6 p-1">
            <span className="font-bold block text-[7.5px]">
              Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF
            </span>
            <span className="text-[8.5px]">- / - / - / -</span>
          </div>

          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">
              Exclusões e Reduções da Base de Cálculo
            </span>
            <span className="text-[8.5px]">R$ 0,00</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">
              Base de Cálculo Após Exclusões e Reduções
            </span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">
              Red. Alíquota IBS / Red. Alíquota CBS
            </span>
            <span className="text-[8.5px]">- / - / -</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Alíquota - IBS UF / IBS Mun</span>
            <span className="text-[8.5px]">- / -</span>
          </div>

          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Alíq. Efetiva Municipal - IBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Valor Apurado Municipal - IBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Alíq. Efetiva Estadual - IBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Valor Apurado Estadual - IBS</span>
            <span className="text-[8.5px]">-</span>
          </div>

          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Valor Total Apurado - IBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Alíquota - CBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Alíq. Efetiva - CBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Valor Total Apurado - CBS</span>
            <span className="text-[8.5px]">-</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 10. VALOR TOTAL DA NFS-e                                                  */}
      {/* ========================================================================= */}
      <div className="border border-black mb-1 text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-y divide-black">
          <div className="col-span-3 p-1 font-bold bg-gray-50 flex items-center">
            VALOR TOTAL DA NFS-e
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">VALOR DA OPERAÇÃO / SERVIÇO</span>
            <span className="font-bold text-[9px]">{vServicos}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Desconto Incondicionado</span>
            <span className="text-[8.5px]">{vDescIncond}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Desconto Condicionado</span>
            <span className="text-[8.5px]">-</span>
          </div>

          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">
              Total das Retenções (ISSQN / Federais)
            </span>
            <span className="text-[8.5px]">
              {totalRetFederais > 0 ? formatBrlMoeda(totalRetFederais) : '-'}
            </span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">VALOR LÍQUIDO DA NFS-e</span>
            <span className="font-bold text-[9px]">{vLiq}</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">Total do IBS/CBS</span>
            <span className="text-[8.5px]">R$ 0,00</span>
          </div>
          <div className="col-span-3 p-1">
            <span className="font-bold block text-[7.5px]">VALOR LÍQUIDO DA NFS-e + IBS/CBS</span>
            <span className="font-bold text-[8.5px]">R$ 0,00</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 11. INFORMAÇÕES COMPLEMENTARES                                            */}
      {/* ========================================================================= */}
      <div className="border border-black mb-6 text-[8px]">
        <div className="p-1 font-bold bg-gray-50 border-b border-black text-[7.5px]">
          INFORMAÇÕES COMPLEMENTARES
        </div>
        <div className="p-1.5 min-h-[50px] space-y-1 text-[8px] leading-snug">
          <p>
            Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: -; Estaduais: -;
            Municipais: -;
          </p>
          {nota.justificativa_correcao && (
            <p className="italic text-amber-900">
              Observação / Justificativa da Correção: {nota.justificativa_correcao}
            </p>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 12. CANHOTO INFERIOR: DATA CIENTIFICAÇÃO / ASSINATURA / CHAVE             */}
      {/* ========================================================================= */}
      <div className="border border-black text-[8px]">
        <div className="grid grid-cols-12 divide-x divide-black items-stretch min-h-[36px]">
          <div className="col-span-3 p-1 flex flex-col justify-between">
            <span className="font-bold text-[7.5px] uppercase">DATA CIENTIFICAÇÃO:</span>
          </div>
          <div className="col-span-3 p-1 flex flex-col justify-between">
            <span className="font-bold text-[7.5px] uppercase">IDENTIFICAÇÃO E ASSINATURA</span>
          </div>
          <div className="col-span-6 p-1 flex flex-col justify-between">
            <span className="font-bold text-[7.5px] uppercase">N° NFS-e / CHAVE NFS-e</span>
            <span className="font-mono text-[7.5px] break-all leading-tight">
              {numNota} / {chaveAcesso || '35245012230915624000108000000000013726101497594680'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DanfseA4Document
