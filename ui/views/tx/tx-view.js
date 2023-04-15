import React, {useState} from 'react'
import {useParams} from 'react-router'
import {BlockSelect, CopyToClipboard, useDependantState} from '@stellar-expert/ui-framework'
import {loadTx} from '../../infrastructure/tx-dispatcher'
import TxDetailsOperationsView from './details/tx-details-operations-view'
import TxSignaturesView from './details/tx-signatures-view'
import TxAddSignatureView from './details/tx-add-signature-view'
import HorizonSubmitTxView from './submit/horizon-submit-tx-view'
import TxPropsView from './details/tx-props-view'

export default function TxView() {
    const {txhash} = useParams()
    const [error, setError] = useState(null)
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
        <h2>Transaction&nbsp;
            <BlockSelect inline wrap className="condensed">{txhash}</BlockSelect>
            <span className="text-small"><CopyToClipboard text={txhash}/></span>
        </h2>
        <div className="row">
            <div className="column column-50">
                <div className="card">
                    <h3>Properties</h3>
                    <hr/>
                    <TxPropsView txInfo={txInfo}/>
                </div>
            </div>
            <div className="column column-50">
                <div className="card">
                    <h3>Operations</h3>
                    <hr/>
                    <TxDetailsOperationsView xdr={txInfo.xdr} network={txInfo.network}/>
                </div>
            </div>
        </div>
        <div className="card space">
            <h3>Signatures</h3>
            <hr/>
            <TxSignaturesView {...txInfo}/>
            <hr className="space"/>
            <div className="space">
                <HorizonSubmitTxView {...txInfo}/>
            </div>
            <TxAddSignatureView txInfo={txInfo} onUpdate={txInfo => setTxInfo(txInfo)}/>
        </div>
    </>
}