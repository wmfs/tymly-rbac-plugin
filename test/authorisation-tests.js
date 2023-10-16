/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('@wmfs/tymly')
const path = require('path')

describe('Authorisation tests', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  let tymlyService
  let rbac
  let rbacAdmin
  let statebox

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
      statebox = tymlyServices.statebox
      rbac = tymlyServices.rbac
      rbac.debug()
      rbacAdmin = tymlyServices.rbacAdmin
    })
  })

  describe('checkRoleAuthorization', async () => {
    const resourceType = 'stateMachine'

    const tests = [
      ['authorize boss to purge site', 'tymlyTest_purgeSite_1_0', 'boss', null, 'create', true],
      ['authorize something $everyone can do', 'tymlyTest_readPost_1_0', null, null, 'create', true],
      ['authorize something an $authenticated user can do', 'tymlyTest_createPost_1_0', 'john.smith', null, 'create', true],
      ['deny something if user is not authenticated, when they need to be', 'tymlyTest_createPost_1_0', undefined, null, 'create', false],
      ['authorize an $owner', 'tymlyTest_updatePost_1_0', 'molly', { userId: 'molly' }, 'create', true],
      ['authorize something directly allowed via a role', 'tymlyTest_createPost_1_0', 'test_dev', null, 'cancel', true],
      ['deny if no matching role', 'tymlyTest_createPost_1_0', 'spaceman', null, 'cancel', false],
      ['deny if no appropriate role', 'tymlyTest_deletePost_1_0', 'test_dev', null, 'create', false],
      ['authorize something because of role inheritance', 'tymlyTest_createPost_1_0', 'boss', null, 'cancel', true],
      ['authorize something with resource and action wildcards', 'tymlyTest_purgeSite_1_0', 'test_admin', null, 'create', true],
      ['authorize something with just an action wildcard', 'tymlyTest_purgeSite_1_0', 'reader', null, 'get', true],
      ['fail to authorize if irrelevant action wildcard', 'tymlyTest_purgeSite_1_0', 'reader', null, 'create', false]
    ]

    it('set up roles', async () => {
      await rbacAdmin.ensureUserRoles('boss', 'tymlyTest_boss')
      await rbacAdmin.ensureUserRoles('test_dev', 'tymlyTest_developer')
      await rbacAdmin.ensureUserRoles('spaceman', ['space_cadet', 'IRRELEVANT'])
      await rbacAdmin.ensureUserRoles('test_admin', 'tymlyTest_tymlyTestAdmin')
      await rbacAdmin.ensureUserRoles('reader', 'tymlyTest_tymlyTestReadOnly')
    })

    for (const [title, resourceName, userId, ctx, action, expected] of tests) {
      it(title, async () => {
        const actual = await rbac.checkAuthorization(
          userId,
          ctx,
          resourceType,
          resourceName,
          action
        )

        expect(actual).to.equal(expected)
      })

      it(`${title} (via state machine)`, async () => {
        const execDesc = await statebox.startExecution(
          {
            resourceType,
            resourceName,
            action,
            ctx
          },
          'tymlyTest_checkUserAuthorization_1_0',
          {
            sendResponse: 'COMPLETE',
            userId
          }
        )

        expect(execDesc.status).to.eql('SUCCEEDED')
        expect(execDesc.ctx.authorized).to.eql(expected)
      })
    }
  })

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })
})
