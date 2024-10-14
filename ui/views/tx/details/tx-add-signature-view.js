import React, {useCallback, useState} from 'react'
import {Button, ButtonGroup, withErrorBoundary} from '@stellar-expert/ui-framework'
import {submitTx} from '../../../infrastructure/tx-dispatcher'
import {delegateTxSigning, getAllProviders} from '../../../signer/tx-signer'
import './add-signatures.scss'

export default withErrorBoundary(function TxAddSignatureView({txInfo, onUpdate}) {
    const [inProgress, setInProgress] = useState(false)

    const requestSignature = useCallback(e => {
        const {provider} = e.target.dataset
        setInProgress(true)
        processSignature(provider, txInfo)
            .then(updatedTxInfo => onUpdate(updatedTxInfo))
            .catch(e => console.error(e))
            .finally(() => setInProgress(false))
    }, [txInfo, onUpdate])

    if (txInfo.readyToSubmit || txInfo.submitted)
        return null

    const providers = getAllProviders()
    return <div className="space">
        <div className="text-small dimmed">Sign transaction</div>
        <div className="signature-options micro-space">
            <div className="desktop-only">
                <ButtonGroup>
                    {providers.map(provider =>
                        <Button key={provider.title} outline disabled={inProgress} onClick={requestSignature} data-provider={provider.title}>
                            <img src={`/img/wallets/${provider.title.toLowerCase()}.svg`}/> {provider.title}
                        </Button>)}
                </ButtonGroup>
            </div>
            <div className="mobile-only">
                {providers.filter(p => !!p.mobileSupported).map(provider =>
                    <Button key={provider.title} outline block disabled={inProgress} onClick={requestSignature} data-provider={provider.title}>
                        <img src={`/img/wallets/${provider.title.toLowerCase()}.svg`}/> {provider.title}
                    </Button>)}
            </div>
        </div>
        {!!inProgress && <div className="loader"/>}
    </div>
})

async function processSignature(provider, txInfo) {
    let signedTx
    try {
        signedTx = await delegateTxSigning(provider, txInfo.xdr, txInfo.network)
    } catch (e) {
        notify({type: 'warning', message: e?.msg || 'Failed to obtain a transaction signature'})
        throw e
    }
    try {
        return await submitTx({...txInfo, xdr: signedTx})
    } catch (e) {
        notify({type: 'error', message: 'Failed to store transaction signature. Please repeat the process later.'})
        throw e
    }
}