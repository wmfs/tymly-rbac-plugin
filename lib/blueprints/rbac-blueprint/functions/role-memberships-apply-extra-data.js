module.exports = function () {
  return async function roleMembershipsApplyExtraData (event, env) {
    const roleMemberships = []

    for (const r of event.roleMemberships) {
      r.launches = [{
        stateMachineName: 'tymly_removeRoleMembership_1_0',
        title: 'Remove',
        input: {
          roleId: r.roleId,
          memberType: r.memberType,
          memberId: r.memberId
        }
      }]

      try {
        r.memberEmail = await env.bootedServices.userInfo.emailFromUserId(r.memberId)
      } catch (err) {
        r.memberEmail = 'N/A'
      }

      roleMemberships.push(r)
    }

    event.roleMemberships = roleMemberships

    return event
  }
}
