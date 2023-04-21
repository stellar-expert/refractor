import React, {useState} from 'react'
import {Button} from '@stellar-expert/ui-framework'
import albedo from '@albedo-link/intent'
import {submitTx} from '../../../infrastructure/tx-dispatcher'

export default function TxAddSignatureView({txInfo, onUpdate, updateResult}) {
    const [error, setError] = useState(''),
        [inProgress, setInProgress] = useState(false)

    if (txInfo.readyToSubmit || txInfo.submitted) return null

    function requestSignature(updateResult) {
        setError('')
        setInProgress(true)
        updateResult(null)
        albedo.tx({xdr: txInfo.xdr, network: txInfo.network})
            .then(({signed_envelope_xdr: xdr}) => submitTx({...txInfo, xdr}))
            .then(txInfo => {
                updateResult(txInfo)
                onUpdate(txInfo)
            })
            .catch(e => {
                setError(e.message)
            })
            .finally(() => setInProgress(false))
    }

    return <div className="space">
        <div className="row">
            <div className="column column-50">
                <Button block disabled={inProgress} onClick={() => requestSignature(updateResult)}>Sign transaction</Button>
            </div>
        </div>
        {!!error && <div className="error">{error}</div>}
        {inProgress && <div className="loader"/>}
    </div>
}