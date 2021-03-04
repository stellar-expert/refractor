export function formatUnixDate(unixDate) {
    return new Date(unixDate * 1000).toISOString().replace(/\.\d*Z$/, '').replace('T', ' ')
}