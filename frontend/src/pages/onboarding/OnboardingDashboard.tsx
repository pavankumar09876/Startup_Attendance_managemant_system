import { useQuery } from '@tanstack/react-query'
import {
  Users, Shield, CheckSquare, ClipboardList,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import EmptyState from '@/components/common/EmptyState'
import StatCard from '@/pages/dashboard/components/StatCard'
import { EMPLOYEE_STATUS_LABELS } from '@/types/onboarding.types'

const BGV_PIE_COLORS = ['#D97706', '#2563EB', '#16A34A', '#DC2626']

const OnboardingDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-dashboard'],
    queryFn: onboardingService.getDashboard,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) {
    return <EmptyState title="No data" description="Onboarding dashboard data is not available." />
  }

  const bgvPieData = [
    { name: 'Pending', value: data.bgv_pending },
    { name: 'In Verification', value: 0 },
    { name: 'Cleared', value: data.bgv_cleared },
    { name: 'Failed', value: data.bgv_failed },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Onboarding"
          value={data.total_onboarding}
          subtext="In pipeline"
          icon={<Users size={18} />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          label="BGV Pending"
          value={data.bgv_pending}
          subtext={`${data.bgv_cleared} cleared`}
          icon={<Shield size={18} />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Checklist Progress"
          value={`${data.checklist_avg_progress.toFixed(0)}%`}
          subtext="Average completion"
          icon={<CheckSquare size={18} />}
          iconBg="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          label="Pending Approvals"
          value={data.pending_approvals}
          subtext="Awaiting action"
          icon={<ClipboardList size={18} />}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Pipeline funnel */}
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-4">
            Pipeline Stages
          </h3>
          {data.pipeline.length === 0 ? (
            <EmptyState title="No employees" description="No employees in the pipeline yet." compact />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.pipeline.map((s) => ({
                  name: EMPLOYEE_STATUS_LABELS[s.status] || s.status,
                  count: s.count,
                }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* BGV pie */}
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-4">
            BGV Status Distribution
          </h3>
          {bgvPieData.length === 0 ? (
            <EmptyState title="No BGV data" description="No background verifications initiated yet." compact />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={bgvPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={3}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {bgvPieData.map((_, i) => (
                    <Cell key={i} fill={BGV_PIE_COLORS[i % BGV_PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingDashboard
