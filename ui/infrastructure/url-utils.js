export function stringifyQuery(query) {
    if (!query) return ''
    const q = [],
        entries = Object.entries(query)
    entries.sort(function ([a], [b]) {
        if (a > b) return 1
        if (a < b) return -1
        return 0
    })
    for (let [key, value] of entries) {
        if (value !== undefined && value !== null && value !== '') {
            if (value instanceof Array) {
                for (let v of value) {
                    q.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`)
                }
            } else {
                q.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            }
        }
    }
    return q.length ? '?' + q.join('&') : ''
}

export function parseQuery(query = null, dest = null) {
    if (query === null) {
        query = window.location.search
    }
    if (query[0] === '?') query = query.substr(1)
    if (!dest) {
        dest = {}
    }
    for (let kv of query.split('&')) {
        let [key, value] = kv.split('=').map(v => decodeURIComponent(v))
        if (key) {
            if (/\[\]$/.test(key)) {
                key = key.substr(0, key.length - 2)
                const array = dest[key] || []
                array.push(value)
                value = array
            }
            dest[key] = value
        }
    }
    return dest
}