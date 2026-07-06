import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {Button, Dropdown, withErrorBoundary} from '@stellar-expert/ui-framework'
import {apiSubmitTx} from '../../../infrastructure/tx-dispatcher'
import {delegateTxSigning, getAllProviders, getAvailableProviders} from '../../../signer/tx-signer'
import AddXdrView from '../add-xdr-view'
import './add-signatures.scss'

//static list for the mobile block - only wallets that work on mobile devices
const mobileProviders = getAllProviders().filter(provider => !!provider.mobileSupported)

export default withErrorBoundary(function TxAddSignatureView({txInfo, onUpdate}) {
    const [inProgress, setInProgress] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    //null while the wallet detection is in progress
    const [providers, setProviders] = useState(null)
    const [wallet, setWallet] = useState(null)

    useEffect(() => {
        let unmounted = false
        getAvailableProviders()
            .then(providers => {
                if (unmounted)
                    return
                setProviders(providers)
            })
        return () => {
            unmounted = true
        }
    }, [])

    const signWith = useCallback(provider => {
        setInProgress(true)
        processSignature(provider, txInfo)
            .then(updatedTxInfo => onUpdate(updatedTxInfo))
            .catch(e => console.error(e))
            .finally(() => setInProgress(false))
    }, [txInfo, onUpdate])

    //remember the choice and immediately request a signature with the selected wallet
    const selectAndSign = useCallback(value => {
        setWallet(value)
        signWith(value)
    }, [signWith])

    const requestMobileSignature = useCallback(e => signWith(e.currentTarget.dataset.provider), [signWith])

    const toggleImportModal = useCallback(() => setIsOpen(prev => !prev), [])

    const walletOptions = (providers || []).sort((a, b) => b.available - a.available).map(provider => ({
        value: provider.title,
        title: <span style={!provider.available ? {filter: 'grayscale(1)'}:{}}>
            <WalletIcon wallet={provider.title}/>{provider.title}&nbsp;
            {!provider.available&&<span className="dimmed text-tiny">(not connected)</span>}
        </span>,
        disabled: !provider.available
    }))

    if (txInfo.readyToSubmit || txInfo.submitted)
        return null

    return <div className="space">
        <div className="text-small dimmed">Sign transaction</div>
        <div className="signature-options micro-space">
            <div className="desktop-only">
                <div className="row">
                    <div className="column column-50">
                        {providers?.length ?
                            <Dropdown className="wallet-select" options={walletOptions} value="" onChange={selectAndSign} solo
                                      disabled={inProgress} showToggle={false} header={<h3>Choose Wallet</h3>}
                                      hint="Use any supported wallet to sign the transaction"
                                      title={<Button block disabled={inProgress}>Sign</Button>}/> :
                            <Button block disabled={true}>Sign</Button>
                        }
                        {/*<span className="dimmed text-tiny">No supported wallets detected</span>*/}
                    </div>
                    <div className="column column-50">
                        <Button block outline disabled={inProgress} onClick={toggleImportModal}>
                            <i className="icon icon-download"/> Import</Button>
                    </div>
                </div>
            </div>
            <div className="mobile-only">
                {mobileProviders.map(provider =>
                    <Button key={provider.title} outline block disabled={inProgress} onClick={requestMobileSignature}
                            data-provider={provider.title}>
                        <WalletIcon wallet={provider.title}/> {provider.title}
                    </Button>)}
                <Button block outline disabled={inProgress} onClick={toggleImportModal}>
                    <i className="icon icon-download"/> Import
                </Button>
            </div>
        </div>
        {!!inProgress && <div className="loader"/>}
        <AddXdrView isOpen={isOpen} changeVisible={toggleImportModal} txInfo={txInfo} onUpdate={onUpdate}/>
    </div>
})

const WalletIcon = React.memo(function WalletIcon({wallet}) {
    //hide the icon if it's missing for a given wallet
    const hideMissing = useCallback(e => e.target.style.display = 'none', [])
    return <span className="wallet-icon" style={{backgroundImage: `url(/img/wallets/${wallet.toLowerCase()}.svg)`}}/>
})

async function processSignature(provider, txInfo) {
    let signedTx
    try {
        signedTx = await delegateTxSigning(provider, txInfo.xdr, txInfo.network)
    } catch (e) {
        notify({type: 'warning', message: e?.msg || e?.message || 'Failed to obtain a transaction signature'})
        throw e
    }
    try {
        return await apiSubmitTx({...txInfo, xdr: signedTx})
    } catch (e) {
        notify({type: 'error', message: 'Failed to store transaction signature. Please repeat the process later.'})
        throw e
    }
}