import React, {useState, useCallback, useEffect} from 'react'
import {Horizon, TransactionBuilder} from '@stellar/stellar-sdk'
import {Button, withErrorBoundary} from '@stellar-expert/ui-framework'
import {checkTxSubmitted} from '../../../infrastructure/tx-dispatcher'
import config from '../../../app.config.json'
import {horizonErrorHandler} from './horizon-error-handler'

export default withErrorBoundary(function HorizonSubmitTxView({txInfo}) {
    const {readyToSubmit, hash, submit, submitted, xdr, status, network, error} = txInfo
    const [inProgress, setInProgress] = useState(false)
    const [isExist, setIsExist] = useState(true)

    useEffect(() => {
        if (!txInfo.submit && !txInfo.submitted) {
            //check existence of transaction in Horizon
            checkTxSubmitted(txInfo)
                .then(tx => {
                    setIsExist(!!tx.submitted)
                })
        }
    }, [txInfo])

    const submitTx = useCallback(() => {
        const {passphrase, horizon} = config.networks[network]
        const tx = TransactionBuilder.fromXDR(xdr, passphrase)
        const server = new Horizon.Server(horizon)

        setInProgress(true)
        server.submitTransaction(tx)
            .then(() => {
                window.location.reload()
            })
            .catch(e => {
                if (e.response.data) {
                    const errors = horizonErrorHandler(e.response.data, 'Transaction failed')
                    errors.forEach(err => {
                        notify({type: 'error', message: err.description})
                    })
                }
            })
            .finally(() => {
                setInProgress(false)
            })
    }, [network, xdr])

    if (inProgress)
        return <div>
            <div className="loader inline"/>
        </div>

    if (error)
        return <div>
            <div className="segment error"><i className="icon-warning"/> {error}</div>
        </div>

    if (submitted)
        return <div>
            <i className="icon-ok"/> Transaction has been{' '}
            <a href={`https://stellar.expert/explorer/${network}/tx/${hash}`} target="_blank" rel="noreferrer">executed</a> on the ledger.
        </div>

    if (status === 'processed' && !submitted && isExist)
        return <div><i className="icon-ok"/> Transaction is fully signed and processed.</div>

    return <div>
        {readyToSubmit && !submitted ? <>
            {!!submit && <p><i className="icon-ok"/> Transaction is fully signed and will be submitted automatically.</p>}
            {(!submit && !isExist) && <div className="row micro-space">
                <div className="column column-25">
                    <Button block onClick={submitTx}>Submit</Button>
                </div>
                <div className="column column-75">
                    <div className="micro-space text-small dimmed">
                        <i className="icon-ok"/> Transaction is fully signed and ready to be submitted to the network.
                    </div>
                </div>
            </div>}
        </> : <>
            Transaction is not fully signed yet. More signatures required to match the threshold.
        </>}
    </div>
})