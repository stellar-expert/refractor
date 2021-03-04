import React from 'react'
import BlockSelect from '../components/block-select'

function SignerKey({address, selected}) {
    return <div className="small">
        {selected ? '✓' : '-'} <BlockSelect>{address}</BlockSelect>
    </div>
}

export default function TxSignaturesView({signatures, schema, readyToSubmit}) {
    const appliedSigners = signatures.map(sig => sig.key),
        potentialSigners = schema.discoverSigners(),
        otherAvailableSigners = potentialSigners.filter(signer => !appliedSigners.includes(signer))

    return <>
        <h3>Signatures</h3>
        {signatures.map(({key}) => <SignerKey key={key} address={key} selected/>)}
        {!signatures?.length && <div className="dimmed small">
            (no signatures so far)
        </div>}
        {!readyToSubmit && otherAvailableSigners.length > 0 &&
        <div className="micro-space">
            <h4 className="dimmed">{signatures.length ? 'Other available' : 'Available'} signers:</h4>
            {otherAvailableSigners.map(signer => <SignerKey key={signer} address={signer}/>)}
        </div>
        }
    </>
}