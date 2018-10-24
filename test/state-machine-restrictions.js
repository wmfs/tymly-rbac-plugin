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
    it('fire up Tymly', function (done) {
      tymly.boot(
        {
          pluginPaths: [
            path.resolve(__dirname, '../'),
            require.resolve('@wmfs/tymly-pg-plugin')
          ],
          blueprintPaths: [
            path.resolve(__dirname, './fixtures/blueprints/website-blueprint')
          ],
          config: {
            caches: {
              userMemberships: { max: 500 }
            }
          }
        },
        function (err, tymlyServices) {
          expect(err).to.eql(null)
          tymlyService = tymlyServices.tymly
          rbac = tymlyServices.rbac
          rbac.debug()
          rbacAdmin = tymlyServices.rbacAdmin
          done()
        }
      )
    })

    it('set up roles', async () => {
      await rbacAdmin.ensureUserRoles('boss', 'tymlyTest_boss')
      await rbacAdmin.ensureUserRoles('test_dev', 'tymlyTest_developer')
      await rbacAdmin.ensureUserRoles('spaceman', ['space_cadet', 'IRRELEVANT'])
    })

  })

  describe('default permissions, set in the state machine definitions', () => {
    const stateMachinesPermissions = [
      [
        'stateMachine',
        'tymlyTest_createPost_1_0', {
          create: ['$authenticated'],
          cancel: ['tymlyTest_developer', 'tymlyTest_teamLeader', 'tymlyTest_boss'],
          get: ['tymlyTest_tymlyTestReadOnly'],
          '*': ['tymlyTest_tymlyTestAdmin']
        }
      ],
      [
        'stateMachine',
        'tymlyTest_deletePost_1_0', {
          create: ['tymlyTest_teamLeader', 'tymlyTest_boss'],
          cancel: ['tymlyTest_boss'],
          get: ['tymlyTest_tymlyTestReadOnly'],
          '*': ['tymlyTest_tymlyTestAdmin']
        }
      ],
      [
        'stateMachine',
        'non-existent-state-machine', {
          get: ['tymlyTest_tymlyTestReadOnly'],
          '*': ['tymlyTest_tymlyTestAdmin']
        }
      ],
      [
        'trouserPress',
        'corby_3300',
        { }
      ]
    ]

    for (const [resourceType, stateMachineName, permissions] of stateMachinesPermissions) {
      it(`verify ${resourceType}/${stateMachineName} restrictions`, () => {
        const rule = rbacAdmin.permissionsOn(resourceType, stateMachineName)
        expect(rule).to.eql(permissions)
      })
    }

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

    const defaultTests = [
      ['authorised', true, defaultAllowed],
      ['not authorised', false, defaultNotAllowed]
    ]

    for (const [label, outcome, tests] of defaultTests) {
      describe(label, () => {
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
  }) // describe default restrictions

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })
})
