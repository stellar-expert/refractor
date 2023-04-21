import React from 'react'
import {BlockSelect, InfoTooltip} from '@stellar-expert/ui-framework'
import {formatDateUTC} from '@stellar-expert/formatter'
import {loadTx} from '../../../infrastructure/tx-dispatcher'


function StatusRowView({tooltip, children, extraInfo}) {
    return <div>
        <span className="dimmed">Status: </span>
        <span className="d-line-block">
            <BlockSelect>{children}</BlockSelect>
            {!!extraInfo && <> {extraInfo}</>}
            <InfoTooltip>{tooltip}</InfoTooltip>
        </span>
    </div>
}

function DateRowView({tooltip, children, extraInfo}) {
    return <div>
        <span className="dimmed">Timestamp: </span>
        <span className="d-line-block">
            <BlockSelect>{children}</BlockSelect>
        </span>
    </div>
}

export default function TxStatusView({tx}) {
    const {status, submitted, hash, network} = tx
    if (submitted) return <>
        <StatusRowView
            tooltip="The transaction has been signed, processed, and automatically submitted to Stellar network"
            extraInfo={<a href={`https://stellar.expert/explorer/${network}/tx/${hash}`} target="_blank"
                          className="icon-open-new-window" title="View in explorer"></a>}>
            Executed
        </StatusRowView>
        <DateRowView>{formatDateUTC(submitted)}</DateRowView>
    </>
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
            if (submitted) return <>
                <StatusRowView
                    tooltip="The transaction has been fully signed but failed during either callback execution or network submission process">
                    Automatic processing failed
                </StatusRowView>
                <DateRowView>{formatDateUTC(submitted)}</DateRowView>
            </>
    }
}