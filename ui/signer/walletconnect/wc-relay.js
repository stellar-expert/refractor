import {open, seal, signRelayJwt} from './wc-crypto'

const callTimeout = 15_000
const reconnectDelays = [1000, 2000, 4000, 8000, 8000]

let lastId = 0

/**
 * Generate unique JSON-RPC request id in the format used by WalletConnect clients
 * @return {number}
 */
export function nextId() {
    lastId = Math.max(lastId + 1, Date.now() * 1000)
    return lastId
}

/**
 * Minimal WalletConnect relay (IRN) client: authenticated WebSocket connection, encrypted publish/subscribe
 */
export class RelayClient {
    /**
     * @param {string} relayUrl - Relay WebSocket endpoint
     * @param {string} projectId - Reown project id
     * @param {string} ua - Client user agent descriptor
     * @param {function(string, Object)} onMessage - Decrypted message handler, receives (topic, payload)
     * @param {function(Error)} onError - Invoked when the connection is lost and cannot be restored
     */
    constructor({relayUrl, projectId, ua, onMessage, onError}) {
        this.relayUrl = relayUrl
        this.projectId = projectId
        this.ua = ua
        this.onMessage = onMessage
        this.onError = onError
        this.topics = new Map()
        this.pending = new Map()
        this.seen = new Set()
        this.closed = false
        this.reconnectAttempt = 0
        this.onVisibilityChange = this.onVisibilityChange.bind(this)
    }

    /**
     * Establish relay connection
     * @return {Promise}
     */
    async open() {
        await this.connect()
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.onVisibilityChange)
        }
    }

    /**
     * Subscribe to a topic, decrypting incoming messages with a given symmetric key
     * @param {string} topic
     * @param {Uint8Array} key
     * @return {Promise}
     */
    async subscribe(topic, key) {
        //register the key upfront - stored messages may arrive before the subscription acknowledgement
        this.topics.set(topic, key)
        await this.call('irn_subscribe', {topic})
    }

    /**
     * Encrypt and publish a JSON-RPC payload to a topic
     * @param {string} topic
     * @param {Object} payload
     * @param {number} tag
     * @param {number} ttl
     * @param {boolean} [prompt] - Whether the wallet should receive a push notification
     * @return {Promise}
     */
    publish(topic, payload, {tag, ttl, prompt}) {
        const message = seal(this.topics.get(topic), payload)
        //ignore own messages if the relay echoes them back
        this.seen.add(message)
        const params = {topic, message, ttl, tag}
        if (prompt) {
            params.prompt = true
        }
        return this.call('irn_publish', params)
    }

    /**
     * Send relay JSON-RPC request
     * @param {string} method
     * @param {Object} params
     * @return {Promise<*>}
     */
    call(method, params) {
        if (this.closed)
            return Promise.reject(new Error('WalletConnect relay connection closed'))
        const request = {id: nextId(), jsonrpc: '2.0', method, params}
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(request.id)
                reject(new Error(`WalletConnect relay request ${method} timed out`))
            }, callTimeout)
            this.pending.set(request.id, {request, resolve, reject, timer})
            //requests issued while reconnecting are sent once the connection is restored
            if (this.isConnected) {
                this.send(request)
            }
        })
    }

    /**
     * Close the connection and reject all pending requests
     * @param {Error} [reason] - Rejection reason for pending requests
     */
    close(reason = new Error('WalletConnect relay connection closed')) {
        if (this.closed)
            return
        this.closed = true
        clearTimeout(this.reconnectTimer)
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.onVisibilityChange)
        }
        for (const {reject, timer} of this.pending.values()) {
            clearTimeout(timer)
            reject(reason)
        }
        this.pending.clear()
        const {socket} = this
        this.socket = null
        socket?.close(1000)
    }

    /**
     * @type {boolean}
     * @readonly
     */
    get isConnected() {
        return this.socket?.readyState === WebSocket.OPEN
    }

    /**
     * @private
     */
    connect() {
        const query = new URLSearchParams({
            auth: signRelayJwt(this.relayUrl),
            projectId: this.projectId,
            ua: this.ua,
            useOnCloseEvent: 'true'
        })
        const socket = new WebSocket(`${this.relayUrl}?${query}`)
        this.socket = socket
        return new Promise((resolve, reject) => {
            let connected = false
            socket.onopen = () => {
                connected = true
                this.reconnectAttempt = 0
                //resend requests that were in flight when the previous connection dropped
                for (const {request} of this.pending.values()) {
                    this.send(request)
                }
                resolve()
            }
            socket.onmessage = e => this.processMessage(e.data)
            socket.onclose = e => {
                if (socket !== this.socket)
                    return
                this.socket = null
                if (!connected) {
                    reject(new Error('WalletConnect relay connection failed' + (e.reason ? `: ${e.reason}` : '')))
                    return
                }
                //relay accepts the connection and then closes it with 3xxx code for invalid project id or auth token
                if (e.code >= 3000 && e.code < 4000) {
                    this.terminate(new Error(`WalletConnect relay rejected the connection: ${e.reason || e.code}`))
                    return
                }
                this.scheduleReconnect()
            }
        })
    }

    /**
     * Close the connection due to unrecoverable error
     * @private
     */
    terminate(error) {
        this.close(error)
        this.onError(error)
    }

    /**
     * @private
     */
    scheduleReconnect() {
        if (this.closed)
            return
        const delay = reconnectDelays[this.reconnectAttempt]
        if (delay === undefined) {
            this.terminate(new Error('Lost connection to WalletConnect relay'))
            return
        }
        this.reconnectAttempt++
        this.reconnectTimer = setTimeout(() => this.reconnect(), delay)
    }

    /**
     * @private
     */
    async reconnect() {
        clearTimeout(this.reconnectTimer)
        if (this.closed || this.socket)
            return
        try {
            await this.connect()
        } catch (e) {
            console.warn(e)
            this.scheduleReconnect()
            return
        }
        //restore subscriptions - the relay delivers messages published while the client was offline
        for (const topic of this.topics.keys()) {
            this.call('irn_subscribe', {topic})
                .catch(e => console.warn(e))
        }
    }

    /**
     * Mobile browsers suspend background tabs, so reconnect as soon as the page is visible again
     * @private
     */
    onVisibilityChange() {
        if (document.visibilityState !== 'visible' || this.closed)
            return
        //a suspended socket may still report OPEN state while the relay has already dropped it - always start over
        const {socket} = this
        if (socket?.readyState === WebSocket.CONNECTING)
            return //reconnection already in progress
        if (socket) {
            this.socket = null
            socket.close(1000)
        }
        this.reconnect()
    }

    /**
     * @private
     */
    send(payload) {
        this.socket.send(JSON.stringify(payload))
    }

    /**
     * @private
     */
    processMessage(data) {
        let msg
        try {
            msg = JSON.parse(data)
        } catch (e) {
            console.warn('Invalid WalletConnect relay message', e)
            return
        }
        if (msg.method === 'irn_subscription') {
            this.send({id: msg.id, jsonrpc: '2.0', result: true})
            const {topic, message} = msg.params.data
            const key = this.topics.get(topic)
            if (!key || this.seen.has(message))
                return
            this.seen.add(message)
            let payload
            try {
                payload = open(key, message)
            } catch (e) {
                console.warn('Failed to decrypt WalletConnect message', e)
                return
            }
            this.onMessage(topic, payload)
            return
        }
        const pending = this.pending.get(msg.id)
        if (!pending)
            return
        this.pending.delete(msg.id)
        clearTimeout(pending.timer)
        if (msg.error) {
            pending.reject(new Error(`WalletConnect relay error: ${msg.error.message}`))
        } else {
            pending.resolve(msg.result)
        }
    }
}
