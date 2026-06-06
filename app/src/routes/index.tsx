import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: LandingPage })

function LandingPage() {
  return (
    <main className="landing-screen" aria-label="htke landing page">
      <h1>htke</h1>
    </main>
  )
}
