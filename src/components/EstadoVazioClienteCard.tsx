import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FileQuestion, PhoneCall } from 'lucide-react'

interface EstadoVazioClienteCardProps {
  empresaNome?: string
  ano?: number | string
  className?: string
  mensagem?: string
}

export const MENSAGEM_PADRAO_ESTADO_VAZIO_CLIENTE =
  'Nenhum lançamento contábil ou DRE importado para esta empresa no exercício selecionado. Entre em contato com seu consultor Borlim para a conciliação do período.'

export const EstadoVazioClienteCard: React.FC<EstadoVazioClienteCardProps> = ({
  empresaNome,
  ano,
  className = '',
  mensagem = MENSAGEM_PADRAO_ESTADO_VAZIO_CLIENTE,
}) => {
  return (
    <Card
      data-testid="estado-vazio-cliente"
      className={`border border-blue-200/80 bg-linear-to-br from-blue-50/70 via-white to-slate-50 shadow-sm rounded-2xl overflow-hidden ${className}`}
    >
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs border border-blue-200">
            <FileQuestion className="w-7 h-7" />
          </div>

          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Aguardando Lançamentos
              </span>
              {ano && (
                <span className="text-[11px] font-mono font-medium text-slate-500">
                  Exercício {ano}
                </span>
              )}
              {empresaNome && (
                <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[200px]">
                  • {empresaNome}
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-[#0B1F3A]">
              Exercício sem movimentações cadastradas
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              {mensagem}
            </p>

            <div className="pt-2 flex items-center justify-center sm:justify-start gap-2 text-xs text-blue-800 font-medium">
              <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
              <span>Suporte e Conciliação Contábil Borlim</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default EstadoVazioClienteCard
