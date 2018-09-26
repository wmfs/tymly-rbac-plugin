/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('@wmfs/tymly')
const path = require('path')

describe('RBAC service tests', function () {
  // TODO: MORE! MORE! MORE!

  this.timeout(process.env.TIMEOUT || 5000)

  let tymlyService
  let rbac

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
          done()
        }
      )
    })
  })

  describe('checkRoleAuthorization', async () => {
    it('set up roles', async () => {
      await rbac.ensureUserRoles('boss', 'tymlyTest_boss')
      await rbac.ensureUserRoles('test_dev', 'tymlyTest_developer')
      await rbac.ensureUserRoles('spaceman', ['space_cadet', 'IRRELEVANT'])
      await rbac.ensureUserRoles('test_admin', 'tymlyTest_tymlyTestAdmin')
      await rbac.ensureUserRoles('reader', 'tymlyTest_tymlyTestReadOnly')
    })

    it('authorize boss to purge site', async () => {
      expect(
        await rbac.checkAuthorization(
          'boss', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_purgeSite_1_0', // resourceName
          'create' // action
        )).to.equal(true)
    })

    it('authorize something $everyone can do', async () => {
      expect(
        await rbac.checkAuthorization(
          null, // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_readPost_1_0', // resourceName
          'create' // action
        )).to.equal(true)
    })

    it('authorize something an $authenticated user can do', async () => {
      expect(
        await rbac.checkAuthorization(
          'john.smith', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_createPost_1_0', // resourceName
          'create' // action
        )).to.equal(true)
    })

    it('deny something if user is not authenticated, when they need to be', async () => {
      expect(
        await rbac.checkAuthorization(
          undefined, // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_createPost_1_0', // resourceName
          'create' // action
        )).to.equal(false)
    })

    it('authorize an $owner', async () => {
      expect(
        await rbac.checkAuthorization(
          'molly', // userId
          { userId: 'molly' }, // ctx
          'stateMachine', // resourceType
          'tymlyTest_updatePost_1_0', // resourceName
          'create' // action
        )).to.equal(true)
    })

    it('authorize something directly allowed via a role', async () => {
      expect(
        await rbac.checkAuthorization(
          'test_dev', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_createPost_1_0', // resourceName
          'cancel' // action
        )).to.equal(true)
    })

    it('deny if no matching role', async () => {
      expect(
        await rbac.checkAuthorization(
          'spaceman', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_createPost_1_0', // resourceName
          'cancel' // action
        )).to.equal(false)
    })

    it('deny if no appropriate role', async () => {
      expect(
        await rbac.checkAuthorization(
          'test_dev', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_deletePost_1_0', // resourceName
          'create' // action
        )).to.equal(false)
    })

    it('authorize something because of role inheritance', async () => {
      expect(
        await rbac.checkAuthorization(
          'boss', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_createPost_1_0', // resourceName
          'cancel' // action
        )).to.equal(true)
    })

    it('authorize something with resource and action wildcards', async () => {
      expect(
        await rbac.checkAuthorization(
          'test_admin', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_purgeSite_1_0', // resourceName
          'create' // action
        )).to.equal(true)
    })

    it('authorize something with just an action wildcard', async () => {
      expect(
        await rbac.checkAuthorization(
          'reader', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_purgeSite_1_0', // resourceName
          'get' // action
        )).to.equal(true)
    })

    it('fail to authorize if irrelevant action wildcard', async () => {
      expect(
        await rbac.checkAuthorization(
          'reader', // userId
          null, // ctx
          'stateMachine', // resourceType
          'tymlyTest_purgeSite_1_0', // resourceName
          'create' // action
        )).to.equal(false)
    })
  })

  describe('listUserRoles', () => {
    it('reset cache', function () {
      rbac.resetCache()
    })

    const allUserRoles = [
      [
        'mommy',
        ['tymlyTest_boss'],
        ['tymlyTest_boss', 'tymlyTest_teamLeader', 'tymlyTest_developer', '$everyone']
      ],
      [
        'daddy',
        ['tymlyTest_tymlyTestAdmin'],
        ['tymlyTest_tymlyTestAdmin', '$everyone']
      ],
      [
        'lucy',
        ['tymlyTest_tymlyTestReadOnly', 'tymlyTest_teamLeader'],
        ['tymlyTest_tymlyTestReadOnly', '$everyone', 'tymlyTest_teamLeader', 'tymlyTest_developer']
      ],
      [
        'molly',
        ['tymlyTest_developer'],
        ['tymlyTest_developer', '$everyone']
      ],
      [
        'just-some-dude',
        null,
        ['$everyone']
      ]
    ]

    for (const [user, roles] of allUserRoles) {
      it(`ensure ${user} roles`, async () => {
        await rbac.ensureUserRoles(user, roles)
      })
    }

    for (const [user, , expectedRoles] of allUserRoles) {
      it(`verify ${user} roles via storage`, async () => {
        const roles = await rbac.listUserRoles(user)
        expect(roles).to.eql(expectedRoles)
      })
      it(`verify ${user} roles via cache`, async () => {
        const roles = await rbac.listUserRoles(user)
        expect(roles).to.eql(expectedRoles)
      })
    } // for ...
  })

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })
})
