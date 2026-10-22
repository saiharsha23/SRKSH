import { AboutUs, Mission, HowItWorks, Legacy, AboutPhotos, Supporters } from '../components/sections'
import { useTitle } from '../lib/useTitle'

export default function About() {
  useTitle('About · SRKSH', 'About Sri Ramakrishna Students Home, Bengaluru — mission, how the Home works, and a century of service.')
  return (
    <>
      <div className="container-x pt-14"><p className="eyebrow">About</p><h1 className="text-5xl font-semibold sm:text-6xl">Sri Ramakrishna Students Home</h1></div>
      <AboutUs /><Mission /><HowItWorks /><Legacy /><AboutPhotos /><Supporters />
    </>
  )
}
