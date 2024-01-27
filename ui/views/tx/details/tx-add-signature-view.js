import React, {useCallback, useState} from 'react'
import {Button, withErrorBoundary} from '@stellar-expert/ui-framework'
import albedo from '@albedo-link/intent'
import {submitTx} from '../../../infrastructure/tx-dispatcher'

export default withErrorBoundary(function TxAddSignatureView({txInfo, onUpdate}) {
    const [error, setError] = useState('')
    const [inProgress, setInProgress] = useState(false)

    const requestSignature = useCallback(() => {
        setError('')
        setInProgress(true)
        albedo.tx({xdr: txInfo.xdr, network: txInfo.network})
            .then(({signed_envelope_xdr: xdr}) => submitTx({...txInfo, xdr}))
            .then(txInfo => onUpdate(txInfo))
            .catch(e => {
                setError(e.message)
            })
            .finally(() => setInProgress(false))
    }, [txInfo, onUpdate])

    if (txInfo.readyToSubmit || txInfo.submitted)
        return null

    return <div className="space">
        <div className="row">
            <div className="column column-50">
                <Button block disabled={inProgress} onClick={requestSignature}>Sign transaction</Button>
            </div>
        </div>
        {!!error && <div className="error">{error}</div>}
        {!!inProgress && <div className="loader"/>}
    </div>
})