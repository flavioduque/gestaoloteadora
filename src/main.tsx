import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Desktop } from './os/Desktop';
import { applyTheme } from './apps/Configuracion';
import './styles/base.css';
import './styles/os.css';

applyTheme();
createRoot(document.getElementById('root')!).render(<StrictMode><Desktop /></StrictMode>);
