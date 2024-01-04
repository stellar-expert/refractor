import React from 'react'
import {formatDateUTC} from '@stellar-expert/formatter'
import {BlockSelect} from '@stellar-expert/ui-framework'

export function hasTimeBounds(tx) {
    return tx.timeBounds && (tx.timeBounds.minTime > 0 || tx.timeBounds.maxTime > 0)
}

export default function TxTimeBoundsView({tx}) {
    const {minTime, maxTime} = tx.timeBounds
    if (minTime > 0 && maxTime > 0) return <span className="d-line-block"><BlockSelect>{formatDateUTC(minTime)} - {formatDateUTC(maxTime)}</BlockSelect></span>
    if (minTime > 0) return <span className="d-line-block">from <BlockSelect>{formatDateUTC(minTime)}</BlockSelect></span>
    if (maxTime > 0) return <span className="d-line-block">to <BlockSelect>{formatDateUTC(maxTime)}</BlockSelect></span>
}