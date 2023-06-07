class AwaitingHumanInput {
  run (event, context) {
    context.sendTaskSuccess()
  } // run
} // Success

module.exports = AwaitingHumanInput
