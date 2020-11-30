module.exports = function () {
  return async function roleMembershipsApplyLaunches (event) {
    event.roleMemberships = event.roleMemberships.map(r => {
      r.launches = [{
        stateMachineName: 'tymly_removeRoleMembership_1_0',
        title: 'Remove',
        input: {
          roleId: r.roleId,
          memberType: r.memberType,
          memberId: r.memberId
        }
      }]

      return r
    })

    return event
  }
}
