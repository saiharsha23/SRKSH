import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/ui'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Gallery from './pages/Gallery'
import { HplLanding, HplLeaderboard, HplResults, HplSports, HplTeams } from './pages/Hpl'
import AdminLayout from './pages/admin/AdminLayout'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import Teams from './pages/admin/Teams'
import Sports, { SportDetail } from './pages/admin/Sports'
import Results from './pages/admin/Results'
import AdminLeaderboard from './pages/admin/AdminLeaderboard'
import Settings from './pages/admin/Settings'
import AboutPhotos from './pages/admin/AboutPhotos'
import AdminGallery from './pages/admin/AdminGallery'

const NotFound = () => (
  <div className="container-x py-24 text-center"><h1 className="text-5xl font-semibold">Page not found</h1><p className="mt-3 text-bark-soft">The page you are looking for does not exist.</p><Link to="/" className="btn-primary mt-6">Back to home</Link></div>
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="hpl" element={<HplLanding />} />
              <Route path="hpl/teams" element={<HplTeams />} />
              <Route path="hpl/sports" element={<HplSports />} />
              <Route path="hpl/results" element={<HplResults />} />
              <Route path="hpl/leaderboard" element={<HplLeaderboard />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="admin/login" element={<Login />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="teams" element={<Teams />} />
              <Route path="sports" element={<Sports />} />
              <Route path="sports/:id" element={<SportDetail />} />
              <Route path="results" element={<Results />} />
              <Route path="leaderboard" element={<AdminLeaderboard />} />
              <Route path="settings" element={<Settings />} />
              <Route path="about-photos" element={<AboutPhotos />} />
              <Route path="gallery" element={<AdminGallery />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
