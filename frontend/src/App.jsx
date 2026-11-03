import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import './index.css'
import { IS_DESKTOP } from './config'

const RoadmapView = lazy(() => import('./pages/RoadmapView'))
const Import = lazy(() => import('./pages/Import'))
const Edit = lazy(() => import('./pages/Edit'))
const Agents = !IS_DESKTOP ? lazy(() => import('./pages/Agents')) : null
const Downloads = !IS_DESKTOP ? lazy(() => import('./pages/Downloads')) : null

function AppRoutes() {
    const location = useLocation()
    return (
        <div className="page-content">
            <Suspense fallback={<div className="loading-state" role="status">Opening your workspace…</div>}>
              <div key={location.pathname} className="route-view">
               <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/import" element={<Import />} />
                <Route path="/roadmap/:id" element={<RoadmapView />} />
                <Route path="/edit/:id" element={<Edit />} />
                {!IS_DESKTOP && <Route path="/agents" element={<Agents />} />}
                {!IS_DESKTOP && <Route path="/downloads" element={<Downloads />} />}
                <Route path="*" element={<Navigate to="/" replace />} />
               </Routes>
              </div>
            </Suspense>
        </div>
    )
}

function App() {
    return (
        <Router>
            <div className="app-container">
                <Navbar />
                <div className="content-container">
                    <AppRoutes />
                </div>
            </div>
        </Router>
    )
}

export default App
