import React from 'react'
import {
    TxOperationsList,
    parseTxDetails, withErrorBoundary
} from '@stellar-expert/ui-framework'

/**
 * @param {{}} tx
 * @param {Boolean} embedded
 * @return {JSX.Element}
 */
export default withErrorBoundary(function TxDetailsView({xdr, network}) {
    const parsedTx = parseTxDetails({
        network: network,
        txEnvelope: xdr,
        context: {}
    })
    return <div className="space">
        <TxOperationsList parsedTx={parsedTx} showEffects={false}/>
    </div>
})