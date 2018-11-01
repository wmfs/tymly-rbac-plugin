class RefreshPermissions {
  init (resourceConfig, env, callback) {
    this.rbacAdmin = env.bootedServices.rbacAdmin
    callback(null)
  } // init

  run (event, context) {
    this.rbacAdmin.refreshRbacIndex()

    context.sendTaskSuccess()
  } // run
} // RefreshPermissions

module.exports = RefreshPermissions