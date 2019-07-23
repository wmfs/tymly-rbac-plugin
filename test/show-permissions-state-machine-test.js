/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('@wmfs/tymly')
const path = require('path')

describe('RBAC Permissions State Machine', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  let tymlyService
  let statebox

  const adminUser = 'administrator'

  const expectedTree = {
    stateMachine: {
      tymly_rbacPermissionsTree_1_0: {
        '*': ['tymly_rbacAdmin']
      },
      tymly_rbacGrantRoleMembership_1_0: {
        '*': ['tymly_rbacAdmin']
      },
      tymly_rbacGrantStateMachinePermission_1_0: {
        '*': ['tymly_rbacAdmin']
      },
      tymly_rbacRefreshPermissions_1_0: {
        '*': ['tymly_rbacAdmin']
      },
      tymly_rbacListRoles_1_0: {
        '*': ['tymly_rbacAdmin']
      },
      tymly_rbacCreateRole_1_0: {
        '*': ['tymly_rbacAdmin']
      },
      tymly_rbacGrantRoleMembershipForm_1_0: {
        '*': [ 'tymly_rbacAdmin' ]
      }
    }
  }

  before('boot Tymly', done => {
    tymly.boot(
      {
        pluginPaths: [
          path.resolve(__dirname, '../'),
          path.resolve(__dirname, './fixtures/plugins/test-plugin')
        ]
      },
      async (err, services) => {
        if (err) return done(err)

        tymlyService = services.tymly
        statebox = services.statebox

        await services.rbacAdmin.ensureUserRoles(adminUser, ['tymly_rbacAdmin'])
        services.rbac.debug()

        done()
      }
    )
  })

  describe('list and create roles', () => {
    it('list roles', async () => {
      const roles = await statebox.startExecution(
        {},
        'tymly_rbacListRoles_1_0',
        {
          sendResponse: 'COMPLETE',
          userId: adminUser
        }
      )

      expect(roles.status).to.eql('SUCCEEDED')
      expect(roles.ctx.roles).to.eql({
        'tymly_rbacAdmin': {
          label: 'rbac-admin',
          description: 'RBAC administrator',
          inherits: []
        }
      })
    })

    it('create fsOfficer role', async () => {
      const create = await statebox.startExecution(
        {
          roleId: 'fsOfficer',
          label: 'fs-officer',
          description: 'Fire Safety Officer'
        },
        'tymly_rbacCreateRole_1_0',
        {
          sendResponse: 'COMPLETE',
          userId: adminUser
        }
      )

      expect(create.status).to.eql('SUCCEEDED')
    })

    it('list updated roles', async () => {
      const roles = await statebox.startExecution(
        {},
        'tymly_rbacListRoles_1_0',
        {
          sendResponse: 'COMPLETE',
          userId: adminUser
        }
      )

      expect(roles.status).to.eql('SUCCEEDED')
      expect(roles.ctx.roles).to.eql({
        'tymly_rbacAdmin': {
          label: 'rbac-admin',
          description: 'RBAC administrator',
          inherits: []
        },
        'fsOfficer': {
          label: 'fs-officer',
          description: 'Fire Safety Officer',
          inherits: []
        }
      })
    })
  })

  describe('list and grant permissions', () => {
    it('fetch permissions tree', async () => {
      const tree = await fetchPermissionsTree()
      expect(tree).to.eql(expectedTree)
    })

    it('grant permission', async () => {
      const grant = await statebox.startExecution(
        {
          roleId: 'fsOfficer',
          stateMachineName: 'wmfs_safeAndStrong_1_0',
          action: ['create', 'cancel']
        },
        'tymly_rbacGrantStateMachinePermission_1_0',
        {
          sendResponse: 'COMPLETE',
          userId: adminUser
        }
      )
      expect(grant.status).to.eql('SUCCEEDED')
    })

    it('refresh rbac index', async () => {
      const refresh = await statebox.startExecution(
        {},
        'tymly_rbacRefreshPermissions_1_0',
        {
          sendResponse: 'COMPLETE',
          userId: adminUser
        }
      )
      expect(refresh.status).to.eql('SUCCEEDED')
    })

    it('fetch updated permissions tree', async () => {
      const tree = await fetchPermissionsTree()

      expectedTree.stateMachine.wmfs_safeAndStrong_1_0 = {
        create: ['fsOfficer'],
        cancel: ['fsOfficer']
      }

      expect(tree).to.eql(expectedTree)
    })
  })

  after('shutdown Tymly', async () => {
    await tymlyService.shutdown()
  })

  async function fetchPermissionsTree () {
    const execDesc = await statebox.startExecution(
      {},
      'tymly_rbacPermissionsTree_1_0',
      {
        sendResponse: 'COMPLETE',
        userId: adminUser
      }
    )

    expect(execDesc.status).to.eql('SUCCEEDED')
    return execDesc.ctx.permissions
  } // fetchPermissionsTree
})
