import { useState, useEffect } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Settings, ShieldCheck, Server, AlertCircle } from 'lucide-react'
import { servicoTransmissaoNfse, CredenciaisNfseNacional } from '@/services/transmissaoNfseService'

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
  const [serie, setSerie] = useState(serieAtual || '1')
  const [proximoNumero, setProximoNumero] = useState(proximoNumeroAtual || 1)
  const [ambiente, setAmbiente] = useState<'1' | '2'>('2')
  const [endpoint, setEndpoint] = useState('https://hom.nfse.fazenda.gov.br/portal')
  const [certNome, setCertNome] = useState('')

  useEffect(() => {
    if (open) {
      setSerie(serieAtual || '1')
      setProximoNumero(proximoNumeroAtual || 1)
      const config = servicoTransmissaoNfse.obterConfiguracoes(empresaId)
      setAmbiente(config.tipoAmbiente || '2')
      if (config.endpointCustomizado) {
        setEndpoint(config.endpointCustomizado)
      }
    }
  }, [open, serieAtual, proximoNumeroAtual, empresaId])

  const handleSalvar = () => {
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

    toast({
      title: 'Configurações salvas',
      description: `Série ${serie} e próximo número ${num} atualizados com sucesso.`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configurações do Novo Padrão Nacional NFS-e / DPS
          </DialogTitle>
          <DialogDescription>
            Defina a série da DPS, controle de numeração e parâmetros de conexão com o Portal
            Nacional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Numeração e Série */}
          <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              Numeração e Série do DPS
            </h4>
            <p className="text-xs text-muted-foreground">
              O DPS (Declaração de Prestação de Serviços) unificado possui série (geralmente
              numérica de 1 a 5 dígitos) e sequencial próprio que é convertido na chave nacional de
              50 dígitos.
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
                    Transmite diretamente aos servidores da Receita Federal / ENCAT com efeito legal
                    e tributário.
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

          {/* Certificado Digital (Aviso e Desacoplamento) */}
          <div className="border rounded-lg p-4 bg-primary/5 border-primary/20 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShieldCheck className="w-4 h-4" />
              Camada de Certificado Digital A1 (ICP-Brasil)
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A arquitetura do emissor está 100% desacoplada: os dados e o payload do DPS são
              gerados e assinados no padrão canônico. Para transmitir em produção direta, o
              certificado digital ICP-Brasil (.pfx) pode ser carregado abaixo ou configurado no
              cofre seguro.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setCertNome(file.name)
                    toast({
                      title: 'Certificado selecionado',
                      description: `Arquivo ${file.name} pronto para ser vinculado.`,
                    })
                  }
                }}
                className="text-xs"
              />
              {certNome && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {certNome}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Em modo homologação, o envio e validação funcionam sem necessidade de certificado.
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar}>Salvar Parâmetros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
