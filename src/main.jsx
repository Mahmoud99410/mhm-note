import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './settings';
import App from './App';
import { initPlatform } from './platform';

initPlatform();
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
