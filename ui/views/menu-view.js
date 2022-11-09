import React, {useEffect, useState} from 'react'
import './main-menu.scss'

export default function MenuView({children}) {
    const [menuVisible, setMenuVisible] = useState(false)
    useEffect(() => {
        if (!menuVisible) return

        function handleEscape(e) {
            if (e.keyCode === 27)
                setMenuVisible(false)
        }

        function handleClick() {
            setMenuVisible(false)
        }

        window.addEventListener('keydown', handleEscape)
        window.addEventListener('click', handleClick)
        return () => {
            window.removeEventListener('keydown', handleEscape)
            window.removeEventListener('click', handleClick)
        }
    }, [menuVisible])
    const style = {display: menuVisible ? 'block' : 'none'}
    return <div className="menu text-right">
        <div className="desktop-menu desktop-only">
            {children}
        </div>
        <div className="mobile-menu mobile-only relative">
            <a href="#" onClick={() => setMenuVisible(!menuVisible)}>
                <i className="icon icon-menu"/>
            </a>
            <div className="menu-backdrop" style={style}/>
            <div className="menu-dropdown" style={style}>{children}</div>
        </div>
    </div>
}