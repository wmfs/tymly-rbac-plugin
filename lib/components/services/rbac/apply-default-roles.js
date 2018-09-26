const debug = require('debug')('rbac')

function isString (s) { return typeof s === 'string' }
function isNotNull (o) { return !!o }

function ensureUserRoles (userId, roleIds, roleMembershipModel) {
  if (!Array.isArray(roleIds)) {
    roleIds = [ roleIds ]
  }

  const roleUpserts = roleIds
    .filter(isNotNull)
    .filter(isString)
    .map(roleId => {
      debug(`Adding user '${userId}' into role '${roleId}'`)
      return roleMembershipModel.upsert({
        roleId: roleId,
        memberType: 'user',
        memberId: userId
      },
      {}
      )
    })

  return Promise.all(roleUpserts)
} // ensureUserRoles

function applyDefaultRoles (defaultUsers, roleMembershipModel) {
  if (!defaultUsers) {
    return
  } // if ...

  const roleUpdates =
    Object.entries(defaultUsers)
      .map(([userId, roles]) => ensureUserRoles(userId, roles, roleMembershipModel))

  return Promise.all(roleUpdates)
} // applyDefaultRoles

module.exports = { applyDefaultRoles, ensureUserRoles }
