import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {Button, Dropdown, withErrorBoundary} from '@stellar-expert/ui-framework'
import {apiSubmitTx} from '../../../infrastructure/tx-dispatcher'
import {delegateTxSigning, getAllProviders, getAvailableProviders} from '../../../signer/tx-signer'
import AddXdrView from '../add-xdr-view'
import './add-signatures.scss'

const selectedWalletKey = 'preferredWallet'
//static list for the mobile block - only wallets that work on mobile devices
const mobileProviders = getAllProviders().filter(provider => !!provider.mobileSupported)

export default withErrorBoundary(function TxAddSignatureView({txInfo, onUpdate}) {
    const [inProgress, setInProgress] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    //null while the wallet detection is in progress
    const [providers, setProviders] = useState(null)
    const [wallet, setWallet] = useState(() => localStorage.getItem(selectedWalletKey) || null)

    useEffect(() => {
        let unmounted = false
        getAvailableProviders()
            .then(available => {
                if (unmounted)
                    return
                setProviders(available)
                //auto-select previously used wallet or fall back to the first available one
                setWallet(prev => available.some(p => p.title === prev) ? prev : (available[0]?.title || null))
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
        localStorage.setItem(selectedWalletKey, value)
        signWith(value)
    }, [signWith])

    const requestMobileSignature = useCallback(e => signWith(e.currentTarget.dataset.provider), [signWith])

    const toggleImportModal = useCallback(() => setIsOpen(prev => !prev), [])

    const walletOptions = useMemo(() => (providers || []).map(provider => ({
        value: provider.title,
        title: <><WalletIcon wallet={provider.title}/>{provider.title}&nbsp;</>
    })), [providers])

    if (txInfo.readyToSubmit || txInfo.submitted)
        return null

    return <div className="space">
        <div className="text-small dimmed">Sign transaction</div>
        <div className="signature-options micro-space">
            <div className="desktop-only">
                <div className="row">
                    <div className="column column-50">
                        {providers?.length ?
                            <Dropdown className="wallet-select" options={walletOptions} value={wallet} onChange={selectAndSign} solo
                                      disabled={inProgress} showToggle={false} header={<h3>Select a wallet</h3>}
                                      hint="Sign with one of the available wallets"
                                      title={<Button block disabled={inProgress}>Sign</Button>}/> :
                            !providers ?
                                <div className="loader inline"/> :
                                <span className="dimmed">No wallets detected</span>}
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
    return <img src={`/img/wallets/${wallet.toLowerCase()}.svg`} alt="" onError={hideMissing}/>
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