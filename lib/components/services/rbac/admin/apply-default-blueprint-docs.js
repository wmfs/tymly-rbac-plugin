function makeTemplateRoleDoc (docId, docSource) {
  return {
    roleId: docId,
    label: docSource.label,
    description: docSource.description
  }
} // makeTemplateRoleDoc

function makePermissionDoc (docId, docSource) {
  return {
    stateMachineName: docSource.stateMachineName,
    roleId: docSource.roleId,
    allows: docSource.allows
  }
} // makePermissionDoc

function makeRoleMembershipDoc (docId, docSource) {
  return {
    roleId: docSource.templateRoleId,
    memberType: 'role',
    memberId: docSource.roleMemberId
  }
} // makeRoleMembershipDoc

function gatherRoleTemplates (templateRoles, roleModel, roleMembershipModel, permissionModel) {
  // Grab role-templates, default role-memberships and default role-grants
  // ---------------------------------------------------------------------

  const docTasks = []

  if (!templateRoles) {
    return docTasks
  }

  for (const [templateRoleId, templateRole] of Object.entries(templateRoles)) {
    docTasks.push({
      domain: 'templateRole',
      docId: templateRoleId,
      docSource: templateRole,
      dao: roleModel,
      docMaker: makeTemplateRoleDoc
    })

    for (const grant of (templateRole.grants || [])) {
      grant.roleId = templateRoleId
      docTasks.push({
        domain: 'roleGrant',
        docId: templateRoleId + '_' + grant.stateMachineName,
        docSource: grant,
        dao: permissionModel,
        docMaker: makePermissionDoc
      })
    }

    for (const roleMemberId of (templateRole.roleMemberships || [])) {
      docTasks.push({
        domain: 'roleMembership',
        docId: templateRoleId + '_' + roleMemberId,
        docSource: {
          templateRoleId,
          roleMemberId: templateRole.namespace + '_' + roleMemberId
        },
        dao: roleMembershipModel,
        docMaker: makeRoleMembershipDoc
      })
    }
  }

  return docTasks
} // gatherRoleTemplates

function gatherStateMachineRestrictions (stateMachines, permissionModel) {
  // Grab restrictions from state machines
  // -------------------------------------

  const docTasks = []

  if (!stateMachines) {
    return docTasks
  }

  for (const [name, stateMachine] of Object.entries(stateMachines)) {
    for (const restriction of (stateMachine.restrictions || [])) {
      restriction.stateMachineName = name
      docTasks.push({
        domain: 'stateMachineRestriction',
        docId: name + '_' + restriction.roleId,
        docSource: restriction,
        dao: permissionModel,
        docMaker: makePermissionDoc
      })
    }
  }

  return docTasks
} // gatherStateMachineRestrictions

const UPSERT_CONCURRENCY = 10

const KEY_FIELDS = {
  templateRole: ['roleId'],
  roleGrant: ['roleId', 'stateMachineName'],
  stateMachineRestriction: ['roleId', 'stateMachineName'],
  roleMembership: ['roleId', 'memberType', 'memberId']
}

function keyOf (doc, keyFields) {
  return JSON.stringify(keyFields.map(f => doc[f]))
} // keyOf

function normalise (value) {
  return value === undefined || value === null ? null : value
} // normalise

function isUnchanged (doc, existing) {
  if (!existing) return false
  return Object.keys(doc).every(field =>
    JSON.stringify(normalise(doc[field])) === JSON.stringify(normalise(existing[field]))
  )
} // isUnchanged

async function runWithConcurrency (items, limit, fn) {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
} // runWithConcurrency

module.exports = async function applyBlueprintDocs (
  blueprintDocs,
  blueprintComponents,
  roleModel,
  roleMembershipModel,
  permissionModel) {
  const roleTemplateTasks = gatherRoleTemplates(
    blueprintComponents.templateRoles,
    roleModel,
    roleMembershipModel,
    permissionModel
  )

  const restrictionTasks = gatherStateMachineRestrictions(
    blueprintComponents.stateMachines,
    permissionModel
  )

  const docTasks = [...roleTemplateTasks, ...restrictionTasks]

  // Group docs by model, de-duplicating on primary key. Later docs win,
  // matching the old one-at-a-time behaviour where the last upsert stuck.
  const docsByModel = new Map()
  for (const task of docTasks) {
    const keyFields = KEY_FIELDS[task.domain]
    const doc = task.docMaker(task.docId, task.docSource)
    if (!docsByModel.has(task.dao)) {
      docsByModel.set(task.dao, { keyFields, docs: new Map() })
    }
    const entry = docsByModel.get(task.dao)
    const key = keyOf(doc, keyFields)
    entry.docs.delete(key) // keep insertion order = last write
    entry.docs.set(key, doc)
  }

  for (const [dao, { keyFields, docs }] of docsByModel) {
    // One read per table instead of one write per doc - on a normal boot
    // almost everything is already in place, so very little needs writing.
    const existingRows = await dao.find({})
    const existing = new Map(existingRows.map(row => [keyOf(row, keyFields), row]))

    const changed = [...docs.entries()]
      .filter(([key, doc]) => !isUnchanged(doc, existing.get(key)))
      .map(([, doc]) => doc)

    await runWithConcurrency(changed, UPSERT_CONCURRENCY, doc => dao.upsert(doc, {}))
  }
}
