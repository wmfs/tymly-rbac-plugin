module.exports = function searchPermissions () {
  return async function (env, event) {
    const { models, client } = env.bootedServices.storage
    const model = models.tymly_permission

    const stateMachine = event.stateMachine ? event.stateMachine.trim() : null
    const roleId = event.roleId ? event.roleId.trim() : null

    const limit = 10
    const page = event.page || 1
    const offset = (page - 1) * limit

    const where = {}

    if (stateMachine) where.stateMachineName = { equals: stateMachine }
    if (roleId) where.roleId = { equals: roleId }

    const opts = {
      limit,
      offset,
      orderBy: ['-modified']
    }

    let countSql = 'select count(*) from tymly.permission'

    if (Object.keys(where).length) {
      opts.where = where
      const columns = {
        stateMachineName: 'state_machine_name',
        roleId: 'role_id'
      }
      countSql += ` where ${Object.entries(where).map(([k, v]) => `${columns[k]} = '${v.equals}'`).join(' and ')}`
    }

    const results = await model.find(opts)
    const { rows: countResults } = await client.query(countSql)
    const totalHits = countResults[0].count
    const totalPages = Math.ceil(totalHits / limit)

    return {
      page,
      totalPages,
      results,
      totalHits
    }
  }
}
