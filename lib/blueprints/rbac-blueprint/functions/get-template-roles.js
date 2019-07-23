module.exports = function (ctx) {
  return async function () {
    const choices = []

    const rbacAdmin = ctx.services.rbacAdmin
    const allRoles = await rbacAdmin.listRoles()

    for (const role of allRoles) {
      const roleDesc = await rbacAdmin.describeRole(role)
      choices.push({ title: roleDesc.label, value: role })
    }

    return choices.sort((a, b) => {
      const A = a.title.toUpperCase()
      const B = b.title.toUpperCase()
      return A > B ? 1 : (A < B ? -1 : 0)
    })
  }
}
