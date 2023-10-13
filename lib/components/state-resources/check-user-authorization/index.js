class CheckUserAuthorization {
  init (resourceConfig, env) {
    this.rbac = env.bootedServices.rbac
  }

  async run (event, context) {
    const { resourceType, resourceName, action } = event
    const { userId } = context

    const authorized = await this.rbac.checkAuthorization(userId, null, resourceType, resourceName, action)

    context.sendTaskSuccess({ authorized })
  }
}

module.exports = CheckUserAuthorization
