const dottie = require('dottie')

class PermissionsTree {
  init (resourceConfig, env) {
    this.rbacAdmin = env.bootedServices.rbacAdmin
  }

  run (event, context) {
    const permissionsTree = { }

    for (const [domainName, domain] of Object.entries(this.rbacAdmin.rbac.index)) {
      for (const [resourceName, resource] of Object.entries(domain)) {
        for (const [actionName, action] of Object.entries(resource)) {
          const path = `${domainName}.${resourceName}.${actionName}`
          dottie.set(permissionsTree, path, action)
        }
      }
    }

    context.sendTaskSuccess(permissionsTree)
  }
}

module.exports = PermissionsTree
