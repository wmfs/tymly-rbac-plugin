class GrantRoleMembership {
  init (resourceConfig, env) {
    this.membershipModel = env.bootedServices.rbacAdmin.roleMembershipModel
  }

  async run (event, context) {
    const { roleId, memberId, memberType } = event

    if (!roleId || !memberId || !memberType) {
      return context.sendTaskFailure({
        error: 'GrantRoleMembership',
        cause: new Error('GrantRoleMembership needs roleId, memberId, and memberType')
      })
    }

    await this.membershipModel.upsert({ roleId, memberId, memberType }, {})

    context.sendTaskSuccess()
  }
}

module.exports = GrantRoleMembership
