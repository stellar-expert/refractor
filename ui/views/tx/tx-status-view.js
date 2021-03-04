import React from 'react'
import BlockSelect from '../components/block-select'
import InfoTooltip from '../components/info-tooltip'
import {formatUnixDate} from '../../util/date-utils'

function StatusRowView({tooltip, children, extraInfo}) {
    return <div>
        <span className="dimmed">Status: </span>
        <BlockSelect>{children}</BlockSelect>
        <InfoTooltip>{tooltip}</InfoTooltip>
        {!!extraInfo && <> {extraInfo}</>}
    </div>
}

export default function TxStatusView({tx}) {
    const {status, submitted, hash, network} = tx
    if (submitted) return <StatusRowView
        tooltip="The transaction has been signed, processed, and automatically submitted to Stellar network"
        extraInfo={<a href={`https://stellar.expert/explorer/${network}/tx/${hash}`} target="_blank"
                      className="small">View in explorer</a>}>
        Submitted to the network <BlockSelect>{formatUnixDate(submitted)}</BlockSelect>
    </StatusRowView>
    switch (status) {
        case 'pending':
            return <StatusRowView tooltip="The transaction has not reached the required signatures threshold yet">
                Waiting for signatures
            </StatusRowView>
        case 'ready':
            return <StatusRowView tooltip="The transaction has been fully signed and can be submitted to the network">
                Ready
            </StatusRowView>
        case 'processing':
            return <StatusRowView
                tooltip="The transaction has been fully signed and currently waits in the processing pipeline">
                Processing
            </StatusRowView>
        case 'processed':
            return <StatusRowView tooltip="The transaction has been fully signed and processed">
                Processed
            </StatusRowView>
        case 'failed':
            return <StatusRowView
                tooltip="The transaction has been fully signed but failed during either callback execution or network submission process">
                Automatic processing failed
            </StatusRowView>
    }
}