class CreateRole {
  init (resourceConfig, env) {
    this.rbacAdmin = env.bootedServices.rbacAdmin
  }

  async run (event, context) {
    const roleId = event.roleId

    if (!roleId) {
      return context.sendTaskFailure({
        error: 'CreateRole',
        cause: new Error('CreateRole needs at least roleId, and optionally label, description, inherites')
      })
    }

    const label = event.label || roleId
    const description = event.description || '<no description provided>'
    const inherits = event.inherits || []

    await this.rbacAdmin.createRole(roleId, label, description, inherits)

    context.sendTaskSuccess()
  }
}

module.exports = CreateRole
