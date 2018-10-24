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

  restrictionsOn(resourceType, resourceName) {
    const specificRestrictions = this.rbac.index[resourceType][resourceName]
    const genericRestrictions = this.rbac.index[resourceType]['*']

    const restrictions = { }
    const allActions = [...Object.keys(specificRestrictions), ...Object.keys(genericRestrictions)]
    for (const action of allActions) {
      restrictions[action] = [
        ...( specificRestrictions[action] || [] ),
        ...( genericRestrictions[action] || [] )
      ]
    }
    return restrictions
  } // restrictionsOn
} // RbacAdmin

async function makeRbacAdmin (rbacService, options) {
  const rbacAdmin = new RbacAdmin()
  await rbacAdmin.init(rbacService, options)
  return rbacAdmin
} // makeRbacAdmin

module.exports = makeRbacAdmin
