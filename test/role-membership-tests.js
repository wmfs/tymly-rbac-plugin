/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('@wmfs/tymly')
const path = require('path')


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

let tymlyService
let rbac

const userRoles = () => describe('set up user roles', () => {
  for (const [user, roles] of allUserRoles) {
    it(`ensure ${user} roles`, async () => {
      await rbac.ensureUserRoles(user, roles)
    })
  }
})

const roleMembership = () => describe('set up user roles', () => {
  for (const role of ['tymlyTest_boss', 'tymlyTest_teamLeader', 'tymlyTest_developer', 'tymlyTest_tymlyTestAdmin', 'tymlyTest_tymlyTestReadOnly']) {
    const members = allUserRoles.filter(([user, memberOf]) => memberOf && memberOf.includes(role)).map(([user]) => user)

    it(`ensure ${role} members`, async () => {
      await rbac.ensureRoleMembers(role, members)
    })
  }
})

for (const [label, setupFn] of [['user roles', userRoles], ['role membership', roleMembership]]) {
  describe(`${label} tests`, function () {
    this.timeout(process.env.TIMEOUT || 5000)

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
                userMemberships: {max: 500}
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

    setupFn()

    describe('check user roles', () => {
      for (const [user, , expectedRoles] of allUserRoles) {
        it(`verify ${user} roles`, async () => {
          const roles = await rbac.listUserRoles(user)
          expect(roles).to.have.members(expectedRoles)
        })
        it(`verify ${user} roles are cached`, async () => {
          const roles = rbac.userMembershipsCache.get(user)
          expect(roles).to.have.members(expectedRoles)
        })
      } // for ...
    })

    describe('check role memberships', () => {
      for (const role of ['tymlyTest_boss', 'tymlyTest_teamLeader', 'tymlyTest_developer', 'tymlyTest_tymlyTestAdmin', 'non-existent-role']) {
        const expectedMembers = allUserRoles.filter(([user, , roles]) => roles.includes(role)).map(([user]) => user)
        it(`verify ${role} members`, async () => {
          const members = await rbac.listRoleUsers(role)
          expect(members).to.have.members(expectedMembers)
        })
        it(`verify ${role} members are cached`, async () => {
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
}

describe('built in roles', () => {
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
              userMemberships: {max: 500}
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

  describe('can \'t add members to $owner', () => {
    it ('add members to $owner', async () => {
      await rbac.ensureUserRoles('bigbossman', ['$owner'])

      await rbac.ensureRoleMembers('$owner', ['james', 'giant peach'])
    })

    it ('but has no effect', async () => {
      const members = await rbac.listRoleUsers('$owner')
      expect(members).to.eql([])

      const roles = await rbac.listUserRoles('bigbossman')
      expect(roles).to.eql(['$everyone'])
    })
  })

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })
})