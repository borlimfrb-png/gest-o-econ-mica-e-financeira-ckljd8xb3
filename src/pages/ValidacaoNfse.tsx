import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  Printer,
  Wrench,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Eye,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { notasFiscaisService } from '@/services/notasFiscaisService'
import { empresasService } from '@/services/financeService'
import type { NotaFiscalRecord, EmpresaRecord } from '@/types/finance'
import { validarNotaFiscalCompleta, type ResultadoValidacaoNfse } from '@/lib/nfseValidacaoEngine'
import { calcularDvChaveNfseNacional, gerarChaveAcessoNfseNacional } from '@/lib/nfseChaveAcesso'
import { DoubleHorizontalScroll } from '@/components/DoubleHorizontalScroll'
import { ModalVisualizarDanfse } from '@/components/ModalVisualizarDanfse'
import { ModalEmitirNfseNacional } from '@/components/ModalEmitirNfseNacional'
import { formatBrlMoeda, downloadArquivo } from '@/lib/nfseXmlGenerator'
import { Globe, RotateCcw } from 'lucide-react'

export default function ValidacaoNfse() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedAno } = useFilter()

  const [loading, setLoading] = useState<boolean>(true)
  const [notas, setNotas] = useState<NotaFiscalRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [validacoes, setValidacoes] = useState<Map<string, ResultadoValidacaoNfse>>(new Map())
  const [validandoTodas, setValidandoTodas] = useState<boolean>(false)
  const [consultandoGovernoId, setConsultandoGovernoId] = useState<string | null>(null)
  const [consultandoGovernoLote, setConsultandoGovernoLote] = useState<boolean>(false)
  const [corrigindoId, setCorrigindoId] = useState<string | null>(null)

  // Modal de Reemissão / Substituição Corrigida
  const [modalReemissaoOpen, setModalReemissaoOpen] = useState<boolean>(false)
  const [notaParaReemitir, setNotaParaReemitir] = useState<NotaFiscalRecord | null>(null)

  // Filtros locais
  const [buscaTexto, setBuscaTexto] = useState<string>('')
  const [filtroResultado, setFiltroResultado] = useState<'todos' | 'validas' | 'erros' | 'avisos'>(
    'todos',
  )
  const [expandedNotaId, setExpandedNotaId] = useState<string | null>(null)

  // Modal de Detalhes
  const [detalheModalOpen, setDetalheModalOpen] = useState<boolean>(false)
  const [notaSelecionada, setNotaSelecionada] = useState<NotaFiscalRecord | null>(null)
  const [resultadoSelecionado, setResultadoSelecionado] = useState<ResultadoValidacaoNfse | null>(
    null,
  )

  // Visualização DANFSE
  const [modalDanfseOpen, setModalDanfseOpen] = useState<boolean>(false)
  const [notaParaDanfse, setNotaParaDanfse] = useState<NotaFiscalRecord | null>(null)

  // Carrega as notas fiscais do PocketBase respeitando empresa e ano globais
  const carregarNotas = useCallback(async () => {
    setLoading(true)
    try {
      const [lista, empList] = await Promise.all([
        notasFiscaisService.listar(),
        empresasService.getAll().catch(() => [] as EmpresaRecord[]),
      ])
      setNotas(lista)
      setEmpresas(empList)

      // Validação automática de cada nota em memória
      const mapa = new Map<string, ResultadoValidacaoNfse>()
      lista.forEach((nota) => {
        const res = validarNotaFiscalCompleta(nota)
        mapa.set(nota.id, res)
      })
      setValidacoes(mapa)
    } catch (err: any) {
      console.error('Erro ao carregar notas para validação:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar notas fiscais',
        description: err?.message || 'Não foi possível carregar a listagem de NFS-e.',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    carregarNotas()
  }, [carregarNotas])

  // Filtragem combinada por empresa e ano globais, além do texto de busca
  const notasFiltradas = useMemo(() => {
    return notas.filter((n) => {
      // Filtro global Empresa
      if (selectedEmpresaId && selectedEmpresaId !== 'todas') {
        const notaEmpresaId = typeof n.empresa === 'string' ? n.empresa : (n.empresa as any)?.id
        if (notaEmpresaId && notaEmpresaId !== selectedEmpresaId) {
          return false
        }
      }

      // Filtro global Ano
      if (selectedAno) {
        const anoNota = n.data_emissao
          ? new Date(n.data_emissao).getFullYear()
          : n.competencia
            ? new Date(n.competencia).getFullYear()
            : null
        if (anoNota && anoNota !== selectedAno) {
          return false
        }
      }

      // Filtro de status da validação
      const resVal = validacoes.get(n.id)
      if (filtroResultado === 'validas' && (!resVal || !resVal.valida)) return false
      if (filtroResultado === 'erros' && (!resVal || resVal.totalErros === 0)) return false
      if (filtroResultado === 'avisos' && (!resVal || resVal.totalAvisos === 0)) return false

      // Busca por texto
      if (buscaTexto.trim()) {
        const q = buscaTexto.toLowerCase()
        const matchNum = String(n.numero).includes(q)
        const matchTomador = (n.tomador_razao_social || '').toLowerCase().includes(q)
        const matchDoc = (n.tomador_cnpj || '').includes(q)
        const matchChave = (n.chave_acesso || '').toLowerCase().includes(q)
        const matchDisc = (n.discriminacao || '').toLowerCase().includes(q)
        if (!matchNum && !matchTomador && !matchDoc && !matchChave && !matchDisc) {
          return false
        }
      }

      return true
    })
  }, [notas, selectedEmpresaId, selectedAno, filtroResultado, buscaTexto, validacoes])

  // Métricas do Topo
  const estatisticas = useMemo(() => {
    let total = 0
    let validas = 0
    let comErros = 0
    let comAvisos = 0

    notasFiltradas.forEach((n) => {
      total++
      const r = validacoes.get(n.id)
      if (r) {
        if (r.valida) validas++
        if (r.totalErros > 0) comErros++
        if (r.totalAvisos > 0) comAvisos++
      }
    })

    return { total, validas, comErros, comAvisos }
  }, [notasFiltradas, validacoes])

  // Ação: Validar Nota Individualmente (Local)
  const handleValidarIndividual = (nota: NotaFiscalRecord) => {
    const res = validarNotaFiscalCompleta(nota)
    setValidacoes((prev) => {
      const clone = new Map(prev)
      clone.set(nota.id, res)
      return clone
    })
    setResultadoSelecionado(res)
    setNotaSelecionada(nota)
    setDetalheModalOpen(true)
    toast({
      title: res.valida ? 'Nota Válida!' : 'Pendências Encontradas',
      description: res.valida
        ? `NFS-e nº ${nota.numero} atende a todos os requisitos do Padrão Nacional.`
        : `NFS-e nº ${nota.numero} possui ${res.totalErros} erro(s) que causariam rejeição no SEFIN.`,
      variant: res.valida ? 'default' : 'destructive',
    })
  }

  // Ação: Validar no Governo (SEFIN / Portal Nacional) Individual
  const handleValidarGovernoIndividual = async (nota: NotaFiscalRecord) => {
    setConsultandoGovernoId(nota.id)
    try {
      const res = await notasFiscaisService.consultarStatusPortal(nota.id, nota.chave_acesso)
      const notaAtualizada: NotaFiscalRecord = {
        ...nota,
        portal_status: res.portal_status,
        portal_motivo: res.portal_motivo,
        portal_consultado_em: res.portal_consultado_em,
      }

      setNotas((prev) => prev.map((n) => (n.id === nota.id ? notaAtualizada : n)))

      // Se o modal estiver aberto para esta nota, atualiza a seleção
      if (notaSelecionada?.id === nota.id) {
        setNotaSelecionada(notaAtualizada)
      }

      if (res.portal_status === 'autorizada') {
        toast({
          title: 'Confirmada no Portal Nacional!',
          description: `NFS-e nº ${nota.numero} está escriturada na base oficial do governo.`,
        })
      } else if (res.portal_status === 'nao_encontrada') {
        toast({
          variant: 'destructive',
          title: 'Nota Inexistente no Governo',
          description: res.portal_motivo || 'O Portal Nacional respondeu que esta nota inexiste.',
        })
      } else {
        toast({
          title: 'Consulta realizada',
          description: res.portal_motivo,
        })
      }
    } catch (err: any) {
      console.error('Erro ao consultar governo:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na consulta ao portal',
        description: err?.message || 'Não foi possível consultar o SEFIN.',
      })
    } finally {
      setConsultandoGovernoId(null)
    }
  }

  // Ação: Validar Todas no Governo (Lote)
  const handleValidarGovernoEmLote = async () => {
    if (notasFiltradas.length === 0) return
    setConsultandoGovernoLote(true)
    let sucessos = 0
    let inexistentes = 0

    try {
      for (const nota of notasFiltradas) {
        try {
          const res = await notasFiscaisService.consultarStatusPortal(nota.id, nota.chave_acesso)
          if (res.portal_status === 'autorizada') sucessos++
          if (res.portal_status === 'nao_encontrada' || res.portal_status === 'rejeitada')
            inexistentes++

          setNotas((prev) =>
            prev.map((n) =>
              n.id === nota.id
                ? {
                    ...n,
                    portal_status: res.portal_status,
                    portal_motivo: res.portal_motivo,
                    portal_consultado_em: res.portal_consultado_em,
                  }
                : n,
            ),
          )
        } catch {
          /* intentionally ignored */
        }
      }

      toast({
        title: 'Validação no governo concluída!',
        description: `${sucessos} autorizada(s), ${inexistentes} inexistente(s)/rejeitada(s) de ${notasFiltradas.length} analisadas.`,
      })
    } finally {
      setConsultandoGovernoLote(false)
    }
  }

  // Ação: Validar Todas as Notas Filtradas em Lote (Local)
  const handleValidarTodas = () => {
    setValidandoTodas(true)
    try {
      const mapa = new Map(validacoes)
      notasFiltradas.forEach((n) => {
        const res = validarNotaFiscalCompleta(n)
        mapa.set(n.id, res)
      })
      setValidacoes(mapa)
      toast({
        title: 'Validação em lote concluída',
        description: `${notasFiltradas.length} notas analisadas com sucesso.`,
      })
    } finally {
      setValidandoTodas(false)
    }
  }

  // Ação: Correção em 1 Clique (Recalcular Chave de 50 Dígitos + Atualizar XML)
  const handleRecalcularChaveNota = async (nota: NotaFiscalRecord) => {
    setCorrigindoId(nota.id)
    try {
      let chaveLimpa = (nota.chave_acesso || '').replace(/\D/g, '')
      let novaChave50 = ''

      if (chaveLimpa.length === 49) {
        // Possui as 49 posições base: apenas calcula o DV Módulo 11 oficial
        const dv = calcularDvChaveNfseNacional(chaveLimpa)
        novaChave50 = `${chaveLimpa}${dv}`
      } else {
        // Regenera chave nacional completa com 50 dígitos
        const mun = (nota.codigo_municipio_prestacao || '3550308')
          .replace(/\D/g, '')
          .padEnd(7, '0')
          .slice(0, 7)
        const d = nota.competencia
          ? new Date(nota.competencia)
          : new Date(nota.data_emissao || Date.now())
        novaChave50 = gerarChaveAcessoNfseNacional({
          codigoMunicipio: mun,
          tipoAmbiente: nota.tipo_ambiente?.includes('1') ? '1' : '2',
          cpfCnpjPrestador: nota.prestador_cnpj || '00000000000000',
          numeroNfse: nota.numero,
          ano: d.getFullYear(),
          mes: d.getMonth() + 1,
        })
      }

      // Atualiza o XML se presente, trocando a chave antiga pela nova de 50 dígitos
      let xmlNovo = nota.xml_conteudo || ''
      if (xmlNovo) {
        if (chaveLimpa && xmlNovo.includes(chaveLimpa)) {
          xmlNovo = xmlNovo.split(chaveLimpa).join(novaChave50)
        } else if (xmlNovo.includes('<ChaveAcesso>')) {
          xmlNovo = xmlNovo.replace(
            /<ChaveAcesso>.*?<\/ChaveAcesso>/g,
            `<ChaveAcesso>${novaChave50}</ChaveAcesso>`,
          )
        }
      }

      // Persiste no banco de dados via notasFiscaisService
      const notaAtualizada = await notasFiscaisService.atualizar(nota.id, {
        chave_acesso: novaChave50,
        xml_conteudo: xmlNovo,
      })

      // Atualiza estado local
      setNotas((prev) => prev.map((n) => (n.id === nota.id ? notaAtualizada : n)))
      const novoRes = validarNotaFiscalCompleta(notaAtualizada)
      setValidacoes((prev) => {
        const clone = new Map(prev)
        clone.set(nota.id, novoRes)
        return clone
      })

      if (notaSelecionada?.id === nota.id) {
        setNotaSelecionada(notaAtualizada)
        setResultadoSelecionado(novoRes)
      }

      toast({
        title: 'Chave recalculada com sucesso!',
        description: `NFS-e nº ${nota.numero} atualizada para chave de 50 dígitos com DV correto.`,
      })
    } catch (err: any) {
      console.error('Erro ao recalcular chave:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na correção automática',
        description: err?.message || 'Não foi possível atualizar a chave de acesso.',
      })
    } finally {
      setCorrigindoId(null)
    }
  }

  // Exportação CSV do Laudo de Validação
  const exportarCsv = () => {
    if (notasFiltradas.length === 0) {
      toast({
        title: 'Nenhum registro',
        description: 'Não há notas no filtro atual para exportar.',
        variant: 'destructive',
      })
      return
    }

    const cabecalho = [
      'Numero_NFSe',
      'Serie_DPS',
      'Status_Nota',
      'Resultado_Validacao',
      'Total_Erros',
      'Total_Avisos',
      'Chave_Acesso',
      'Chave_Qtd_Digitos',
      'Prestador_CNPJ',
      'Tomador_Razao_Social',
      'Tomador_CNPJ_CPF',
      'Valor_Servicos',
      'Valor_Liquido',
      'Data_Emissao',
      'Detalhamento_Falhas',
    ].join(';')

    const linhas = notasFiltradas.map((n) => {
      const res = validacoes.get(n.id)
      const errosMsg = (res?.checagens || [])
        .filter((c) => c.status === 'erro')
        .map((c) => `[${c.titulo}] ${c.mensagem}`)
        .join(' | ')

      return [
        n.numero,
        `"${n.dps_serie || n.serie || '1'}"`,
        n.status,
        res?.valida ? 'VALIDA' : 'REJEITADA',
        res?.totalErros || 0,
        res?.totalAvisos || 0,
        `"${n.chave_acesso || ''}"`,
        (n.chave_acesso || '').replace(/\D/g, '').length,
        `"${n.prestador_cnpj || ''}"`,
        `"${n.tomador_razao_social || ''}"`,
        `"${n.tomador_cnpj || ''}"`,
        (Number(n.valor_servicos) || 0).toFixed(2),
        (Number(n.valor_liquido) || 0).toFixed(2),
        n.data_emissao ? n.data_emissao.slice(0, 10) : '',
        `"${errosMsg.replace(/"/g, '""')}"`,
      ].join(';')
    })

    const csvContent = [cabecalho, ...linhas].join('\n')
    downloadArquivo(
      `laudo_validacao_nfse_${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
      'text/csv;charset=utf-8;',
    )
    toast({
      title: 'Exportação concluída',
      description: `${notasFiltradas.length} notas exportadas em formato CSV.`,
    })
  }

  // Impressão / Salvar PDF do Laudo
  const handlePrintLaudo = () => {
    window.print()
  }

  const abrirVisualizacaoDanfse = (nota: NotaFiscalRecord) => {
    setNotaParaDanfse(nota)
    setModalDanfseOpen(true)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
            >
              <Link to="/notas-fiscais" title="Voltar ao Emissor NFS-e">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              Validação Automática de NFS-e (Padrão Nacional)
            </h1>
          </div>
          <p className="text-xs text-[#5B6B7F] mt-0.5 ml-10">
            Conferência antecipada das regras do portal do governo (SEFIN / Receita Federal / ADN):
            chave de 50 dígitos, DVs, CNPJs, IBGE, coerência de valores e XML
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportarCsv}
            className="text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-indigo-300 hover:text-indigo-700 shadow-2xs gap-1.5 h-9"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintLaudo}
            className="text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-indigo-300 hover:text-indigo-700 shadow-2xs gap-1.5 h-9"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            Imprimir Laudo A4
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarNotas}
            disabled={loading}
            className="text-xs font-semibold h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleValidarTodas}
            disabled={validandoTodas || loading || notasFiltradas.length === 0}
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs h-9 shadow-sm gap-1.5"
          >
            <FileCheck2 className={`w-4 h-4 ${validandoTodas ? 'animate-spin' : ''}`} />
            Validar Local ({notasFiltradas.length})
          </Button>

          <Button
            onClick={handleValidarGovernoEmLote}
            disabled={consultandoGovernoLote || loading || notasFiltradas.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 shadow-sm gap-1.5"
            title="Consulta a base de dados do Portal Nacional (SEFIN) para conferir se as notas existem de fato no governo"
          >
            <Globe className={`w-4 h-4 ${consultandoGovernoLote ? 'animate-spin' : ''}`} />
            Validar no Governo ({notasFiltradas.length})
          </Button>
        </div>
      </div>

      {/* Cards de Métricas / Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Total de Notas</p>
              <p className="text-2xl font-bold text-[#0B1F3A] mt-1">{estatisticas.total}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Filtradas no período</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-emerald-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-emerald-700 uppercase">100% Válidas</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{estatisticas.validas}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">
                {estatisticas.total > 0
                  ? `${((estatisticas.validas / estatisticas.total) * 100).toFixed(0)}% do total`
                  : '0%'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-rose-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-rose-700 uppercase">
                Com Erros (Rejeição)
              </p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{estatisticas.comErros}</p>
              <p className="text-[10px] text-rose-600 mt-0.5">Exigem correção antes do envio</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-amber-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase">Com Advertências</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{estatisticas.comAvisos}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Alertas recomendados</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="bg-white border-slate-200 shadow-2xs print:hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por número, tomador, chave ou CNPJ..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <Select value={filtroResultado} onValueChange={(val: any) => setFiltroResultado(val)}>
              <SelectTrigger className="w-[180px] text-xs h-9">
                <SelectValue placeholder="Status Validação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os resultados</SelectItem>
                <SelectItem value="validas">Apenas Válidas</SelectItem>
                <SelectItem value="erros">Apenas com Erro</SelectItem>
                <SelectItem value="avisos">Com Advertências</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Notas com Validação Automática e Rolagem Dupla */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Quadro de Notas Fiscais e Diagnóstico Governamental
          </CardTitle>
          <span className="text-xs text-slate-500">{notasFiltradas.length} nota(s) exibida(s)</span>
        </CardHeader>

        <CardContent className="p-0">
          <DoubleHorizontalScroll>
            <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-3 w-10 text-center"></th>
                  <th className="py-3 px-3 w-28">NFS-e / DPS</th>
                  <th className="py-3 px-3 w-36">Status do Sistema</th>
                  <th className="py-3 px-3 w-36">Validação Local</th>
                  <th className="py-3 px-3 w-44">Portal Nacional (SEFIN)</th>
                  <th className="py-3 px-3 w-52">Chave de Acesso</th>
                  <th className="py-3 px-3">Tomador dos Serviços</th>
                  <th className="py-3 px-3 w-28 text-right">Valor Líquido</th>
                  <th className="py-3 px-3 w-24">Emissão</th>
                  <th className="py-3 px-3 w-52 text-right print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Nenhuma nota fiscal encontrada no filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  notasFiltradas.map((nota) => {
                    const res = validacoes.get(nota.id)
                    const isExpanded = expandedNotaId === nota.id
                    const chaveDigitos = (nota.chave_acesso || '').replace(/\D/g, '').length
                    const isCorrigindo = corrigindoId === nota.id

                    return (
                      <React.Fragment key={nota.id}>
                        <tr
                          className={`hover:bg-slate-50/70 transition-colors ${
                            res && !res.valida ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setExpandedNotaId(isExpanded ? null : nota.id)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded"
                              title="Expandir checagens"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            <div>NFS-e nº {nota.numero}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              DPS {nota.dps_numero || nota.numero} (Série{' '}
                              {nota.dps_serie || nota.serie || '1'})
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {nota.status}
                            </Badge>
                          </td>

                          <td className="py-2.5 px-3">
                            {res ? (
                              res.valida ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Regras OK
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-semibold gap-1">
                                  <XCircle className="w-3 h-3 text-rose-600" /> Falhas (
                                  {res.totalErros})
                                </Badge>
                              )
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Pendente
                              </Badge>
                            )}
                          </td>

                          {/* Coluna Portal Nacional (SEFIN) */}
                          <td className="py-2.5 px-3">
                            {nota.portal_status === 'autorizada' ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> No Governo
                                (OK)
                              </Badge>
                            ) : nota.portal_status === 'nao_encontrada' ? (
                              <div className="flex flex-col gap-0.5" title={nota.portal_motivo}>
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-700" /> Inexistente
                                </Badge>
                                <span className="text-[9px] text-amber-800 font-semibold truncate max-w-[140px]">
                                  {nota.modo_emissao?.includes('Produção')
                                    ? 'Não localizada'
                                    : 'Modo Simulação'}
                                </span>
                              </div>
                            ) : nota.portal_status === 'rejeitada' ? (
                              <Badge
                                className="bg-rose-100 text-rose-900 border-rose-300 text-[10px] font-bold gap-1"
                                title={nota.portal_motivo}
                              >
                                <XCircle className="w-3 h-3 text-rose-700" /> Rejeitada
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Não consultado
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                            <div className="truncate max-w-[200px]" title={nota.chave_acesso}>
                              {nota.chave_acesso || (
                                <span className="text-slate-400 italic">Não gerada</span>
                              )}
                            </div>
                            <div className="text-[10px] mt-0.5">
                              {chaveDigitos === 50 ? (
                                <span className="text-emerald-600 font-sans font-semibold">
                                  50 dígitos (OK)
                                </span>
                              ) : (
                                <span className="text-rose-600 font-sans font-bold">
                                  {chaveDigitos} dígitos (Inválido!)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800 truncate max-w-[240px]">
                              {nota.tomador_razao_social || 'Cliente'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {nota.tomador_cnpj || 'Sem CNPJ/CPF'}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                            {formatBrlMoeda(nota.valor_liquido)}
                          </td>

                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {nota.data_emissao ? nota.data_emissao.slice(0, 10) : '-'}
                          </td>

                          <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap print:hidden">
                            {/* Botão de Validar no Governo Individual */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleValidarGovernoIndividual(nota)}
                              disabled={consultandoGovernoId === nota.id}
                              className="h-7 text-[10px] px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold gap-1"
                              title="Consultar status real do documento no Portal Nacional da NFS-e"
                            >
                              <Globe
                                className={`w-3 h-3 ${consultandoGovernoId === nota.id ? 'animate-spin' : ''}`}
                              />
                              No Governo
                            </Button>

                            {/* Botão Reemitir / Corrigir quando inexistente ou com erro */}
                            {(nota.portal_status === 'nao_encontrada' ||
                              nota.portal_status === 'rejeitada' ||
                              (res && !res.valida)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setNotaParaReemitir(nota)
                                  setModalReemissaoOpen(true)
                                }}
                                className="h-7 text-[10px] px-2 text-amber-800 border-amber-300 hover:bg-amber-50 bg-amber-50/50 font-bold gap-1"
                                title="Reemitir em modo substituição com novo sequencial de DPS e justificativa"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-700" />
                                Reemitir / Corrigir
                              </Button>
                            )}

                            {res && res.podeRecalcularChave && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRecalcularChaveNota(nota)}
                                disabled={isCorrigindo}
                                className="h-7 text-[10px] px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold gap-1"
                                title="Recalcular chave com 50 dígitos e atualizar XML"
                              >
                                <Wrench
                                  className={`w-3 h-3 ${isCorrigindo ? 'animate-spin' : ''}`}
                                />
                                Chave 50
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleValidarIndividual(nota)}
                              className="h-7 text-[10px] px-2 text-slate-700 hover:text-indigo-700 font-semibold gap-1"
                              title="Ver laudo analítico de checagens"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                              Laudo
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirVisualizacaoDanfse(nota)}
                              className="h-7 text-[10px] px-1.5 text-slate-500 hover:text-slate-800"
                              title="Visualizar DANFSE"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>

                        {/* Linha Expandida com as Checagens Individuais */}
                        {isExpanded && res && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={9} className="p-4 border-b border-slate-200">
                              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Info className="w-4 h-4 text-indigo-600" />
                                    Detalhamento dos {res.totalChecagens} itens analisados para a
                                    NFS-e nº {nota.numero}:
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {res.podeRecalcularChave && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleRecalcularChaveNota(nota)}
                                        disabled={isCorrigindo}
                                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1"
                                      >
                                        <Wrench className="w-3.5 h-3.5" />
                                        Recalcular Chave (50 dígitos) em 1 clique
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {res.checagens.map((item) => (
                                    <div
                                      key={item.id}
                                      className={`p-2.5 rounded border flex items-start gap-2.5 ${
                                        item.status === 'valido'
                                          ? 'bg-emerald-50/40 border-emerald-200'
                                          : item.status === 'erro'
                                            ? 'bg-rose-50/60 border-rose-200'
                                            : 'bg-amber-50/40 border-amber-200'
                                      }`}
                                    >
                                      {item.status === 'valido' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                      ) : item.status === 'erro' ? (
                                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                      ) : (
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                      )}
                                      <div className="space-y-0.5 flex-1 min-w-0">
                                        <div className="font-semibold text-slate-900 flex items-center justify-between">
                                          <span>{item.titulo}</span>
                                          <span
                                            className={`text-[10px] font-bold uppercase ${
                                              item.status === 'valido'
                                                ? 'text-emerald-700'
                                                : item.status === 'erro'
                                                  ? 'text-rose-700'
                                                  : 'text-amber-700'
                                            }`}
                                          >
                                            {item.status}
                                          </span>
                                        </div>
                                        <p className="text-slate-600 text-[11px] leading-relaxed">
                                          {item.mensagem}
                                        </p>
                                        {item.sugestaoAcao && (
                                          <p className="text-[11px] text-indigo-700 font-medium">
                                            Ação sugerida: {item.sugestaoAcao}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </DoubleHorizontalScroll>
        </CardContent>
      </Card>

      {/* MODAL DE DETALHAMENTO INDIVIDUAL DO LAUDO */}
      <Dialog open={detalheModalOpen} onOpenChange={setDetalheModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Laudo Oficial de Validação da NFS-e nº {notaSelecionada?.numero}
            </DialogTitle>
          </DialogHeader>

          {resultadoSelecionado && notaSelecionada && (
            <div className="space-y-4 text-xs">
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  resultadoSelecionado.valida
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div>
                  <div className="font-bold text-sm">
                    {resultadoSelecionado.valida
                      ? 'NFS-e Aprovada nos Critérios Governamentais'
                      : 'NFS-e Rejeitada (Pendências Fiscais)'}
                  </div>
                  <div className="text-[11px] mt-0.5">
                    {resultadoSelecionado.totalErros} erro(s) impeditivos e{' '}
                    {resultadoSelecionado.totalAvisos} aviso(s).
                  </div>
                </div>
                {resultadoSelecionado.valida ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-rose-600" />
                )}
              </div>

              {/* SEÇÃO: Parecer do Portal Nacional / SEFIN */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    Parecer do Portal Nacional (SEFIN / Receita Federal):
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleValidarGovernoIndividual(notaSelecionada)}
                    disabled={consultandoGovernoId === notaSelecionada.id}
                    className="h-7 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold gap-1"
                  >
                    <Globe
                      className={`w-3.5 h-3.5 ${consultandoGovernoId === notaSelecionada.id ? 'animate-spin' : ''}`}
                    />
                    Consultar SEFIN Agora
                  </Button>
                </div>

                <div className="text-[11px] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Status Governamental:</span>
                    {notaSelecionada.portal_status === 'autorizada' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                        Autorizada e Escriturada no SEFIN
                      </Badge>
                    ) : notaSelecionada.portal_status === 'nao_encontrada' ? (
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold">
                        Nota Fiscal Inexistente no Portal Nacional
                      </Badge>
                    ) : notaSelecionada.portal_status === 'rejeitada' ? (
                      <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[10px] font-bold">
                        Rejeitada pelo Governo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-slate-500">
                        Ainda não consultada
                      </Badge>
                    )}
                    {notaSelecionada.portal_consultado_em && (
                      <span className="text-[10px] text-slate-400">
                        (última consulta:{' '}
                        {new Date(notaSelecionada.portal_consultado_em).toLocaleString('pt-BR')})
                      </span>
                    )}
                  </div>

                  {notaSelecionada.portal_motivo && (
                    <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-700 leading-relaxed text-[11px]">
                      <strong>Motivo / Diagnóstico Oficial:</strong> {notaSelecionada.portal_motivo}
                    </div>
                  )}

                  {(notaSelecionada.portal_status === 'nao_encontrada' ||
                    notaSelecionada.portal_status === 'rejeitada') && (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-amber-800 font-semibold">
                        Ação Recomendada: Reemitir em modo substituição com novo sequencial DPS.
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setDetalheModalOpen(false)
                          setNotaParaReemitir(notaSelecionada)
                          setModalReemissaoOpen(true)
                        }}
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reemitir / Corrigir
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Lista completa de regras checadas */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-xs">
                  Checagens Analíticas do Padrão Nacional 2.0:
                </span>
                {resultadoSelecionado.checagens.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-lg border space-y-1 ${
                      c.status === 'valido'
                        ? 'bg-emerald-50/30 border-emerald-200'
                        : c.status === 'erro'
                          ? 'bg-rose-50/50 border-rose-200'
                          : 'bg-amber-50/40 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-900">{c.titulo}</span>
                      <span
                        className={`text-[10px] uppercase font-bold ${
                          c.status === 'valido'
                            ? 'text-emerald-700'
                            : c.status === 'erro'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{c.mensagem}</p>
                    {c.sugestaoAcao && (
                      <p className="text-indigo-700 text-[11px] font-medium">
                        Sugestão: {c.sugestaoAcao}
                      </p>
                    )}
                    {c.detalhe && (
                      <div className="font-mono text-[10px] text-slate-500 bg-white/70 p-1 rounded">
                        {c.detalhe}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
            {resultadoSelecionado?.podeRecalcularChave && notaSelecionada && (
              <Button
                onClick={() => handleRecalcularChaveNota(notaSelecionada)}
                disabled={corrigindoId === notaSelecionada.id}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5 font-semibold"
              >
                <Wrench className="w-3.5 h-3.5" />
                Recalcular Chave (50 dígitos)
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetalheModalOpen(false)}
              className="h-8 text-xs ml-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal DANFSE */}
      {notaParaDanfse && (
        <ModalVisualizarDanfse
          open={modalDanfseOpen}
          onOpenChange={setModalDanfseOpen}
          nota={notaParaDanfse}
        />
      )}

      {/* Modal de Reemissão / Substituição por Correção */}
      {notaParaReemitir && (
        <ModalEmitirNfseNacional
          open={modalReemissaoOpen}
          onOpenChange={(isOpen: boolean) => {
            setModalReemissaoOpen(isOpen)
            if (!isOpen) setNotaParaReemitir(null)
          }}
          empresaAtiva={
            empresas.find((e) => e.id === notaParaReemitir.empresa) ||
            empresas.find((e) => e.id === selectedEmpresaId) ||
            empresas[0] ||
            null
          }
          empresasLista={empresas}
          seriePadrao={notaParaReemitir.dps_serie || notaParaReemitir.serie || '1'}
          proximoNumeroPadrao={(notaParaReemitir.numero || 0) + 1}
          notaParaSubstituir={notaParaReemitir}
          onEmitida={async (notaNova?: NotaFiscalRecord) => {
            setModalReemissaoOpen(false)
            setNotaParaReemitir(null)
            await carregarNotas()
            if (notaNova?.id) {
              try {
                const completa = await notasFiscaisService.getById(notaNova.id)
                abrirVisualizacaoDanfse(completa || notaNova)
              } catch {
                abrirVisualizacaoDanfse(notaNova)
              }
            }
          }}
        />
      )}
    </div>
  )
}
