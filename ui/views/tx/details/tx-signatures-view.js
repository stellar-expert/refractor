import React from 'react'
import {BlockSelect, UpdateHighlighter, withErrorBoundary} from '@stellar-expert/ui-framework'
import {shortenString} from '@stellar-expert/formatter'

const signaturesWeight = {}

function SignerKey({address, weight, chars, changes, selected}) {
    let isHighlight = ''
    if (changes?.accepted?.length) {
        const signerInfo = changes.accepted.find(signer => signer.key === address) || {}
        isHighlight = Object.keys(signerInfo).length ? 'highlighter' : ''
    }
    if (chars && chars !== 'all') {
        address = shortenString(address, chars)
    }

    return <UpdateHighlighter>
        <div className={`text-small ${isHighlight}`}>
            {selected ? <span className="icon icon-feather"/> : '-'}&nbsp;
            <BlockSelect>{address}</BlockSelect>&nbsp;
            {!!weight && <span className="dimmed text-tiny">(w: {weight})</span>}
        </div>
    </UpdateHighlighter>
}

function TxStoreResult({changes}) {
    if (!changes) return null
    const {accepted, rejected} = changes

    accepted?.forEach(s => {
        const signer = shortenString(s.key, 12)
        notify({
            type: 'success',
            message: <span key={s.signature}>
                Accepted signature {signer}
            </span>
        })
    })

    rejected?.forEach(s => {
        const signer = s.key.replace(/_+/g,'**')
        notify({
            type: 'error',
            message: <span key={s.signature}>
                Rejected signature {signer}
            </span>
        })
    })

    return null
}

export default withErrorBoundary(function TxSignaturesView({signatures, schema, readyToSubmit, changes}) {
    const appliedSigners = signatures.map(sig => sig.key)
    const potentialSigners = schema.discoverSigners()
    const otherAvailableSigners = potentialSigners.filter(signer => !appliedSigners.includes(signer))

    schema.requirements.map(requirement =>
        requirement.signers.map(signer => signaturesWeight[signer.key] = signer.weight))

    return <div className="space">
        {signatures.map(({key}) =>
            <SignerKey key={key} weight={signaturesWeight[key]} address={key} chars={12} changes={changes} selected/>)}
        {!signatures?.length && <div className="dimmed text-small">
            (no signatures so far)
        </div>}
        {!readyToSubmit && otherAvailableSigners.length > 0 &&
            <div className="micro-space">
                <h4 className="dimmed">{signatures.length ? 'Other available' : 'Available'} signers:</h4>
                {otherAvailableSigners.map(signer =>
                    <SignerKey key={signer} weight={signaturesWeight[signer]} address={signer} chars={12}/>)}
            </div>
        }
        <TxStoreResult changes={changes}/>
    </div>
})