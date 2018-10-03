const MemberId = 'memberId'
const RoleId = 'roleId'

function uniqify (array) {
  return [...new Set(array)]
}

async function findUserRoles (userId, roleMembershipModel, rbac) {
  const roleIds = await findRoleIds(userId, roleMembershipModel)

  const applicableRoles = []
  for (const roleId of roleIds) {
    const roles = rbac.inherits[roleId] || [roleId]

    applicableRoles.push(...roles)
  }
  applicableRoles.push('$everyone')

  return uniqify(applicableRoles)
} // findUserRoles

async function findRoleIds (userId, roleMembershipModel) {
  return findInRoleMembership(MemberId, userId, RoleId, roleMembershipModel)
} // findRoleIds

/// //////
async function findRoleUsers (roleId, roleMembershipModel, rbac) {
  const userIds = [ ]
  for (const inheritedRoleId of rbac.inheritedBy[roleId]) {
    userIds.push(...await findUserIds(inheritedRoleId, roleMembershipModel))
  } // for ...

  return uniqify(userIds)
} // findRoleUsers

function findUserIds (roleId, roleMembershipModel) {
  return findInRoleMembership(RoleId, roleId, MemberId, roleMembershipModel)
} // findUserIds

/// ////////////////////
async function findInRoleMembership (fieldName, fieldValue, outputField, roleMembershipModel) {
  const results = await roleMembershipModel.find({
    where: {
      memberType: { equals: 'user' },
      [fieldName]: { equals: fieldValue }
    }
  })
  return results.map(r => r[outputField])
} // findInRoleMembership

module.exports = { findUserRoles, findRoleUsers }
