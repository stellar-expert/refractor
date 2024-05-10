import React from 'react'
import {BlockSelect, InfoTooltip, UpdateHighlighter, UtcTimestamp} from '@stellar-expert/ui-framework'

export default function TxStatusView({tx}) {
    const {status, submitted, hash, network} = tx
    if (submitted)
        return <>
            <StatusRowView
                tooltip="The transaction has been signed, processed, and automatically submitted to Stellar network"
                extraInfo={<a href={`https://stellar.expert/explorer/${network}/tx/${hash}`} target="_blank"
                              className="icon-open-new-window" title="View in explorer"></a>}>
                Executed
            </StatusRowView>
            <DateRowView submitted={submitted} tooltip="Date and time when the transaction has been saved on the ledger"/>
        </>
    switch (status) {
        case 'pending':
            return <StatusRowView tooltip="The transaction has not reached the required signatures threshold yet"
                                  extraInfo={<span className="loader small"/>}>
                Waiting for signatures
            </StatusRowView>
        case 'ready':
            return <StatusRowView tooltip="The transaction has been fully signed and can be submitted to the network"
                                  extraInfo={<span className="loader small"/>}>
                Ready
            </StatusRowView>
        case 'processing':
            return <StatusRowView tooltip="The transaction has been fully signed and currently waits in the processing pipeline"
                                  extraInfo={<span className="loader small"/>}>
                Processing
            </StatusRowView>
        case 'processed':
            return <StatusRowView tooltip="The transaction has been fully signed and processed"
                                  extraInfo={<span className="loader small"/>}>
                Processed
            </StatusRowView>
        case 'failed':
            return <>
                <StatusRowView
                    tooltip="The transaction has been fully signed but failed during either callback execution or network submission process">
                    Automatic processing failed
                </StatusRowView>
                <DateRowView submitted={submitted} tooltip="Date and time when the transaction has been processed"/>
            </>
        default: return null
    }
}

function StatusRowView({tooltip, children, extraInfo}) {
    return <div>
        <span className="dimmed">State: </span>
        <span className="inline-block">
            <UpdateHighlighter><BlockSelect>{children}</BlockSelect></UpdateHighlighter>
            {!!extraInfo && <> {extraInfo}</>}
            <InfoTooltip>{tooltip}</InfoTooltip>
        </span>
    </div>
}

function DateRowView({submitted, tooltip}) {
    if (!submitted)
        return null
    return <div>
        <span className="dimmed">Timestamp: </span>
        <span className="d-line-block">
            <UtcTimestamp date={submitted}/>
            <InfoTooltip>{tooltip}</InfoTooltip>
        </span>
    </div>
}
