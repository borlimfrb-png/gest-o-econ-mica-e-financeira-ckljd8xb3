import React, { useState, useEffect, useRef } from 'react'
import { minhaEmpresaService } from '@/services/minhaEmpresaService'
import type {
  MinhaEmpresaRecord,
  UfEmpresa,
  RegimeTributario,
  PorteMinhaEmpresa,
} from '@/types/finance'
import { cleanCnpj, validateCnpj } from '@/lib/financeCalculations'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  MapPin,
  Phone,
  UserCheck,
  Palette,
  Landmark,
  Save,
  RotateCcw,
  UploadCloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const UFS: UfEmpresa[] = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

const REGIMES: RegimeTributario[] = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI']

const PORTES: PorteMinhaEmpresa[] = [
  'MEI',
  'Micro Empresa',
  'Empresa de Pequeno Porte',
  'Média Empresa',
  'Grande Empresa',
]

const BANCOS = [
  'Banco do Brasil',
  'Itaú',
  'Bradesco',
  'Santander',
  'Caixa Econômica',
  'Nubank',
  'Inter',
  'Sicoob',
  'Sicredi',
  'BTG Pactual',
  'C6 Bank',
  'Safra',
  'Original',
  'Outro',
]

export interface MinhaEmpresaFormData {
  // Seção 1 — Dados da Empresa
  razao_social: string
  nome_fantasia: string
  cnpj: string
  inscricao_estadual: string
  inscricao_municipal: string
  regime_tributario: RegimeTributario | ''
  data_abertura: string
  porte: PorteMinhaEmpresa | ''

  // Seção 2 — Endereço
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: UfEmpresa | ''
  codigo_ibge: string
  pais: string

  // Seção 3 — Contato
  telefone_comercial: string
  celular_whatsapp: string
  email_comercial: string
  email_financeiro: string
  site: string

  // Seção 4 — Responsável Técnico (CRC)
  contador_nome: string
  contador_crc: string
  contador_uf_crc: UfEmpresa | ''
  contador_email: string
  contador_telefone: string

  // Seção 5 — Identidade Visual
  cor_primaria: string
  cor_secundaria: string

  // Seção 6 — Dados Bancários
  banco: string
  agencia: string
  conta_corrente: string
  chave_pix: string
}

const INITIAL_FORM: MinhaEmpresaFormData = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  regime_tributario: 'Simples Nacional',
  data_abertura: '',
  porte: 'Empresa de Pequeno Porte',

  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  codigo_ibge: '',
  pais: 'Brasil',

  telefone_comercial: '',
  celular_whatsapp: '',
  email_comercial: '',
  email_financeiro: '',
  site: '',

  contador_nome: '',
  contador_crc: '',
  contador_uf_crc: '',
  contador_email: '',
  contador_telefone: '',

  cor_primaria: '#0B1F3A',
  cor_secundaria: '#2563EB',

  banco: '',
  agencia: '',
  conta_corrente: '',
  chave_pix: '',
}

type FormErrors = Partial<Record<keyof MinhaEmpresaFormData | 'general' | 'logo', string>>

// Máscaras de formatação
const maskCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

const maskInscricaoEstadual = (v: string) => {
  const d = v.replace(/[^\d.-]/g, '').slice(0, 20)
  return d
}

const maskCrc = (v: string) => {
  // Formato desejado: UF-000000/O (ex: SP-123456/O ou PR-012345/O-1)
  const clean = v.toUpperCase().trim()
  return clean.slice(0, 15)
}

const maskAgencia = (v: string) => {
  const d = v.replace(/[^\dX]/gi, '').slice(0, 6)
  if (d.length > 4) {
    return `${d.slice(0, 4)}-${d.slice(4)}`
  }
  return d
}

const maskConta = (v: string) => {
  const d = v.replace(/[^\dX]/gi, '').slice(0, 10)
  if (d.length > 1) {
    const last = d.slice(-1)
    const rest = d.slice(0, -1)
    return `${rest}-${last}`
  }
  return d
}

const isValidEmail = (email: string) => {
  if (!email.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

const isValidCrcFormat = (crc: string) => {
  if (!crc.trim()) return false
  // Aceita formatos comuns: SP-123456/O, SP-123456, 123456/O, SP-123456/O-1, etc.
  const regex = /^([A-Z]{2}-?)?\d{4,8}(\/[O|P|T|S](-\d)?)?$/i
  return regex.test(crc.trim())
}

export default function MinhaEmpresa() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchingCep, setSearchingCep] = useState(false)
  const [consultandoIbge, setConsultandoIbge] = useState(false)
  const [ibgeMunicipioNome, setIbgeMunicipioNome] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [formData, setFormData] = useState<MinhaEmpresaFormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaved, setIsSaved] = useState(false)

  // Upload Logo
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carregar dados salvos
  const loadMinhaEmpresa = async () => {
    try {
      setLoading(true)
      const data = await minhaEmpresaService.get()
      if (data) {
        setEmpresaId(data.id)
        setIsSaved(true)
        setFormData({
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || '',
          cnpj: maskCnpj(data.cnpj || ''),
          inscricao_estadual: data.inscricao_estadual || '',
          inscricao_municipal: data.inscricao_municipal || '',
          regime_tributario: (data.regime_tributario as RegimeTributario) || 'Simples Nacional',
          data_abertura: data.data_abertura ? data.data_abertura.slice(0, 10) : '',
          porte: (data.porte as PorteMinhaEmpresa) || 'Empresa de Pequeno Porte',

          cep: data.cep ? maskCep(data.cep) : '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          estado: (data.estado as UfEmpresa) || '',
          codigo_ibge: (data.codigo_ibge || '').replace(/\D/g, '').slice(0, 7),
          pais: data.pais || 'Brasil',

          telefone_comercial: data.telefone_comercial ? maskPhone(data.telefone_comercial) : '',
          celular_whatsapp: data.celular_whatsapp ? maskPhone(data.celular_whatsapp) : '',
          email_comercial: data.email_comercial || '',
          email_financeiro: data.email_financeiro || '',
          site: data.site || '',

          contador_nome: data.contador_nome || '',
          contador_crc: data.contador_crc || '',
          contador_uf_crc: (data.contador_uf_crc as UfEmpresa) || '',
          contador_email: data.contador_email || '',
          contador_telefone: data.contador_telefone ? maskPhone(data.contador_telefone) : '',

          cor_primaria: data.cor_primaria || '#0B1F3A',
          cor_secundaria: data.cor_secundaria || '#2563EB',

          banco: data.banco || '',
          agencia: data.agencia || '',
          conta_corrente: data.conta_corrente || '',
          chave_pix: data.chave_pix || '',
        })

        if (data.logo) {
          setLogoPreview(pb.files.getURL(data, data.logo))
        }

        if (data.codigo_ibge && data.codigo_ibge.replace(/\D/g, '').length === 7) {
          consultarIbgeApi(data.codigo_ibge, true)
        }
      } else {
        setIsSaved(false)
      }
    } catch (err) {
      console.error('Erro ao carregar dados da minha empresa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível recuperar os dados da sua consultoria.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMinhaEmpresa()
  }, [])

  const setField = <K extends keyof MinhaEmpresaFormData>(
    key: K,
    value: MinhaEmpresaFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  // Consulta de município na API pública do IBGE
  const consultarIbgeApi = async (codigo: string, silencioso: boolean = false) => {
    const codLimpo = (codigo || '').replace(/\D/g, '')
    if (codLimpo.length !== 7) {
      if (!silencioso) {
        toast({
          variant: 'destructive',
          title: 'Código IBGE inválido',
          description:
            'O código IBGE do município deve conter exatamente 7 dígitos numéricos (ex: 3136702).',
        })
      }
      return
    }

    setConsultandoIbge(true)
    try {
      const resp = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codLimpo}`,
      )
      if (!resp.ok) {
        throw new Error('Município não localizado no IBGE')
      }
      const data = await resp.json()
      if (data && data.nome) {
        const uf =
          data.microrregiao?.mesorregiao?.UF?.sigla ||
          data['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ||
          ''
        const descCompleta = uf ? `${data.nome}/${uf}` : data.nome
        setIbgeMunicipioNome(descCompleta)
        if (!silencioso) {
          toast({
            title: 'Município confirmado no IBGE',
            description: `${descCompleta} (Código: ${codLimpo})`,
          })
        }
      } else {
        throw new Error('Código não retornado')
      }
    } catch (err: any) {
      if (!silencioso) {
        toast({
          title: 'Consulta IBGE não confirmada',
          description:
            'Não foi possível confirmar o código via API pública do IBGE, mas você pode salvar normalmente caso o código esteja correto.',
        })
      }
    } finally {
      setConsultandoIbge(false)
    }
  }

  // Busca automática de CEP via ViaCEP
  const handleCepBlur = async () => {
    const rawCep = formData.cep.replace(/\D/g, '')
    if (rawCep.length !== 8) return

    setSearchingCep(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`)
      if (!response.ok) throw new Error('Falha na consulta do CEP')
      const data = await response.json()

      if (data.erro) {
        toast({
          variant: 'destructive',
          title: 'CEP não encontrado',
          description: 'Verifique o CEP informado e tente novamente.',
        })
        return
      }

      const ibgeCep = data.ibge ? data.ibge.replace(/\D/g, '').slice(0, 7) : ''
      setFormData((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        estado: (data.uf as UfEmpresa) || prev.estado,
        codigo_ibge: ibgeCep || prev.codigo_ibge,
        complemento: data.complemento || prev.complemento,
      }))

      if (ibgeCep) {
        consultarIbgeApi(ibgeCep, true)
      }

      if (errors.cidade) setErrors((prev) => ({ ...prev, cidade: undefined }))
      if (errors.estado) setErrors((prev) => ({ ...prev, estado: undefined }))
      if (errors.codigo_ibge) setErrors((prev) => ({ ...prev, codigo_ibge: undefined }))

      toast({
        title: 'Endereço localizado!',
        description: `${data.logradouro ? data.logradouro + ' — ' : ''}${data.localidade}/${data.uf}`,
      })
    } catch (err) {
      console.warn('Erro ao consultar ViaCEP:', err)
    } finally {
      setSearchingCep(false)
    }
  }

  // Tratamento do Logo
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, selecione uma imagem PNG, JPG, WEBP ou SVG.',
      })
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O logotipo deve ter no máximo 2MB.',
      })
      return
    }

    setLogoFile(file)
    setLogoRemoved(false)
    const reader = new FileReader()
    reader.onload = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleLogoFile(file)
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoRemoved(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Validação completa
  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    // 1. Razão Social
    if (!formData.razao_social.trim()) {
      newErrors.razao_social = 'Razão Social é obrigatória'
    } else if (formData.razao_social.trim().length < 2) {
      newErrors.razao_social = 'Mínimo de 2 caracteres'
    }

    // 2. Nome Fantasia
    if (!formData.nome_fantasia.trim()) {
      newErrors.nome_fantasia = 'Nome Fantasia é obrigatório'
    } else if (formData.nome_fantasia.trim().length < 2) {
      newErrors.nome_fantasia = 'Mínimo de 2 caracteres'
    }

    // 3. CNPJ
    const rawCnpj = cleanCnpj(formData.cnpj)
    if (!rawCnpj) {
      newErrors.cnpj = 'CNPJ é obrigatório'
    } else if (rawCnpj.length !== 14) {
      newErrors.cnpj = 'CNPJ deve conter 14 dígitos'
    } else if (!validateCnpj(rawCnpj)) {
      newErrors.cnpj = 'CNPJ inválido (dígitos verificadores incorretos)'
    }

    // 4. E-mails
    if (formData.email_comercial && !isValidEmail(formData.email_comercial)) {
      newErrors.email_comercial = 'Formato de e-mail comercial inválido'
    }
    if (formData.email_financeiro && !isValidEmail(formData.email_financeiro)) {
      newErrors.email_financeiro = 'Formato de e-mail financeiro inválido'
    }
    if (formData.contador_email && !isValidEmail(formData.contador_email)) {
      newErrors.contador_email = 'Formato de e-mail do contador inválido'
    }

    // 5. Site
    if (formData.site.trim()) {
      const s = formData.site.trim()
      const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`
      try {
        new URL(candidate)
      } catch {
        newErrors.site = 'URL do site inválida'
      }
    }

    // 6. Contador Responsável
    if (!formData.contador_nome.trim()) {
      newErrors.contador_nome = 'Nome do Contador Responsável é obrigatório'
    }

    // 7. CRC
    if (!formData.contador_crc.trim()) {
      newErrors.contador_crc = 'Número de registro no CRC é obrigatório'
    } else if (!isValidCrcFormat(formData.contador_crc)) {
      newErrors.contador_crc = 'Formato sugerido: UF-000000/O (ex: SP-123456/O)'
    }

    // 8. Código IBGE (opcional, mas se preenchido deve conter 7 dígitos)
    const rawIbge = formData.codigo_ibge.replace(/\D/g, '')
    if (rawIbge && rawIbge.length !== 7) {
      newErrors.codigo_ibge =
        'O código IBGE deve conter exatamente 7 dígitos numéricos (ex: 3136702)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Envio / Salvamento
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast({
        variant: 'destructive',
        title: 'Campos pendentes ou incorretos',
        description: 'Verifique os campos destacados em vermelho no formulário.',
      })
      return
    }

    setSaving(true)
    setErrors((prev) => ({ ...prev, general: undefined }))

    try {
      const formDataToSend = new FormData()

      // Seção 1
      formDataToSend.append('razao_social', formData.razao_social.trim())
      formDataToSend.append('nome_fantasia', formData.nome_fantasia.trim())
      formDataToSend.append('cnpj', cleanCnpj(formData.cnpj))
      if (formData.inscricao_estadual) {
        formDataToSend.append('inscricao_estadual', formData.inscricao_estadual.trim())
      }
      if (formData.inscricao_municipal) {
        formDataToSend.append('inscricao_municipal', formData.inscricao_municipal.trim())
      }
      if (formData.regime_tributario) {
        formDataToSend.append('regime_tributario', formData.regime_tributario)
      }
      if (formData.data_abertura) {
        formDataToSend.append('data_abertura', formData.data_abertura)
      }
      if (formData.porte) {
        formDataToSend.append('porte', formData.porte)
      }

      // Seção 2
      if (formData.cep) formDataToSend.append('cep', formData.cep.replace(/\D/g, ''))
      if (formData.logradouro) formDataToSend.append('logradouro', formData.logradouro.trim())
      if (formData.numero) formDataToSend.append('numero', formData.numero.trim())
      if (formData.complemento) formDataToSend.append('complemento', formData.complemento.trim())
      if (formData.bairro) formDataToSend.append('bairro', formData.bairro.trim())
      if (formData.cidade) formDataToSend.append('cidade', formData.cidade.trim())
      if (formData.estado) formDataToSend.append('estado', formData.estado)
      if (formData.codigo_ibge) {
        formDataToSend.append('codigo_ibge', formData.codigo_ibge.replace(/\D/g, '').slice(0, 7))
      }
      if (formData.pais) formDataToSend.append('pais', formData.pais.trim())

      // Seção 3
      if (formData.telefone_comercial) {
        formDataToSend.append('telefone_comercial', formData.telefone_comercial.replace(/\D/g, ''))
      }
      if (formData.celular_whatsapp) {
        formDataToSend.append('celular_whatsapp', formData.celular_whatsapp.replace(/\D/g, ''))
      }
      if (formData.email_comercial) {
        formDataToSend.append('email_comercial', formData.email_comercial.trim())
      }
      if (formData.email_financeiro) {
        formDataToSend.append('email_financeiro', formData.email_financeiro.trim())
      }
      if (formData.site.trim()) {
        const s = formData.site.trim()
        formDataToSend.append('site', /^https?:\/\//i.test(s) ? s : `https://${s}`)
      }

      // Seção 4
      formDataToSend.append('contador_nome', formData.contador_nome.trim())
      formDataToSend.append('contador_crc', formData.contador_crc.trim())
      if (formData.contador_uf_crc) {
        formDataToSend.append('contador_uf_crc', formData.contador_uf_crc)
      }
      if (formData.contador_email) {
        formDataToSend.append('contador_email', formData.contador_email.trim())
      }
      if (formData.contador_telefone) {
        formDataToSend.append('contador_telefone', formData.contador_telefone.replace(/\D/g, ''))
      }

      // Seção 5
      if (logoFile) {
        formDataToSend.append('logo', logoFile)
      } else if (logoRemoved) {
        formDataToSend.append('logo', '')
      }
      if (formData.cor_primaria) formDataToSend.append('cor_primaria', formData.cor_primaria)
      if (formData.cor_secundaria) formDataToSend.append('cor_secundaria', formData.cor_secundaria)

      // Seção 6
      if (formData.banco) formDataToSend.append('banco', formData.banco)
      if (formData.agencia) formDataToSend.append('agencia', formData.agencia.trim())
      if (formData.conta_corrente) {
        formDataToSend.append('conta_corrente', formData.conta_corrente.trim())
      }
      if (formData.chave_pix) formDataToSend.append('chave_pix', formData.chave_pix.trim())

      const saved = await minhaEmpresaService.save(formDataToSend, empresaId || undefined)
      setEmpresaId(saved.id)
      setIsSaved(true)
      setLogoFile(null)
      setLogoRemoved(false)

      toast({
        title: 'Dados salvos com sucesso!',
        description:
          'As informações da sua consultoria foram atualizadas e estão prontas para os relatórios.',
      })
    } catch (err: any) {
      console.error('Erro ao salvar Minha Empresa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar informações',
        description:
          err?.data?.data?.cnpj?.message ||
          err?.message ||
          'Não foi possível salvar os dados da consultoria.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Cancelar / Limpar
  const handleCancel = () => {
    if (isSaved) {
      loadMinhaEmpresa()
      toast({
        title: 'Alterações descartadas',
        description: 'Os dados foram restaurados para a última versão salva.',
      })
    } else {
      setFormData(INITIAL_FORM)
      setLogoFile(null)
      setLogoPreview(null)
      setErrors({})
      toast({
        title: 'Formulário limpo',
        description: 'Todos os campos foram resetados.',
      })
    }
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Carregando dados da sua empresa...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-6xl mx-auto">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
                  Minha Empresa (Consultoria)
                </h1>
                {isSaved && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1 hover:bg-emerald-50">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Dados Salvos
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#5B6B7F]">
                Configure os dados oficiais da sua empresa de consultoria contábil/financeira para
                cabeçalhos de relatórios, pareceres técnicos e identificação profissional.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação Topo */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={saving}
            className="text-xs h-9 border-slate-200 hover:bg-slate-100"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            {isSaved ? 'Descartar' : 'Limpar'}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 shadow-sm"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Salvar Dados
              </>
            )}
          </Button>
        </div>
      </div>

      {errors.general && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-xs font-medium">{errors.general}</AlertDescription>
        </Alert>
      )}

      {/* Formulário Principal com Grid Responsivo */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* ========================================================================= */}
        {/* SEÇÃO 1: DADOS DA EMPRESA */}
        {/* ========================================================================= */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              1. Dados da Empresa
            </CardTitle>
            <CardDescription className="text-xs">
              Informações societárias e fiscais da sua consultoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Razão Social */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="razao_social" className="text-xs font-semibold text-slate-700">
                  Razão Social <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="razao_social"
                  placeholder="Ex: Apex Consultoria Financeira & Contábil Ltda"
                  value={formData.razao_social}
                  onChange={(e) => setField('razao_social', e.target.value)}
                  className={`h-9 text-xs ${
                    errors.razao_social
                      ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20'
                      : ''
                  }`}
                />
                {errors.razao_social && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.razao_social}</p>
                )}
              </div>

              {/* Nome Fantasia */}
              <div className="space-y-1.5">
                <Label htmlFor="nome_fantasia" className="text-xs font-semibold text-slate-700">
                  Nome Fantasia <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nome_fantasia"
                  placeholder="Ex: Apex Consultoria"
                  value={formData.nome_fantasia}
                  onChange={(e) => setField('nome_fantasia', e.target.value)}
                  className={`h-9 text-xs ${
                    errors.nome_fantasia
                      ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20'
                      : ''
                  }`}
                />
                {errors.nome_fantasia && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.nome_fantasia}</p>
                )}
              </div>

              {/* CNPJ */}
              <div className="space-y-1.5">
                <Label htmlFor="cnpj" className="text-xs font-semibold text-slate-700">
                  CNPJ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => setField('cnpj', maskCnpj(e.target.value))}
                  className={`h-9 text-xs font-mono ${
                    errors.cnpj ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20' : ''
                  }`}
                />
                {errors.cnpj && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.cnpj}</p>
                )}
              </div>

              {/* Inscrição Estadual */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="inscricao_estadual"
                  className="text-xs font-semibold text-slate-700"
                >
                  Inscrição Estadual (IE)
                </Label>
                <Input
                  id="inscricao_estadual"
                  placeholder="Ex: 123.456.789.000 ou Isento"
                  value={formData.inscricao_estadual}
                  onChange={(e) =>
                    setField('inscricao_estadual', maskInscricaoEstadual(e.target.value))
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Inscrição Municipal */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="inscricao_municipal"
                  className="text-xs font-semibold text-slate-700"
                >
                  Inscrição Municipal (CCM)
                </Label>
                <Input
                  id="inscricao_municipal"
                  placeholder="Ex: 1234567-8"
                  value={formData.inscricao_municipal}
                  onChange={(e) => setField('inscricao_municipal', e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Regime Tributário */}
              <div className="space-y-1.5">
                <Label htmlFor="regime_tributario" className="text-xs font-semibold text-slate-700">
                  Regime Tributário
                </Label>
                <Select
                  value={formData.regime_tributario}
                  onValueChange={(v) => setField('regime_tributario', v as RegimeTributario)}
                >
                  <SelectTrigger id="regime_tributario" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o regime" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((reg) => (
                      <SelectItem key={reg} value={reg} className="text-xs">
                        {reg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data de Abertura */}
              <div className="space-y-1.5">
                <Label htmlFor="data_abertura" className="text-xs font-semibold text-slate-700">
                  Data de Abertura
                </Label>
                <Input
                  id="data_abertura"
                  type="date"
                  value={formData.data_abertura}
                  onChange={(e) => setField('data_abertura', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Porte da Empresa */}
              <div className="space-y-1.5">
                <Label htmlFor="porte" className="text-xs font-semibold text-slate-700">
                  Porte da Empresa
                </Label>
                <Select
                  value={formData.porte}
                  onValueChange={(v) => setField('porte', v as PorteMinhaEmpresa)}
                >
                  <SelectTrigger id="porte" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o porte" />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTES.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* SEÇÃO 2: ENDEREÇO */}
        {/* ========================================================================= */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              2. Endereço Comercial
            </CardTitle>
            <CardDescription className="text-xs">
              Localização da sede ou escritório de consultoria. Digite o CEP para busca automática.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* CEP com busca automática */}
              <div className="space-y-1.5 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cep" className="text-xs font-semibold text-slate-700">
                    CEP
                  </Label>
                  {searchingCep && (
                    <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                      <Search className="w-3 h-3 animate-spin" /> Buscando...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={formData.cep}
                    onChange={(e) => setField('cep', maskCep(e.target.value))}
                    onBlur={handleCepBlur}
                    className="h-9 text-xs font-mono pr-8"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Logradouro */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="logradouro" className="text-xs font-semibold text-slate-700">
                  Logradouro (Rua, Avenida, Praça)
                </Label>
                <Input
                  id="logradouro"
                  placeholder="Ex: Av. Paulista"
                  value={formData.logradouro}
                  onChange={(e) => setField('logradouro', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Número */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="numero" className="text-xs font-semibold text-slate-700">
                  Número
                </Label>
                <Input
                  id="numero"
                  placeholder="Ex: 1000"
                  value={formData.numero}
                  onChange={(e) => setField('numero', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Complemento */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="complemento" className="text-xs font-semibold text-slate-700">
                  Complemento
                </Label>
                <Input
                  id="complemento"
                  placeholder="Ex: Sala 1204 - Bloco B"
                  value={formData.complemento}
                  onChange={(e) => setField('complemento', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Bairro */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="bairro" className="text-xs font-semibold text-slate-700">
                  Bairro
                </Label>
                <Input
                  id="bairro"
                  placeholder="Ex: Bela Vista"
                  value={formData.bairro}
                  onChange={(e) => setField('bairro', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Cidade */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="cidade" className="text-xs font-semibold text-slate-700">
                  Cidade
                </Label>
                <Input
                  id="cidade"
                  placeholder="Ex: São Paulo"
                  value={formData.cidade}
                  onChange={(e) => setField('cidade', e.target.value)}
                  className={`h-9 text-xs ${errors.cidade ? 'border-red-500' : ''}`}
                />
              </div>

              {/* Estado UF */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="estado" className="text-xs font-semibold text-slate-700">
                  Estado (UF)
                </Label>
                <Select
                  value={formData.estado}
                  onValueChange={(v) => setField('estado', v as UfEmpresa)}
                >
                  <SelectTrigger id="estado" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf} className="text-xs">
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Código IBGE do Município */}
              <div className="space-y-1.5 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="codigo_ibge" className="text-xs font-semibold text-slate-700">
                    Código IBGE (7 dígitos)
                  </Label>
                  {ibgeMunicipioNome && (
                    <span
                      className="text-[10px] text-emerald-700 font-medium truncate max-w-[130px]"
                      title={ibgeMunicipioNome}
                    >
                      {ibgeMunicipioNome}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="codigo_ibge"
                    placeholder="Ex: 3136702"
                    maxLength={7}
                    value={formData.codigo_ibge}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 7)
                      setField('codigo_ibge', v)
                      if (v.length !== 7) setIbgeMunicipioNome(null)
                    }}
                    className={`h-9 text-xs font-mono ${errors.codigo_ibge ? 'border-red-500' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => consultarIbgeApi(formData.codigo_ibge)}
                    disabled={consultandoIbge}
                    className="h-9 px-2 text-xs shrink-0"
                    title="Buscar nome do município na API do IBGE"
                  >
                    {consultandoIbge ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
                {errors.codigo_ibge && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.codigo_ibge}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Alimenta automaticamente a emissão da NFS-e Nacional 2.0 (DPS).
                </p>
              </div>

              {/* País */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="pais" className="text-xs font-semibold text-slate-700">
                  País
                </Label>
                <Input
                  id="pais"
                  placeholder="Brasil"
                  value={formData.pais}
                  onChange={(e) => setField('pais', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* SEÇÃO 3: CONTATO */}
        {/* ========================================================================= */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-600" />
              3. Canais de Contato
            </CardTitle>
            <CardDescription className="text-xs">
              Telefones, e-mails corporativos e página na internet.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Telefone Comercial */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="telefone_comercial"
                  className="text-xs font-semibold text-slate-700"
                >
                  Telefone Comercial
                </Label>
                <Input
                  id="telefone_comercial"
                  placeholder="(00) 0000-0000"
                  value={formData.telefone_comercial}
                  onChange={(e) => setField('telefone_comercial', maskPhone(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Celular / WhatsApp */}
              <div className="space-y-1.5">
                <Label htmlFor="celular_whatsapp" className="text-xs font-semibold text-slate-700">
                  Celular / WhatsApp
                </Label>
                <Input
                  id="celular_whatsapp"
                  placeholder="(00) 90000-0000"
                  value={formData.celular_whatsapp}
                  onChange={(e) => setField('celular_whatsapp', maskPhone(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Site */}
              <div className="space-y-1.5">
                <Label htmlFor="site" className="text-xs font-semibold text-slate-700">
                  Website Oficial
                </Label>
                <Input
                  id="site"
                  type="text"
                  placeholder="https://www.consultoria.com.br"
                  value={formData.site}
                  onChange={(e) => setField('site', e.target.value)}
                  className={`h-9 text-xs ${
                    errors.site ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20' : ''
                  }`}
                />
                {errors.site && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.site}</p>
                )}
              </div>

              {/* E-mail Comercial */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="email_comercial" className="text-xs font-semibold text-slate-700">
                  E-mail Comercial
                </Label>
                <Input
                  id="email_comercial"
                  type="email"
                  placeholder="contato@consultoria.com.br"
                  value={formData.email_comercial}
                  onChange={(e) => setField('email_comercial', e.target.value)}
                  className={`h-9 text-xs ${
                    errors.email_comercial
                      ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20'
                      : ''
                  }`}
                />
                {errors.email_comercial && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.email_comercial}</p>
                )}
              </div>

              {/* E-mail Financeiro */}
              <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
                <Label htmlFor="email_financeiro" className="text-xs font-semibold text-slate-700">
                  E-mail Financeiro / Cobrança
                </Label>
                <Input
                  id="email_financeiro"
                  type="email"
                  placeholder="financeiro@consultoria.com.br"
                  value={formData.email_financeiro}
                  onChange={(e) => setField('email_financeiro', e.target.value)}
                  className={`h-9 text-xs ${
                    errors.email_financeiro
                      ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20'
                      : ''
                  }`}
                />
                {errors.email_financeiro && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.email_financeiro}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* SEÇÃO 4: DADOS DO RESPONSÁVEL TÉCNICO (CRC) */}
        {/* ========================================================================= */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              4. Responsável Técnico (Contador / CRC)
            </CardTitle>
            <CardDescription className="text-xs">
              Profissional habilitado responsável pela assinatura técnica dos demonstrativos e
              relatórios.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Nome do Contador */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="contador_nome" className="text-xs font-semibold text-slate-700">
                  Nome do Contador Responsável <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contador_nome"
                  placeholder="Ex: Flávio Borlim"
                  value={formData.contador_nome}
                  onChange={(e) => setField('contador_nome', e.target.value)}
                  className={`h-9 text-xs ${
                    errors.contador_nome
                      ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20'
                      : ''
                  }`}
                />
                {errors.contador_nome && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.contador_nome}</p>
                )}
              </div>

              {/* Registro CRC */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="contador_crc" className="text-xs font-semibold text-slate-700">
                    Registro CRC <span className="text-red-500">*</span>
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#0B1F3A] text-white text-[11px]">
                      Formato padrão: UF-000000/O (ex: SP-123456/O)
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="contador_crc"
                  placeholder="Ex: SP-123456/O"
                  value={formData.contador_crc}
                  onChange={(e) => setField('contador_crc', maskCrc(e.target.value))}
                  className={`h-9 text-xs font-mono uppercase ${
                    errors.contador_crc
                      ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20'
                      : ''
                  }`}
                />
                {errors.contador_crc && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.contador_crc}</p>
                )}
              </div>

              {/* UF do CRC */}
              <div className="space-y-1.5">
                <Label htmlFor="contador_uf_crc" className="text-xs font-semibold text-slate-700">
                  UF do CRC
                </Label>
                <Select
                  value={formData.contador_uf_crc}
                  onValueChange={(v) => setField('contador_uf_crc', v as UfEmpresa)}
                >
                  <SelectTrigger id="contador_uf_crc" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="UF de Registro" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf} className="text-xs">
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* E-mail do Contador */}
              <div className="space-y-1.5">
                <Label htmlFor="contador_email" className="text-xs font-semibold text-slate-700">
                  E-mail do Contador
                </Label>
                <Input
                  id="contador_email"
                  type="email"
                  placeholder="contador@consultoria.com.br"
                  value={formData.contador_email}
                  onChange={(e) => setField('contador_email', e.target.value)}
                  className={`h-9 text-xs ${
                    errors.contador_email
                      ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20'
                      : ''
                  }`}
                />
                {errors.contador_email && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.contador_email}</p>
                )}
              </div>

              {/* Telefone do Contador */}
              <div className="space-y-1.5">
                <Label htmlFor="contador_telefone" className="text-xs font-semibold text-slate-700">
                  Telefone / WhatsApp do Contador
                </Label>
                <Input
                  id="contador_telefone"
                  placeholder="(00) 90000-0000"
                  value={formData.contador_telefone}
                  onChange={(e) => setField('contador_telefone', maskPhone(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* SEÇÃO 5: IDENTIDADE VISUAL */}
        {/* ========================================================================= */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              5. Identidade Visual da Marca
            </CardTitle>
            <CardDescription className="text-xs">
              Logotipo e paleta de cores aplicados nos cabeçalhos de relatórios PDF e exportações.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Upload de Logo com Drag and Drop */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Logotipo da Empresa (PNG, JPG, SVG - Máx 2MB)
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleLogoFile(f)
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
                  }`}
                >
                  {logoPreview ? (
                    <div className="relative group w-full flex flex-col items-center gap-2">
                      <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs max-h-24 flex items-center justify-center">
                        <img
                          src={logoPreview}
                          alt="Logo Preview"
                          className="max-h-20 max-w-full object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-500">
                          {logoFile ? logoFile.name : 'Logotipo carregado'}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveLogo()
                          }}
                          className="h-6 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          Arraste o logotipo aqui ou clique para selecionar
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Formatos: PNG, JPG, WEBP ou SVG (Fundo transparente recomendado)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cores da Marca e Pré-visualização */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Cores Institucionais
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Defina as cores predominantes da sua marca para personalizar os relatórios.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cor Primária */}
                  <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <Label
                      htmlFor="cor_primaria"
                      className="text-xs font-medium text-slate-700 block"
                    >
                      Cor Primária
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="cor_primaria"
                        type="color"
                        value={formData.cor_primaria}
                        onChange={(e) => setField('cor_primaria', e.target.value)}
                        className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <Input
                        value={formData.cor_primaria}
                        onChange={(e) => setField('cor_primaria', e.target.value)}
                        className="h-8 text-xs font-mono uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Cor Secundária */}
                  <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <Label
                      htmlFor="cor_secundaria"
                      className="text-xs font-medium text-slate-700 block"
                    >
                      Cor Secundária
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="cor_secundaria"
                        type="color"
                        value={formData.cor_secundaria}
                        onChange={(e) => setField('cor_secundaria', e.target.value)}
                        className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <Input
                        value={formData.cor_secundaria}
                        onChange={(e) => setField('cor_secundaria', e.target.value)}
                        className="h-8 text-xs font-mono uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Box de Preview Visual do Cabeçalho */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Pré-visualização do Cabeçalho
                  </span>
                  <div
                    className="p-3 rounded-lg text-white flex items-center justify-between"
                    style={{ backgroundColor: formData.cor_primaria || '#0B1F3A' }}
                  >
                    <div className="flex items-center gap-2">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="w-7 h-7 object-contain rounded bg-white/10 p-0.5"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center font-bold text-xs">
                          🏢
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold leading-tight">
                          {formData.nome_fantasia || 'Nome da Consultoria'}
                        </p>
                        <p className="text-[10px] opacity-80">
                          {formData.contador_nome
                            ? `Resp: ${formData.contador_nome}`
                            : 'Relatório Contábil'}
                        </p>
                      </div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        backgroundColor: formData.cor_secundaria || '#2563EB',
                        color: '#FFFFFF',
                      }}
                    >
                      DRE & Balanço
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* SEÇÃO 6: DADOS BANCÁRIOS (OPCIONAL) */}
        {/* ========================================================================= */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              6. Dados Bancários & PIX (Opcional)
            </CardTitle>
            <CardDescription className="text-xs">
              Informações para emissão de cobranças, RPS, propostas comerciais e contratos de
              honorários.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Banco */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="banco" className="text-xs font-semibold text-slate-700">
                  Instituição Bancária
                </Label>
                <Select value={formData.banco} onValueChange={(v) => setField('banco', v)}>
                  <SelectTrigger id="banco" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS.map((b) => (
                      <SelectItem key={b} value={b} className="text-xs">
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Agência */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="agencia" className="text-xs font-semibold text-slate-700">
                  Agência (com dígito)
                </Label>
                <Input
                  id="agencia"
                  placeholder="0000-0"
                  value={formData.agencia}
                  onChange={(e) => setField('agencia', maskAgencia(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Conta Corrente */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="conta_corrente" className="text-xs font-semibold text-slate-700">
                  Conta Corrente (com dígito)
                </Label>
                <Input
                  id="conta_corrente"
                  placeholder="000000-0"
                  value={formData.conta_corrente}
                  onChange={(e) => setField('conta_corrente', maskConta(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Chave PIX */}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="chave_pix" className="text-xs font-semibold text-slate-700">
                  Chave PIX
                </Label>
                <Input
                  id="chave_pix"
                  placeholder="CNPJ, E-mail, Telefone ou Aleatória"
                  value={formData.chave_pix}
                  onChange={(e) => setField('chave_pix', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rodapé Fixo de Ação */}
        <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-xs p-4 rounded-xl border border-slate-200 shadow-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">
              Os dados são armazenados de forma segura e vinculados exclusivamente à sua conta.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
              className="text-xs h-9"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-5 shadow-xs"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                  Salvando alterações...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Salvar Dados da Minha Empresa
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
