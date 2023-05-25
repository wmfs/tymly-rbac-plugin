const builtInRoles = require('@wmfs/rbac').builtInRoles

function isString (s) { return typeof s === 'string' }
function isNotNull (o) { return !!o }
function isNotBuiltIn (s) { return !builtInRoles.includes(s) }

function ensureRoles (id, roleIds, type, roleMembershipModel, logger) {
  if (!Array.isArray(roleIds)) {
    roleIds = [roleIds]
  }

  const roleUpserts = roleIds
    .filter(isNotNull)
    .filter(isString)
    .filter(isNotBuiltIn)
    .map(roleId => {
      logger.debug(`Adding ${type} '${id}' into role '${roleId}'`)
      return roleMembershipModel.upsert({
        roleId,
        memberType: type,
        memberId: id
      },
      {}
      )
    })

  return Promise.all(roleUpserts)
} // ensureUserRoles

function ensureUserRoles (userId, roleIds, roleMembershipModel, logger) {
  return ensureRoles(userId, roleIds, 'user', roleMembershipModel, logger)
} // ensureUserRoles

async function clearUserRoles (userId, roleMembershipModel) {
  const existingRoles = await roleMembershipModel.find({
    where: {
      memberId: { equals: userId },
      memberType: { equals: 'user' }
    }
  })
  for (const { roleId, memberId } of existingRoles) {
    await roleMembershipModel.destroyById([roleId, 'user', memberId])
  }
} // clearUserRoles

async function ensureRoleRoles (roleId, roleIds, roleMembershipModel, logger) {
  const existingRoles = await roleMembershipModel.find({
    where: {
      roleId: { equals: roleId },
      memberType: { equals: 'role' }
    }
  })
  for (const { roleId, memberId } of existingRoles) {
    await roleMembershipModel.destroyById([roleId, 'role', memberId])
  }

  const updates = roleIds
    .filter(isNotNull)
    .filter(isString)
    .filter(isNotBuiltIn)
    .map(inheritedId =>
      ensureRoles(inheritedId, [roleId], 'role', roleMembershipModel, logger)
    )
  return Promise.all(updates)
} // ensureRoleRoles

module.exports = { ensureUserRoles, ensureRoleRoles, clearUserRoles }
