
class Success {
  run (event, context) {
    context.sendTaskSuccess('Yes boys!')
  } // run
} // Success

module.exports = Success
