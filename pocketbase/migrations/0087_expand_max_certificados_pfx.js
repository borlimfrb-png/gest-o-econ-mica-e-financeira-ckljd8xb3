/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('certificados_digitais')

    const pfxField = col.fields.getByName('pfx_base64_criptografado')
    if (pfxField) {
      // Por padrão em PocketBase v0.23+, max é 5000 se não especificado.
      // Certificados A1 em base64 criptografados com AES têm entre 5KB e 60KB (até ~80.000 caracteres).
      // Expandimos para 1.000.000 caracteres para suportar com folga qualquer certificado A1 ICP-Brasil.
      pfxField.max = 1000000
    }

    const senhaField = col.fields.getByName('senha_criptografada')
    if (senhaField) {
      senhaField.max = 10000
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('certificados_digitais')
      const pfxField = col.fields.getByName('pfx_base64_criptografado')
      if (pfxField) {
        pfxField.max = 5000
      }
      const senhaField = col.fields.getByName('senha_criptografada')
      if (senhaField) {
        senhaField.max = 5000
      }
      app.save(col)
    } catch (_) {}
  },
)
