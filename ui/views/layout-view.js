import React from 'react'
import PropTypes from 'prop-types'
import {ThemeSelector} from '@stellar-expert/ui-framework'
import {withRouter} from 'react-router'
import Catcher from './general/catcher'
import MenuView from './menu-view'

function Layout({children}) {
    return <div className="page-wrapper">
        <div className="blue-ribbon"/>
        <div className="top-block">
            <div className="container">
                <a href="/" className="logo external-link">
                    <img src="/img/refractor-logo-512.svg" alt="Refractor"
                         style={{height: '36px', filter: 'drop-shadow(0 0 12px rgba(92,194,224,0.4))'}}/>
                    <span className="brand-word condensed" style={{fontSize: '20px', margin: '0 0 -0.8em 0.2em'}}>refractor</span>
                </a>
                <MenuView>
                    <a href="/tx/add">Store transaction</a>
                    <a href="/api-docs" target="_blank">Documentation & API</a>
                </MenuView>
            </div>
        </div>
        <div className="page-container">
            <div className="container">
                <Catcher>{children}</Catcher>
            </div>
        </div>
        <div className="footer">
            <div className="dimmed container text-center">
            <div>{new Date().getFullYear()}&nbsp;©&nbsp;Refractor</div>
                <div>
                    <a href="mailto:info@stellar.expert" target="_blank" rel="noreferrer" className="dimmed">
                        <i className="icon-email"/> Contact us
                    </a>&emsp;
                    <a href="https://github.com/stellar-expert/refractor" target="_blank" rel="noreferrer" className="dimmed">
                        <i className="icon-github"/> Source code
                    </a>
                </div>
            </div>
        </div>
    </div>
}

Layout.propTypes = {
    children: PropTypes.node
}

export default withRouter(Layout)