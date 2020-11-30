class RemoveRoleMembership {
  init (resourceConfig, env) {
    this.membershipModel = env.bootedServices.rbacAdmin.roleMembershipModel
  }

  async run (event, context) {
    const { roleId, memberId, memberType } = event

    if (!roleId || !memberId || !memberType) {
      return context.sendTaskFailure({
        error: 'RemoveRoleMembership',
        cause: new Error('RemoveRoleMembership needs roleId, memberId, and memberType')
      })
    }

    await this.membershipModel.destroyById([roleId, memberType, memberId])

    context.sendTaskSuccess()
  }
}

module.exports = RemoveRoleMembership
