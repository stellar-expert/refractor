import React, {useCallback, useState} from 'react'
import {Button} from '@stellar-expert/ui-framework'
import {submitTx} from '../../infrastructure/tx-dispatcher'
import DialogView from '../component/dialog-view'

export default function AddXdrView({isOpen, changeVisible, txInfo, onUpdate}) {
    const [inProgress, setInProgress] = useState(false)
    const [signedXdr, setSignedXdr] = useState('')

    const changeSignedXdr = useCallback(e => {
        const val = e.target.value.trim()
        setSignedXdr(val)
    }, [])

    const importXdr = useCallback(() => {
        setInProgress(true)
        submitTx({
            network: txInfo.network,
            xdr: signedXdr
        })
            .then(txInfo => {
                setSignedXdr('')
                changeVisible(false)
                onUpdate(txInfo)
            })
            .catch(e => {
                setInProgress(false)
                notify({type: 'error', message: e.message})
            })
    }, [txInfo, signedXdr])

    return <DialogView dialogOpen={isOpen}>
        <h3>Transaction XDR</h3>
        <textarea value={signedXdr} disabled={inProgress} onChange={changeSignedXdr}
                  className="text-small text-monospace condensed"
                  placeholder="Base64-encoded transaction envelope"
                  style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '8rem',
                      maxHeight: '32rem',
                      display: 'block',
                      resize: 'vertical'
                  }}/>
        <div className="space row">
            <div className="column column-50">
                {!!inProgress && <>
                    <div className="loader inline"/>
                    <span className="dimmed text-small"> In progress...</span>
                </>}
            </div>
            <div className="column column-25">
                <Button block outline disabled={inProgress} onClick={changeVisible}>Cancel</Button>
            </div>
            <div className="column column-25">
                <Button block disabled={inProgress} onClick={importXdr}>Import</Button>
            </div>
        </div>
    </DialogView>
}