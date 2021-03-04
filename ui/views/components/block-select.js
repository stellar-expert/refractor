import React from 'react'
import PropTypes from 'prop-types'
import cn from 'classnames'
import './block-select.scss'

function select(target) {
    //handle textarea and inputs
    if (target.nodeName.match(/^(INPUT|TEXTAREA)$/i)) {
        target.focus()
        target.select()
        return
    }
    //handle selection inside text elements
    const range = document.createRange()
    range.selectNodeContents(target)
    const sel = window.getSelection()
    if (typeof sel.setBaseAndExtent === 'function') {
        // Safari
        sel.setBaseAndExtent(target, 0, target, 1)
    }
    sel.removeAllRanges()
    sel.addRange(range)
}

function BlockSelect({children, as = 'span', title, className, style, wrap, ...otherProps}) {
    const props = {
        className: cn('block-select', className, {'word-wrap': wrap}),
        onFocus: e => select(e.target),
        tabIndex: '-1',
        style,
        title,
        ...otherProps
    }
    return React.createElement(as, props, children)
}

BlockSelect.propTypes = {
    children: PropTypes.any.isRequired,
    title: PropTypes.string,
    className: PropTypes.string,
    style: PropTypes.object,
    wrap: PropTypes.bool,
    as: PropTypes.string
}

export default BlockSelect