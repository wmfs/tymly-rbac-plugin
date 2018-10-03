'use strict'

const Rbac = require('@wmfs/rbac')

module.exports = async function refreshRbacIndex (
  roleModel,
  roleMembershipModel,
  permissionModel) {
  const { roles, roleMemberships, permissions } = await loader(
    roleModel,
    roleMembershipModel,
    permissionModel
  )

  return new Rbac('stateMachine', roles, roleMemberships, permissions)
} // refreshRbacIndex

async function loader (
  roleModel,
  roleMembershipModel,
  permissionModel) {
  const roleMemberships =
    await roleMembershipModel.find({
      where: {
        memberType: { equals: 'role' }
      }
    })

  const permissions =
    await permissionModel.find({})

  const roles =
    await roleModel.find({})

  return { roleMemberships, permissions, roles }
} // loader
