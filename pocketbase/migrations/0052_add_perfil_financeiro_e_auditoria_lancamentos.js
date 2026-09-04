/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Atualizar campo 'role' em users para incluir 'financeiro' (extensível: admin, empresa, financeiro)
    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'empresa', 'financeiro']
    } else {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['admin', 'empresa', 'financeiro'],
          maxSelect: 1,
        }),
      )
    }
    app.save(usersCol)

    // 2. Criar coleção 'auditoria_lancamentos' para rastrear criações, edições e exclusões de lançamentos
    // Campos:
    // - empresa (relation -> empresas, cascadeDelete: false)
    // - lancamento_id (text: id do lançamento afetado)
    // - acao (select: 'criacao' | 'edicao' | 'exclusao')
    // - usuario (relation -> users)
    // - usuario_nome (text: nome do usuário gravado no momento)
    // - usuario_email (text: email do usuário gravado no momento)
    // - data_hora (date ou autodate created)
    // - detalhes (json: campos alterados com antes/depois, ou resumo do lançamento)
    // - valor (number: valor do lançamento no momento da ação)
    // - historico (text: histórico do lançamento no momento da ação)
    // - conta_info (text: código/nome da conta e centro de custo)
    // Regras de acesso RLS:
    // Admin vê auditoria de todas as empresas; Usuários vinculados a uma empresa vêem apenas registros da sua empresa (@request.auth.empresa).
    // Criação permitida para qualquer usuário autenticado.

    let auditoriaCol
    try {
      auditoriaCol = app.findCollectionByNameOrId('auditoria_lancamentos')
    } catch (_) {
      auditoriaCol = new Collection({
        name: 'auditoria_lancamentos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'lancamento_id',
            type: 'text',
            required: true,
          },
          {
            name: 'acao',
            type: 'select',
            required: true,
            values: ['criacao', 'edicao', 'exclusao'],
            maxSelect: 1,
          },
          {
            name: 'usuario',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'usuario_nome',
            type: 'text',
          },
          {
            name: 'usuario_email',
            type: 'text',
          },
          {
            name: 'valor',
            type: 'number',
          },
          {
            name: 'historico',
            type: 'text',
          },
          {
            name: 'conta_info',
            type: 'text',
          },
          {
            name: 'detalhes',
            type: 'json',
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_audit_lanc_empresa ON auditoria_lancamentos (empresa)',
          'CREATE INDEX idx_audit_lanc_id ON auditoria_lancamentos (lancamento_id)',
          'CREATE INDEX idx_audit_lanc_created ON auditoria_lancamentos (created)',
        ],
      })
      app.save(auditoriaCol)
    }

    // 3. Criar usuário de demonstração para o perfil Financeiro
    try {
      let targetEmpresaId = ''
      try {
        const molare = app.findFirstRecordByData('empresas', 'cnpj', '59963899000190')
        targetEmpresaId = molare.id
      } catch (_) {
        const todasEmpresas = app.findAllRecords('empresas')
        if (todasEmpresas && todasEmpresas.length > 0) {
          targetEmpresaId = todasEmpresas[0].id
        }
      }

      try {
        const financeiroUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'financeiro@molare.com.br',
        )
        financeiroUser.set('role', 'financeiro')
        if (targetEmpresaId) financeiroUser.set('empresa', targetEmpresaId)
        financeiroUser.set('ativo', true)
        app.save(financeiroUser)
      } catch (_) {
        const finUser = new Record(usersCol)
        finUser.setEmail('financeiro@molare.com.br')
        finUser.setPassword('Financeiro@2026')
        finUser.setVerified(true)
        finUser.set('name', 'Analista Financeiro Molare')
        finUser.set('role', 'financeiro')
        if (targetEmpresaId) finUser.set('empresa', targetEmpresaId)
        finUser.set('ativo', true)
        app.save(finUser)
      }
    } catch (err) {
      console.log('Aviso ao semear usuário financeiro:', err)
    }
  },
  (app) => {
    try {
      const auditoriaCol = app.findCollectionByNameOrId('auditoria_lancamentos')
      app.delete(auditoriaCol)
    } catch (_) {}

    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const roleField = usersCol.fields.getByName('role')
      if (roleField) {
        roleField.values = ['admin', 'empresa']
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
