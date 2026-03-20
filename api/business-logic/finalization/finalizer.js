const createQueue = require('fastq')
const storageLayer = require('../../storage/storage-layer')
const {rehydrateTx} = require('../tx-loader')
const {getUnixTimestamp} = require('../timestamp-utils')
const {submitTransaction} = require('../rpc-connector')
const {processCallback} = require('./callback-handler')

class Finalizer {
    constructor() {
        this.finalizerQueue = createQueue(this.processTx, 50) //max 50 tasks in parallel
    }

    finalizerQueue

    targetQueueSize = 200

    tickerTimeout = 5000

    processorTimerHandler = -1

    async scheduleTransactionsBatch() {
        try {
            const now = getUnixTimestamp()
            //get transactions ready to be submitted
            const cursor = await storageLayer.dataProvider.listTransactions({status: 'ready', minTime: {$lte: now}})
            for await (let txInfo of cursor) {
                if (this.processorTimerHandler === 0) //pipeline stop executed
                    return
                this.finalizerQueue.push(txInfo)
                //the queue length should not exceed the max queue size
                if (this.finalizerQueue.length() >= this.targetQueueSize)
                    break
            }
        } catch (e) {
            console.error(e)
        }
        if (this.processorTimerHandler === 0) //pipeline stop executed
            return
        this.processorTimerHandler = setTimeout(() => this.scheduleTransactionsBatch(), this.tickerTimeout) // wait to drain the queue and check for new entries
    }

    setQueueConcurrency(concurrency) {
        this.finalizerQueue.concurrency = concurrency
    }

    /**
     * Process fully signed tx
     * @param {TxModel} txInfo
     * @param {Function} cb
     */
    async processTx(txInfo, cb) {
        if (txInfo.status !== 'ready')
            return cb()
        try {
            //lock tx
            if (!await storageLayer.dataProvider.updateTxStatus(txInfo.hash, 'processing', 'ready'))
                return cb()//failed to obtain a lock - some other thread is currently processing this transaction
        } catch (e) {
            console.error(e)
            return cb()//invalid current state
        }
        try {
            if (txInfo.maxTime && txInfo.maxTime < getUnixTimestamp())
                throw new Error(`Transaction has already expired`)
            const txInfoFull = rehydrateTx(txInfo)
            const update = {status: 'processed'}
            if (txInfo.callbackUrl) {
                await processCallback(txInfoFull)
            }
            if (txInfo.submit) {
                await submitTransaction(txInfoFull)
                update.submitted = getUnixTimestamp()
            }
            if (!await storageLayer.dataProvider.updateTransaction(txInfo.hash, update, 'processing'))
                throw new Error(`State conflict after callback execution`)
        } catch (e) {
            console.error('TX ' + txInfo.hash + ' processing failed')
            console.error(e)
            await storageLayer.dataProvider.updateTxStatus(txInfo.hash, 'failed', 'processing', e)
            return cb(e)
        }
        cb(null)
    }

    start() {
        this.scheduleTransactionsBatch()
            .catch(e => console.error(e))
    }

    async stop() {
        clearTimeout(this.processorTimerHandler)
        this.processorTimerHandler = 0
        //clear the pending queue
        this.finalizerQueue.kill()
        //wait for all current tasks to finish
        return new Promise(resolve => {
            const finalizerCheckInterval = setInterval(() => {
                if (this.finalizerQueue.idle()) {
                    clearInterval(finalizerCheckInterval)
                    resolve()
                }
            }, 300)
        })
    }

    async resetProcessingStatus() {
        const cursor = await storageLayer.dataProvider.listTransactions({status: 'processing'})
        for await (let txInfo of cursor) {
            await storageLayer.dataProvider.updateTxStatus(txInfo.hash, 'ready', 'processing')
        }
    }
}

const finalizer = new Finalizer()

module.exports = finalizer