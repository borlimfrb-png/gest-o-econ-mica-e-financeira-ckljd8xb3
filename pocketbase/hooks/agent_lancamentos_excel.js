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

      if (!headers || headers.length === 0) {
        return e.badRequestError('headers are required')
      }

      const prompt = `Você é um especialista em contabilidade e importação de planilhas financeiras (lançamentos de receitas e despesas).
Analise o cabeçalho e as primeiras linhas de uma planilha Excel e determine o mapeamento de colunas para os seguintes campos do sistema.

ATENÇÃO - PRIORIDADE MÁXIMA PARA O MODELO OFICIAL DO SISTEMA:
- Se existir coluna "Data do Lançamento" (ou variação direta como "Data Lancamento", "Data"), MAPEIE OBRIGATORIAMENTE para o campo "data".
- Se existir coluna "Código da Conta" (ou "Codigo Conta", "Código", "Cod Conta"), MAPEIE OBRIGATORIAMENTE para o campo "codigoConta".
- Se existir coluna "Nome da Conta" (ou "Nome Conta", "Conta Contábil", "Descrição da Conta"), MAPEIE OBRIGATORIAMENTE para o campo "nomeConta".
- Se existir coluna "Valor" (ou "Valor Líquido", "Total", "Quantia"), MAPEIE OBRIGATORIAMENTE para o campo "valor".

Demais campos do sistema:
- "historico": coluna com o histórico, descrição, cliente/fornecedor ou detalhe da operação
- "tipo": coluna que indica se é Receita ou Despesa (ou Débito/Crédito, Entrada/Saída, R/D, C/D), ou deixe null se não houver
- "centroCusto": coluna com o centro de custo ou unidade de negócio, ou null
- "documento": coluna com número do documento, NF, comprovante, ou null
- "formaPagamento": coluna com forma de pagamento (PIX, Boleto, Cartão, Transferência), ou null

Cabeçalhos detectados:
${JSON.stringify(headers)}

Amostra das primeiras linhas de dados:
${JSON.stringify(sampleRows.slice(0, 5))}

Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "mapping": {
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
              content: prompt,
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
