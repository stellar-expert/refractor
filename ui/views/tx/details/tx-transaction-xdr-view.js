import React from 'react'
import {BlockSelect, CopyToClipboard, InfoTooltip} from '@stellar-expert/ui-framework'

/**
 * Transaction details
 * @param {String} xdr - Transaction XDR
 */
export default function TxTransactionXDRView({xdr}) {

    return <div style={{'display': 'inline-flex', 'maxWidth': '100%'}}>
        <span className="dimmed">Raw&nbsp;XDR:&nbsp;</span>
        <BlockSelect className="condensed" style={{'overflow': 'hidden', 'whiteSpace': 'nowrap'}}>{xdr}</BlockSelect>
        <CopyToClipboard text={xdr}/>
        <InfoTooltip>
            Base64-encoded Stellar transaction XDR with signatures
        </InfoTooltip>
        {/*&nbsp;
            <a href={formatLabLink(txInfo)} target="_blank" className="small nowrap">View in Laboratory</a>*/}
    </div>
}