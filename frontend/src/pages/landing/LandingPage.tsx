import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock, Users, BarChart2, Shield, CreditCard, FolderKanban,
  CalendarCheck, FileText, UserPlus, ChevronRight, CheckCircle2,
  ArrowRight, Menu, X, Zap, Globe, Lock, Headphones,
  TrendingUp, Building2, Star,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

/* ─── Stats ─────────────────────────────────────────────────────── */
const STATS = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '50K+', label: 'Employees Managed' },
  { value: '500+', label: 'Companies Trust Us' },
  { value: '4.9/5', label: 'Customer Rating' },
]

/* ─── Core modules ──────────────────────────────────────────────── */
const MODULES = [
  {
    icon: <Clock size={24} />,
    title: 'Attendance & Time Tracking',
    desc: 'GPS-enabled clock-in/out, real-time dashboards, shift management, and automated overtime calculations. Never miss a punch again.',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 text-blue-600',
  },
  {
    icon: <CalendarCheck size={24} />,
    title: 'Leave Management',
    desc: 'Configurable leave policies, multi-level approval workflows, holiday calendars, and balance tracking — all on autopilot.',
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: <CreditCard size={24} />,
    title: 'Payroll & Finance',
    desc: 'Automated salary computation, tax deductions, payslip generation, and bulk finalization. Compliance built right in.',
    color: 'bg-violet-500',
    lightColor: 'bg-violet-50 text-violet-600',
  },
  {
    icon: <FolderKanban size={24} />,
    title: 'Projects & Tasks',
    desc: 'Kanban boards, sprint planning, backlog grooming, and time logging. Keep every project on track with real-time visibility.',
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50 text-amber-600',
  },
  {
    icon: <UserPlus size={24} />,
    title: 'Employee Onboarding',
    desc: 'Customizable checklists, document collection, background verification tracking, SLA monitoring, and approval chains.',
    color: 'bg-rose-500',
    lightColor: 'bg-rose-50 text-rose-600',
  },
  {
    icon: <BarChart2 size={24} />,
    title: 'Reports & Analytics',
    desc: 'Pre-built and custom reports, exportable dashboards, trend analysis, and department-level breakdowns for data-driven decisions.',
    color: 'bg-cyan-500',
    lightColor: 'bg-cyan-50 text-cyan-600',
  },
]

/* ─── How it works ──────────────────────────────────────────────── */
const STEPS = [
  {
    num: '01',
    title: 'Set Up Your Organization',
    desc: 'Configure departments, shifts, leave policies, and approval hierarchies in minutes — not days.',
  },
  {
    num: '02',
    title: 'Invite Your Team',
    desc: 'Bulk-invite employees via email. They accept, complete onboarding checklists, and are ready to go.',
  },
  {
    num: '03',
    title: 'Manage Day-to-Day',
    desc: 'Track attendance, approve leaves, assign tasks, and run payroll — all from one unified dashboard.',
  },
  {
    num: '04',
    title: 'Analyze & Optimize',
    desc: 'Use built-in analytics to spot trends, reduce absenteeism, and make smarter workforce decisions.',
  },
]

/* ─── Why choose us ─────────────────────────────────────────────── */
const WHY_US = [
  { icon: <Zap size={20} />, title: 'Lightning Fast', desc: 'Sub-second load times with optimized caching and async processing.' },
  { icon: <Shield size={20} />, title: 'Enterprise Security', desc: 'Role-based access, audit logs, encrypted data, and SOC-2 ready architecture.' },
  { icon: <Globe size={20} />, title: 'Works Everywhere', desc: 'Responsive design that works seamlessly on desktop, tablet, and mobile.' },
  { icon: <Lock size={20} />, title: 'Data Privacy', desc: 'Your data stays yours. No third-party sharing, full GDPR compliance.' },
  { icon: <Headphones size={20} />, title: '24/7 Support', desc: 'Dedicated support team ready to help whenever you need assistance.' },
  { icon: <TrendingUp size={20} />, title: 'Scales With You', desc: 'From 10 employees to 10,000 — the platform grows as your company grows.' },
]

/* ─── Testimonials ──────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    quote: 'Workforce Pro transformed how we manage our 200+ employees. Payroll that used to take 3 days now takes 3 hours.',
    name: 'Priya Sharma',
    role: 'HR Director',
    company: 'TechNova Solutions',
  },
  {
    quote: 'The onboarding module alone saved us 15 hours per new hire. The SLA tracking ensures nothing falls through the cracks.',
    name: 'Rajesh Kumar',
    role: 'Operations Head',
    company: 'BuildRight Infra',
  },
  {
    quote: 'Finally, an HR platform that our employees actually enjoy using. The attendance and leave system is incredibly intuitive.',
    name: 'Anita Desai',
    role: 'CEO',
    company: 'GreenLeaf Organics',
  },
]

/* ════════════════════════════════════════════════════════════════════
   Landing Page Component
   ════════════════════════════════════════════════════════════════════ */
const LandingPage = () => {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ═══════════ NAVBAR ═══════════════════════════════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg tracking-tight">WP</span>
              </div>
              <span className={`text-xl font-bold transition-colors ${scrolled ? 'text-gray-900' : 'text-white'}`}>
                Workforce Pro
              </span>
            </div>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-8">
              {['Features', 'How It Works', 'Why Us', 'Testimonials'].map(item => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`text-sm font-medium transition-colors hover:text-blue-500 ${
                    scrolled ? 'text-gray-600' : 'text-white/80'
                  }`}
                >
                  {item}
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                to={ROUTES.LOGIN}
                className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  scrolled
                    ? 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                Sign In
              </Link>
              <Link
                to={ROUTES.LOGIN}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
              >
                Get Started Free
              </Link>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${
                scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'
              }`}
            >
              {mobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="lg:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-4 space-y-2">
              {['Features', 'How It Works', 'Why Us', 'Testimonials'].map(item => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setMobileMenu(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  {item}
                </a>
              ))}
              <div className="pt-3 border-t space-y-2">
                <Link
                  to={ROUTES.LOGIN}
                  className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-center"
                >
                  Sign In
                </Link>
                <Link
                  to={ROUTES.LOGIN}
                  className="block px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 text-center"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════ HERO SECTION ════════════════════════════════════ */}
      <section className="relative min-h-[100vh] flex items-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
              <Zap size={14} className="text-blue-400" />
              <span className="text-blue-300 text-sm font-medium">The Complete HR Platform for Modern Teams</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">
              Workforce Management,{' '}
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-violet-500 bg-clip-text text-transparent">
                Simplified
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              From attendance and leave tracking to payroll processing and employee onboarding —
              manage your entire workforce lifecycle in one powerful, intuitive platform.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                to={ROUTES.LOGIN}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/25 text-base"
              >
                Start Free Trial
                <ArrowRight size={18} />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 text-white font-semibold rounded-xl hover:bg-white/10 border border-white/10 transition-all text-base"
              >
                Explore Features
                <ChevronRight size={18} />
              </a>
            </div>

            {/* Dashboard preview mockup */}
            <div className="relative max-w-3xl mx-auto">
              <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-slate-700/50 rounded-md px-3 py-1 text-xs text-slate-400 text-center">
                      app.workforcepro.com/dashboard
                    </div>
                  </div>
                </div>
                {/* Dashboard content mockup */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Present Today', val: '142', clr: 'bg-emerald-500/20 text-emerald-400' },
                      { label: 'On Leave', val: '12', clr: 'bg-amber-500/20 text-amber-400' },
                      { label: 'Pending Approvals', val: '8', clr: 'bg-blue-500/20 text-blue-400' },
                      { label: 'Open Tasks', val: '34', clr: 'bg-violet-500/20 text-violet-400' },
                    ].map((c, i) => (
                      <div key={i} className={`rounded-lg p-3 ${c.clr}`}>
                        <div className="text-2xl font-bold">{c.val}</div>
                        <div className="text-xs opacity-70 mt-1">{c.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 bg-slate-700/30 rounded-lg h-32 flex items-center justify-center">
                      <div className="flex items-end gap-1.5">
                        {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((h, i) => (
                          <div key={i} className="w-4 bg-blue-500/40 rounded-t" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg h-32 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full border-4 border-emerald-500/40 border-t-emerald-400 flex items-center justify-center">
                        <span className="text-emerald-400 text-sm font-bold">94%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow behind the card */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 via-violet-600/20 to-blue-600/20 blur-3xl -z-10 rounded-3xl" />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-slate-500 text-xs">Scroll to explore</span>
          <div className="w-5 h-8 border-2 border-slate-600 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-slate-500 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ═══════════ TRUSTED BY / STATS ══════════════════════════════ */}
      <section className="py-16 bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">{s.value}</div>
                <div className="text-sm text-gray-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES / MODULES ══════════════════════════════ */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
              Modules
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to Manage Your Workforce
            </h2>
            <p className="text-gray-500 text-lg">
              Six powerful modules that work together seamlessly — covering every aspect
              of HR operations from hire to retire.
            </p>
          </div>

          {/* Module cards grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {MODULES.map((m, i) => (
              <div
                key={i}
                className="group bg-white border border-gray-100 rounded-2xl p-7 hover:shadow-xl hover:shadow-gray-200/50 hover:border-gray-200 transition-all duration-300"
              >
                <div className={`w-12 h-12 ${m.lightColor} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  {m.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{m.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
              Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Up and Running in 4 Simple Steps
            </h2>
            <p className="text-gray-500 text-lg">
              No complex setup, no steep learning curve. Get your entire team onboarded
              and productive from day one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="relative">
                {/* Connector line (hidden on last) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-gray-200" />
                )}
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-600/20">
                    <span className="text-white font-bold text-lg">{step.num}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DETAILED MODULE SHOWCASE ════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          {/* Attendance Module */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
                Attendance
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                Real-Time Attendance That Works at Scale
              </h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Whether your team is in-office, remote, or hybrid — capture every clock-in and clock-out
                with precision. GPS verification, shift rotation, and overtime tracking all built in.
              </p>
              <ul className="space-y-3">
                {[
                  'GPS-enabled clock in/out with location verification',
                  'Automated shift scheduling and rotation management',
                  'Real-time attendance dashboards with live counters',
                  'Overtime calculations and late-arrival alerts',
                  'Bulk attendance marking for HR administrators',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle2 size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-8 border border-blue-100">
              <div className="bg-white rounded-xl shadow-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Today's Attendance</h4>
                  <span className="text-xs text-gray-400">Live</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Present', val: '142', color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Absent', val: '8', color: 'text-red-600 bg-red-50' },
                    { label: 'Late', val: '5', color: 'text-amber-600 bg-amber-50' },
                  ].map((s, i) => (
                    <div key={i} className={`rounded-lg p-3 text-center ${s.color}`}>
                      <div className="text-xl font-bold">{s.val}</div>
                      <div className="text-xs mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Ravi Patel', time: '09:02 AM', status: 'On Time' },
                    { name: 'Sneha Gupta', time: '09:15 AM', status: 'Late' },
                    { name: 'Amit Joshi', time: '08:55 AM', status: 'On Time' },
                  ].map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-xs">
                      <span className="font-medium text-gray-700">{e.name}</span>
                      <span className="text-gray-400">{e.time}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        e.status === 'On Time' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>{e.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Payroll Module */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-2xl p-8 border border-violet-100">
              <div className="bg-white rounded-xl shadow-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Payroll Summary — March 2026</h4>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-medium rounded-full">Processed</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Gross', val: '₹24,50,000' },
                    { label: 'Total Deductions', val: '₹4,80,000' },
                    { label: 'Net Payable', val: '₹19,70,000' },
                    { label: 'Employees', val: '155' },
                  ].map((s, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                      <div className="text-sm font-bold text-gray-800">{s.val}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-blue-600 text-white text-xs font-medium py-2 rounded-lg text-center">
                    Download Payslips
                  </div>
                  <div className="flex-1 border border-gray-200 text-gray-600 text-xs font-medium py-2 rounded-lg text-center">
                    Finalize All
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-block px-3 py-1 bg-violet-50 text-violet-600 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
                Payroll
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                Payroll Processing, Zero Headaches
              </h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Automated salary calculations with built-in tax rules, allowances, and deduction
                policies. Generate payslips, handle bulk finalization, and maintain complete audit trails.
              </p>
              <ul className="space-y-3">
                {[
                  'Automated gross-to-net calculation with configurable rules',
                  'Tax deduction (TDS) and statutory compliance built-in',
                  'One-click bulk payroll finalization',
                  'Downloadable payslips with company branding',
                  'Complete audit trail for every payroll cycle',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle2 size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Onboarding Module */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-3 py-1 bg-rose-50 text-rose-600 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
                Onboarding
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                Onboard New Hires Like a Pro
              </h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                From offer acceptance to first-day readiness — automate every step of employee
                onboarding with customizable checklists, document collection, and SLA tracking.
              </p>
              <ul className="space-y-3">
                {[
                  'Visual pipeline with drag-and-drop stage transitions',
                  'Customizable onboarding checklists per department',
                  'Automated document collection and verification',
                  'Background verification (BGV) tracking',
                  'SLA monitoring with automatic breach escalation',
                  'Multi-level approval chains for offer letters',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle2 size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-2xl p-8 border border-rose-100">
              <div className="bg-white rounded-xl shadow-lg p-5 space-y-4">
                <h4 className="font-semibold text-sm">Onboarding Pipeline</h4>
                <div className="space-y-3">
                  {[
                    { stage: 'Offer Sent', count: 3, color: 'bg-amber-400' },
                    { stage: 'Documents', count: 5, color: 'bg-blue-400' },
                    { stage: 'BGV In Progress', count: 2, color: 'bg-violet-400' },
                    { stage: 'IT Setup', count: 4, color: 'bg-cyan-400' },
                    { stage: 'Completed', count: 12, color: 'bg-emerald-400' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${s.color}`} />
                      <span className="text-xs text-gray-600 flex-1">{s.stage}</span>
                      <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded">{s.count}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex items-center gap-2 text-xs text-amber-600">
                  <Clock size={12} />
                  <span>2 SLA breaches detected — auto-escalated to HR Director</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ WHY CHOOSE US ═══════════════════════════════════ */}
      <section id="why-us" className="py-20 lg:py-28 bg-[#0F172A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
              Why Workforce Pro
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for Teams That Mean Business
            </h2>
            <p className="text-slate-400 text-lg">
              Enterprise-grade features with startup-level simplicity. Here's what sets us apart.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_US.map((item, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-4">
                  {item.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ════════════════════════════════════ */}
      <section id="testimonials" className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-3 py-1 bg-amber-50 text-amber-600 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
              Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Loved by HR Teams Everywhere
            </h2>
            <p className="text-gray-500 text-lg">
              Don't just take our word for it — hear from the teams using Workforce Pro every day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6 italic">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{t.name.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}, {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ROLE-BASED VALUE ════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-3 py-1 bg-violet-50 text-violet-600 text-xs font-semibold rounded-full uppercase tracking-wider mb-4">
              For Every Role
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Designed for Your Entire Organization
            </h2>
            <p className="text-gray-500 text-lg">
              Role-specific dashboards and workflows tailored to what each team member needs most.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Building2 size={24} />,
                role: 'HR Admins',
                features: ['Full workforce visibility', 'Bulk operations & payroll', 'Compliance reports', 'Policy configuration'],
                gradient: 'from-blue-500 to-blue-600',
              },
              {
                icon: <Users size={24} />,
                role: 'Managers',
                features: ['Team attendance overview', 'Leave approvals', 'Project task boards', 'Performance insights'],
                gradient: 'from-emerald-500 to-emerald-600',
              },
              {
                icon: <FileText size={24} />,
                role: 'Employees',
                features: ['Self-service portal', 'Leave applications', 'Payslip downloads', 'Task management'],
                gradient: 'from-violet-500 to-violet-600',
              },
              {
                icon: <Shield size={24} />,
                role: 'Super Admins',
                features: ['Organization settings', 'Security audit logs', 'User management', 'System configuration'],
                gradient: 'from-rose-500 to-rose-600',
              },
            ].map((r, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 bg-gradient-to-br ${r.gradient} rounded-xl flex items-center justify-center text-white mb-4`}>
                  {r.icon}
                </div>
                <h3 className="font-semibold text-lg mb-3">{r.role}</h3>
                <ul className="space-y-2">
                  {r.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your HR Operations?
          </h2>
          <p className="text-blue-100 text-lg sm:text-xl mb-10 max-w-2xl mx-auto">
            Join hundreds of companies that have streamlined their workforce management
            with Workforce Pro. Start your free trial today — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={ROUTES.LOGIN}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-xl text-base"
            >
              Start Free Trial
              <ArrowRight size={18} />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 border border-white/20 transition-all text-base"
            >
              View All Features
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ══════════════════════════════════════════ */}
      <footer className="bg-[#0F172A] text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Company */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">WP</span>
                </div>
                <span className="text-white font-bold text-lg">Workforce Pro</span>
              </div>
              <p className="text-sm leading-relaxed">
                The complete HR and workforce management platform built for modern organizations.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2.5">
                {['Attendance', 'Leave Management', 'Payroll', 'Projects', 'Onboarding', 'Reports'].map(item => (
                  <li key={item}>
                    <a href="#features" className="text-sm hover:text-blue-400 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2.5">
                {['About Us', 'Careers', 'Blog', 'Contact', 'Partners'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-blue-400 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {['Privacy Policy', 'Terms of Service', 'Security', 'GDPR'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-blue-400 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs">
              &copy; {new Date().getFullYear()} Workforce Pro. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link to={ROUTES.LOGIN} className="text-xs hover:text-blue-400 transition-colors">
                Sign In
              </Link>
              <span className="text-slate-700">|</span>
              <Link to={ROUTES.LOGIN} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
