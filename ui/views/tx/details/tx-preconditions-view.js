import React from 'react'
import {AccountAddress, InfoTooltip as Info} from '@stellar-expert/ui-framework'

function formatDateUTC(date) {
    const parseDate = new Date(date * 1000)
    if (isNaN(parseDate.valueOf())) return '∞'
    return parseDate
        .toISOString()
        .replace(/(T|\.\d+Z)/g, ' ') // make it more human friendly
        .trim()
}

function parseTimeBounds(preconditions) {
    if (!preconditions.timeBounds)
        return null
    const {minTime, maxTime} = preconditions.timeBounds
    const info = <Info link="https://developers.stellar.org/docs/glossary/transactions/#time-bounds">
        The timestamp, determined by ledger time, of a lower and upper bound of when this transaction is valid. If a transaction is
        submitted too early or too late, it will fail to make it into the transaction set.
    </Info>
    if (minTime > 0 && maxTime > 0)
        return <><span className="dimmed">Valid</span>{' '}
            <span className="condensed">{formatDateUTC(minTime)} - {formatDateUTC(maxTime)}</span>{info}</>
    if (minTime > 0)
        return <><span className="dimmed">Valid after</span> <span className="condensed">{formatDateUTC(minTime)}{info}</span></>
    if (maxTime > 0)
        return <><span className="dimmed">Valid before</span> <span className="condensed">{formatDateUTC(maxTime)}</span>{info}</>
    return null
}

function parseLedgerBounds(preconditions) {
    if (!preconditions.ledgerBounds)
        return null
    const {minLedger, maxLedger} = preconditions.ledgerBounds
    const info = <Info link="https://developers.stellar.org/docs/glossary/transactions/#ledger-bounds">
        The transaction is only valid for ledger numbers that fall into the specified ledger sequence range.
    </Info>
    if (minLedger > 0 && maxLedger > 0) return <><span className="dimmed">Valid
        between</span> {minLedger} <span className="dimmed">and</span> {maxLedger} <span className="dimmed">ledgers</span>{info}</>
    if (minLedger > 0) return <><span className="dimmed">Valid after ledger</span> {minLedger}{info}</>
    if (maxLedger > 0) return <><span className="dimmed">Valid before ledger</span> {maxLedger}{info}</>
    return null
}


function parseMinSequence(preconditions) {
    if (!preconditions.minAccountSequence)
        return null
    return <>
        <span className="dimmed">Minimum account sequence:</span> {preconditions.minAccountSequence}
        <Info link="https://developers.stellar.org/docs/glossary/transactions/#minimum-sequence-number">
            <p>
                The transaction is valid when its source account’s sequence number satisfies{' '}
                <code>tx.minSeqNum &lt;= source.sequence &lt; tx.seqNum</code>.
            </p>
            Note that after a transaction is executed, the account will always set its sequence number to the transaction’s sequence number.
        </Info>
    </>
}

function parseMinSequenceAge(preconditions) {
    if (!preconditions.minAccountSequenceAge)
        return null
    return <>
        <span className="dimmed">Minimum account sequence age:</span> {preconditions.minAccountSequenceAge._value.toString()}{' '}
        <span className="dimmed">seconds</span>
        <Info link="https://developers.stellar.org/docs/glossary/transactions/#minimum-sequence-age">
            <p>
                The transaction is only valid after a specified duration (expressed in seconds) elapses since the account’s sequence number
                age.
            </p>
            Minimum sequence age is a precondition relating to time, but unlike time bounds which express absolute times, minimum sequence
            age is relative to when the transaction source account’s sequence number was touched.
        </Info>
    </>
}

function parseMinSequenceGap(preconditions) {
    if (!preconditions.minAccountSequenceLedgerGap)
        return null
    return <>
        <span className="dimmed">Minimum sequence ledger gap:</span> {preconditions.minAccountSequenceLedgerGap}
        <Info link="https://developers.stellar.org/docs/glossary/transactions/#minimum-sequence-ledger-gap">
            <p>
                The transaction is only valid after the current network ledger number meets (or exceeds) a particular gap relative to
                the ledger corresponding to the account’s sequence number age.
            </p>
            This is similar to the minimum sequence age, except it’s expressed as a number of ledgers rather than a duration of time.
        </Info>
    </>
}

function parseExtraSigners(preconditions) {
    const {extraSigners} = preconditions
    if (!extraSigners?.length)
        return null
    return <>
        <span className="dimmed">Required extra signer{extraSigners.length > 1 ? 's' : ''}:{' '}</span>
        {extraSigners.map((s, i) => <span key={i + s}>{i > 0 && ', '}<AccountAddress account={s}/></span>)}
        <Info link="https://developers.stellar.org/docs/glossary/transactions/#extra-signers">
            Extra signers precondition means it must have signatures that correspond to those extra signers,
            even if those signatures would not otherwise be required to authorize the transaction
            (i.e. for its source account or operations).
        </Info>
    </>
}

export default function TxPreconditionsView({tx}) {
    const parsed = [
        parseTimeBounds(tx),
        parseLedgerBounds(tx),
        parseMinSequence(tx),
        parseMinSequenceAge(tx),
        parseMinSequenceGap(tx),
        parseExtraSigners(tx)
    ].filter(r => !!r)

    if (!parsed.length)
        return null
    return <>
        {parsed.map((component, i) => <div key={tx.hash + i}>{component}</div>)}
    </>
}