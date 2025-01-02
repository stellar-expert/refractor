import React, {useCallback, useState} from 'react'
import isEqual from 'react-fast-compare'
import {Button, Dropdown} from '@stellar-expert/ui-framework'
import {navigation} from '@stellar-expert/navigation'
import {apiSubmitTx} from '../../../infrastructure/tx-dispatcher'
import config from '../../../app.config.json'

const networkOptions = Object.keys(config.networks)
    .map(key => ({value: key, title: config.networks[key].title + ' network'}))

function Optional() {
    return <span className="dimmed text-small"> (optional)</span>
}

function TxPropsBlock({title, description, optional = false, children}) {
    return <div className="space">
        {title}{!!optional && <Optional/>}
        <div className="row micro-space">
            <div className="column column-60">
                {children}
            </div>
            <div className="column column-40">
                <div className="segment h-100 dimmed text-tiny">
                    {description}
                </div>
            </div>
        </div>
    </div>
}

export default function AddTxView() {
    const [data, setData] = useState({
        xdr: '',
        network: 'public',
        submit: false,
        callback: '',
        expires: '',
        desiredSigners: []
    })
    const [inProgress, setInProgress] = useState(false)

    const setParam = useCallback((param, value) => {
        setData(prev => {
            const newData = {...prev, [param]: value}
            if (!isEqual(prev, newData)) return newData
            return prev
        })
    }, [])

    const storeTx = useCallback(() => {
        setInProgress(true)
        return apiSubmitTx(data)
            .then(res => {
                navigation.navigate(`/tx/${res.hash}`)
            })
            .catch(e => {
                setInProgress(false)
                notify({type: 'error', message: e.message})
            })
    }, [data])

    const changeNetwork = useCallback(n => setParam('network', n), [setParam])

    const changeXdr = useCallback(e => setParam('xdr', e.target.value.trim()), [setParam])

    const changeAutoSubmit = useCallback(e => setParam('submit', e.target.checked), [setParam])

    const changeCallback = useCallback(e => setParam('callback', e.target.value.trim()), [setParam])

    const changeExpires = useCallback(e => setParam('expires', e.target.value), [setParam])

    return <>
        <div className="dual-layout">
            <div>
                <h2>Store transaction</h2>
            </div>
        </div>

        <div className="card card-blank" style={{paddingTop: '1px'}}>
            <div className="flex-row space">
                &nbsp; <Dropdown options={networkOptions} value={data.network} onChange={changeNetwork}/>
            </div>
            <TxPropsBlock title="Transaction XDR" description={<>
                Base64-encoded transaction envelope. If the same transaction has been already stored earlier,
                all additional signatures will be added to this transaction.
                <br/>
                You can prepare a transaction using{' '}
                <a href="views/tx/add/add-tx-view#txbuilder" target="_blank">Stellar Laboratory</a> or any{' '}
                <a href="views/tx/add/add-tx-view#sdks" target="_blank"> Stellar SDK</a>.
            </>}>
                <textarea value={data.xdr} disabled={inProgress} onChange={changeXdr}
                          className="text-small text-monospace condensed mobile-micro-space-bottom" placeholder="Base64-encoded transaction envelope"
                          style={{width: '100%', 'minHeight': '8rem', height: '100%', display: 'block', resize: 'vertical', marginBottom: '-6px'}}/>
            </TxPropsBlock>

            <TxPropsBlock description={<>
                Automatically submit this transaction to the network once gathered enough signatures to match the threshold.
            </>}>
                <label>
                    <input type="checkbox" checked={data.submit}
                           onChange={changeAutoSubmit}/>{' '}
                    Autosubmit to the network<Optional/>
                </label>
            </TxPropsBlock>

            <TxPropsBlock title="Callback URL" optional description={<>
                Callback URL where this transaction will be automatically sent as a HTTP POST request gathered enough signatures to match
                the threshold.
            </>}>
                <input type="text" value={data.callback} onChange={changeCallback}
                       placeholder="for example, https://my.service/success.php"/>
            </TxPropsBlock>

            <TxPropsBlock title="Valid until" optional description={<>
                Transaction retention period. If not specified explicitly, the <code>validBefore</code> value from transaction is used.
                Maximum retention period is capped to 1 year.
            </>}>
                <input value={data.expires} onChange={changeExpires}
                       placeholder="UNIX timestamp or ISO date, like 2020-11-29T09:29:13Z"/>
            </TxPropsBlock>
            {/*<div>
                <label>Desired signers</label>
                <DesiredTxSignersView signers={data.desiredSigners}
                                      onChange={newSigners => setParam('desiredSigners', newSigners)}/>
            </div>*/}
            <hr className="space"/>
            <div className="space row">
                <div className="column column-50">
                    {!!inProgress && <>
                        <div className="loader inline"/>
                        <span className="dimmed text-small"> In progress...</span>
                    </>}
                </div>
                <div className="column column-25">
                    <Button block outline href="/" disabled={inProgress}>Cancel</Button>
                </div>
                <div className="column column-25">
                    <Button block disabled={inProgress} onClick={storeTx}>Save</Button>
                </div>
            </div>
        </div>
    </>
}