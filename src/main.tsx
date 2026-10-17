import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import Home from './App';
import Admin from './Admin';
import './styles.css';
const root=document.getElementById('root')!;
if(window.location.pathname.replace(/\/$/,'')==='/admin')createRoot(root).render(<React.StrictMode><Admin/></React.StrictMode>);
else hydrateRoot(root,<React.StrictMode><Home/></React.StrictMode>);
