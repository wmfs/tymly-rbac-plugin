/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('@wmfs/tymly')
const path = require('path')

describe('State machine restrictions tests', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  let tymlyService
  let rbac
  let rbacAdmin

  describe('setup', () => {
    it('fire up Tymly', async () => {
      const tymlyServices = await tymly.boot(
        {
          pluginPaths: [
            path.resolve(__dirname, '../'),
            path.resolve(__dirname, './fixtures/plugins/test-plugin')
          ],
          blueprintPaths: [
            path.resolve(__dirname, './fixtures/blueprints/website-blueprint')
          ],
          config: {
            caches: {
              userMemberships: { max: 500 }
            }
          }
        }
      )

      tymlyService = tymlyServices.tymly
      rbac = tymlyServices.rbac
      rbac.debug()
      rbacAdmin = tymlyServices.rbacAdmin
    })

    it('set up roles', async () => {
      await rbacAdmin.ensureUserRoles('boss', 'tymlyTest_boss')
      await rbacAdmin.ensureUserRoles('test_dev', 'tymlyTest_developer')
      await rbacAdmin.ensureUserRoles('spaceman', ['space_cadet', 'IRRELEVANT'])
    })
  })

  const defaultAllowed = [
    ['tymlyTest_createPost_1_0', 'create', 'loggedInUser'],
    ['tymlyTest_createPost_1_0', 'cancel', 'test_dev'],
    ['tymlyTest_deletePost_1_0', 'create', 'boss'],
    ['tymlyTest_deletePost_1_0', 'cancel', 'boss']
  ]

  const defaultNotAllowed = [
    ['tymlyTest_createPost_1_0', 'create', null],
    ['tymlyTest_createPost_1_0', 'cancel', 'loggedInUser'],
    ['tymlyTest_deletePost_1_0', 'create', 'test_dev'],
    ['tymlyTest_deletePost_1_0', 'cancel', 'loggedInUser']
  ]

  const stateMachinesPermissions = [
    [
      'stateMachine',
      'tymlyTest_createPost_1_0',
      {
        create: ['$authenticated'],
        cancel: ['tymlyTest_developer', 'tymlyTest_teamLeader', 'tymlyTest_boss'],
        get: ['tymlyTest_tymlyTestReadOnly'],
        '*': ['tymlyTest_tymlyTestAdmin']
      }
    ],
    [
      'stateMachine',
      'tymlyTest_deletePost_1_0',
      {
        create: ['tymlyTest_teamLeader', 'tymlyTest_boss'],
        cancel: ['tymlyTest_boss'],
        get: ['tymlyTest_tymlyTestReadOnly'],
        '*': ['tymlyTest_tymlyTestAdmin']
      }
    ],
    [
      'stateMachine',
      'non-existent-state-machine',
      {
        get: ['tymlyTest_tymlyTestReadOnly'],
        '*': ['tymlyTest_tymlyTestAdmin']
      }
    ],
    [
      'trouserPress',
      'corby_3300',
      {}
    ]
  ]

  describe('default permissions, set in the state machine definitions', () => {
    describe('verify state machine permissions', () => {
      for (const [resourceType, stateMachineName, permissions] of stateMachinesPermissions) {
        it(`${resourceType}/${stateMachineName}`, () => {
          const rule = rbacAdmin.permissionsOn(resourceType, stateMachineName)
          expect(rule).to.eql(permissions)
        })
      }
    })

    actionVerification(defaultAllowed, defaultNotAllowed)
  }) // describe default restrictions

  describe('$authorised -> stateMachine -> * -> create', () => {
    describe('grant permission', () => {
      it('set permission', async () => {
        await rbacAdmin.grantPermission(
          '$authenticated',
          'stateMachine',
          '*',
          'create'
        )
        await rbacAdmin.refreshRbacIndex()
      })

      describe('verify permissions', () => {
        for (const [resourceType, stateMachineName, rawPermissions] of stateMachinesPermissions) {
          const permissions = Object.assign({}, rawPermissions)
          if (resourceType === 'stateMachine') {
            permissions.create = rawPermissions.create ? [...rawPermissions.create] : []
            if (!permissions.create.includes('$authenticated')) {
              permissions.create.push('$authenticated')
            }
          }

          it(`${resourceType}/${stateMachineName}`, () => {
            const rule = rbacAdmin.permissionsOn(resourceType, stateMachineName)
            expect(rule).to.eql(permissions)
          })
        }
      })

      actionVerification(
        [...defaultAllowed, ...defaultNotAllowed.filter(([sm, a, u]) => a === 'create' && u !== null)],
        defaultNotAllowed.filter(([sm, a, u]) => !(a === 'create' && u !== null))
      )
    })

    describe('remove permission again', () => {
      it('remove permission', async () => {
        await rbacAdmin.removePermission(
          '$authenticated',
          'stateMachine',
          '*',
          'create'
        )
        await rbacAdmin.refreshRbacIndex()
      })
      describe('verify state machine permissions', () => {
        for (const [resourceType, stateMachineName, permissions] of stateMachinesPermissions) {
          it(`${resourceType}/${stateMachineName}`, () => {
            const rule = rbacAdmin.permissionsOn(resourceType, stateMachineName)
            expect(rule).to.eql(permissions)
          })
        }
      })

      actionVerification(defaultAllowed, defaultNotAllowed)
    }) // remove ...
  })

  describe('tymlyTestReadOnly -> stateMachine -> * -> get', () => {
    it('remove pre-defined permission', async () => {
      await rbacAdmin.removePermission(
        'tymlyTest_tymlyTestReadOnly',
        'stateMachine',
        '*',
        'get'
      )
      await rbacAdmin.refreshRbacIndex()
    })
    describe('verify state machine permissions', () => {
      for (const [resourceType, stateMachineName, rawPermissions] of stateMachinesPermissions) {
        const permissions = Object.assign({}, rawPermissions)
        delete permissions.get
        it(`${resourceType}/${stateMachineName}`, () => {
          const rule = rbacAdmin.permissionsOn(resourceType, stateMachineName)
          expect(rule).to.eql(permissions)
        })
      }
    })
  })

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })

  /// ////////////
  function actionVerification (allowed, notAllowed) {
    const testGroups = [
      ['authorised', true, allowed],
      ['not authorised', false, notAllowed]
    ]

    for (const [label, outcome, tests] of testGroups) {
      describe(`${label} actions`, () => {
        for (const [stateMachineName, action, userId] of tests) {
          it(`${stateMachineName} ${action} by ${userId}`, async () => {
            expect(
              await rbac.checkAuthorization(
                userId,
                null, // ctx
                'stateMachine', // resourceType
                stateMachineName,
                action
              )
            ).to.equal(outcome)
          })
        } // for ...
      }) // describe ...
    } // for ...
  } // actionVerification ...
})
