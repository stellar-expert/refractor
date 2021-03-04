import React, {useState} from 'react'
import {useParams} from 'react-router'
import {useDependantState} from '../hooks/state-hooks'
import {loadTx} from '../../infrastructure/tx-dispatcher'
import BlockSelect from '../components/block-select'
import TxSignaturesView from './tx-signatures-view'
import InfoTooltip from '../components/info-tooltip'
import TxAddSignatureView from './tx-add-signature-view'
import {formatUnixDate} from '../../util/date-utils'
import TxStatusView from './tx-status-view'
import HorizonSubmitTxView from './horizon-submit-tx-view'

function shortenTxHash(hash, len = 12) {
    return hash.substr(0, len / 2) + '…' + hash.substr(-len / 2)
}

function formatLabLink({network, xdr}) {
    return `https://laboratory.stellar.org/#xdr-viewer?input=${xdr}&type=TransactionEnvelope&network=${network}`
}

export default function TxView() {
    const {txhash} = useParams(),
        [error, setError] = useState(null),
        [txInfo, setTxInfo] = useDependantState(() => {
            setError('')
            loadTx(txhash)
                .then(txInfo => setTxInfo(txInfo))
                .catch(e => setError(e))
            return null
        }, [txhash])
    if (error) throw error
    if (!txInfo) return <div className="loader"/>
    return <div className="card">
        <h2>Transaction {shortenTxHash(txhash)}</h2>
        <hr/>
        <div className="space">
            <div>
                <span className="dimmed">Hash:</span> <BlockSelect className="condensed">{txhash}</BlockSelect>
                <InfoTooltip>
                    Unique transaction hash
                </InfoTooltip>
            </div>
            <div>
                <span className="dimmed">Network:</span> <BlockSelect>{txInfo.network}</BlockSelect>
                <InfoTooltip>
                    Stellar network name ("public" or "testnet")
                </InfoTooltip>
            </div>
            {!!txInfo.minTime && <div>
                <span className="dimmed">Valid since: </span>
                <BlockSelect>{formatUnixDate(txInfo.minTime)}</BlockSelect>
                <InfoTooltip>
                    MinTime value from the transaction TimeBounds conditions
                </InfoTooltip>
            </div>}
            {!!txInfo.maxTime && <div>
                <span className="dimmed">Expiration: </span>
                <BlockSelect>{formatUnixDate(txInfo.maxTime)}</BlockSelect>
                <InfoTooltip>
                    When transaction expires, it will be deleted automatically
                </InfoTooltip>
            </div>}
            {!!txInfo.submit && <div>
                <span className="dimmed">Submit: </span> auto
                <InfoTooltip>
                    The transaction will be automatically submitted to Horizon once ready
                </InfoTooltip>
            </div>}
            {!!txInfo.callbackUrl && <div>
                <span className="dimmed">Callback URL: </span>
                <BlockSelect>{txInfo.callbackUrl}</BlockSelect>
                <InfoTooltip>
                    The transaction will be POSTed to this URL once ready
                </InfoTooltip>
            </div>}
            <TxStatusView tx={txInfo}/>
            <div>
                <span className="dimmed">Transaction&nbsp;XDR:&nbsp;</span>
                <BlockSelect className="condensed word-break" wrap>{txInfo.xdr}</BlockSelect>
                <InfoTooltip>
                    Base64-encoded Stellar transaction XDR with signatures
                </InfoTooltip>{' '}
                <a href={formatLabLink(txInfo)} target="_blank" className="small nowrap">View in Laboratory</a>
            </div>
        </div>
        <TxSignaturesView {...txInfo}/>
        <HorizonSubmitTxView {...txInfo}/>
        <TxAddSignatureView txInfo={txInfo} onUpdate={txInfo => setTxInfo(txInfo)}/>
    </div>
}