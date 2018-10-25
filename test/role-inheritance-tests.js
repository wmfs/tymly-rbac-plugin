/* eslint-env mocha */

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
const tymly = require('@wmfs/tymly')
const path = require('path')

describe('Role Inheritance tests', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  let tymlyService
  let rbac
  let rbacAdmin

  describe('setup', () => {
    it('fire up Tymly', function (done) {
      tymly.boot(
        {
          pluginPaths: [
            path.resolve(__dirname, '../')
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
      await rbacAdmin.ensureUserRoles('leader', 'tymlyTest_teamLeader')
      await rbacAdmin.ensureUserRoles('test_dev', 'tymlyTest_developer')
      await rbacAdmin.ensureUserRoles('spaceman', ['space_cadet', 'IRRELEVANT'])
    })
  })

  const defaultAllowed = [
    ['tymlyTest_createPost_1_0', 'create', 'spaceman'],
    ['tymlyTest_createPost_1_0', 'cancel', 'test_dev'],
    ['tymlyTest_createPost_1_0', 'cancel', 'boss'],
    ['tymlyTest_deletePost_1_0', 'create', 'boss'],
    ['tymlyTest_deletePost_1_0', 'create', 'leader'],
    ['tymlyTest_deletePost_1_0', 'cancel', 'boss'],
    ['tymlyTest_purgeSite_1_0', 'create', 'boss'],
    ['tymlyTest_readPost_1_0', 'create', 'boss']
  ]

  const allowedIfDeveloper = [
    ['tymlyTest_createPost_1_0', 'cancel', 'spaceman'],
  ]
  const allowedIfTeamLeader = [
    ['tymlyTest_deletePost_1_0', 'create', 'spaceman'],
    ['tymlyTest_createPost_1_0', 'cancel', 'spaceman'],
  ]
  const allowedIfBoss = [
    ['tymlyTest_deletePost_1_0', 'cancel', 'spaceman'],
  ]
  const allowedIfReadOnly = [
    ['tymlyTest_createPost_1_0', 'get', 'spaceman'],
    ['tymlyTest_deletePost_1_0', 'get', 'spaceman'],
    ['tymlyTest_purgeSite_1_0', 'get', 'spaceman'],
    ['tymlyTest_readPost_1_0', 'get', 'spaceman']
  ]

  describe('default role inheritance, set by template-roles', () => {
    it('describe space cadet', async () => {
      const role = await rbacAdmin.describeRole('space_cadet')
      expect(role).to.be.undefined()
    })

    actionVerification(
      defaultAllowed,
      [
        ...allowedIfDeveloper,
        ...allowedIfTeamLeader,
        ...allowedIfBoss,
        ...allowedIfReadOnly
      ]
    )
  }) // describe default restrictions

  describe('create space_cadet role, inheriting developer', () => {
    it ('create space_cadet', async () => {
      await rbacAdmin.createRole(
        'space_cadet',
        'SpaceCadet',
        'From The Cosmos!',
        [ 'tymlyTest_developer']
      )
      await rbacAdmin.refreshRbacIndex()
    })

    it('describe space_cadet', async () => {
      const role = await rbacAdmin.describeRole('space_cadet')
      expect(role).to.not.be.undefined()
    })

    actionVerification(
      [
        ...defaultAllowed,
        ...allowedIfDeveloper
      ],
      [
        ...allowedIfDeveloper,
        ...allowedIfTeamLeader,
        ...allowedIfBoss,
        ...allowedIfReadOnly
      ]
    )
  })

  describe('create role boundaries', () => {
    it('can not inherit a built-in role', async () => {
      await rbacAdmin.createRole(
        'dev_space_cadet',
        'SpaceCadet',
        'From The Cosmos!',
        [ 'tymlyTest_developer', '$authenticated' ]
      )
      const dsc = rbacAdmin.describeRole('dev_space_cadet')
      expect(dsc.inherits).to.eql(['tymlyTest_developer'])

      await rbacAdmin.createRole(
        'base_cadet',
        'SpaceCadet',
        'From The Cosmos!',
        [ '$authenticated' ]
      )
      const bc = rbacAdmin.describeRole('base_cadet')
      expect(bc.inherits).to.eql([])
    })

    it('role id must not start with $', () => {
      expect(async () => {
        await rbacAdmin.createRole(
          '$space_cadet',
          'SpaceCadet',
          'From The Cosmos!',
          [ 'tymlyTest_developer' ]
        )
      }).to.throw()
    })

    it('can not create role with existing id', async () => {
      await rbacAdmin.createRole(
        'giant_egg',
        'Giant Egg',
        'Ostrich',
        [ ]
      )

      expect(async () => {
        await rbacAdmin.createRole(
          'giant_egg',
          'A Big Egg',
          'Out of the nether end of an apatosaurus',
          [ ]
        )
      }).to.throw()
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
