import React, {useState} from 'react'
import {Server, TransactionBuilder} from 'stellar-sdk'
import {networks} from '../../app.config.json'

export default function HorizonSubmitTxView({readyToSubmit, submit, submitted, xdr, network}) {
    const [inProgress, setInProgress] = useState(false),
        [result, setResult] = useState(null),
        [error, setError] = useState(null)

    function submitTx() {
        const {passphrase, horizon} = networks[network],
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

    if (inProgress) return <div className="loader"/>
    return <div className="space">
        {readyToSubmit && !submitted ? <>
            {!!error && <div className="error">{error}</div>}
            {submit ? <p>✓ The transaction is fully signed and will be submitted automatically.</p> :
                <div className="row micro-space">
                    <div className="column column-25">
                        <button className="button button-block" onClick={() => submitTx()}>Submit</button>
                    </div>
                    <div className="column column-75">
                        <div className="micro-space small dimmed">
                            Transaction is fully signed and ready to be submitted to the network.
                        </div>
                    </div>
                </div>}
        </> : <>
            Transaction is not fully signed yet. More signatures required to match the threshold.
        </>}
    </div>
}