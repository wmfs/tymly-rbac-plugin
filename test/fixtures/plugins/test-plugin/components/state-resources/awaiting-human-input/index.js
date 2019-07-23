
class AwaitingHumanInput {
  init (resourceConfig, env, callback) {
    callback(null)
  }

  run (event, context) {
    context.sendTaskSuccess()
  } // run
} // Success

module.exports = AwaitingHumanInput
