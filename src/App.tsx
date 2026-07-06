import { Routes, Route } from 'react-router-dom'
import Welcome from './pages/Welcome'
import Deck from './pages/Deck'
import Player from './pages/Player'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/deck" element={<Deck />} />
      <Route path="/player" element={<Player />} />
    </Routes>
  )
}
