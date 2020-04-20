class ListRoles {
  init (resourceConfig, env) {
    this.rbacAdmin = env.bootedServices.rbacAdmin
  }

  async run (event, context) {
    const allRoles = await this.rbacAdmin.listRoles()

    const roleDescriptions = {}
    for (const role of allRoles) {
      roleDescriptions[role] = await this.rbacAdmin.describeRole(role)
      delete roleDescriptions[role].roleId
    }

    context.sendTaskSuccess(roleDescriptions)
  }
}

module.exports = ListRoles
