import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/theme.css';
import './styles/layout.css';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <a href="#main-content" className="visually-hidden">Skip to content</a>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
