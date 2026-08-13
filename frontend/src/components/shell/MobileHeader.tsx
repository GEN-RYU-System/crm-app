import { NavLink } from 'react-router-dom';
import { NAVIGATION_BY_ID } from '../../app/navigation';
import './MobileHeader.css';

export function MobileHeader() { return <header className="shell-mobile-header"><span className="shell-mobile-header__brand">CRM POC</span><NavLink className="shell-mobile-header__catalog" to={NAVIGATION_BY_ID.components.hash}>{NAVIGATION_BY_ID.components.label}</NavLink></header>; }
