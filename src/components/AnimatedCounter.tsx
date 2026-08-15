import React, { useEffect, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  formatter?: (val: number) => string
  duration?: number
  className?: string
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  formatter = (v) => v.toLocaleString('pt-BR'),
  duration = 800,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startValue = displayValue
    const diff = value - startValue

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setDisplayValue(startValue + diff * easeProgress)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setDisplayValue(value)
      }
    }

    window.requestAnimationFrame(step)
  }, [value, duration])

  return <span className={className}>{formatter(displayValue)}</span>
}
