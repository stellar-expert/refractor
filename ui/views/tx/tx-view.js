import React, {useState} from 'react'
import {useParams} from 'react-router'
import {BlockSelect, CopyToClipboard, useDependantState} from '@stellar-expert/ui-framework'
import {loadTx} from '../../infrastructure/tx-dispatcher'
import TxDetailsOperationsView from './details/tx-details-operations-view'
import TxTransactionXDRView from './details/tx-transaction-xdr-view'
import TxSignaturesView from './details/tx-signatures-view'
import TxAddSignatureView from './details/tx-add-signature-view'
import HorizonSubmitTxView from './submit/horizon-submit-tx-view'
import TxPropsView from './details/tx-props-view'

function signaturesAmount({signatures, schema}) {
    let amount = 0
    schema.requirements?.map(requirement => amount += requirement.signers?.length)
    return signatures ? <span className="text-small dimmed">{`${signatures.length}/${amount}`}</span> : ''
}

export default function TxView() {
    const {txhash} = useParams()
    const [error, setError] = useState(null)
    const [result, setResult] = useState(null)
    const [txInfo, setTxInfo] = useDependantState(() => {
        setError('')
        loadTx(txhash)
            .then(txInfo => setTxInfo(txInfo))
            .catch(e => setError(e))
        return null
    }, [txhash])
    if (error) throw error
    if (!txInfo) return <div className="loader"/>
    return <>
        <h2 style={{'display': 'inline-flex', 'maxWidth': '100%'}}>Transaction&nbsp;
            <BlockSelect className="condensed" style={{'overflow': 'hidden'}}>{txhash}</BlockSelect>
            <span className="text-small"><CopyToClipboard text={txhash}/></span>
        </h2>
        <div className="row">
            <div className="column column-50">
                <div className="segment h-100">
                    <h3>Properties</h3>
                    <hr/>
                    <TxPropsView txInfo={txInfo}/>
                </div>
            </div>
            <div className="column column-50">
                <div className="segment h-100 mobile-space">
                    <h3>Transaction</h3>
                    <hr/>
                    <div className="space">
                        <TxTransactionXDRView xdr={txInfo.xdr}/>
                    </div>
                    <TxDetailsOperationsView xdr={txInfo.xdr} network={txInfo.network}/>
                </div>
            </div>
            <div className="column column-50">
                <div className="segment h-100 space">
                    <h3>Signatures {signaturesAmount({...txInfo})}</h3>
                    <hr/>
                    <TxSignaturesView {...txInfo} resultAction={result}/>
                </div>
            </div>
            <div className="column column-50">
                <div className="segment h-100 space">
                    <h3>Action</h3>
                    <hr/>
                    <div className="space">
                        <HorizonSubmitTxView {...txInfo}/>
                    </div>
                    <TxAddSignatureView txInfo={txInfo} onUpdate={txInfo => setTxInfo(txInfo)} updateResult={txInfo => setResult(txInfo)}/>
                </div>
            </div>
        </div>

    </>
}