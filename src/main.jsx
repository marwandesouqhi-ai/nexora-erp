import './utils/browserPatch'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* لازم QueryClientProvider يلف التطبيق كله، لأن صفحات زي Dashboard
        بتستخدم useQuery من @tanstack/react-query وكانت هتكراش من غيره */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)