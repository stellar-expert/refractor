import React from 'react'

export default function WelcomeView() {
    return <div className="card">
        <h2>Welcome to Refractor<span style={{verticalAlign: 'sub', fontSize: '0.57em'}}>beta</span></h2>
        <hr/>
        <p className="space">
            Refractor is a pending transactions storage and multisig aggregator for Stellar Network.
        </p>
        <p>
            Need a place to keep your transaction until all signatures are in place? {' '}
            <a href="/tx/add">Store it here</a>, this is entirely free.
        </p>

        <h3 className="space">How it works</h3>
        <hr/>
        <p className="space">
            It's a developer-focused service in the first place, but anyone can use it to store transactions
            and gather signatures required to match the signing threshold.
            You can set the network (Stellar public network or testnet), expiration date, custom callback URL.
            Any eligible signer can sign the transaction. As soon as it reaches the required threshold (calculated
            automatically), the service either submits the transaction to Stellar network or executes a callback.
        </p>
        <p>
            Once uploaded to the server, the transaction cannot be deleted or modified. Other
            services and wallets can access and sign it by a standard URL like{' '}
            <code>https://api.refractor.space/tx/4b50...3dad</code> where its hash serves as a unique
            identifier.

            Alternatively, a person who uploaded the transaction can share a direct web link
            (e.g. <code>https://refractor.stellar.expert/tx/4b50...3dad</code>) pointing to a page where other people
            can sign the transaction using a convenient Albedo web interface.
            The website shows information about current signing status, suitable signers, and thresholds.
        </p>
        <p>
            Refractor automatically discovers potential signers and computes the thresholds. The signing process is
            fully coordinated, signatures aggregation occurs on the server side which in turn allows us to deal with
            potentially problematic cases like applying signatures from two different signers concurrently or preventing
            handling <code>TX_BAD_AUTH_EXTRA</code> errors in case of too many signatures applied to a transaction.
            Refractor ensures that signatures are valid and consistent.
        </p>

        <h3 className="space">Potential applications</h3>
        <hr/>
        <p className="space">
            This service may come in handy for anyone working on Stellar multisig-based solutions, namely joint
            custodial account operators, escrow services, financial derivative contracts trading (features, options),
            p2p lending, insurance, etc.
        </p>
        <p>
            Smart contracts on Stellar imply that some pre-signed or partially signed transactions should be
            stored by a user for a prolonged period of time.

            For obvious reasons, a service provider can’t be regarded as a trustworthy custodian in this situation
            (otherwise, it’s not a trustless solution at all). At the same time, storing pre-signed transactions on the
            client-side is not an option as well due to the high risk of losing this transaction which in turn may
            result in a permanent funds lock.
            Refractor with its retention policy may become a convenient third-party storage for all such use-cases.
        </p>

        <h3 className="space">Notes and Limitations</h3>
        <hr/>
        <p className="space">
            This is a public beta version and it may contain errors. Currently, we still gather feature requests
            from developers. API interface, as well as the storage format itself, is subject to changes.
            We use redundant storage, so transactions submitted to the system are very unlikely to get lost
            but we cannot offer 100% retention guarantees until the API and all formats are finalized.
        </p>
        <p>
            Please note: You shouldn't store transactions containing any potentially sensitive information as anyone
            with the link will be able to view transaction details on Refractor. For example, this may lead to
            the potential front-running of trades involving derivatives.
        </p>
        <p>
            Currently, Refractor is configured to work in auto-discovery mode only, which means that it automatically
            analyses all source accounts in the transaction, detects required signer weights and thresholds.
            While this works flawlessly in most scenarios, this also implies that the source account should exist
            beforehand.
            Otherwise, it's impossible to discover eligible signers and consequently, there's no way to evaluate
            signatures validity.
            We have a solution for this, but we need more time to test various edge-cases in order to better protect
            users from potentially malicious behavior.
        </p>
        <p>
            Although transactions are processed in order of arrival, setting the autosubmit option does not
            guarantee that two transactions submitted and signed right after each other will make it to the ledger in a
            strictly sequential manner. If you want to make sure that several interdependent transactions are
            submitted sequentially, set timebounds on them accordingly.
        </p>
        <p>
            While the project is fully open source, we need some time to polish the code and properly document
            everything. So if you want to run a self-hosted Refractor, please stay in touch, we are working
            on documentation and full test coverage.
        </p>
    </div>
}