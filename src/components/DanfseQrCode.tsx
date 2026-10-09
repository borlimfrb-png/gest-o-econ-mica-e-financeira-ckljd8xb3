import React, { useMemo } from 'react'
import { generateQrMatrix } from '@/lib/qrCodeUtil'

interface DanfseQrCodeProps {
  chaveAcesso?: string
  urlConsulta?: string
  size?: number
  className?: string
}

/**
 * Componente de QR Code vetorial SVG nítido para o DANFSE Nacional 2.0.
 * Utiliza o utilitário nativo src/lib/qrCodeUtil.ts sem dependências externas.
 */
export const DanfseQrCode: React.FC<DanfseQrCodeProps> = ({
  chaveAcesso,
  urlConsulta,
  size = 110,
  className = '',
}) => {
  const qrUrl = useMemo(() => {
    if (urlConsulta) return urlConsulta
    const chaveLimpa = (chaveAcesso || '').replace(/\D/g, '')
    if (chaveLimpa) {
      return `https://www.nfse.gov.br/consultapublica?chave=${chaveLimpa}`
    }
    return 'https://www.nfse.gov.br/consultapublica'
  }, [chaveAcesso, urlConsulta])

  const matrix = useMemo(() => {
    return generateQrMatrix(qrUrl)
  }, [qrUrl])

  const count = matrix.length || 25
  const cellSize = 100 / count

  return (
    <div
      className={`inline-flex flex-col items-center justify-center p-1.5 bg-white border border-slate-300 rounded shadow-xs ${className}`}
      style={{ width: size, height: size }}
      title={`Consulta pública da NFS-e Nacional: ${qrUrl}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        shapeRendering="crispEdges"
        aria-label="QR Code para consulta da NFS-e Nacional"
      >
        <rect width="100" height="100" fill="#ffffff" />
        {matrix.map((row, rIdx) =>
          row.map((dark, cIdx) => {
            if (!dark) return null
            return (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx * cellSize}
                y={rIdx * cellSize}
                width={cellSize + 0.05}
                height={cellSize + 0.05}
                fill="#0f172a"
              />
            )
          }),
        )}
      </svg>
    </div>
  )
}

export default DanfseQrCode
