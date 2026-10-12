/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0092: Atualiza a definição do agente nativo 'importador-despesas'
 * para orientar especificamente a extração hierárquica CONTA -> SUBCONTA -> DESPESAS em PDFs,
 * e assegura campo 'hierarquia_json' ou compatibilidade em 'importacao_rascunhos'.
 */
migrate(
  (app) => {
    // 1. Atualiza o Agente nativo 'importador-despesas' com capacidade hierárquica
    try {
      $ai.agents.define(app, {
        slug: 'importador-despesas',
        name: 'Agente Especialista em Importação e Classificação de Despesas',
        description:
          'Lê e interpreta despesas extraídas de arquivos PDF e planilhas Excel, extraindo a hierarquia Conta -> Subconta -> Despesas, classifica categorias contábeis e gerenciais, identifica correspondências com o Plano de Contas da empresa e sugere novos cadastros ou lançamentos rápidos.',
        tier: 'fast',
        systemPrompt: `Você é o Agente Especialista em Importação e Gestão de Despesas do sistema GESTÃO ECONÔMICA E FINANCEIRA.
Sua missão é auxiliar o usuário a importar, classificar e auditar despesas provenientes de PDFs (faturas, demonstrativos de custos, comprovantes, relatórios contábeis/gerenciais) e planilhas Excel.

DIRETRIZES DE LEITURA HIERÁRQUICA:
1. Extração Estruturada: Ao analisar relatórios e PDFs contábeis/gerenciais, extraia a estrutura em árvore quando presente no documento: CONTA (grupo agregador, ex: "Despesas Administrativas", "Custos Operacionais") -> SUBCONTA (subgrupo, ex: "Salários", "Energia", "Água e Telefone", "Serviços de Terceiros") -> DESPESAS detalhadas (itens individuais com fornecedor/descrição, competência e valor).
2. Degradação Graciosa: Se o documento não apresentar subcontas explícitas, agrupe as despesas diretamente sob a Conta principal ou crie subcontas sintéticas por natureza de gasto.
3. Vínculo com o Plano de Contas: Cada item de despesa deve ser confrontado com o Plano de Contas da empresa informada no contexto. Sugira o ID exato da conta quando houver correspondência clara por nome, código ou fornecedor.
4. Isolamento por Empresa: Nunca sugira ou misture contas de outras empresas. Respeite sempre a empresa ativa informada.
5. Formatação: Retorne sempre JSON rigoroso quando solicitado em endpoints de análise técnica.`,
      })
    } catch (err) {
      console.warn('Aviso ao redefinir agente importador-despesas na migração 0092:', err)
    }

    // 2. Garante campo 'hierarquia_json' na coleção 'importacao_rascunhos' se ainda não existir
    try {
      const col = app.findCollectionByNameOrId('importacao_rascunhos')
      if (col && !col.fields.getByName('hierarquia_json')) {
        col.fields.add(
          new JSONField({
            name: 'hierarquia_json',
            required: false,
            maxSize: 2097152, // 2MB
          }),
        )
        app.save(col)
      }
    } catch (err) {
      console.warn('Aviso ao atualizar campos da coleção importacao_rascunhos:', err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('importacao_rascunhos')
      const f = col.fields.getByName('hierarquia_json')
      if (f) {
        col.fields.remove(f)
        app.save(col)
      }
    } catch (_) {}
  },
)
