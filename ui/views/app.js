import React from 'react'
import {render} from 'react-dom'
import {bindClickNavHandler, createToastNotificationsContainer} from '@stellar-expert/ui-framework'
import AppRouter from './router'
import './styles/styles.scss'

window.explorerFrontendOrigin = 'https://stellar.expert'
window.explorerApiOrigin = 'https://api.stellar.expert'

const appContainer = document.createElement('div')

bindClickNavHandler(appContainer)

render(<AppRouter/>, appContainer)
const preLoader = document.getElementById('pre-loader')
preLoader.parentNode.removeChild(preLoader)

document.body.appendChild(appContainer)

createToastNotificationsContainer()