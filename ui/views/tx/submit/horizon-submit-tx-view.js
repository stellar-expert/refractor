import React, {useState, useCallback, useEffect} from 'react'
import {Horizon, TransactionBuilder} from '@stellar/stellar-sdk'
import {Button} from '@stellar-expert/ui-framework'
import {existenceTx} from '../../../infrastructure/tx-dispatcher'
import config from '../../../app.config.json'
import {horizonErrorHandler} from './horizon-error-handler'

export default function HorizonSubmitTxView({txInfo}) {
    const {readyToSubmit, hash, submit, submitted, xdr, status, network, error} = txInfo
    const [inProgress, setInProgress] = useState(false)
    const [isExist, setIsExist] = useState(true)

    useEffect(() => {
        if (!txInfo.submit && !txInfo.submitted) {
            //check existence of transaction in Horizon
            existenceTx(txInfo)
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

    if (inProgress) return <div className="loader inline"/>

    if (error) return <div>
        <div>{error}</div>
    </div>

    if (submitted) return <div>
        Transaction has been <a href={`https://stellar.expert/explorer/${network}/tx/${hash}`} target="_blank" rel="noreferrer">submitted</a> to the network
    </div>

    if (status === 'processed' && !submitted && isExist) return <div>
        Transaction is fully signed and processed.
    </div>

    return <div>
        {readyToSubmit && !submitted ? <>
            {!!submit && <p>✓ The transaction is fully signed and will be submitted automatically.</p>}
            {(!submit && !isExist) && <div className="row micro-space">
                <div className="column column-25">
                    <Button block onClick={submitTx}>Submit</Button>
                </div>
                <div className="column column-75">
                    <div className="micro-space text-small dimmed">
                        Transaction is fully signed and ready to be submitted to the network.
                    </div>
                </div>
            </div>}
        </> : <>
            Transaction is not fully signed yet. More signatures required to match the threshold.
        </>}
    </div>
}