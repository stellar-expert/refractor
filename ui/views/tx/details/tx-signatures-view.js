import React from 'react'
import cn from 'classnames'
import {BlockSelect, UpdateHighlighter} from '@stellar-expert/ui-framework'
import {shortenString} from '@stellar-expert/formatter'

const signaturesWeight = {}

function SignerKey({address, weight, chars, result = null, selected}) {
    let isHighlight = ''
    if (result && result.changes.accepted?.length) {
        const signerInfo = result.changes.accepted.find(signer => signer.key === address) || {}
        isHighlight = Object.keys(signerInfo).length ? 'highlighter' : ''
    }
    if (chars && chars !== 'all') {
        address = shortenString(address, chars)
    }

    return <UpdateHighlighter>
        <div className={`text-small ${isHighlight}`}>
            {selected ? <span className="icon icon-feather"/> : '-'}&nbsp;
            <BlockSelect>{address}</BlockSelect>&nbsp;
            {weight && <span className="dimmed text-tiny">(w: {weight})</span>}
        </div>
    </UpdateHighlighter>
}

function SignatureResult({signer, chars, weight, accepted}) {
    if (chars && chars !== 'all') {
        signer = shortenString(signer, chars)
    }
    return <div>
        <i className={cn('icon', accepted ? 'icon-ok' : 'icon-block')}/>&nbsp;
        <BlockSelect>{signer}</BlockSelect>&nbsp;
        {weight && <span className="dimmed text-tiny">(w: {weight})</span>}
    </div>
}

function TxStoreResult({result}) {
    if (!result) return <></>
    const {accepted, rejected} = result.changes

    return <>
        <h3 className="space">Changes</h3>
        <hr/>
        <div className="small">
            {accepted?.length > 0 && <div>
                <h4 className="dimmed">
                    Accepted signatures:
                </h4>
                <div className="text-small">
                    {accepted.map(s => <SignatureResult key={s.signature} signer={s.key} weight={signaturesWeight[s.key]}  chars={12} accepted/>)}
                </div>
            </div>}
            {rejected?.length > 0 && <div>
                <h4 className="dimmed">
                    Rejected signatures:
                </h4>
                <div className="text-small">
                    {rejected.map(s => <SignatureResult key={s.signature} signer={s.key.replace(/_+/g,'**')}/>)}
                </div>
            </div>}
        </div>
    </>
}

export default function TxSignaturesView({signatures, schema, readyToSubmit, resultAction}) {
    const appliedSigners = signatures.map(sig => sig.key),
        potentialSigners = schema.discoverSigners(),
        otherAvailableSigners = potentialSigners.filter(signer => !appliedSigners.includes(signer))

    schema.requirements.map(requirement => {
        requirement.signers.map(signer => signaturesWeight[signer.key] = signer.weight)
    });

    return <div className="space">
        {signatures.map(({key}) => <SignerKey key={key} weight={signaturesWeight[key]} address={key} chars={12} result={resultAction} selected/>)}
        {!signatures?.length && <div className="dimmed text-small">
            (no signatures so far)
        </div>}
        {!readyToSubmit && otherAvailableSigners.length > 0 &&
            <div className="micro-space">
                <h4 className="dimmed">{signatures.length ? 'Other available' : 'Available'} signers:</h4>
                {otherAvailableSigners.map(signer => <SignerKey key={signer} weight={signaturesWeight[signer]} address={signer} chars={12}/>)}
            </div>
        }
        <TxStoreResult result={resultAction}/>
    </div>
}