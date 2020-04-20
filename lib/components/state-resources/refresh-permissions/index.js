class RefreshPermissions {
  init (resourceConfig, env) {
    this.rbacAdmin = env.bootedServices.rbacAdmin
  } // init

  run (event, context) {
    this.rbacAdmin.refreshRbacIndex()

    context.sendTaskSuccess()
  } // run
} // RefreshPermissions

module.exports = RefreshPermissions
