const { ensureUserRoles } = require('./ensure-role-membership')

function applyDefaultRoles (defaultUsers, roleMembershipModel) {
  if (!defaultUsers) {
    return
  } // if ...

  const roleUpdates =
    Object.entries(defaultUsers)
      .map(([userId, roles]) => ensureUserRoles(userId, roles, roleMembershipModel))

  return Promise.all(roleUpdates)
} // applyDefaultRoles

module.exports = applyDefaultRoles
