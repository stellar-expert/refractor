import React from 'react'
import {render} from 'react-dom'
import {bindClickNavHandler, navigation} from '@stellar-expert/navigation'
import Router from './router'
import './styles/styles.scss'

window.explorerFrontendOrigin = 'https://stellar.expert'
window.explorerApiOrigin = 'https://api.stellar.expert'

const appContainer = document.createElement('div')

bindClickNavHandler(appContainer)

render(<Router history={navigation.history}/>, appContainer)
const preLoader = document.getElementById('pre-loader')
preLoader.parentNode.removeChild(preLoader)

document.body.appendChild(appContainer)