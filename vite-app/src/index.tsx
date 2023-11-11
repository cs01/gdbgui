import { createRoot } from 'react-dom/client'
import React from 'react'
import './index.css'
import './App.css'
import { Gdbgui } from './components/App'
import { RecoilRoot } from 'recoil'
import 'tailwindcss/tailwind.css'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <RecoilRoot>
      <Gdbgui />
    </RecoilRoot>
  </React.StrictMode>
)
