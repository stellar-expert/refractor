import React from 'react'

export default function DesiredTxSignersView({signers, onChange}) {
    const signersToRender = [...signers].filter(s => !!s)
    signersToRender.push('')

    function editSigner(i, e) {
        const newSigners = [...signers],
            {value} = e.target
        newSigners[i] = value//.replace(/[^ABCDEFGHIJKLMNOPQRSTUVWXYZ234567]/g, '')
        onChange(newSigners.filter(s => !!s))
    }

    return <div>
        {signersToRender.map((signer, i) => <div key={i}>
            <input type="text" value={signer} placeholder="Copy-paste signer key here"
                   onChange={e => editSigner(i, e)}/>
        </div>)}
    </div>
}