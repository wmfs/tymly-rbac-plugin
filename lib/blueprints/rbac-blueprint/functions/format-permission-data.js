module.exports = function formatPermissionData () {
  return function (event) {
    return event.reduce((acc, curr) => {
      const foundIdx = acc.findIndex(a => a.stateMachineName === curr.stateMachineName)
      if (foundIdx === -1) {
        acc.push({ stateMachineName: curr.stateMachineName, roles: [curr.roleId] })
        // acc.push({ stateMachineName: curr.stateMachineName, roles: [{ roleId: curr.roleId, allows: curr.allows }] })
      } else {
        const found = acc[foundIdx]
        found.roles.push(curr.roleId)
        // found.roles.push({ roleId: curr.roleId, allows: curr.allows })
        acc[foundIdx] = found
      }
      return acc
    }, [])
  }
}
