import React, {useState} from 'react'
import PropTypes from 'prop-types'
import cn from 'classnames'
import {useDependantState} from '../hooks/state-hooks'
import './dropdown.scss'

export default function Dropdown({options, value, disabled, className, title, onChange}) {
    const [listOpen, updateListOpen] = useState(false)
    const [selectedValue, updateSelectedValue] = useDependantState(() => {
        document.addEventListener('click', collapseDropdown)
        return {
            listOpen: false,
            selectedValue: value
        }
    }, [value], () => {
        document.removeEventListener('click', collapseDropdown)
    })

    function collapseDropdown() {
        updateListOpen(false)
    }

    function toggleList(e) {
        e && e.nativeEvent.stopImmediatePropagation()
        if (disabled) return
        updateListOpen(prevValue => !prevValue)
    }

    function select(e, option) {
        e.preventDefault()
        collapseDropdown()
        onChange && onChange(option.value || option)
        updateSelectedValue(option)
    }

    const val = value !== undefined ? value : selectedValue
    if (val === null || val === undefined) return options[0]

    const selectedItem = options.find(item => item === val || item.value === val) || options[0]

    return <div className={cn('dd-wrapper', {disabled}, className)} title={title}>
        <a href="#" className="dd-header" onClick={e => toggleList(e)}>
            {selectedItem.title || selectedItem.value || selectedItem}
            <span className={cn('dd-toggle', {visible: listOpen})}/>
        </a>
        {!disabled && <ul className={cn('dd-list', {visible: listOpen})}>
            {options.map(option => {
                const selected = option === selectedItem,
                    {id, value, title} = option
                return <li className="dd-list-item" key={id || value || option} onClick={e => select(e, option)}>
                    <a href="#" className={selected ? 'selected' : ''}>{title || value || option}</a>
                </li>
            })}
        </ul>}
    </div>
}

Dropdown.propTypes = {
    options: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        id: PropTypes.string,
        title: PropTypes.string
    }), PropTypes.string])).isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    className: PropTypes.string,
    title: PropTypes.string
}