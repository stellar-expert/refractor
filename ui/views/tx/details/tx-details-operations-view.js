import React from 'react'
import {TransactionBuilder} from '@stellar/stellar-sdk'
import OperationDescription from './operation-description-view'

/**
 * Transaction details
 * @param {String} xdr - Transaction XDR
 * @param {String} network - Network identifier or passphrase
 * @param {Boolean} compact? - Whether to show extended tx info
 */
export default function TxDetailsOperationsView({xdr, network, compact = false}) {
    const tx = TransactionBuilder.fromXDR(xdr, network)

    if (!tx) return <div>
        <span className="icon-warning color-danger"/> Transaction is invalid
    </div>

    return <div className="space">
        {tx.operations.length === 1 ?
            <OperationDescription op={tx.operations[0]} source={tx.source}/> :
            <>{tx.operations.map((op, i) => <div key={i}>
                <i className="icon icon-angle-right"/><OperationDescription key={i} op={op} source={tx.source}/>
            </div>)}</>}
    </div>
}