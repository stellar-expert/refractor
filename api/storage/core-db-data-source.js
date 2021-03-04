const {Pool} = require('pg'),
    {parse: parseConnectionString} = require('pg-connection-string'),
    {StrKey} = require('stellar-sdk'),
    {networks} = require('../app.config.json')

const pools = {}

function initPgDbPools() {
    for (const network of Object.keys(networks)) {
        const {coredb} = networks[network]
        pools[network] = new Pool(coredb)
    }
}

function formatSigner(key, weight) {
    return {
        type: 'ed25519_public_key',
        key,
        weight
    }
}

async function loadAccountsInfo(network, accounts) {
    const pool = pools[network]
    const {rows} = await pool.query('select accountid, thresholds, flags, signers from accounts where accountid = ANY($1)', [accounts])

    return rows.map(function ({accountid, thresholds, flags, signers}) {
        const accountSigners = []
        const rawThresholds = Buffer.from(thresholds, 'base64')
        const masterWeight = rawThresholds[0]
        if (masterWeight > 0) {
            accountSigners.push(formatSigner(accountid, masterWeight))
        }
        if (signers) {
            const raw = Buffer.from(signers, 'base64')
            const signersCount = raw.readUInt32BE(0)
            let ptr = 4
            for (let i = 0; i < signersCount; i++) {
                const type = raw.readUInt32BE(ptr)
                ptr += 4
                const key = StrKey.encodeEd25519PublicKey(raw.slice(ptr, ptr + 32))
                ptr += 32
                const weight = raw.readUInt32BE(ptr)
                ptr += 4
                if (type === 0) {
                    accountSigners.push(formatSigner(key, weight))
                }
                //TODO: handle other signer types
            }
        }

        return {
            account_id: accountid,
            id: accountid,
            signers: accountSigners,
            thresholds: {
                low_threshold: rawThresholds[1],
                med_threshold: rawThresholds[2],
                high_threshold: rawThresholds[3]
            }
        }
        //const parsedFlags = xdr.AccountFlags.fromXDR(Buffer.from(flags, 'base64'))
    })
}

module.exports = {loadAccountsInfo, initPgDbPools}