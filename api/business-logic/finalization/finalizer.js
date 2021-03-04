const createQueue = require('fastq'),
    {inspectTransactionSigners} = require('@stellar-expert/tx-signers-inspector'),
    storageLayer = require('../../storage/storage-layer'),
    {rehydrateTx} = require('../tx-loader'),
    {processCallback} = require('./callback-handler'),
    {submitTransaction} = require('./horizon-handler')

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
            const cursor = await storageLayer.dataProvider.listTransactions({status: 'ready'})
            for await (let txInfo of cursor) {
                if (this.processorTimerHandler === 0) //pipeline stop executed
                    return
                this.finalizerQueue.push(txInfo)
                if (this.finalizerQueue.length() >= this.targetQueueSize)
                    break
            }
        } catch (e) {
            console.error(e)
        }
        this.processorTimerHandler = setTimeout(() => this.scheduleTransactionsBatch(), this.tickerTimeout) // wait 5 seconds to drain the queue and check for new entries
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
        if (txInfo.status !== 'ready') return
        try {
            //lock tx
            if (!await storageLayer.dataProvider.updateTxStatus(txInfo.hash, 'processing', 'ready'))
                return //failed to obtain a lock - some other thread is currently processing this transaction
        } catch (e) {
            console.error(e)
            return //invalid current state
        }
        try {
            const txInfoFull = rehydrateTx(txInfo)
            const update = {status: 'processed'}
            if (txInfo.callbackUrl) {
                await processCallback(txInfoFull)
            }
            if (txInfo.submit) {
                await submitTransaction(txInfoFull)
                update.submitted = Math.floor(new Date().getTime() / 1000)
            }
            if (!await storageLayer.dataProvider.updateTransaction(txInfo.hash, update, 'processing')) {
                console.error(`State conflict after callback execution`)
                return
            }
        } catch (e) {
            console.error(e)
            await storageLayer.dataProvider.updateTxStatus(txInfo.hash, 'failed', 'processing')
            cb(e)
            return
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
            let finalizerCheckInterval = setInterval(() => {
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