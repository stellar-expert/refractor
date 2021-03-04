import React from 'react'
import PropTypes from 'prop-types'
import Tooltip from './tooltip'
import './info-tooltip.scss'

function InfoTooltip({children, link}) {
    return <Tooltip trigger={<span className="info-tooltip-trigger"/>}>
        {children}
        {!!link && <a href={link} className="info-tooltip-link" target="_blank">Read more&hellip;</a>}
    </Tooltip>
}

InfoTooltip.propTypes = {
    children: PropTypes.any.isRequired,
    link: PropTypes.string
}

export default InfoTooltip