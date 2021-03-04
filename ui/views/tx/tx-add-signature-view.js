import React, {useState} from 'react'
import albedo from '@albedo-link/intent'
import {submitTx} from '../../infrastructure/tx-dispatcher'
import BlockSelect from '../components/block-select'

function TxStoreResult({result}) {
    if (!result) return null
    const {accepted, rejected} = result.changes

    return <>
        <h3>Changes</h3>
        <div className="small">
            {accepted?.length > 0 && <div>
                <div>
                    Accepted signatures:
                </div>
                <div>
                    {accepted.map(s => <div key={s.signature}>✓ <BlockSelect>{s.key}</BlockSelect></div>)}
                </div>
            </div>}
            {rejected?.length > 0 && <div>
                <div>
                    Rejected signatures:
                </div>
                <div>
                    {rejected.map(s => <div key={s.signature}>✗ <BlockSelect>{s.key}</BlockSelect></div>)}
                </div>
            </div>}
        </div>
    </>
}

export default function TxAddSignatureView({txInfo, onUpdate}) {
    const [error, setError] = useState(''),
        [inProgress, setInProgress] = useState(false),
        [result, setResult] = useState(null)

    if (txInfo.readyToSubmit || txInfo.submitted) return null

    function requestSignature() {
        setError('')
        setInProgress(true)
        setResult(null)
        albedo.tx({xdr: txInfo.xdr, network: txInfo.network})
            .then(({signed_envelope_xdr: xdr}) => submitTx({...txInfo, xdr}))
            .then(txInfo => {
                setResult(txInfo)
                onUpdate(txInfo)
            })
            .catch(e => {
                setError(e.message)
            })
            .finally(() => setInProgress(false))
    }

    return <div className="space">
        <div className="row">
            <div className="column column-25">
                <button className="button button-block" disabled={inProgress} onClick={requestSignature}>Sign
                    transaction
                </button>
            </div>
        </div>
        {!!error && <div className="error">{error}</div>}
        {inProgress && <div className="loader"/>}
        <TxStoreResult result={result}/>
    </div>
}