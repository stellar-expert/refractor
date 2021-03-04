import {createBrowserHistory} from 'history'
import isEqual from 'react-fast-compare'
import {parseQuery, stringifyQuery} from './url-utils'

const history = window.__history = createBrowserHistory()

function setQueryInternal(paramsToSet, replace = false) {
    const prevState = JSON.stringify(this.query),
        newQuery = Object.assign({}, replace ? null : this.query, paramsToSet)
    if (JSON.stringify(newQuery) !== prevState) {
        Object.freeze(newQuery)
        this.query = newQuery
        return true
    }
    return false
}

class Nav {
    constructor() {
        this.query = {}
        this.updateQuery(parseQuery())
    }

    query = {}

    get history() {
        return history
    }

    get path() {
        return history.location.pathname
    }

    get hash() {
        return history.location.hash
    }

    set hash(value) {
        if (value[0] !== '#') value = '#' + value
        window.location.hash = value
        history.location.hash = value
    }

    updateQuery(paramsToSet, replace = false) {
        if (setQueryInternal.call(this, paramsToSet)) {
            const {pathname} = this.history.location,
                newUrl = pathname + stringifyQuery(this.query)
            this.history.replace(newUrl)
        }
    }

    navigate(url) {
        if (history.location.pathname + history.location.search === url.replace(/#.*$/, '')) return
        setQueryInternal.call(this, parseQuery(url.split('?')[1] || ''), true)
        this.history.push(url)
    }

    replaceState(url) {
        if (history.location.pathname + history.location.search === url.replace(/#.*$/, '')) return
        setQueryInternal.call(this, parseQuery(url.split('?')[1] || ''), true)
        this.history.replace(url)
    }

    urlChanged(currentProps, nextProps) {
        return this.pathChanged(currentProps, nextProps)
            || nextProps.location.search !== currentProps.location.search
    }

    pathChanged(currentProps, nextProps) {
        return !isEqual(nextProps.match, currentProps.match)
    }

    queryParamChanged(currentProps, nextProps, ...params) {
        const currentQuery = parseQuery(currentProps.location.search),
            nextQuery = parseQuery(nextProps.location.search)
        for (const param of params) {
            if (currentQuery[param] !== nextQuery[param]) return true
        }
        return false
    }
}

const nav = new Nav()

export default nav

export function bindClickNavHandler(container) {
    container.addEventListener('click', e => {
        //do not process ctrl+click on links
        if (e.ctrlKey) return
        let link = e.target
        while (link && !(link.tagName === 'A' && link.href)) {
            link = link.parentElement
        }
        if (link) {
            const href = link.getAttribute('href')
            if (!href) return
            if (href === '#') return e.preventDefault()
            if (link.target === '_blank') return
            if (window.parent !== window) {
                window.top.location = /^(https?):\/\//.test(href) ? href : (window.origin + href)
                return e.preventDefault()
            }
            if (link.classList.contains('external-link')) return
            if (/^(mailto:|tel:|(https?):\/\/)/.test(href)) return
            const currentLocation = history.location
            const [pathAndQuery, hash] = href.split('#')

            if (!pathAndQuery || (currentLocation.pathname + currentLocation.search) === pathAndQuery) {
                //allow jumping to the element by id
                if (hash) return
                return e.preventDefault()
            }
            if (link.classList.contains('static-link')) return e.preventDefault()
            nav.navigate(href)
            e.preventDefault()
            window.scrollTo(0, 0)
        }
    })
}