const makeRbacAdmin = require('./admin')

class RbacService {
  async boot (options) {
    this.logger = options.bootedServices.logger.child('service:rbac')
    this.messages = options.messages

    const caches = options.bootedServices.caches
    caches.defaultIfNotInConfig('userMemberships', 500)
    this.userMembershipsCache = caches.userMemberships

    this.rbacAdmin = await makeRbacAdmin(this, options)
    options.bootedServices.rbacAdmin = this.rbacAdmin

    this.userInfo = options.bootedServices.userInfo
  } // boot

  get rbac () { return this.rbac_ }
  set rbac (rbac) {
    this.rbac_ = rbac
    this.resetCache()
  }

  /// ///////////////////////////////////////////////////
  /**
   * Checks the supplied credentials against the internal RBAC index
   * @param {string} userId A userId to check (used for dynamic checks such as _'allow update as long as userId matches with the author of target document'_)
   * @param {Object} ctx A Tymly context (optional)
   * @param {Array<string>} roles An array of roleIds
   * @param {string} resourceType The type of resource to authorize against (e.g. `flow`)
   * @param {string} resourceName The name of the resource that the credentials are being checked against (e.g. `flow tymlyTest_cat_1_0 startNewTymly`)
   * @param {string} action And the name of action these credentials are wanting to perform (e.g. `startNewTymly`)
   * @returns {boolean} Indicates if the provided credentials allow the specified action to be applied to the named resource (`true`) or not (`false`)
   * @example
   * var allowed = rbac.getUserIdFromContext(
   *   'Dave', // userId
   *   null, // ctx
   *   'flow', // resourceType,
   *   'tymlyTest_cat_1_0', // resourceName,
   *   'startNewTymly' // action
   * ) // Returns true/false
   */
  async checkAuthorization (userId, ctx, resourceType, resourceName, action) {
    const uid = cleanUserId(userId)
    const ownerId = cleanUserId(ctx)

    const roles = await this.listUserRoles(uid)

    return this.rbac.checkRoleAuthorization(uid, ownerId, roles, resourceType, resourceName, action)
  } // checkRoleAuthorization

  /// //////////////////////////////////////
  /**
   * Returns with all the roles currently assigned to the specified userId
   * @param {string} userId Specifies which useId to return a list of roles for
   * @param {Function} callback Called with an array of roleId strings that are assigned to the specified userId
   * @returns {Promise<array of roles>}
   * @example
   * users.getUserRoles('Dave').then(roles => {
   *     // roles === ['tymlyTest_tymlyTestAdmin']
   *   }
   * )
   */
  async listUserRoles (userId) {
    const cachedRoles = this.userMembershipsCache.get(userId)
    if (Array.isArray(cachedRoles)) return cachedRoles

    const localRoles = await this.rbacAdmin.listUserRoles(userId)
    const userRoles = await rolesFromUserId(this.userInfo, userId)

    const roles = combine(localRoles, userRoles)

    this.userMembershipsCache.set(userId, roles)
    return roles
  } // listUserRoles

  resetCache () {
    this.userMembershipsCache.reset()
  }

  debug () {
    this.logger.debug('')
    this.logger.debug('RBAC Index\n----------')

    for (const [domainName, domain] of Object.entries(this.rbac.index)) {
      for (const [stateMachineName, stateMachine] of Object.entries(domain)) {
        for (const [actionName, action] of Object.entries(stateMachine)) {
          const path = [domainName, stateMachineName, actionName, JSON.stringify(action)].join(' -> ')
          this.logger.debug('  ', path)
        }
      }
    }
    this.logger.debug('')

    if (this.rbac.unknownRoles.length) {
      this.logger.debug('Undefined roles\n---------------')
      this.logger.debug('  ', this.rbac.unknownRoles.join(', '))
    }
  } // debug
} // RbacService

async function rolesFromUserId (userInfo, userId) {
  if (!userInfo) return []

  try {
    return await userInfo.rolesFromUserId(userId)
  } catch (err) {
    console.log(`Ignoring error in rolesFromUserId: ${err.toString()}`)
    return []
  }
} // rolesFromUserId

function combine (oneArray, anotherArray) {
  const combined = [
    ...oneArray,
    ...anotherArray
  ]
  const uniqed = [...new Set(combined)]
  return uniqed
} // combine

/// /////////////////
function cleanUserId (userId) {
  if (userId && userId.userId) {
    return cleanUserId(userId.userId)
  }

  return (typeof userId === 'string') ? userId : null
} // cleanUserId

module.exports = {
  serviceClass: RbacService,
  bootBefore: ['statebox'],
  bootAfter: ['caches', 'storage']
}
