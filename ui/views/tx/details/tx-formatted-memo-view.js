import React from 'react'

export function hasMemo(tx) {
    return tx.memo && tx.memo._type !== 'none'
}

/**
 * Convert raw memo value (string, Buffer, or Uint8Array since SDK v17) to a displayable string
 * @param {string|Uint8Array} value
 * @param {'utf8'|'base64'} encoding
 * @return {string}
 */
function decodeMemoValue(value, encoding) {
    if (typeof value === 'string')
        return value
    return Buffer.from(value).toString(encoding)
}

export default function TxFormattedMemo({rawMemo}) {
    switch (rawMemo && rawMemo._type) {
        case 'id':
            return <><span className="word-break">{rawMemo._value.toString()}</span>&nbsp;
                <span className="dimmed">(MEMO_ID)</span></>
        case 'text':
            return <><span className="word-break">{decodeMemoValue(rawMemo._value, 'utf8')}</span>&nbsp;
                <span className="dimmed">(MEMO_TEXT)</span></>
        case 'hash':
        case 'return':
            return <><span className="word-break">{decodeMemoValue(rawMemo._value, 'base64')}</span>&nbsp;
                <span className="dimmed">(MEMO_{rawMemo._type.toUpperCase()})</span></>
        default:
            return <span className="dimmed">none</span>
    }
}
