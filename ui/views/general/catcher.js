import React from 'react'
import {withRouter} from 'react-router'

class Catcher extends React.Component {
    constructor(props) {
        super(props)
        this.state = {lastError: null}
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.state.lastError && prevProps.location.pathname !== this.props.location.pathname) {
            this.setState({lastError: null})
        }
    }

    componentDidCatch(e, errorInfo) {
        console.error(e)
        this.setState({lastError: e})
    }

    render() {
        const {lastError} = this.state
        if (lastError) {
            const {message, stack} = lastError
            return <div className="container">
                <div className="card">
                    <h2>Unhandled error occurred</h2>
                    <hr/>
                    <div className="error space">
                        <div className="micro-space">
                            "{message}" at {window.location.href}
                        </div>
                        <pre className="small">
                        {stack}
                        </pre>
                    </div>
                    <div className="space dimmed text-small">
                        If this error persists please{' '}
                        <a href="https://github.com/orbitlens/refractor/issues/"
                           target="_blank" rel="noreferrer noopener">contact our support</a>.
                    </div>
                </div>
            </div>
        }
        return this.props.children
    }
}

export default withRouter(Catcher)