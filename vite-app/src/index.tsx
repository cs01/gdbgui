import { createRoot } from 'react-dom/client'
import React from 'react'
import './index.css'
import './App.css'
import { RecoilRoot } from 'recoil'
import 'tailwindcss/tailwind.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const Dashboard = React.lazy(() => import('components/dashboard/Dashboard'))
const Gdbgui = React.lazy(() => import('components/App'))
const queryClient = new QueryClient()

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Gdbgui />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </BrowserRouter>
      </RecoilRoot>
    </QueryClientProvider>
  </React.StrictMode>
)
