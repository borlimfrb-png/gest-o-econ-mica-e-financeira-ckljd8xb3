import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { NfseTomadorRecord, TipoPessoaTomador } from '@/types/finance'
import { tomadoresService, SalvarTomadorInput } from '@/services/tomadoresService'
import { Building2, User, Loader2, MapPin, Mail, Phone } from 'lucide-react'

interface ModalCadastroTomadorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  tomadorParaEditar?: NfseTomadorRecord | null
  onSalvo: (tomador: NfseTomadorRecord) => void
}

export function ModalCadastroTomador({
  open,
  onOpenChange,
  empresaId,
  tomadorParaEditar,
  onSalvo,
}: ModalCadastroTomadorProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  // Formulário
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoaTomador>(
    tomadorParaEditar?.tipo_pessoa || 'PJ',
  )
  const [cpfCnpj, setCpfCnpj] = useState(tomadorParaEditar?.cpf_cnpj || '')
  const [razaoSocial, setRazaoSocial] = useState(tomadorParaEditar?.razao_social || '')
  const [nomeFantasia, setNomeFantasia] = useState(tomadorParaEditar?.nome_fantasia || '')
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(
    tomadorParaEditar?.inscricao_municipal || '',
  )
  const [inscricaoEstadual, setInscricaoEstadual] = useState(
    tomadorParaEditar?.inscricao_estadual || '',
  )
  const [email, setEmail] = useState(tomadorParaEditar?.email || '')
  const [telefone, setTelefone] = useState(tomadorParaEditar?.telefone || '')
  const [cep, setCep] = useState(tomadorParaEditar?.cep || '')
  const [logradouro, setLogradouro] = useState(tomadorParaEditar?.logradouro || '')
  const [numero, setNumero] = useState(tomadorParaEditar?.numero || '')
  const [complemento, setComplemento] = useState(tomadorParaEditar?.complemento || '')
  const [bairro, setBairro] = useState(tomadorParaEditar?.bairro || '')
  const [cidade, setCidade] = useState(tomadorParaEditar?.cidade || '')
  const [estado, setEstado] = useState(tomadorParaEditar?.estado || 'SP')
  const [codigoMunicipio, setCodigoMunicipio] = useState(
    tomadorParaEditar?.codigo_municipio || '3550308',
  )
  const [observacoes, setObservacoes] = useState(tomadorParaEditar?.observacoes || '')

  // Resetar quando abrir
  const handleOpen = (aberto: boolean) => {
    if (aberto && tomadorParaEditar) {
      setTipoPessoa(tomadorParaEditar.tipo_pessoa || 'PJ')
      setCpfCnpj(tomadorParaEditar.cpf_cnpj || '')
      setRazaoSocial(tomadorParaEditar.razao_social || '')
      setNomeFantasia(tomadorParaEditar.nome_fantasia || '')
      setInscricaoMunicipal(tomadorParaEditar.inscricao_municipal || '')
      setInscricaoEstadual(tomadorParaEditar.inscricao_estadual || '')
      setEmail(tomadorParaEditar.email || '')
      setTelefone(tomadorParaEditar.telefone || '')
      setCep(tomadorParaEditar.cep || '')
      setLogradouro(tomadorParaEditar.logradouro || '')
      setNumero(tomadorParaEditar.numero || '')
      setComplemento(tomadorParaEditar.complemento || '')
      setBairro(tomadorParaEditar.bairro || '')
      setCidade(tomadorParaEditar.cidade || '')
      setEstado(tomadorParaEditar.estado || 'SP')
      setCodigoMunicipio(tomadorParaEditar.codigo_municipio || '3550308')
      setObservacoes(tomadorParaEditar.observacoes || '')
    } else if (aberto && !tomadorParaEditar) {
      setTipoPessoa('PJ')
      setCpfCnpj('')
      setRazaoSocial('')
      setNomeFantasia('')
      setInscricaoMunicipal('')
      setInscricaoEstadual('')
      setEmail('')
      setTelefone('')
      setCep('')
      setLogradouro('')
      setNumero('')
      setComplemento('')
      setBairro('')
      setCidade('São Paulo')
      setEstado('SP')
      setCodigoMunicipio('3550308')
      setObservacoes('')
    }
    onOpenChange(aberto)
  }

  // Busca de CEP simplificada
  const buscarCep = async (valorCep: string) => {
    const cepLimpo = valorCep.replace(/\D/g, '')
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setLogradouro(data.logradouro || '')
          setBairro(data.bairro || '')
          setCidade(data.localidade || '')
          setEstado(data.uf || '')
          setCodigoMunicipio(data.ibge || '3550308')
          toast({
            title: 'Endereço localizado',
            description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`,
          })
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }

  const handleSalvar = async () => {
    if (!razaoSocial.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a Razão Social ou Nome do tomador.',
        variant: 'destructive',
      })
      return
    }

    const docLimpo = cpfCnpj.replace(/\D/g, '')
    if (!docLimpo || (docLimpo.length !== 11 && docLimpo.length !== 14)) {
      toast({
        title: 'Documento inválido',
        description: 'O CPF deve ter 11 dígitos ou o CNPJ deve ter 14 dígitos.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const input: SalvarTomadorInput = {
        empresa: empresaId,
        tipo_pessoa: tipoPessoa,
        cpf_cnpj: cpfCnpj.trim(),
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim() || undefined,
        inscricao_municipal: inscricaoMunicipal.trim() || undefined,
        inscricao_estadual: inscricaoEstadual.trim() || undefined,
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        cep: cep.trim() || undefined,
        logradouro: logradouro.trim() || undefined,
        numero: numero.trim() || undefined,
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim() || undefined,
        codigo_municipio: codigoMunicipio.trim() || undefined,
        cidade: cidade.trim() || undefined,
        estado: estado.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        ativo: true,
      }

      let res: NfseTomadorRecord
      if (tomadorParaEditar?.id) {
        res = await tomadoresService.atualizar(
          tomadorParaEditar.id,
          input,
          user?.id,
          user?.name || user?.email,
        )
        toast({
          title: 'Tomador atualizado',
          description: `Os dados de ${res.razao_social} foram salvos com sucesso.`,
        })
      } else {
        res = await tomadoresService.criar(input, user?.id, user?.name || user?.email)
        toast({
          title: 'Tomador cadastrado',
          description: `${res.razao_social} adicionado à base da empresa.`,
        })
      }

      onSalvo(res)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar tomador',
        description: err?.message || 'Verifique as informações preenchidas.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipoPessoa === 'PJ' ? (
              <Building2 className="w-5 h-5 text-primary" />
            ) : (
              <User className="w-5 h-5 text-primary" />
            )}
            {tomadorParaEditar
              ? 'Editar Tomador de Serviços'
              : 'Novo Tomador de Serviços (NFS-e Nacional)'}
          </DialogTitle>
          <DialogDescription>
            Cadastro estruturado do tomador conforme exigências do layout DPS Nacional 2.0.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Tipo de Pessoa</Label>
              <Select
                value={tipoPessoa}
                onValueChange={(val: TipoPessoaTomador) => setTipoPessoa(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica (CNPJ)</SelectItem>
                  <SelectItem value="PF">Pessoa Física (CPF)</SelectItem>
                  <SelectItem value="Exterior">Exterior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{tipoPessoa === 'PJ' ? 'CNPJ *' : 'CPF *'}</Label>
              <Input
                placeholder={tipoPessoa === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
              />
            </div>

            <div>
              <Label>Inscrição Municipal</Label>
              <Input
                placeholder="Ex: 1234567-8"
                value={inscricaoMunicipal}
                onChange={(e) => setInscricaoMunicipal(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Razão Social / Nome Completo *</Label>
              <Input
                placeholder="Nome empresarial ou completo do cliente"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
              />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input
                placeholder="Nome fantasia (opcional)"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
              />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                E-mail para Envio da Nota
              </Label>
              <Input
                type="email"
                placeholder="financeiro@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Telefone de Contato
              </Label>
              <Input
                placeholder="(11) 98765-4321"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
          </div>

          {/* Endereço - Obrigatório no padrão nacional */}
          <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              Endereço do Tomador (Obrigatório no DPS Nacional)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>CEP</Label>
                <Input
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => {
                    setCep(e.target.value)
                    if (e.target.value.replace(/\D/g, '').length === 8) {
                      buscarCep(e.target.value)
                    }
                  }}
                  onBlur={() => buscarCep(cep)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Logradouro / Rua</Label>
                <Input
                  placeholder="Av. Paulista, Rua ..."
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                />
              </div>
              <div>
                <Label>Número</Label>
                <Input
                  placeholder="1000 ou SN"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Complemento</Label>
                <Input
                  placeholder="Sala 12, Bloco B"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input
                  placeholder="Bela Vista"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  placeholder="São Paulo"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>UF</Label>
                  <Input
                    maxLength={2}
                    placeholder="SP"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <Label>IBGE</Label>
                  <Input
                    placeholder="3550308"
                    value={codigoMunicipio}
                    onChange={(e) => setCodigoMunicipio(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label>Observações Internas</Label>
            <Textarea
              placeholder="Anotações internas sobre o tomador ou faturamento..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {tomadorParaEditar ? 'Salvar Alterações' : 'Cadastrar Tomador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
