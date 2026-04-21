import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1F1F1F',
              color: '#FFFFFF',
              border: '1px solid #2F2F2F',
              borderRadius: '12px',
            },
            success: { iconTheme: { primary: '#00FF88', secondary: '#0D0D0D' } },
            error:   { iconTheme: { primary: '#FF5A5A', secondary: '#0D0D0D' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
