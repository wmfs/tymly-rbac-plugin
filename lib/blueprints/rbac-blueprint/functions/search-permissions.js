module.exports = function searchPermissions () {
  return async function (env, event) {
    const model = env.bootedServices.storage.models.tymly_permission
    event.stateMachineName = event.stateMachine
    const where = constructWhere(event, ['stateMachineName', 'roleId'])
    return model.search({ where, page: event.page, limit: 10, orderBy: ['-modified'] })
  }
}

function constructWhere (input, fields) {
  const where = {}

  fields.forEach(field => {
    const value = input[field]
    if (value && typeof value === 'string' && value.trim().length) {
      where[field] = { equals: value.trim() }
    }
  })

  return where
}
