import React from 'react'
import PropTypes from 'prop-types'
import Catcher from './general/catcher'

export default function Layout({children}) {
    return <div className="page-wrapper">
        <div className="blue-ribbon"/>
        <div className="top-block">
            <div className="container">
                <a href="/" className="logo"><img src="/img/refractor-small-logo.png" alt="refractor logo"/></a>
                <div className="main-menu">
                    <a href="/tx/add">Store transaction</a>
                    <a href="/openapi.html" target="_blank">Documentation & API</a>
                </div>
            </div>
        </div>
        <div className="page-container">
            <div className="container">
                <Catcher>{children}</Catcher>
            </div>
        </div>
        <div className="footer">
            <div className="container text-center">
                <div>{new Date().getFullYear()}&nbsp;©&nbsp;Refractor Web <span className="dimmed">v{appVersion}</span>
                </div>
                <div>
                    <a href="https://github.com/stellar-expert/refractor" target="_blank" rel="noopener"
                       className="nowrap">
                        Open Source
                    </a>&emsp;
                    <a href="mailto:info@stellar.expert" target="_blank" rel="noopener" className="nowrap">
                        info@stellar.expert
                    </a>
                </div>
            </div>
        </div>
    </div>
}

Layout.propTypes = {
    children: PropTypes.node
}
