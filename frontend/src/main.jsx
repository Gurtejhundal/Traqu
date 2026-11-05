import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import axios from 'axios'
import './index.css'
import { IS_MOBILE } from './config'

if (IS_MOBILE) {
    const { installMobileWorkspace } = await import('./mobile/install')
    installMobileWorkspace()
    document.documentElement.dataset.traquMobile = 'true'
}

axios.defaults.withCredentials = true

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
