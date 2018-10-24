const { applyDefaultRoles, ensureUserRoles } = require('./apply-default-roles')
const applyDefaultBlueprintDocs = require('./apply-default-blueprint-docs')
const loadRbacIndex = require('./refresh-index')
const { findUserRoles, findRoleUsers } = require('./find-user-roles')
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

  describeRole (roleId) {
    if (builtInRoles.includes(roleId)) {
      return {
        'description': 'Built in',
        'label': roleId,
        'roleId': roleId
      }
    }

    return this.roleModel.findOne({
      where: {
        roleId: { equals: roleId }
      }
    })
  } // describeRole

  permissionsOn(resourceType, resourceName) {
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

  async grantPermission(roleId, resourceType, resourceName, action) {
    if (resourceType !== 'stateMachine') {
      throw new Error('Only support stateMachine resources for now')
    }

    const currentPermissions = await this.permissionModel.findOne({
        where: {
          stateMachineName: { equals: resourceName },
          roleId: { equals: roleId }
        }
      })
    const grants = currentPermissions ? currentPermissions.allows : [ ]
    if (grants.includes(action)) {
      // already granted
      return
    }
    grants.push(action)

    await this.permissionModel.upsert({
      stateMachineName: resourceName,
      roleId: roleId,
      allows: grants
    })
  } // grantPermission
} // RbacAdmin

async function makeRbacAdmin (rbacService, options) {
  const rbacAdmin = new RbacAdmin()
  await rbacAdmin.init(rbacService, options)
  return rbacAdmin
} // makeRbacAdmin

function combinePermissions(specific = [], generic = []) {
  const combined = [
    ...specific,
    ...generic
  ]
  const uniqed = [...new Set(combined)]
  return uniqed
} // combinePermissions

module.exports = makeRbacAdmin
