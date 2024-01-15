import React from 'react'
import {BlockSelect, InfoTooltip, UpdateHighlighter, UtcTimestamp} from '@stellar-expert/ui-framework'

function StatusRowView({tooltip, children, extraInfo}) {
    return <div>
        <span className="dimmed">Status: </span>
        <span className="inline-block">
            <UpdateHighlighter><BlockSelect>{children}</BlockSelect></UpdateHighlighter>
            {!!extraInfo && <> {extraInfo}</>}
            <InfoTooltip>{tooltip}</InfoTooltip>
        </span>
    </div>
}

function DateRowView({children}) {
    return <div>
        <span className="dimmed">Timestamp: </span>
        <span className="inline-block">
            <UtcTimestamp date={children}/>
        </span>
    </div>
}

export default function TxStatusView({tx, statusWatcher}) {
    const {status, submitted, hash, network} = tx
    if (submitted) return <>
        <StatusRowView tooltip="The transaction has been signed, processed, and automatically submitted to Stellar network"
                       extraInfo={<a href={`https://stellar.expert/explorer/${network}/tx/${hash}`} target="_blank" rel="noreferrer"
                                     className="icon-open-new-window" title="View in explorer"/>}>
            Executed
        </StatusRowView>
        <DateRowView>{submitted}</DateRowView>
    </>
    switch (status) {
        case 'pending':
            return <StatusRowView tooltip="The transaction has not reached the required signatures threshold yet">
                Waiting for signatures
            </StatusRowView>
        case 'ready':
            return <StatusRowView tooltip="The transaction has been fully signed and can be submitted to the network"
                                  extraInfo={!!statusWatcher && <span className="loader small"/>}>
                Ready
            </StatusRowView>
        case 'processing':
            return <StatusRowView tooltip="The transaction has been fully signed and currently waits in the processing pipeline"
                                  extraInfo={!!statusWatcher && <span className="loader small"/>}>
                Processing
            </StatusRowView>
        case 'processed':
            return <StatusRowView tooltip="The transaction has been fully signed and processed">
                Processed
            </StatusRowView>
        case 'failed':
            return <>
                <StatusRowView tooltip="The transaction has been fully signed but failed during either callback execution or network submission process">
                    Automatic processing failed
                </StatusRowView>
                {!!submitted && <DateRowView>{submitted}</DateRowView>}
            </>
        default: return null
    }
}