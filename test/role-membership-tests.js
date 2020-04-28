/* eslint-env mocha */

const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect
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

const allRoles = ['tymly_rbacAdmin', 'tymlyTest_boss', 'tymlyTest_teamLeader', 'tymlyTest_developer', 'tymlyTest_tymlyTestAdmin', 'tymlyTest_tymlyTestReadOnly']

let tymlyService
let rbac
let rbacAdmin

const userRoles = () => describe('set up user roles', () => {
  for (const [user, roles] of allUserRoles) {
    it(`ensure ${user} roles`, async () => {
      await rbacAdmin.ensureUserRoles(user, roles)
    })
  }
})

const roleMembership = () => describe('set up role memberships', () => {
  for (const role of allRoles) {
    const members = allUserRoles.filter(([user, memberOf]) => memberOf && memberOf.includes(role)).map(([user]) => user)

    it(`ensure ${role} members`, async () => {
      await rbacAdmin.ensureRoleMembers(role, members)
    })
  }
})

for (const [label, setupFn] of [['user roles', userRoles], ['role membership', roleMembership]]) {
  describe(`${label} tests`, function () {
    this.timeout(process.env.TIMEOUT || 5000)

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
      for (const role of [...allRoles, 'non-existent-role']) {
        const expectedMembers = allUserRoles.filter(([user, , roles]) => roles.includes(role)).map(([user]) => user)
        it(`verify ${role} members`, async () => {
          const members = await rbacAdmin.listRoleUsers(role)
          expect(members).to.have.members(expectedMembers)
        })
      }

      it('list roles', async () => {
        const roles = await rbacAdmin.listRoles()
        expect(roles).to.have.members(allRoles)
      })

      it('describe tymlyTest_boss', async () => {
        const role = await rbacAdmin.describeRole('tymlyTest_boss')
        expect(role).to.eql({
          description: 'Like a Boss!',
          label: 'Boss',
          roleId: 'tymlyTest_boss',
          inherits: ['tymlyTest_teamLeader']
        })
      })

      it('describe $everyone', async () => {
        const role = await rbacAdmin.describeRole('$everyone')
        expect(role).to.eql({
          description: 'Built in',
          label: '$everyone',
          roleId: '$everyone',
          inherits: []
        })
      })

      it('describe nobodyWears_trilbys', async () => {
        const role = await rbacAdmin.describeRole('nobodyWears_trilbys')
        expect(role).to.be.undefined()
      })
    })

    if (label === 'user roles') {
      describe('clear user roles', () => {
        it('clear mommy roles', async () => {
          const roles = await rbac.listUserRoles('mommy')
          expect(roles.length).to.eql(4)

          await rbacAdmin.clearUserRoles('mommy')
          await rbacAdmin.refreshRbacIndex()

          const clearedRoles = await rbac.listUserRoles('mommy')
          expect(clearedRoles).to.eql(['$everyone'])
        })
      })
    }

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

  describe('can \'t add members to a built in', () => {
    it('add members to $owner', async () => {
      await rbacAdmin.ensureUserRoles('bigbossman', ['$owner'])

      await rbacAdmin.ensureRoleMembers('$owner', ['james', 'giant peach'])
    })

    it('but has no effect', async () => {
      const members = await rbacAdmin.listRoleUsers('$owner')
      expect(members).to.eql([])

      const roles = await rbacAdmin.listUserRoles('bigbossman')
      expect(roles).to.eql(['$everyone'])
    })
  })

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })
})
