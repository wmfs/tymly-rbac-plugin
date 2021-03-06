/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('@wmfs/tymly')
const path = require('path')

describe('Misconfig tests', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  let tymlyService
  let rbac

  describe('setup', () => {
    it('fire up Tymly', async () => {
      const tymlyServices = await tymly.boot(
        {
          pluginPaths: [
            path.resolve(__dirname, '../'),
            path.resolve(__dirname, './fixtures/plugins/test-plugin')
          ],
          blueprintPaths: [
            path.resolve(__dirname, './fixtures/blueprints/access-controlled-by-undefined-role-blueprint')
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
    })
  })

  describe('verify', () => {
    it('there is an unknown role', () => {
      expect(rbac.rbac.unknownRoles).to.eql(['not-defined-admin'])
    })
  })

  describe('shutdown', () => {
    it('shutdown Tymly', async () => {
      await tymlyService.shutdown()
    })
  })
})
