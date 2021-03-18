/**
 * Convert date to UNIX timestamp format
 * @param {Date} [date] - Date object to convert
 * @return {Number}
 */
function getUnixTimestamp(date = undefined) {
    if (date === undefined) {
        date = new Date()
    }
    if (!(date instanceof Date)) return undefined
    return Math.floor(date.getTime() / 1000)
}

module.exports = {getUnixTimestamp}