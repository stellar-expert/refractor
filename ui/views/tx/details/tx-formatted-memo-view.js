import React from 'react'
import {xdr} from '@stellar/stellar-sdk'

export function hasMemo(tx) {
    return tx.memo && tx.memo.type !== 'none'
}

//MEMO_TEXT decoded from XDR is a byte array, but a memo built in-process retains the original string
function formatMemoText(value) {
    return typeof value === 'string' ? value : new TextDecoder().decode(value)
}

export default function TxFormattedMemo({rawMemo}) {
    switch (rawMemo && rawMemo.type) {
        case 'id':
            return <><span className="word-break">{rawMemo.value}</span>&nbsp;
                <span className="dimmed">(MEMO_ID)</span></>
        case 'text':
            return <><span className="word-break">{formatMemoText(rawMemo.value)}</span>&nbsp;
                <span className="dimmed">(MEMO_TEXT)</span></>
        case 'hash':
        case 'return':
            return <><span className="word-break">{xdr.encodeBytes(rawMemo.value, 'base64')}</span>&nbsp;
                <span className="dimmed">(MEMO_{rawMemo.type.toUpperCase()})</span></>
        default: return <span className="dimmed">none</span>
    }
}