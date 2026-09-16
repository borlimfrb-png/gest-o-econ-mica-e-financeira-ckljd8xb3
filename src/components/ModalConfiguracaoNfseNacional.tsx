import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Settings,
  ShieldCheck,
  Server,
  AlertCircle,
  RefreshCw,
  KeyRound,
  UploadCloud,
  Trash2,
  Lock,
  CheckCircle2,
  Calendar,
  FileCheck,
  ShieldAlert,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { servicoTransmissaoNfse, CredenciaisNfseNacional } from '@/services/transmissaoNfseService'
import { nfseLancamentosService } from '@/services/nfseLancamentosService'
import {
  certificadoA1Service,
  extrairValidadePfxLocal,
  type DadosCertificadoA1,
} from '@/services/certificadoA1Service'
import { useAuth } from '@/contexts/AuthContext'

interface ModalConfiguracaoNfseNacionalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  serieAtual: string
  proximoNumeroAtual: number
  onSalvarSerieNumero: (serie: string, proximoNumero: number) => void
}

export function ModalConfiguracaoNfseNacional({
  open,
  onOpenChange,
  empresaId,
  serieAtual,
  proximoNumeroAtual,
  onSalvarSerieNumero,
}: ModalConfiguracaoNfseNacionalProps) {
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  const [serie, setSerie] = useState(serieAtual || '1')
  const [proximoNumero, setProximoNumero] = useState(proximoNumeroAtual || 1)
  const [ambiente, setAmbiente] = useState<'1' | '2'>('2')
  const [endpoint, setEndpoint] = useState('https://hom.nfse.fazenda.gov.br/portal')
  const [integrarLancamentos, setIntegrarLancamentos] = useState<boolean>(true)

  // Estado do Certificado Digital A1
  const [certCarregando, setCertCarregando] = useState(false)
  const [certDados, setCertDados] = useState<DadosCertificadoA1 | null>(null)
  const [certArquivo, setCertArquivo] = useState<File | null>(null)
  const [certSenha, setCertSenha] = useState('')
  const [salvandoCert, setSalvandoCert] = useState(false)
  const [removendoCert, setRemovendoCert] = useState(false)
  const [confirmRemoverOpen, setConfirmRemoverOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carregar status do certificado
  const carregarStatusCertificado = async (empId: string) => {
    if (!isAdmin || !empId) {
      setCertDados(null)
      return
    }

    setCertCarregando(true)
    try {
      const resp = await certificadoA1Service.obterStatusCertificado(empId)
      if (resp.success && resp.temCertificado && resp.dados) {
        setCertDados(resp.dados)
      } else {
        setCertDados(null)
      }
    } catch (err) {
      console.warn('Não foi possível obter dados do certificado digital:', err)
      setCertDados(null)
    } finally {
      setCertCarregando(false)
    }
  }

  useEffect(() => {
    if (open) {
      setSerie(serieAtual || '1')
      setProximoNumero(proximoNumeroAtual || 1)
      const config = servicoTransmissaoNfse.obterConfiguracoes(empresaId)
      setAmbiente(config.tipoAmbiente || '2')
      if (config.endpointCustomizado) {
        setEndpoint(config.endpointCustomizado)
      }

      // Reset dos campos de formulário de upload
      setCertArquivo(null)
      setCertSenha('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Carregar flag de integração com lançamentos da empresa
      if (empresaId) {
        nfseLancamentosService
          .verificarIntegracaoHabilitada(empresaId)
          .then((habilitada) => setIntegrarLancamentos(habilitada))
          .catch(() => setIntegrarLancamentos(true))

        // Carrega status do certificado no backend
        carregarStatusCertificado(empresaId)
      }
    }
  }, [open, serieAtual, proximoNumeroAtual, empresaId, isAdmin])

  const handleSalvar = async () => {
    const num = Number(proximoNumero)
    if (!serie.trim()) {
      toast({
        title: 'Série inválida',
        description: 'Informe a série da DPS / NFS-e.',
        variant: 'destructive',
      })
      return
    }
    if (isNaN(num) || num < 1) {
      toast({
        title: 'Número inválido',
        description: 'O próximo número sequencial deve ser maior ou igual a 1.',
        variant: 'destructive',
      })
      return
    }

    const config: CredenciaisNfseNacional = {
      tipoAmbiente: ambiente,
      endpointCustomizado: endpoint,
      habilitado: ambiente === '1',
    }
    servicoTransmissaoNfse.salvarConfiguracoes(config, empresaId)
    onSalvarSerieNumero(serie.trim(), num)

    // Atualiza preferência de integração na empresa
    if (empresaId) {
      try {
        await nfseLancamentosService.alternarIntegracaoEmpresa(empresaId, integrarLancamentos)
      } catch (err) {
        console.warn('Falha ao atualizar integracao com lancamentos na empresa:', err)
      }
    }

    toast({
      title: 'Configurações salvas',
      description: `Série ${serie}, número ${num} e integração com lançamentos atualizados com sucesso.`,
    })
    onOpenChange(false)
  }

  // Upload e Validação de Certificado
  const handleSelecionarArquivoCert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const nomeLower = file.name.toLowerCase()
    if (!nomeLower.endsWith('.pfx') && !nomeLower.endsWith('.p12')) {
      toast({
        title: 'Formato inválido',
        description: 'Selecione um arquivo de Certificado Digital A1 (.pfx ou .p12).',
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      setCertArquivo(null)
      return
    }

    // Limite razoável de 100KB (certificados A1 costumam ter 5KB a 50KB)
    if (file.size > 100 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: `O arquivo tem ${(file.size / 1024).toFixed(0)}KB. O tamanho máximo permitido para o certificado A1 é de 100KB.`,
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      setCertArquivo(null)
      return
    }

    setCertArquivo(file)
    toast({
      title: 'Certificado selecionado',
      description: `${file.name} (${(file.size / 1024).toFixed(1)} KB). Digite a senha para salvar no cofre seguro.`,
    })
  }

  const handleSalvarCertificado = async () => {
    if (!empresaId) {
      toast({
        title: 'Empresa não selecionada',
        description: 'Selecione uma empresa ativa para vincular o certificado.',
        variant: 'destructive',
      })
      return
    }

    if (!certArquivo) {
      toast({
        title: 'Arquivo não selecionado',
        description: 'Selecione o arquivo .pfx ou .p12 do seu Certificado Digital A1.',
        variant: 'destructive',
      })
      return
    }

    if (!certSenha.trim()) {
      toast({
        title: 'Senha obrigatória',
        description: 'Informe a senha de instalação do certificado digital.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoCert(true)
    try {
      // Ler bytes e converter para base64
      const buffer = await certArquivo.arrayBuffer()
      const bytes = new Uint8Array(buffer)

      // Extrai metadados/validade do PFX de forma segura
      const { validadeFim, validadeInicio } = extrairValidadePfxLocal(bytes)

      // Converte bytes para Base64
      let binary = ''
      const len = bytes.byteLength
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      await certificadoA1Service.salvarCertificado({
        empresa_id: empresaId,
        nome_arquivo: certArquivo.name,
        arquivo_base64: base64,
        senha: certSenha,
        metadados: {
          validade_fim: validadeFim,
          validade_inicio: validadeInicio,
          emissor: 'ICP-Brasil (A1)',
        },
      })

      toast({
        title: 'Certificado A1 gravado com segurança',
        description:
          'O certificado foi armazenado no cofre criptografado do servidor. A senha nunca será exibida.',
      })

      // Limpar formulário de upload
      setCertArquivo(null)
      setCertSenha('')
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Recarrega status
      await carregarStatusCertificado(empresaId)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar certificado',
        description: err?.message || 'Falha ao transmitir o certificado para o cofre seguro.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoCert(false)
    }
  }

  const handleRemoverCertificado = async () => {
    if (!empresaId) return
    setRemovendoCert(true)
    try {
      await certificadoA1Service.removerCertificado(empresaId)
      toast({
        title: 'Certificado removido',
        description: 'O certificado digital foi excluído do cofre seguro com sucesso.',
      })
      setConfirmRemoverOpen(false)
      setCertDados(null)
    } catch (err: any) {
      toast({
        title: 'Erro ao remover certificado',
        description: err?.message || 'Não foi possível remover o certificado.',
        variant: 'destructive',
      })
    } finally {
      setRemovendoCert(false)
    }
  }

  const formatarData = (isoStr?: string | null) => {
    if (!isoStr) return 'Não identificada'
    try {
      const dt = new Date(isoStr)
      if (isNaN(dt.getTime())) return isoStr
      return dt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configurações do Novo Padrão Nacional NFS-e / DPS
            </DialogTitle>
            <DialogDescription>
              Defina a série da DPS, controle de numeração, parâmetros de conexão e Certificado
              Digital A1.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Integração NFS-e com Lançamentos Rápidos */}
            <div className="border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="toggle-integrar"
                    className="text-sm font-semibold flex items-center gap-2 cursor-pointer text-foreground"
                  >
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Integrar NFS-e com Lançamentos Rápidos
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Gera automaticamente a receita contábil líquida no módulo financeiro e estorna
                    em caso de cancelamento.
                  </p>
                </div>
                <Switch
                  id="toggle-integrar"
                  checked={integrarLancamentos}
                  onCheckedChange={setIntegrarLancamentos}
                />
              </div>
            </div>

            {/* Numeração e Série */}
            <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                Numeração e Série do DPS
              </h4>
              <p className="text-xs text-muted-foreground">
                O DPS (Declaração de Prestação de Serviços) unificado possui série (geralmente
                numérica de 1 a 5 dígitos) e sequencial próprio que é convertido na chave nacional
                de 50 dígitos.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Série do DPS / NFS-e</Label>
                  <Input
                    value={serie}
                    maxLength={5}
                    placeholder="Ex: 1, 900"
                    onChange={(e) => setSerie(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div>
                  <Label>Próximo Número a Emitir</Label>
                  <Input
                    type="number"
                    min={1}
                    value={proximoNumero}
                    onChange={(e) => setProximoNumero(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>
            </div>

            {/* Ambiente de Transmissão */}
            <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Server className="w-4 h-4 text-primary" />
                  Ambiente de Conexão Nacional
                </h4>
                <Badge variant={ambiente === '1' ? 'default' : 'secondary'}>
                  {ambiente === '1' ? 'Produção' : 'Homologação / Simulação'}
                </Badge>
              </div>

              <RadioGroup
                value={ambiente}
                onValueChange={(val: '1' | '2') => {
                  setAmbiente(val)
                  if (val === '1') {
                    setEndpoint('https://nfse.fazenda.gov.br/portal')
                  } else {
                    setEndpoint('https://hom.nfse.fazenda.gov.br/portal')
                  }
                }}
                className="space-y-2"
              >
                <div className="flex items-start space-x-2 border p-2.5 rounded-md hover:bg-muted/40 transition">
                  <RadioGroupItem value="2" id="amb-hom" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="amb-hom" className="font-medium cursor-pointer">
                      Ambiente 2 - Homologação / Simulação Nacional (Recomendado)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Gera e valida o JSON/XML do DPS fiel ao layout oficial. Emite notas com
                      protocolo simulado sem valor fiscal imediato, permitindo testes sem custos.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 border p-2.5 rounded-md hover:bg-muted/40 transition">
                  <RadioGroupItem value="1" id="amb-prod" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="amb-prod" className="font-medium cursor-pointer">
                      Ambiente 1 - Produção Oficial SEFIN / ADN
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Transmite diretamente aos servidores da Receita Federal / ENCAT com efeito
                      legal e tributário. Requer Certificado Digital A1 ativo.
                    </p>
                  </div>
                </div>
              </RadioGroup>

              <div>
                <Label className="text-xs">Endpoint do Portal Nacional</Label>
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* SEÇÃO: CERTIFICADO DIGITAL A1 (Visível e gerenciável apenas para ADMIN) */}
            {isAdmin ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        Certificado Digital A1 (ICP-Brasil)
                        <Badge
                          variant="outline"
                          className="text-[10px] text-blue-700 border-blue-200 bg-blue-50"
                        >
                          Apenas Admin
                        </Badge>
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Utilizado para assinar digitalmente as DPS e transmitir com valor fiscal à
                        Receita Federal
                      </p>
                    </div>
                  </div>

                  {certCarregando && (
                    <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Status do Certificado Atual */}
                {certDados ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900 p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                          Certificado Digital A1 Ativo
                        </span>
                        <Badge
                          variant={certDados.estaExpirado ? 'destructive' : 'default'}
                          className="text-[10px] h-5"
                        >
                          {certDados.estaExpirado ? 'Expirado' : 'Válido'}
                        </Badge>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemoverOpen(true)}
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 gap-1"
                        title="Remover certificado desta empresa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover certificado
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
                      <div className="bg-white/70 dark:bg-slate-900/40 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                        <span className="text-[10px] text-muted-foreground block font-medium">
                          Nome do Arquivo
                        </span>
                        <span
                          className="font-mono text-[11px] font-semibold text-foreground truncate block"
                          title={certDados.nome_arquivo}
                        >
                          {certDados.nome_arquivo}
                        </span>
                      </div>

                      <div className="bg-white/70 dark:bg-slate-900/40 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                        <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          Data do Upload
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatarData(certDados.data_upload)}
                        </span>
                      </div>

                      <div className="bg-white/70 dark:bg-slate-900/40 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                        <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
                          <FileCheck className="w-3 h-3 text-muted-foreground" />
                          Validade do Certificado
                        </span>
                        <span
                          className={`font-semibold ${
                            certDados.estaExpirado
                              ? 'text-red-600 font-bold'
                              : certDados.diasRestantes !== null && certDados.diasRestantes <= 30
                                ? 'text-amber-700 font-bold'
                                : 'text-emerald-700'
                          }`}
                        >
                          {formatarData(certDados.validade_fim)}
                          {certDados.diasRestantes !== null && !certDados.estaExpirado && (
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                              ({certDados.diasRestantes} dias)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-950 dark:text-amber-100">
                        Nenhum certificado cadastrado — emissão em modo Homologação/Simulação
                      </p>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                        Para transmitir notas fiscais no ambiente oficial de Produção com validade
                        fiscal perante a Receita Federal, faça o upload do Certificado Digital A1
                        (.pfx ou .p12) abaixo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Formulário de Envio / Substituição do Certificado */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-primary" />
                      {certDados
                        ? 'Substituir Certificado Digital (.pfx / .p12)'
                        : 'Enviar Certificado Digital (.pfx / .p12)'}
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Aceita apenas .pfx ou .p12 (Máx. 100KB)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".pfx,.p12"
                        onChange={handleSelecionarArquivoCert}
                        disabled={salvandoCert}
                        className="text-xs file:text-xs file:font-semibold file:text-primary file:bg-primary/10 file:border-0 file:rounded-md file:mr-2 cursor-pointer h-9"
                      />
                      {certArquivo && (
                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                          Selecionado: <strong>{certArquivo.name}</strong> (
                          {(certArquivo.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>

                    <div>
                      <Input
                        type="password"
                        placeholder="Senha do Certificado Digital"
                        value={certSenha}
                        onChange={(e) => setCertSenha(e.target.value)}
                        disabled={salvandoCert}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Senha de instalação vinculada ao arquivo
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Armazenado com segurança no cofre do backend. A senha nunca é exibida
                        novamente.
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSalvarCertificado}
                      disabled={salvandoCert || !certArquivo || !certSenha.trim()}
                      className="text-xs h-8 gap-1.5"
                    >
                      {salvandoCert ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Gravando com segurança...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Salvar Certificado
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Aviso para perfis não-admin
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 bg-slate-50 dark:bg-slate-900/30 text-xs text-muted-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  O gerenciamento do Certificado Digital A1 é restrito aos administradores do
                  sistema.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar}>Salvar Parâmetros</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação para Remoção de Certificado */}
      <AlertDialog open={confirmRemoverOpen} onOpenChange={setConfirmRemoverOpen}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Remover Certificado Digital A1?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 dark:text-slate-400">
              Tem certeza que deseja remover o certificado digital cadastrado para esta empresa?
              Após a remoção, o emissor passará a operar exclusivamente em modo de
              Homologação/Simulação até que um novo certificado seja enviado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendoCert} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoverCertificado}
              disabled={removendoCert}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {removendoCert ? 'Removendo...' : 'Sim, Remover Certificado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
