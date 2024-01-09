import React from 'react'
import {Networks, TransactionBuilder} from '@stellar/stellar-sdk'
import {AccountAddress, BlockSelect, CopyToClipboard, InfoTooltip} from '@stellar-expert/ui-framework'
import {formatDateUTC} from '@stellar-expert/formatter'
import TxTimeBoundsView, {hasTimeBounds} from './tx-timebounds-view'
import TxFormattedMemo, {hasMemo} from './tx-formatted-memo-view'
import TxStatusView from './tx-status-view'

/*function formatLabLink({network, xdr}) {
    return `https://laboratory.stellar.org/#xdr-viewer?input=${encodeURIComponent(xdr)}&type=TransactionEnvelope&network=${network}`
}*/

export default function TxPropsView({txInfo}) {
    let tx = TransactionBuilder.fromXDR(txInfo.xdr, Networks[txInfo.network.toUpperCase()])
    const isFeeBump = !!tx.innerTransaction
    const feeSponsor = isFeeBump && tx.feeSource
    if (isFeeBump) {
        tx = tx.innerTransaction
    }
    return <div className="space">
        <TxStatusView tx={txInfo}/>
        <div>
            <span className="dimmed">Network:</span> <BlockSelect>{txInfo.network}</BlockSelect>
            <InfoTooltip>
                Stellar network name ("public" or "testnet")
            </InfoTooltip>
        </div>
        {!!txInfo.submit && <div>
            <span className="dimmed">Autosubmit: </span> yes
            <InfoTooltip>
                This transaction will be automatically submitted to Horizon once ready
            </InfoTooltip>
        </div>}
        {!!txInfo.callbackUrl && <div>
            <span className="dimmed">Callback URL: </span>
            <BlockSelect inline>{txInfo.callbackUrl}</BlockSelect>
            <InfoTooltip>
                This transaction will be automatically sent to the callback URL via HTTP POST request once ready
            </InfoTooltip>
        </div>}
        {!!txInfo.maxTime && <div>
            <span className="dimmed">Expiration: </span>
            <BlockSelect>{formatDateUTC(txInfo.maxTime)}</BlockSelect>
            <InfoTooltip>
                When transaction expires, it will be deleted from the database
            </InfoTooltip>
        </div>}
        {hasTimeBounds(tx) && <div>
            <span className="label">Time restrictions: </span>
            <TxTimeBoundsView tx={tx}/>
            <InfoTooltip>
                Time restrictions (minimum/maximum) set in this transactions
            </InfoTooltip>
        </div>}
        {hasMemo(tx) && <div>
            <span className="label">Memo: </span>
            <TxFormattedMemo rawMemo={tx.memo}/>
            <InfoTooltip>
                Memo attached to the transaction
            </InfoTooltip>
        </div>}
        <div>
            <span className="label">Source account: </span>
            <AccountAddress account={tx.source} chars={12}/>
            <CopyToClipboard text={tx.source}/>
            <InfoTooltip>
                Source account of this transaction
            </InfoTooltip>
        </div>
        {isFeeBump && <div>
            <span className="label">Fee sponsor: </span>
            <AccountAddress account={feeSponsor}/>
            <InfoTooltip>
                Fee sponsor account of the wrapped transaction
            </InfoTooltip>
        </div>}
        <div>
            <span className="label">Source sequence: </span>
            <span className="inline-block">
                <BlockSelect inline wrap className="condensed">{tx.sequence}</BlockSelect>
                <InfoTooltip>
                    Sequence of the source account
                </InfoTooltip>
            </span>
        </div>
    </div>
}