import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './Chat.css'  // Yeh line add kar dena (App.css ki jagah)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)