class GrantPermission {
  init (resourceConfig, env, callback) {
    this.rbacAdmin = env.bootedServices.rbacAdmin
    callback(null)
  }

  async run (event, context) {
    const { roleId, stateMachine } = event

    if (!roleId || !stateMachine || !event.action) {
      return context.sendTaskFailure({
        error: 'GrantPermission',
        cause: new Error('GrantPermission needs roleId, stateMachineName, and action')
      })
    }

    const actions = Array.isArray(event.action) ? event.action : [ event.action ]

    for (const action of actions) {
      await this.rbacAdmin.grantPermission(roleId, 'stateMachine', stateMachine, action)
    }

    context.sendTaskSuccess()
  }
}

module.exports = GrantPermission
