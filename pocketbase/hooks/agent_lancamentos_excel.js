routerAdd(
  'POST',
  '/backend/v1/agent-lancamentos/analisar-colunas',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const headers = body.headers || []
      const sampleRows = body.sampleRows || []
      const anoSelecionado = Number(body.anoSelecionado) || new Date().getFullYear()

      if (!headers || headers.length === 0) {
        return e.badRequestError('headers are required')
      }

      // 1. Detecção rápida de Matriz Mensal (Coluna A = Contas, Colunas B..M = Meses 31/01..31/12)
      function identificarMes(headerStr) {
        if (!headerStr) return null
        const s = String(headerStr)
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        const mDate = s.match(/^(\d{1,2})[/\-.](\d{1,2})/)
        if (mDate) {
          const m = parseInt(mDate[2], 10)
          if (m >= 1 && m <= 12) return m
        }
        const meses = [
          'jan',
          'fev',
          'mar',
          'abr',
          'mai',
          'jun',
          'jul',
          'ago',
          'set',
          'out',
          'nov',
          'dez',
        ]
        for (let i = 0; i < 12; i++) {
          if (s === meses[i] || s.includes(meses[i])) return i + 1
        }
        return null
      }

      const colunasMesesDetectadas = {}
      let totalMesesAchados = 0
      headers.forEach((h, idx) => {
        if (idx === 0) return
        const mes = identificarMes(h)
        if (mes !== null && !colunasMesesDetectadas[mes]) {
          colunasMesesDetectadas[mes] = h
          totalMesesAchados++
        }
      })

      if (totalMesesAchados >= 3) {
        // É garantidamente o formato matriz mensal
        const colContaMatriz = headers[0] || 'Conta das despesas'
        if (headers.length >= 13) {
          for (let m = 1; m <= 12; m++) {
            if (!colunasMesesDetectadas[m] && headers[m]) {
              colunasMesesDetectadas[m] = headers[m]
            }
          }
        }

        return e.json(200, {
          mapping: {
            formato: 'matriz_mensal',
            data: null,
            historico: null,
            valor: null,
            tipo: 'Despesa',
            codigoConta: colContaMatriz,
            nomeConta: colContaMatriz,
            colunaContaMatriz: colContaMatriz,
            colunasMesesMatriz: colunasMesesDetectadas,
          },
          confianca: 0.99,
          observacoes: `Planilha no formato Matriz Mensal detectada: Coluna A (${colContaMatriz}) para contas e colunas mensais com vencimento no último dia do mês para o ano ${anoSelecionado}.`,
        })
      }

      const prompt = `Você é um especialista em contabilidade e importação de planilhas financeiras (lançamentos de receitas e despesas).
Analise o cabeçalho e as primeiras linhas de uma planilha Excel e determine o formato e o mapeamento de colunas.

FORMATOS SUPORTADOS:
1. FORMATO "matriz_mensal": Coluna A contém o código/nome da conta de despesa, e as colunas seguintes (B a M) correspondem aos meses do ano (ex: 31/01, 28/02, 31/03... ou nomes dos meses).
2. FORMATO "padrao_colunas": cada linha é um lançamento individual com data, valor e conta.

ATENÇÃO - PRIORIDADE MÁXIMA PARA O MODELO OFICIAL DO SISTEMA EM FORMATO "padrao_colunas":
- Se existir coluna "Data do Lançamento" (ou "Data Lancamento", "Data"), MAPEIE OBRIGATORIAMENTE para o campo "data".
- Se existir coluna "Código da Conta" (ou "Codigo Conta", "Código", "Cod Conta"), MAPEIE OBRIGATORIAMENTE para o campo "codigoConta".
- Se existir coluna "Nome da Conta" (ou "Nome Conta", "Conta Contábil", "Descrição da Conta"), MAPEIE OBRIGATORIAMENTE para o campo "nomeConta".
- Se existir coluna "Valor" (ou "Valor Líquido", "Total", "Quantia"), MAPEIE OBRIGATORIAMENTE para o campo "valor".

Demais campos do sistema:
- "historico": coluna com o histórico, descrição, cliente/fornecedor ou detalhe da operação
- "tipo": coluna que indica se é Receita ou Despesa, ou null
- "centroCusto": coluna com o centro de custo ou unidade de negócio, ou null
- "documento": coluna com número do documento, NF, comprovante, ou null
- "formaPagamento": coluna com forma de pagamento (PIX, Boleto, Cartão), ou null

Cabeçalhos detectados:
${JSON.stringify(headers)}

Amostra das primeiras linhas de dados:
${JSON.stringify(sampleRows.slice(0, 5))}

Ano de exercício selecionado no sistema: ${anoSelecionado}

Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "mapping": {
    "formato": "padrao_colunas",
    "data": "nome_exato_da_coluna_ou_null",
    "historico": "nome_exato_da_coluna_ou_null",
    "valor": "nome_exato_da_coluna_ou_null",
    "tipo": "nome_exato_da_coluna_ou_null",
    "codigoConta": "nome_exato_da_coluna_ou_null",
    "nomeConta": "nome_exato_da_coluna_ou_null",
    "centroCusto": "nome_exato_da_coluna_ou_null",
    "documento": "nome_exato_da_coluna_ou_null",
    "formaPagamento": "nome_exato_da_coluna_ou_null"
  },
  "confianca": 0.95,
  "observacoes": "breve resumo da interpretação"
}
Não inclua crases markdown adicionais fora do JSON.`

      let aiResult
      try {
        // Limpa os cabeçalhos e amostras para remover placeholders de células vazias como __EMPTY
        const sanitizedHeaders = headers.map((h, idx) => {
          const s = String(h || '').trim()
          if (/^_{1,2}EMPTY(_\d+)?$/i.test(s)) {
            return `Coluna_${idx + 1}`
          }
          return s
        })

        const sanitizedSamples = sampleRows.map((row) => {
          const cleanRow = {}
          for (const k in row) {
            const val = row[k]
            const kClean = /^_{1,2}EMPTY(_\d+)?$/i.test(k) ? `Coluna` : k
            cleanRow[kClean] =
              typeof val === 'string' && /^_{1,2}EMPTY(_\d+)?$/i.test(val) ? '' : val
          }
          return cleanRow
        })

        const promptWithSanitized = prompt
          .replace(JSON.stringify(headers), JSON.stringify(sanitizedHeaders))
          .replace(
            JSON.stringify(sampleRows.slice(0, 5)),
            JSON.stringify(sanitizedSamples.slice(0, 5)),
          )

        const reply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um parser contábil assistido por IA que mapeia colunas de planilhas de lançamentos financeiros. Responda sempre em JSON válido puro.',
            },
            {
              role: 'user',
              content: promptWithSanitized,
            },
          ],
        })
        const content = reply?.choices?.[0]?.message?.content || '{}'
        const cleaned = content
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim()
        aiResult = JSON.parse(cleaned)
      } catch (aiErr) {
        // Fallback heurístico em caso de falha da IA
        aiResult = {
          mapping: {
            data: null,
            historico: null,
            valor: null,
            tipo: null,
            codigoConta: null,
            nomeConta: null,
            centroCusto: null,
            documento: null,
            formaPagamento: null,
          },
          confianca: 0.5,
          observacoes: 'Mapeamento heurístico padrão utilizado.',
        }
      }

      return e.json(200, aiResult)
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao analisar colunas com IA.' })
    }
  },
  $apis.requireAuth(),
)
