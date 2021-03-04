import React, {useState} from 'react'
import isEqual from 'react-fast-compare'
import nav from '../../infrastructure/nav'
import {networks} from '../../app.config.json'
import Dropdown from '../components/dropdown'
import {submitTx} from '../../infrastructure/tx-dispatcher'

function DesiredTxSignersView({signers, onChange}) {
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

export default function AddTxView() {
    const [data, setData] = useState({
            xdr: '',
            network: 'testnet',
            submit: false,
            callback: '',
            expires: '',
            desiredSigners: []
        }),
        [error, setError] = useState(''),
        [inProgress, setInProgress] = useState(false)

    function setParam(param, value) {
        setData(prev => {
            const newData = {...prev, [param]: value}
            if (!isEqual(prev, newData)) return newData
            return prev
        })
    }

    function storeTx() {
        setInProgress(true)
        return submitTx(data)
            .then(res => {
                console.log(res)
                nav.navigate(`/tx/${res.hash}`)
            })
            .catch(e => {
                console.error(e)
                setError(e.message)
            })
            .finally(() => setInProgress(false))
    }


    const networkOptions = Object.keys(networks).map(key => ({value: key, title: networks[key].title}))

    return <div className="card">
        <h2>Submit new transaction</h2>
        <hr/>
        <div className="space">
            <div>
                <label>Stellar network{' '}
                    <Dropdown options={networkOptions} value={data.network} onChange={n => setParam('network', n)}/>
                </label>
            </div>
            <div className="space">
                <label>Transaction XDR
                    <div className="dimmed small">You can build it using {' '}
                        <a href="https://laboratory.stellar.org/#txbuilder" target="_blank">Stellar Laboratory</a>{' '}
                        or any <a href="https://developers.stellar.org/docs/software-and-sdks/#sdks" target="_blank">
                            Stellar SDK</a>
                    </div>
                    <textarea value={data.xdr} disabled={inProgress} style={{width: '100%', height: '5em'}}
                              placeholder="Base64-encoded transaction envelope"
                              onChange={e => setParam('xdr', e.target.value.trim())}/>
                </label>
            </div>
            <div>
                <label>
                    Valid until
                    <br/>
                    <input value={data.expires} onChange={e => setParam('expires', e.target.value)}
                           placeholder="UNIX timestamp or ISO date, like 2020-11-29T09:29:13Z"/>
                </label>
            </div>
            <div>
                <label>
                    Callback URL where this transaction will be POSTed once signed
                    <br/>
                    <input type="text" value={data.callback} onChange={e => setParam('callback', e.target.value.trim())}
                           placeholder="for example, https://my.service/success.php"/>
                </label>
            </div>
            <div>
                <label>
                    <input type="checkbox" checked={data.submit}
                           onChange={e => setParam('submit', e.target.checked)}/>{' '}
                    Submit this transaction to the network once ready
                </label>
            </div>
            {/*<div>
                <label>Desired signers</label>
                <DesiredTxSignersView signers={data.desiredSigners}
                                      onChange={newSigners => setParam('desiredSigners', newSigners)}/>
            </div>*/}
            {inProgress && <div className="loader"/>}
            {!!error && <div className="error">
                {error}
            </div>}
            <div className="space row">
                <div className="column column-25">
                    <button className="button button-block" disabled={inProgress} onClick={storeTx}>Save</button>
                </div>
                <div className="column column-75">
                    <div className="micro-space small dimmed">
                        Please note: this a developers preview, it is not recommended to use it production environments.
                    </div>
                </div>
            </div>
        </div>
    </div>
}