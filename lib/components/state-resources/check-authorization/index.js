class CheckAuthorization {
  init (resourceConfig, env, callback) {
    this.rbac = env.bootedServices.rbac
    callback(null)
  }

  async run (event, context) {
    const { roleId, stateMachineName } = event

    const allowed = await this.rbac.checkAuthorization(roleId, null, 'stateMachine', stateMachineName, 'create')

    // console.log(`Can ${roleId} create ${stateMachineName}? ${allowed}`)
    context.sendTaskSuccess({ allowed })
  }
}

module.exports = CheckAuthorization
