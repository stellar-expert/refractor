import React, {useEffect, useState} from 'react'
import {AccountAddress, Button, CopyToClipboard, Dialog, QrCode} from '@stellar-expert/ui-framework'
import {getWcStatus, subscribeWcStatus} from '../../../signer/walletconnect/wc-status'
import {formatPairingLink} from '../../../signer/walletconnect/wc-wallets'

export default function WalletConnectDialog() {
    const [status, setStatus] = useState(getWcStatus)

    useEffect(() => {
        const unsubscribe = subscribeWcStatus(setStatus)
        //status may have changed between the first render and the subscription
        setStatus(getWcStatus())
        return unsubscribe
    }, [])

    if (!status)
        return null
    return <Dialog dialogOpen className="walletconnect-dialog">
        <h3>WalletConnect</h3>
        <WalletConnectStage {...status}/>
        <div className="space row">
            <div className="column column-50 column-offset-50">
                <Button block outline onClick={status.cancel}>Cancel</Button>
            </div>
        </div>
    </Dialog>
}

function WalletConnectStage({stage, uri, wallet, account, mobileWallet}) {
    switch (stage) {
        case 'pairing': {
            //wallets ignore bare "wc:" links on mobile, so use the deep link of the chosen wallet app if any
            const pairingLink = mobileWallet ? formatPairingLink(mobileWallet.link, uri) : uri
            return <>
                <div className="text-center">
                    <QrCode value={uri} size={280}/>
                    <div className="text-small dimmed micro-space">
                        Scan with a WalletConnect-compatible Stellar wallet&nbsp;
                        <CopyToClipboard text={uri} title="Copy connection link"/>
                    </div>
                </div>
                <a className="button button-block mobile-only micro-space" href={pairingLink}>
                    Open in {mobileWallet?.name || 'wallet'}
                </a>
            </>
        }
        case 'requesting': {
            const walletName = wallet?.name || 'your wallet'
            //the plain native link reopens the app with the pending request
            const walletLink = mobileWallet?.link ||
                wallet?.redirect?.native || wallet?.redirect?.universal
            return <>
                <p>Confirm the transaction in {walletName}</p>
                {!!account && <div className="text-small">
                    <span className="dimmed">Connected account </span>
                    <AccountAddress account={account} chars={12} link={false}/>
                </div>}
                <div className="loader"/>
                {!!walletLink && <a className="button button-block mobile-only" href={walletLink}>Open {walletName}</a>}
            </>
        }
        default:
            return <>
                <div className="loader"/>
                <p className="text-center dimmed">Connecting…</p>
            </>
    }
}
