import { useState } from 'react'
import {
  GitBranch, Shield, CheckSquare, FileCheck,
  ClipboardList, BarChart3, Timer,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import OnboardingDashboard from './OnboardingDashboard'
import OnboardingPipeline from './OnboardingPipeline'
import BGVPanel from './BGVPanel'
import ChecklistTemplateManager from './ChecklistTemplateManager'
import ApprovalChainPanel from './ApprovalChainPanel'
import DocumentRequirementsConfig from './DocumentRequirementsConfig'
import SLAConfigPanel from './SLAConfigPanel'

type Tab = 'dashboard' | 'pipeline' | 'bgv' | 'checklists' | 'approvals' | 'documents' | 'sla'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard',  label: 'Dashboard',    icon: <BarChart3 size={15} /> },
  { key: 'pipeline',   label: 'Pipeline',     icon: <GitBranch size={15} /> },
  { key: 'bgv',        label: 'BGV',          icon: <Shield size={15} /> },
  { key: 'checklists', label: 'Checklists',   icon: <CheckSquare size={15} /> },
  { key: 'approvals',  label: 'Approvals',    icon: <ClipboardList size={15} /> },
  { key: 'documents',  label: 'Documents',    icon: <FileCheck size={15} /> },
  { key: 'sla',        label: 'SLA',          icon: <Timer size={15} /> },
]

const OnboardingPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const { isHR } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Onboarding
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage employee onboarding pipeline, BGV, checklists, and approvals
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard'  && <OnboardingDashboard />}
      {activeTab === 'pipeline'   && <OnboardingPipeline />}
      {activeTab === 'bgv'        && <BGVPanel />}
      {activeTab === 'checklists' && <ChecklistTemplateManager />}
      {activeTab === 'approvals'  && <ApprovalChainPanel />}
      {activeTab === 'documents'  && <DocumentRequirementsConfig />}
      {activeTab === 'sla'        && <SLAConfigPanel />}
    </div>
  )
}

export default OnboardingPage
