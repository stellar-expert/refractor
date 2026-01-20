import React, {useCallback, useState} from 'react'
import {Button, withErrorBoundary} from '@stellar-expert/ui-framework'
import {apiSubmitTx} from '../../../infrastructure/tx-dispatcher'
import {delegateTxSigning} from '../../../signer/tx-signer'
import AddXdrView from '../add-xdr-view'
import './add-signatures.scss'

export default withErrorBoundary(function TxAddSignatureView({txInfo, onUpdate}) {
    const [inProgress, setInProgress] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    const requestSignature = useCallback(e => {
        const {provider} = e.target.dataset
        setInProgress(true)
        processSignature(provider, txInfo)
            .then(updatedTxInfo => onUpdate(updatedTxInfo))
            .catch(e => console.error(e))
            .finally(() => setInProgress(false))
    }, [txInfo, onUpdate])

    const toggleImportModal = useCallback(() => setIsOpen(prev => !prev), [])

    if (txInfo.readyToSubmit || txInfo.submitted)
        return null

    return <div className="space">
        <div className="text-small dimmed">Sign transaction</div>
        <div className="signature-options micro-space">
            <div className="row">
                <div className="column column-50">
                    <Button block outline disabled={inProgress} onClick={requestSignature}>
                        <i className="icon icon-wallet"/> Stellar wallets
                    </Button>
                </div>
                <div className="column column-50">
                    <Button block outline disabled={inProgress} onClick={toggleImportModal}>
                        <i className="icon icon-download"/> Import signed XDR
                    </Button>
                </div>
            </div>
        </div>
        {!!inProgress && <div className="loader"/>}
        <AddXdrView isOpen={isOpen} changeVisible={toggleImportModal} txInfo={txInfo} onUpdate={onUpdate}/>
    </div>
})

async function processSignature(provider, txInfo) {
    const {signedTxXdr} = await delegateTxSigning(txInfo.xdr, txInfo.network)
    try {
        return await apiSubmitTx({...txInfo, xdr: signedTxXdr})
    } catch (e) {
        notify({type: 'error', message: 'Failed to store transaction signature. Please repeat the process later.'})
        throw e
    }
}