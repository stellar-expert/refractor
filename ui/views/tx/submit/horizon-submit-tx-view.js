import React, {useState, useEffect} from 'react'
import {Server, TransactionBuilder} from '@stellar/stellar-sdk'
import {Button, TxLink} from '@stellar-expert/ui-framework'
import config from '../../../app.config.json'
import {loadTx} from '../../../infrastructure/tx-dispatcher'

export default function HorizonSubmitTxView({readyToSubmit, hash, submit, submitted, xdr, status, network}) {
    const [inProgress, setInProgress] = useState(false),
        [result, setResult] = useState(null),
        [error, setError] = useState(null)

    let checkStatus
    useEffect(async () => {
        if (result && status === 'ready') {
            checkStatus = setInterval(async () => {
                const txInfo = await loadTx(hash)
                if (txInfo.status === 'processed' || txInfo.status === 'failed') window.location.reload()
            }, 1000)
        }
        return () => {
            clearInterval(checkStatus)
        }
    })

    function submitTx() {
        const {passphrase, horizon} = config.networks[network],
            tx = TransactionBuilder.fromXDR(xdr, passphrase),
            server = new Server(horizon)

        setInProgress(true)
        setError(null)
        server.submitTransaction(tx)
            .then(() => {
                setResult(true)
                window.location.reload()
            })
            .catch(e => {
                console.error(e)
                let err = 'Transaction failed'
                if (e.response.data) {
                    err += ' ' + JSON.stringify(e.response.data.extras.result_codes)
                }
                setError(err)
            })
            .finally(() => {
                setInProgress(false)
            })
    }

    if (inProgress)
        return <div className="loader inline"/>
    if (submitted)
        return <div>
            Transaction has been <a href={`https://stellar.expert/explorer/${network}/tx/${hash}`} target="_blank">submitted</a> to the
            network
        </div>
    if (status === 'processed' && !submitted)
        return <div>
            Transaction is fully signed but not submitted to the network.
        </div>
    return <div>
        {readyToSubmit? <>
            {!!error && <div className="error">{error}</div>}
            {submit ? <p>✓ The transaction is fully signed and will be submitted automatically.</p> :
                <div className="row micro-space">
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