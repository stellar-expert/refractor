import React from 'react'
import {BlockSelect, CopyToClipboard, InfoTooltip, withErrorBoundary} from '@stellar-expert/ui-framework'

/**
 * Transaction details
 * @param {String} xdr - Transaction XDR
 */
export default withErrorBoundary(function TxTransactionXDRView({xdr}) {

    return <div style={{'display': 'inline-flex', 'maxWidth': '100%'}}>
        <span className="dimmed">Raw&nbsp;XDR:<InfoTooltip>
            Base64-encoded Stellar transaction XDR with signatures
        </InfoTooltip>
        </span>
        &emsp;
        <BlockSelect className="condensed" style={{'overflow': 'hidden', 'whiteSpace': 'nowrap'}}>{xdr}</BlockSelect>
        <CopyToClipboard text={xdr}/>
    </div>
})