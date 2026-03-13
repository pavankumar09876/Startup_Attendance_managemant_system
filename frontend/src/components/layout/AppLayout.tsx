import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import OnboardingChecklist from '@/pages/onboarding/OnboardingChecklist'
import { useAuth } from '@/hooks/useAuth'

const AppLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { user } = useAuth()

  // Show onboarding checklist only for employees in their first 7 days
  const isNewEmployee = user && user.date_of_joining
    ? (new Date().getTime() - new Date(user.date_of_joining).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false

  return (
    <div className="flex h-screen overflow-hidden bg-page dark:bg-gray-950">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, shown via overlay */}
      <div className={[
        'fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto transition-transform duration-300',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}>
        <Sidebar onMobileClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMobileMenuToggle={() => setMobileSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Onboarding checklist (new employees only) */}
      {isNewEmployee && <OnboardingChecklist />}
    </div>
  )
}

export default AppLayout
