import React, {useEffect, useMemo} from 'react'
import {BlockSelect, UpdateHighlighter, withErrorBoundary} from '@stellar-expert/ui-framework'
import {shortenString} from '@stellar-expert/formatter'

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

function TxStoreResult({changes}) {  //TODO: refactor
    if (!changes)
        return null
    const {accepted, rejected} = changes

    useEffect(() => {
        accepted?.forEach(s => {
            const signer = shortenString(s.key, 12)
            notify({
                type: 'success',
                message: <span key={s.signature}>
                Signature from {signer} accepted
            </span>
            })
        })

        rejected?.forEach(s => {
            const signer = s.key.replace(/_+/g, '...')
            notify({
                type: 'error',
                message: <span key={s.signature}>
                Signature from {signer} rejected
            </span>
            })
        })
    }, [accepted, rejected])

    return null
}

export default withErrorBoundary(function TxSignaturesView({signatures, schema, readyToSubmit, changes}) {
    const appliedSigners = signatures.map(sig => sig.key)
    const potentialSigners = schema.getAllPotentialSigners()
    const otherAvailableSigners = potentialSigners.filter(signer => !appliedSigners.includes(signer))
    const weights = useMemo(() => {
        const res = {}
        for (const requirement of schema.requirements) {
            for (const signer of requirement.signers) {
                res[signer.key] = signer.weight
            }
        }
        return res
    }, [schema.requirements])


    return <div className="space">
        {signatures.map(({key}) => <SignerKey key={key} weight={weights[key]} address={key} chars={12} changes={changes} selected/>)}
        {!signatures?.length && <div className="dimmed text-small">
            (no signatures so far)
        </div>}
        {!readyToSubmit && otherAvailableSigners.length > 0 &&
            <div className="micro-space">
                <h4 className="dimmed">{signatures.length ? 'Other available' : 'Available'} signers:</h4>
                {otherAvailableSigners.map(signer => <SignerKey key={signer} weight={weights[signer]} address={signer} chars={12}/>)}
            </div>}
        <TxStoreResult changes={changes}/>
    </div>
})