import {stringifyQuery} from './url-utils'
import config from '../app.config.json'

/**
 * Retrieve data from the server API endpoint.
 * @param {string} relativeApiPath - API endpoint path.
 * @param {object} [data] - Request payload.
 * @param {object} [params] - Request params.
 * @param {'GET'|'POST'|'PUT'|'DELETE'} [params.method] - HTTP method to use (GET by default)..
 * @return {Promise<object>}
 */
export function apiCall(relativeApiPath, data, params) {
    params = {method: 'GET', includeNetwork: true, ...params}
    let fetchParams = {}
    let url = `${config.apiEndpoint}/${relativeApiPath}`
    if (params.method && params.method !== 'GET') {
        fetchParams = {
            ...params,
            body: JSON.stringify(data),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            }
        }
    } else {
        url += stringifyQuery(data)
    }
    return fetch(url, fetchParams)
        .then(resp => {
            if (!resp.ok)
                return resp.json()
                    .catch(e => ({}))
                    .then(ext => {
                        const err = new Error(ext.error || resp.statusText)
                        err.error = resp.statusText
                        err.status = resp.status
                        err.ext = ext
                        return Promise.reject(err)
                    })
            return resp.json()
        })
}