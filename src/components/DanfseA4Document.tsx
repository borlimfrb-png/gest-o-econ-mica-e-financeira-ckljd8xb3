import React, { useState } from 'react'
import { Copy, Check, QrCode, ShieldCheck, ExternalLink } from 'lucide-react'
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
 * Layout Canônico A4 do DANFSE Nacional 2.0 (Documento Auxiliar da NFS-e - Padrão DPS 2.0)
 *
 * Implementa rigorosamente:
 * 1. Cabeçalho canônico oficial: brasão/identificador, título "DANFSE — Documento Auxiliar da Nota Fiscal de Serviços Eletrônica",
 *    número da NFS-e (8 dígitos com zero à esquerda), série, data/hora de emissão e competência.
 * 2. Chave de acesso nacional de 50 dígitos (monoespaçada, formatada em 4 grupos e com botão de copiar).
 * 3. Protocolo de autorização e código de verificação.
 * 4. Bloco PRESTADOR: Razão Social, CNPJ, Inscrição Municipal, endereço completo (logradouro, nº, bairro, município/UF, CEP), regime tributário.
 * 5. Bloco TOMADOR: Nome/Razão Social, CNPJ/CPF, Inscrição Municipal, endereço completo (logradouro, nº, bairro, município/UF, CEP), e-mail.
 * 6. Bloco DISCRIMINAÇÃO DOS SERVIÇOS (itens de serviços ou texto estruturado da DPS Nacional).
 * 7. Bloco VALORES: valor dos serviços, alíquota e valor do ISSQN, retenções federais (PIS, COFINS, INSS, IR, CSLL, outras), descontos, valor líquido.
 * 8. Bloco DADOS FISCAIS: Código de tributação nacional (LC 116), CNAE, exigibilidade/incidência do ISS, optante Simples Nacional.
 * 9. QR Code de consulta pública (https://www.nfse.gov.br/consultapublica?chave=<chave>) vetorial SVG nítido.
 * 10. Marca d'água / tarja "SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO" quando em homologação ('2').
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
    !nota.tipo_ambiente // Se não preenchido, default é homologação no projeto

  const isCancelada = nota.status === 'Cancelada'
  const isSubstituida = nota.status === 'Substituída'

  // Chave de acesso de 50 dígitos (ou chave existente)
  const chaveAcesso = (nota.chave_acesso || '').replace(/\D/g, '')
  const chaveFormatada = chaveAcesso
    ? chaveAcesso.match(/.{1,4}/g)?.join(' ') || chaveAcesso
    : 'CHAVE NÃO GERADA'

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
    nomeFantasia: minhaEmpresa?.nome_fantasia,
    cnpj: nota.prestador_cnpj || minhaEmpresa?.cnpj || '30.915.624/0001-08',
    inscricaoMunicipal:
      nota.prestador_inscricao_municipal || minhaEmpresa?.inscricao_municipal || 'ISENTO',
    inscricaoEstadual: minhaEmpresa?.inscricao_estadual,
    logradouro: minhaEmpresa?.logradouro || 'Rua Principal',
    numero: minhaEmpresa?.numero || 'S/N',
    complemento: minhaEmpresa?.complemento,
    bairro: minhaEmpresa?.bairro || 'Centro',
    municipio: minhaEmpresa?.cidade || 'São Paulo',
    uf: minhaEmpresa?.estado || 'SP',
    cep: minhaEmpresa?.cep || '01000-000',
    telefone: minhaEmpresa?.telefone_comercial || minhaEmpresa?.celular_whatsapp,
    email: minhaEmpresa?.email_financeiro || minhaEmpresa?.email_comercial,
    regimeTributario: minhaEmpresa?.regime_tributario || 'Simples Nacional (ME / EPP)',
    codigoIbge: minhaEmpresa?.codigo_ibge || nota.codigo_municipio_prestacao || '3550308',
    cnae:
      minhaEmpresa?.cnae_principal || minhaEmpresa?.cnae_servicos || nota.item_cnae || '6920-6/01',
  }

  // Resolução de dados do TOMADOR (empresa cliente)
  const tomadorRefDados = tomadorRef || nota.expand?.tomador_ref
  const empCliente = empresaCliente || nota.expand?.empresa
  const tomador = {
    razaoSocial:
      nota.tomador_razao_social ||
      tomadorRefDados?.razao_social ||
      empCliente?.nome ||
      'CLIENTE TOMADOR DE SERVIÇOS',
    nomeFantasia: empCliente?.nome_fantasia,
    cnpjCpf:
      nota.tomador_cnpj || tomadorRefDados?.cpf_cnpj || empCliente?.cnpj || '00.000.000/0000-00',
    inscricaoMunicipal:
      tomadorRefDados?.inscricao_municipal || empCliente?.inscricao_municipal || 'NÃO INFORMADA',
    logradouro: tomadorRefDados?.logradouro || empCliente?.logradouro || 'Endereço do Tomador',
    numero: tomadorRefDados?.numero || empCliente?.numero || 'S/N',
    complemento: tomadorRefDados?.complemento || empCliente?.complemento,
    bairro: tomadorRefDados?.bairro || empCliente?.bairro || 'Centro',
    municipio: tomadorRefDados?.cidade || empCliente?.cidade || 'São Paulo',
    uf: tomadorRefDados?.estado || empCliente?.estado || 'SP',
    cep: tomadorRefDados?.cep || empCliente?.cep || '01000-000',
    telefone: tomadorRefDados?.telefone || empCliente?.telefone,
    email: nota.tomador_email || tomadorRefDados?.email || empCliente?.email,
  }

  // Itens de serviço
  const itens =
    nota.servicos_itens && Array.isArray(nota.servicos_itens) && nota.servicos_itens.length > 0
      ? nota.servicos_itens
      : [
          {
            item: 1,
            descricao:
              nota.discriminacao || 'Prestação de Serviços de Assessoria Contábil e Financeira',
            quantidade: 1,
            valor_unitario: nota.valor_servicos,
            valor_total: nota.valor_servicos,
            codigo_tributacao_nacional: nota.codigo_tributacao_nacional || '010701',
            desconto: nota.desconto_incondicionado || 0,
          },
        ]

  const numeroNfseFormatado = String(nota.numero || 1).padStart(8, '0')
  const serieDps = nota.dps_serie || nota.serie || '1'
  const numeroDps = nota.dps_numero || nota.numero || 1

  const urlConsultaOficial = chaveAcesso
    ? `https://www.nfse.gov.br/consultapublica?chave=${chaveAcesso}`
    : 'https://www.nfse.gov.br/consultapublica'

  return (
    <div
      id={id}
      className="relative bg-white text-slate-900 font-sans text-[11px] leading-tight select-text print:p-0 print:m-0 print:border-none print:shadow-none"
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '10mm 12mm',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Marca d'água de HOMOLOGAÇÃO (Diagonal) */}
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

      {/* Marca d'água de CANCELAMENTO */}
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

      {/* Tarja Superior Informativa (Homologação / Cancelada / Substituída) */}
      {isHomologacao && (
        <div className="mb-2 border-2 border-dashed border-amber-500 bg-amber-50 p-2 text-center rounded font-bold uppercase tracking-wider text-[11px] text-amber-900 print:border-amber-600">
          SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO / TESTES DO NOVO PADRÃO NACIONAL 2.0
        </div>
      )}

      {isCancelada && (
        <div className="mb-2 border-2 border-red-600 bg-red-50 p-2 text-center rounded font-bold uppercase tracking-wider text-[12px] text-red-700">
          DOCUMENTO CANCELADO — PROTOCOLO: {nota.protocolo_cancelamento || 'CAN-0000'}
          {nota.cancelada_em && ` EM ${formatDataHora(nota.cancelada_em)}`}
        </div>
      )}

      {isSubstituida && (
        <div className="mb-2 border-2 border-amber-600 bg-amber-50 p-2 text-center rounded font-bold uppercase tracking-wider text-[11px] text-amber-900">
          NOTA FISCAL SUBSTITUÍDA — REEMITIDA POR CORREÇÃO FISCAL
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CABEÇALHO CANÔNICO DANFSE NACIONAL 2.0                                 */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2">
        <div className="grid grid-cols-12 items-stretch divide-x divide-slate-400">
          {/* Brasão / Identificador Nacional */}
          <div className="col-span-2 p-2 flex flex-col items-center justify-center text-center bg-slate-50">
            <div className="w-12 h-12 rounded-full border-2 border-slate-700 flex items-center justify-center font-black text-slate-800 text-lg shadow-2xs">
              BR
            </div>
            <span className="text-[9px] font-extrabold text-slate-700 mt-1 uppercase tracking-tighter">
              REPÚBLICA FEDERATIVA DO BRASIL
            </span>
          </div>

          {/* Título Oficial */}
          <div className="col-span-6 p-2.5 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-black text-sm tracking-tight text-slate-900 uppercase">DANFSE</h1>
              <span className="text-[10px] font-semibold text-slate-700 uppercase">
                — Documento Auxiliar da Nota Fiscal de Serviços Eletrônica
              </span>
            </div>
            <p className="text-[10px] font-bold text-indigo-900 mt-0.5">
              Padrão Nacional NFS-e 2.0 (DPS 2.0 / Layout ADN)
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">
              Emitida nos termos do Convênio Nacional da NFS-e e Resolução CGSN nº 169/2022
            </p>
          </div>

          {/* Dados de Identificação da Nota */}
          <div className="col-span-4 p-2 bg-slate-50/60 flex flex-col justify-between text-[10px] space-y-1">
            <div className="flex justify-between items-baseline border-b border-slate-300 pb-0.5">
              <span className="text-slate-600 font-semibold uppercase">Número da NFS-e:</span>
              <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                {numeroNfseFormatado}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600 font-medium">Série / Número DPS:</span>
              <span className="font-mono font-bold text-slate-800">
                Série {serieDps} · Nº {numeroDps}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600 font-medium">Data / Hora Emissão:</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatDataHora(nota.data_emissao)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600 font-medium">Competência:</span>
              <span className="font-mono font-bold text-slate-800">
                {formatDataSimples(nota.competencia || nota.data_emissao)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CHAVE DE ACESSO NACIONAL (50 DÍGITOS) COM BOTÃO DE COPIAR              */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs p-2 mb-2 bg-slate-50/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="space-y-0.5 overflow-hidden flex-1">
            <div className="text-[9px] uppercase font-bold tracking-wider text-slate-600 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
              Chave de Acesso Nacional da NFS-e (50 Dígitos)
            </div>
            <div
              className="font-mono font-black text-xs sm:text-[13px] tracking-wider text-indigo-950 select-all break-all"
              title="Chave de Acesso Nacional da NFS-e"
            >
              {chaveFormatada}
            </div>
          </div>
          {chaveAcesso && (
            <button
              type="button"
              onClick={copiarChave}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 rounded transition-colors self-start sm:self-center print:hidden shadow-2xs"
              title="Copiar chave de acesso"
            >
              {copiado ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copiar Chave
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PROTOCOLO, CÓDIGO DE VERIFICAÇÃO E DADOS DE AUTORIZAÇÃO                */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-400 bg-white text-[10px]">
        <div className="p-1.5">
          <span className="block text-[9px] text-slate-500 font-semibold uppercase">
            Protocolo de Autorização
          </span>
          <span
            className="font-mono font-bold text-slate-900 block truncate"
            title={nota.protocolo_autorizacao}
          >
            {nota.protocolo_autorizacao || 'AUT-NAC-LOCAL'}
          </span>
        </div>
        <div className="p-1.5">
          <span className="block text-[9px] text-slate-500 font-semibold uppercase">
            Código de Verificação
          </span>
          <span className="font-mono font-black text-indigo-900 text-[11px] block">
            {nota.codigo_verificacao || '—'}
          </span>
        </div>
        <div className="p-1.5">
          <span className="block text-[9px] text-slate-500 font-semibold uppercase">
            Local da Prestação (IBGE)
          </span>
          <span className="font-mono font-semibold text-slate-900 block">
            {nota.codigo_municipio_prestacao || prestador.codigoIbge || '3550308'}
          </span>
        </div>
        <div className="p-1.5">
          <span className="block text-[9px] text-slate-500 font-semibold uppercase">
            Natureza da Operação
          </span>
          <span className="font-semibold text-slate-900 block truncate">
            {nota.natureza_operacao || 'Tributação no município'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BLOCO PRESTADOR (MINHA EMPRESA) E BLOCO TOMADOR (EMPRESA CLIENTE)      */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2 divide-y divide-slate-400">
        {/* PRESTADOR */}
        <div className="p-2 space-y-1">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
            <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">
              PRESTADOR DOS SERVIÇOS (EMITENTE)
            </span>
            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-300">
              CNPJ: {formatCnpj(prestador.cnpj)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-2 gap-y-0.5 text-[10px]">
            <div className="sm:col-span-8">
              <span className="text-slate-500 font-medium">Razão Social: </span>
              <strong className="text-slate-900 font-bold">{prestador.razaoSocial}</strong>
              {prestador.nomeFantasia && (
                <span className="text-slate-600 text-[9px]"> ({prestador.nomeFantasia})</span>
              )}
            </div>
            <div className="sm:col-span-4 text-left sm:text-right">
              <span className="text-slate-500 font-medium">Inscrição Municipal: </span>
              <span className="font-mono font-semibold text-slate-900">
                {prestador.inscricaoMunicipal}
              </span>
            </div>
            <div className="sm:col-span-8">
              <span className="text-slate-500 font-medium">Endereço: </span>
              <span className="text-slate-800">
                {prestador.logradouro}, {prestador.numero}
                {prestador.complemento ? ` - ${prestador.complemento}` : ''} - {prestador.bairro}
              </span>
            </div>
            <div className="sm:col-span-4 text-left sm:text-right">
              <span className="text-slate-500 font-medium">Município / UF: </span>
              <span className="font-semibold text-slate-900">
                {prestador.municipio} / {prestador.uf} · CEP: {prestador.cep}
              </span>
            </div>
            <div className="sm:col-span-6">
              <span className="text-slate-500 font-medium">Regime Tributário: </span>
              <span className="font-semibold text-slate-900">{prestador.regimeTributario}</span>
            </div>
            <div className="sm:col-span-6 text-left sm:text-right">
              {prestador.email && (
                <>
                  <span className="text-slate-500 font-medium">E-mail: </span>
                  <span className="text-slate-800">{prestador.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* TOMADOR */}
        <div className="p-2 space-y-1 bg-slate-50/40">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
            <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">
              TOMADOR DOS SERVIÇOS (CLIENTE)
            </span>
            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-300">
              CPF / CNPJ: {formatCnpj(tomador.cnpjCpf)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-2 gap-y-0.5 text-[10px]">
            <div className="sm:col-span-8">
              <span className="text-slate-500 font-medium">Nome / Razão Social: </span>
              <strong className="text-slate-900 font-bold">{tomador.razaoSocial}</strong>
              {tomador.nomeFantasia && (
                <span className="text-slate-600 text-[9px]"> ({tomador.nomeFantasia})</span>
              )}
            </div>
            <div className="sm:col-span-4 text-left sm:text-right">
              <span className="text-slate-500 font-medium">Inscrição Municipal: </span>
              <span className="font-mono font-semibold text-slate-900">
                {tomador.inscricaoMunicipal}
              </span>
            </div>
            <div className="sm:col-span-8">
              <span className="text-slate-500 font-medium">Endereço: </span>
              <span className="text-slate-800">
                {tomador.logradouro}, {tomador.numero}
                {tomador.complemento ? ` - ${tomador.complemento}` : ''} - {tomador.bairro}
              </span>
            </div>
            <div className="sm:col-span-4 text-left sm:text-right">
              <span className="text-slate-500 font-medium">Município / UF: </span>
              <span className="font-semibold text-slate-900">
                {tomador.municipio} / {tomador.uf} · CEP: {tomador.cep}
              </span>
            </div>
            <div className="sm:col-span-6">
              {tomador.email && (
                <>
                  <span className="text-slate-500 font-medium">E-mail: </span>
                  <span className="text-slate-800">{tomador.email}</span>
                </>
              )}
            </div>
            <div className="sm:col-span-6 text-left sm:text-right">
              {tomador.telefone && (
                <>
                  <span className="text-slate-500 font-medium">Telefone: </span>
                  <span className="text-slate-800">{tomador.telefone}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. DISCRIMINAÇÃO DOS SERVIÇOS (ITENS DETALHADOS DPS 2.0)                  */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2">
        <div className="bg-slate-100 px-2 py-1 border-b border-slate-400 flex items-center justify-between">
          <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">
            DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS
          </span>
          <span className="text-[9px] font-mono text-slate-600">
            Cód. Trib. Nacional: <strong>{nota.codigo_tributacao_nacional || '010701'}</strong>
          </span>
        </div>

        <div className="p-2 space-y-2">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 font-bold uppercase text-[9px] bg-slate-50/70">
                <th className="py-1 px-1 w-8 text-center">Item</th>
                <th className="py-1 px-1.5">Descrição do Serviço</th>
                <th className="py-1 px-1 w-12 text-center">Qtd</th>
                <th className="py-1 px-1.5 w-20 text-right">Unitário (R$)</th>
                <th className="py-1 px-1.5 w-20 text-right">Total (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {itens.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-1 px-1 text-center font-mono text-slate-600">
                    {it.item || idx + 1}
                  </td>
                  <td className="py-1 px-1.5 whitespace-pre-wrap text-slate-900 leading-snug">
                    {it.descricao}
                  </td>
                  <td className="py-1 px-1 text-center font-mono">{it.quantidade || 1}</td>
                  <td className="py-1 px-1.5 text-right font-mono">
                    {formatBrlMoeda(Number(it.valor_unitario || it.valor_total || 0))}
                  </td>
                  <td className="py-1 px-1.5 text-right font-mono font-bold text-slate-900">
                    {formatBrlMoeda(Number(it.valor_total || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Justificativa / Substituição se houver */}
          {nota.justificativa_correcao && (
            <div className="border border-amber-300 bg-amber-50/60 rounded p-1.5 text-[9px] text-amber-900 space-y-0.5">
              <span className="font-bold block uppercase tracking-wide text-amber-950">
                Observação / Justificativa da Correção (Substituição Fiscal):
              </span>
              <p className="italic">{nota.justificativa_correcao}</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. DADOS FISCAIS / TRIBUTAÇÃO NACIONAL                                     */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2">
        <div className="bg-slate-100 px-2 py-1 border-b border-slate-400">
          <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">
            DADOS FISCAIS DA OPERAÇÃO (DPS NACIONAL 2.0)
          </span>
        </div>
        <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="text-slate-500 block text-[9px] font-medium uppercase">
              Cód. Tributação Nacional
            </span>
            <span className="font-mono font-bold text-slate-900">
              {nota.codigo_tributacao_nacional || '010701'}
            </span>
            <span className="text-[9px] text-slate-500 block">Suporte / Consultoria</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] font-medium uppercase">
              CNAE Prestador
            </span>
            <span className="font-mono font-bold text-slate-900">
              {nota.item_cnae || prestador.cnae || '6920-6/01'}
            </span>
            <span className="text-[9px] text-slate-500 block">Atividades Contábeis / Gestão</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] font-medium uppercase">
              Exigibilidade do ISSQN
            </span>
            <span className="font-bold text-slate-900">
              {nota.iss_retido ? 'Exigível (Retido na Fonte)' : 'Exigível (Devido Prestador)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] font-medium uppercase">
              Optante Simples Nacional
            </span>
            <span className="font-bold text-indigo-900">
              {prestador.regimeTributario?.includes('Simples')
                ? 'SIM — ME / EPP (LC 123/2006)'
                : 'NÃO — Regime Geral'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. RETENÇÕES FEDERAIS                                                     */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2">
        <div className="bg-slate-100 px-2 py-1 border-b border-slate-400">
          <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">
            RETENÇÕES DE TRIBUTOS FEDERAIS (R$)
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-300 text-center text-[10px] bg-slate-50/50">
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">PIS</span>
            <span className="font-mono font-bold text-slate-900">
              {formatBrlMoeda(nota.valor_pis || 0)}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">COFINS</span>
            <span className="font-mono font-bold text-slate-900">
              {formatBrlMoeda(nota.valor_cofins || 0)}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">INSS</span>
            <span className="font-mono font-bold text-slate-900">
              {formatBrlMoeda(nota.valor_inss || 0)}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">
              IRPJ / IRRF
            </span>
            <span className="font-mono font-bold text-slate-900">
              {formatBrlMoeda(nota.valor_ir || 0)}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">CSLL</span>
            <span className="font-mono font-bold text-slate-900">
              {formatBrlMoeda(nota.valor_csll || 0)}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">
              Outras Retenções
            </span>
            <span className="font-mono font-bold text-slate-900">
              {formatBrlMoeda(nota.outras_retencoes || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8. BLOCO VALORES E CÁLCULO DO ISSQN                                       */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2">
        <div className="bg-slate-100 px-2 py-1 border-b border-slate-400">
          <span className="font-black text-[10px] uppercase tracking-wider text-slate-800">
            CÁLCULO DO ISSQN E VALOR LÍQUIDO DA NFS-E
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-400 text-center text-[10px]">
          <div className="p-1.5 bg-slate-50/60">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">
              Valor dos Serviços
            </span>
            <span className="font-mono font-bold text-xs text-slate-900">
              {formatBrlMoeda(nota.valor_servicos)}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">
              Desconto Incond.
            </span>
            <span className="font-mono font-medium text-slate-800">
              {formatBrlMoeda(nota.desconto_incondicionado || 0)}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">
              Base de Cálculo
            </span>
            <span className="font-mono font-semibold text-slate-900">
              {formatBrlMoeda(
                Math.max(
                  0,
                  Number(nota.valor_servicos || 0) - Number(nota.desconto_incondicionado || 0),
                ),
              )}
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">
              Alíquota ISS (%)
            </span>
            <span className="font-mono font-bold text-slate-900">
              {Number(nota.aliquota_iss || 0).toFixed(2)}%
            </span>
          </div>
          <div className="p-1.5">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">
              Valor do ISSQN
            </span>
            <span className="font-mono font-bold text-slate-900">
              {formatBrlMoeda(nota.valor_iss || 0)}
            </span>
            <span className="text-[8px] text-slate-500 block">
              {nota.iss_retido ? '(Retido Tomador)' : '(Devido Prestador)'}
            </span>
          </div>
          <div className="p-1.5 bg-indigo-50 border-l border-indigo-200">
            <span className="text-[9px] font-black uppercase block text-indigo-950">
              Valor Líquido NFS-e
            </span>
            <span className="font-mono font-black text-sm text-indigo-700">
              {formatBrlMoeda(nota.valor_liquido || nota.valor_servicos)}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 9. QR CODE OFICIAL E INFORMAÇÕES COMPLEMENTARES                           */}
      {/* ========================================================================= */}
      <div className="border border-slate-400 rounded-xs mb-2">
        <div className="grid grid-cols-12 divide-x divide-slate-400">
          {/* Informações adicionais */}
          <div className="col-span-8 p-2 text-[9px] text-slate-600 space-y-1">
            <span className="font-black text-[10px] uppercase tracking-wider text-slate-800 block">
              OUTRAS INFORMAÇÕES / MENSAGEM DO PORTAL NACIONAL
            </span>
            <p className="leading-snug">
              {nota.gateway_status_resposta ||
                'Declaração de Prestação de Serviços (DPS) transmitida e autorizada no Sistema Nacional da NFS-e (ADN / Receita Federal).'}
            </p>
            <p className="leading-snug text-slate-500">
              Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a
              crédito fiscal de IPI ou ICMS. Conforme Resolução CGSN nº 169/2022.
            </p>
            <div className="pt-1 border-t border-slate-200 flex flex-wrap items-center justify-between gap-1 text-[8.5px] text-slate-500 font-mono">
              <span>Layout Nacional DPS v2.00 / ADN</span>
              <span>
                Cód. Mun. Incidência: {nota.codigo_municipio_prestacao || prestador.codigoIbge}
              </span>
              <span>Autenticação: {nota.codigo_verificacao || 'SISTEMA-NACIONAL'}</span>
            </div>
          </div>

          {/* QR Code de Consulta Pública Nacional */}
          <div className="col-span-4 p-2 flex flex-col items-center justify-center text-center bg-slate-50/50">
            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-800 uppercase tracking-tight mb-1">
              <QrCode className="w-3 h-3 text-indigo-700" />
              Consulta Pública
            </div>
            <DanfseQrCode chaveAcesso={chaveAcesso} size={92} />
            <a
              href={urlConsultaOficial}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-[8px] text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5 font-mono print:no-underline"
              title="Acessar consulta pública no Portal Nacional da NFS-e"
            >
              nfse.gov.br/consultapublica <ExternalLink className="w-2.5 h-2.5 print:hidden" />
            </a>
            <span className="text-[7.5px] text-slate-400 uppercase tracking-tighter">
              Aponte a câmera para autenticar
            </span>
          </div>
        </div>
      </div>

      {/* Rodapé institucional formal do documento auxiliar */}
      <footer className="pt-1 border-t border-slate-300 text-center text-[8.5px] text-slate-500 flex items-center justify-between">
        <span>
          DANFSE Nacional 2.0 · {prestador.razaoSocial} · CNPJ {formatCnpj(prestador.cnpj)}
        </span>
        <span className="font-mono">
          NFS-e Nº {numeroNfseFormatado} · Série {serieDps}
        </span>
        <span>Página 1 de 1</span>
      </footer>
    </div>
  )
}

export default DanfseA4Document
