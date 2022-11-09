import React from 'react'
import {BlockSelect} from '@stellar-expert/ui-framework'

function SignerKey({address, selected}) {
    return <div className="text-small">
        {selected ? <span className="icon icon-feather"/> : '-'}&nbsp;<BlockSelect>{address}</BlockSelect>
    </div>
}

export default function TxSignaturesView({signatures, schema, readyToSubmit}) {
    const appliedSigners = signatures.map(sig => sig.key),
        potentialSigners = schema.discoverSigners(),
        otherAvailableSigners = potentialSigners.filter(signer => !appliedSigners.includes(signer))

    return <div className="space">
        {signatures.map(({key}) => <SignerKey key={key} address={key} selected/>)}
        {!signatures?.length && <div className="dimmed text-small">
            (no signatures so far)
        </div>}
        {!readyToSubmit && otherAvailableSigners.length > 0 &&
            <div className="micro-space">
                <h4 className="dimmed">{signatures.length ? 'Other available' : 'Available'} signers:</h4>
                {otherAvailableSigners.map(signer => <SignerKey key={signer} address={signer}/>)}
            </div>
        }
    </div>
}