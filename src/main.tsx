import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PortfolioValuationProvider } from './lib/portfolioValuation.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortfolioValuationProvider>
      <App />
    </PortfolioValuationProvider>
  </StrictMode>,
)
