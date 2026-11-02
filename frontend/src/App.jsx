import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import './index.css'

const RoadmapView = lazy(() => import('./pages/RoadmapView'))
const Import = lazy(() => import('./pages/Import'))
const Edit = lazy(() => import('./pages/Edit'))
const Agents = lazy(() => import('./pages/Agents'))
const Downloads = lazy(() => import('./pages/Downloads'))

function AppRoutes() {
    return (
        <div className="page-content">
            <Suspense fallback={<div className="loading-state" role="status">Opening your workspace…</div>}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/import" element={<Import />} />
                <Route path="/roadmap/:id" element={<RoadmapView />} />
                <Route path="/edit/:id" element={<Edit />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/downloads" element={<Downloads />} />
                <Route path="*" element={<Home />} />
              </Routes>
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
