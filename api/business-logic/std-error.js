/**
 * Prepare a unified error with extended status.
 * @param {Number} status
 * @param {String} message
 * @return {Error}
 */
function standardError(status, message) {
    const err = new Error(message)
    //modify stack to remove the last function call (always refers to this function)
    const parsedStack = err.stack.split('\n    at ')
    parsedStack.splice(1, 1)
    err.stack = parsedStack.join('\n    at ')
    err.status = status
    return err
}

module.exports = {standardError}
