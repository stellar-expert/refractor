import React from 'react'
import {render} from 'react-dom'
import Router from './router'
import nav, {bindClickNavHandler} from '../infrastructure/nav'
import './styles/styles.scss'

const appContainer = document.createElement('div')

bindClickNavHandler(appContainer)

render(<Router history={nav.history}/>, appContainer)
const preLoader = document.getElementById('pre-loader')
preLoader.parentNode.removeChild(preLoader)

document.body.appendChild(appContainer)