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
      }
    }
  }

  before('boot Tymly', done => {
    tymly.boot(
      {
        pluginPaths: [
          path.resolve(__dirname, '../')
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

  it('fetch permissions tree', async () => {
    const execDesc = await statebox.startExecution(
      {},
      'tymly_rbacPermissionsTree_1_0',
      {
        sendResponse: 'COMPLETE',
        userId: adminUser
      }
    )

    expect(execDesc.status).to.eql('SUCCEEDED')
    const tree = execDesc.ctx.permissions
    expect(tree).to.eql(expectedTree)
  })

  after('shutdown Tymly', async () => {
    await tymlyService.shutdown()
  })
})