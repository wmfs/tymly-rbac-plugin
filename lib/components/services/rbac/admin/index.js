const applyDefaultRoles = require('./apply-default-roles')
const applyDefaultBlueprintDocs = require('./apply-default-blueprint-docs')
const loadRbacIndex = require('./refresh-index')
const { findUserRoles, findRoleUsers } = require('./find-user-roles')
const { ensureUserRoles, ensureRoleRoles, clearUserRoles } = require('./ensure-role-membership')
const builtInRoles = require('@wmfs/rbac').builtInRoles

class RbacAdmin {
  async init (rbacService, options) {
    this.rbacService = rbacService

    this.messages = options.messages
    this.roleModel = options.bootedServices.storage.models.tymly_role
    this.roleMembershipModel = options.bootedServices.storage.models.tymly_roleMembership
    this.permissionModel = options.bootedServices.storage.models.tymly_permission

    this.messages.info('Applying default roles')
    await applyDefaultRoles(
      options.config.defaultUsers,
      this.roleMembershipModel
    )

    this.messages.info('Applying unknown Blueprint documents')
    await applyDefaultBlueprintDocs(
      options.bootedServices.blueprintDocs,
      options.blueprintComponents,
      this.roleModel,
      this.roleMembershipModel,
      this.permissionModel
    )

    await this.refreshRbacIndex()
  } // constructor

  /// ///////////////////
  ensureUserRoles (userId, roleIds) {
    return ensureUserRoles(userId, roleIds, this.roleMembershipModel)
  } // ensureUserRoles

  clearUserRoles (userId) {
    return clearUserRoles(userId, this.roleMembershipModel)
  } // clearUserRoles

  ensureRoleMembers (roleId, userIds) {
    if (!Array.isArray(userIds)) {
      userIds = [userIds]
    }

    roleId = [roleId]

    const updates = userIds.map(userId => this.ensureUserRoles(userId, roleId))
    return Promise.all(updates)
  } // ensureRoleMembers

  async refreshRbacIndex () {
    this.messages.info('Refreshing RBAC index')
    this.rbac = await loadRbacIndex(
      this.roleModel,
      this.roleMembershipModel,
      this.permissionModel
    )

    this.rbacService.rbac = this.rbac
  } // refreshRbacIndex

  listUserRoles (userId) {
    return findUserRoles(userId, this.roleMembershipModel, this.rbac)
  } // listUserRoles

  listRoleUsers (roleId) {
    return findRoleUsers(roleId, this.roleMembershipModel, this.rbac)
  } // listRoleMembers

  listRoles () {
    return this.roleModel.find({})
      .then(results => results.map(r => r.roleId))
  } // listRoles

  async createRole (roleId, label, description, inherits) {
    if (roleId[0] === '$') {
      throw new Error('Role ids beginning with $ are reserved for system use.')
    }

    const desc = await findRole(this.roleModel, roleId)
    if (desc) {
      throw new Error(`Role ${roleId} already exists`)
    }

    await this.roleModel.create({
      roleId: roleId,
      label: label,
      description: description
    })
    await ensureRoleRoles(roleId, inherits, this.roleMembershipModel)
  } // createRole

  async updateRole (roleId, label, description, inherits) {
    const desc = await findRole(this.roleModel, roleId)
    if (!desc) {
      throw new Error(`Role ${roleId} does not exist`)
    }

    await this.roleModel.update(
      {
        roleId: roleId,
        label: label,
        description: description
      },
      {}
    )
    await ensureRoleRoles(roleId, inherits, this.roleMembershipModel)
  } // createRole

  async describeRole (roleId) {
    if (builtInRoles.includes(roleId)) {
      return {
        description: 'Built in',
        label: roleId,
        roleId: roleId,
        inherits: []
      }
    }

    const desc = await findRole(this.roleModel, roleId)
    if (!desc) return desc

    desc.inherits = await findInheritedRoles(this.roleMembershipModel, roleId)
    return desc
  } // describeRole

  permissionsOn (resourceType, resourceName) {
    const resourceTypePermissions = this.rbac.index[resourceType] || { }

    const specificPermissions = resourceTypePermissions[resourceName] || { }
    const genericPermissions = resourceTypePermissions['*'] || { }

    const permissions = { }
    const allActions = [...Object.keys(specificPermissions), ...Object.keys(genericPermissions)]
    for (const action of allActions) {
      permissions[action] = combinePermissions(
        specificPermissions[action],
        genericPermissions[action]
      )
    }
    return permissions
  } // permissionsOn

  async grantPermission (roleId, resourceType, resourceName, action) {
    const updateFn = grants =>
      !grants.includes(action)
        ? grants.push(action) && grants
        : false // already granted

    await updatePermission(
      this.permissionModel,
      roleId,
      resourceType,
      resourceName,
      updateFn
    )
  } // grantPermission

  async removePermission (roleId, resourceType, resourceName, action) {
    const updateFn = grants =>
      grants.includes(action)
        ? grants.filter(a => a !== action)
        : false // not granted anyway

    await updatePermission(
      this.permissionModel,
      roleId,
      resourceType,
      resourceName,
      updateFn
    )
  } // removePermission
} // RbacAdmin

async function findRole (roleModel, roleId) {
  const role = await roleModel.findOne({
    where: {
      roleId: { equals: roleId }
    }
  })
  return role
    ? {
      description: role.description,
      label: role.label,
      roleId: role.roleId
    }
    : undefined
} // findRole

async function findInheritedRoles (membershipModel, roleId) {
  const inherited = await membershipModel.find({
    where: {
      roleId: { equals: roleId },
      memberType: { equals: 'role' }
    }
  })
  return inherited.map(r => r.memberId)
} // findInheritedRoles

function stateMachinesOnlyForNow (resourceType) {
  if (resourceType !== 'stateMachine') {
    throw new Error('Only support stateMachine resources for now')
  }
} // stateMachinesOnly

async function updatePermission (permissionModel, roleId, resourceType, resourceName, updateFn) {
  stateMachinesOnlyForNow(resourceType)

  const grants = await getGrantsFor(
    permissionModel,
    roleId,
    resourceName
  )

  const revisedGrants = updateFn(grants)
  if (revisedGrants === false) return // nothing to do!

  await setGrantsFor(
    permissionModel,
    roleId,
    resourceName,
    revisedGrants
  )
} // removePermission

async function getGrantsFor (permissionModel, roleId, stateMachineName) {
  const permissions = await permissionModel.findOne({
    where: {
      roleId: { equals: roleId },
      stateMachineName: { equals: stateMachineName }
    }
  })
  return permissions ? permissions.allows : [ ]
} // getGrantsFor

function setGrantsFor (permissionModel, roleId, resourceName, grants) {
  return permissionModel.upsert(
    {
      roleId: roleId,
      stateMachineName: resourceName,
      allows: grants
    },
    { }
  )
} // setGrantsFor

function combinePermissions (specific = [], generic = []) {
  const combined = [
    ...specific,
    ...generic
  ]
  const uniqed = [...new Set(combined)]
  return uniqed
} // combinePermissions

/// ////////////////
async function makeRbacAdmin (rbacService, options) {
  const rbacAdmin = new RbacAdmin()
  await rbacAdmin.init(rbacService, options)
  return rbacAdmin
} // makeRbacAdmin

module.exports = makeRbacAdmin
