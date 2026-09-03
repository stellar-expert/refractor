import React from 'react'
import {Route, Router, RouterSwitch} from '@stellar-expert/ui-framework'
import Layout from './layout-view'
import TxView from './tx/tx-view'
import AddTxView from './tx/add/add-tx-view'
import NotFoundView from './general/not-found-view'

//home page `/` is served as a static HTML page (static/index.html), outside the React app

function AppRouter() {
    return <Router>
        <Layout>
            <RouterSwitch>
                <Route path="/tx/add" component={AddTxView}/>
                <Route path="/tx/:txhash" component={TxView}/>
                <Route component={NotFoundView}/>
            </RouterSwitch>
        </Layout>
    </Router>
}

export default AppRouter