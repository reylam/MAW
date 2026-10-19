import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import App from './App.jsx'
import logoIcon from './assets/logo_icon.png'
import { useMawStore } from './store/mawStore'

const favicon = document.querySelector('link[rel="icon"]')
if (favicon) favicon.href = logoIcon

function ThemeProvider({ children }) {
  const isDarkMode = useMawStore(state => state.isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  return children;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
