/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('@wmfs/tymly')
const path = require('path')

describe('Role membership tests', function () {
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

    const allUserRoles = [
      [
        'mommy',
        ['tymlyTest_boss', 'tymlyTest_developer'],
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

  describe('set up roles', () => {
    for (const [user, roles] of allUserRoles) {
      it(`ensure ${user} roles`, async () => {
        await rbac.ensureUserRoles(user, roles)
      })
    }
  })

  describe('check user roles', () => {
    for (const [user, , expectedRoles] of allUserRoles) {
      it(`verify ${user} roles`, async () => {
        const roles = await rbac.listUserRoles(user)
        expect(roles).to.eql(expectedRoles)
      })
      it(`verify ${user} roles are cached`, async () => {
        const roles = rbac.userMembershipsCache.get(user)
        expect(roles).to.eql(expectedRoles)
      })
    } // for ...
  })

  describe('check role memberships', () => {
    for (const role of ['tymlyTest_boss', 'tymlyTest_teamLeader', 'tymlyTest_developer', 'tymlyTest_tymlyTestAdmin', 'non-existent-role']) {
      const expectedMembers = allUserRoles.filter(([user, , roles]) => roles.indexOf(role) !== -1).map(([user, , ]) => user)
      it(`verify ${role} members`, async() => {
        const members = await rbac.listRoleUsers(role)
        expect(members).to.have.members(expectedMembers)
      })
      it(`verify ${role} members are cached`, async() => {
        const members = rbac.roleMembershipsCache.get(role)
        expect(members).to.have.members(expectedMembers)
      })
    }
  })

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })
})
