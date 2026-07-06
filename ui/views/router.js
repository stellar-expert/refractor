import React from 'react'
import PropTypes from 'prop-types'
import {Switch, Router, Route} from 'react-router'
import Layout from './layout-view'
import TxView from './tx/tx-view'
import AddTxView from './tx/add/add-tx-view'
import NotFoundView from './general/not-found-view'

//home page `/` is served as a static HTML page (static/index.html), outside the React app

function AppRouter({history}) {
    return <Router history={history}>
        <Layout>
            <Switch>
                <Route path="/tx/add" component={AddTxView}/>
                <Route path="/tx/:txhash" component={TxView}/>
                <Route component={NotFoundView}/>
            </Switch>
        </Layout>
    </Router>
}

AppRouter.propTypes = {
    history: PropTypes.object.isRequired
}

export default AppRouter