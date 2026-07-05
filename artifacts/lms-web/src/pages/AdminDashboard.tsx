import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import {
  Users, BookOpen, CreditCard, CheckCircle, XCircle, Trash2,
  TrendingUp, GraduationCap, Presentation, Shield, Globe, Lock,
  DollarSign, BarChart2, Clock, Plus, RefreshCw, Eye, Radio,
  AlertCircle, BadgeCheck, Flag, Filter, PlusCircle, Tag, Edit2, ShieldAlert, School, Settings, Banknote, Ticket,
  Video, Search, PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const api = useApi();
  const queryClient = useQueryClient();

  // Read the ?tab= deep-link from the URL
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const defaultTab = searchParams.get('tab') || 'users';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [teacherRegPendingCount, setTeacherRegPendingCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation('/login');
    if (user && user.role !== 'admin') setLocation('/dashboard');
  }, [isAuthenticated, authLoading, user]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: () => api.get('/admin/stats'),
    enabled: !!user && user.role === 'admin',
    refetchInterval: 30000,
  });

  const { data: pendingCourses } = useQuery({
    queryKey: ['/api/admin/courses', 'pending_review'],
    queryFn: () => api.get('/admin/courses?status=pending_review'),
    enabled: !!user && user.role === 'admin',
    refetchInterval: 30000,
  });

  if (authLoading || statsLoading) {
    return <PageContainer><div className="p-20 text-center">Loading admin panel...</div></PageContainer>;
  }
  if (!user || user.role !== 'admin') return null;

  const pendingCount = pendingCourses?.courses?.length || pendingCourses?.length || 0;


  return (
    <PageContainer>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-sm uppercase tracking-widest font-medium">Admin Control Panel</p>
              <h1 className="text-2xl font-display font-bold">EduLibya Administration</h1>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {[
              { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-400' },
              { label: 'Teachers', value: stats?.totalTeachers || 0, icon: Presentation, color: 'text-purple-400' },
              { label: 'Students', value: stats?.totalStudents || 0, icon: GraduationCap, color: 'text-teal-400' },
              { label: 'Published Courses', value: `${stats?.publishedCourses || 0} / ${stats?.totalCourses || 0}`, icon: BookOpen, color: 'text-green-400' },
              { label: 'Enrollments', value: stats?.totalEnrollments || 0, icon: TrendingUp, color: 'text-amber-400' },
              { label: 'Revenue (LYD)', value: (stats?.totalRevenue || 0).toFixed(0), icon: DollarSign, color: 'text-emerald-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <Icon className={`w-5 h-5 ${color} mb-2`} />
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-white/50 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Finance Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Platform Fees Earned', value: `${(stats?.platformFees || 0).toFixed(2)} LYD`, icon: BarChart2, color: 'text-green-400' },
              { label: 'Pending Payments', value: stats?.pendingPayments || 0, icon: Clock, color: 'text-yellow-400' },
              { label: 'Pending Payouts to Teachers', value: `${(stats?.pendingEarnings || 0).toFixed(2)} LYD`, icon: CreditCard, color: 'text-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color} shrink-0`} />
                <div>
                  <div className="text-sm font-bold text-white">{value}</div>
                  <div className="text-xs text-white/50">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 bg-muted/60 flex-wrap h-auto gap-1">
            <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Users</TabsTrigger>
            <TabsTrigger value="teachers" className="gap-2"><Presentation className="w-4 h-4" /> Teachers</TabsTrigger>
            <TabsTrigger value="approvals" className="gap-2 relative">
              <CheckCircle className="w-4 h-4" /> Approvals
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="teacher_reg_approvals" className="gap-2 relative">
              <GraduationCap className="w-4 h-4" /> Teacher Registrations
              {teacherRegPendingCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {teacherRegPendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tutoring_reviews" className="gap-2"><Presentation className="w-4 h-4" /> Tutoring Reviews</TabsTrigger>
            <TabsTrigger value="courses" className="gap-2"><BookOpen className="w-4 h-4" /> Courses</TabsTrigger>
            <TabsTrigger value="categories" className="gap-2"><Tag className="w-4 h-4" /> Categories</TabsTrigger>
            <TabsTrigger value="payments" className="gap-2"><CreditCard className="w-4 h-4" /> Payments</TabsTrigger>
            <TabsTrigger value="finance" className="gap-2"><DollarSign className="w-4 h-4" /> Finance</TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2"><Banknote className="w-4 h-4" /> Withdrawals</TabsTrigger>
            <TabsTrigger value="redeem_cards" className="gap-2"><Ticket className="w-4 h-4" /> Redeem Cards</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><Flag className="w-4 h-4" /> Reports</TabsTrigger>
            <TabsTrigger value="dmca" className="gap-2"><ShieldAlert className="w-4 h-4" /> DMCA</TabsTrigger>
            <TabsTrigger value="device_security" className="gap-2"><ShieldAlert className="w-4 h-4" /> Device Security</TabsTrigger>
            <TabsTrigger value="refunds" className="gap-2"><Banknote className="w-4 h-4" /> Refunds</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2"><DollarSign className="w-4 h-4" /> Analytics</TabsTrigger>
            <TabsTrigger value="academy" className="gap-2 text-amber-600"><School className="w-4 h-4 text-amber-500" /> Academy</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users"><UsersTab api={api} queryClient={queryClient} toast={toast} stats={stats} user={user} /></TabsContent>
          <TabsContent value="teachers"><TeachersManagementTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="approvals"><PendingApprovalsTab api={api} queryClient={queryClient} toast={toast} initialPendingCourses={pendingCourses} /></TabsContent>
          <TabsContent value="teacher_reg_approvals"><TeacherRegistrationApprovalsTab api={api} toast={toast} onCountChange={setTeacherRegPendingCount} /></TabsContent>
          <TabsContent value="tutoring_reviews"><TutoringReviewsTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="courses"><CoursesTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="categories"><CategoriesTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="payments"><PaymentsTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="finance"><FinanceTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="withdrawals"><WithdrawalsTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="redeem_cards"><RedeemCardsTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="reports"><ReportsTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="dmca"><DMCAComplaintsTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="device_security"><DeviceSecurityTab api={api} toast={toast} /></TabsContent>
          <TabsContent value="refunds"><RefundsTab api={api} toast={toast} /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab api={api} /></TabsContent>
          <TabsContent value="academy"><AcademyAdminTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
          <TabsContent value="settings"><SettingsTab api={api} queryClient={queryClient} toast={toast} /></TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────

function UsersTab({ api, queryClient, toast, stats, user }: any) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { email: '', password: '', fullName: '', role: 'student' } });

  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: () => api.get('/admin/users'),
  });

  const changeRole = async (userId: number, role: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      toast({ title: 'Role updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const deleteUser = async (userId: number, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/admin/users/${userId}`);
      toast({ title: 'User deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const createUser = async (data: any) => {
    try {
      await api.post('/admin/users/create', data);
      toast({ title: 'User created!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setIsCreateOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = (users || []).filter((u: any) => {
    const matchSearch = !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    teacher: 'bg-blue-100 text-blue-700 border-blue-200',
    student: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-3 flex-1">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Create User
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="font-bold">All Users <span className="text-muted-foreground font-normal text-sm">({filtered.length})</span></h2>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u: any) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {u.fullName?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{u.fullName}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={u.id === user?.id}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border bg-transparent ${u.id === user?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${roleColors[u.role] || ''}`}
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                      {u.id === user?.id && (
                        <div className="text-[10px] text-muted-foreground mt-1">Current User</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{u.phoneNumber || <span className="text-muted-foreground text-xs">–</span>}</div>
                      {u.phoneNumber && (
                        <div className={`text-xs flex items-center gap-1 mt-0.5 ${u.phoneVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                          {u.phoneVerified ? <><BadgeCheck className="w-3 h-3" /> Verified</> : <><AlertCircle className="w-3 h-3" /> Unverified</>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.role === 'teacher' && <span>{u.courseCount ?? 0} courses · {u.studentCount ?? 0} students</span>}
                      {u.role === 'student' && <span>{u.enrollmentCount ?? 0} enrollments</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={u.id === user?.id}
                        className={`h-8 w-8 text-destructive ${u.id === user?.id ? 'opacity-50 cursor-not-allowed' : 'hover:text-destructive hover:bg-destructive/10'}`}
                        onClick={() => deleteUser(u.id, u.fullName)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(createUser)} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name *</label>
              <Input {...register('fullName', { required: true })} placeholder="Full name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email *</label>
              <Input {...register('email', { required: true })} type="email" placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Password *</label>
              <Input {...register('password', { required: true })} type="password" placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Role</label>
              <select {...register('role')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" className="w-full">Create User</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── COURSES TAB ──────────────────────────────────────────────────────────────

function CoursesTab({ api, queryClient, toast }: any) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: courses, isLoading } = useQuery({
    queryKey: ['/api/admin/courses'],
    queryFn: () => api.get('/admin/courses'),
  });

  const togglePublish = async (courseId: number, current: boolean) => {
    try {
      await api.put(`/admin/courses/${courseId}/publish`, { isPublished: !current });
      toast({ title: current ? 'Course unpublished' : 'Course published!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const deleteCourse = async (courseId: number, title: string) => {
    if (!confirm(`Delete course "${title}"? This will remove all lessons and enrollments.`)) return;
    try {
      await api.del(`/admin/courses/${courseId}`);
      toast({ title: 'Course deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = (courses || []).filter((c: any) => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.teacherName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (statusFilter === 'published' ? c.isPublished : !c.isPublished);
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.reduce((s: number, c: any) => s + (c.revenue || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap justify-between">
        <div className="flex gap-3">
          <Input
            placeholder="Search by title or teacher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Courses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <DollarSign className="w-4 h-4" />
          Total revenue shown: <span className="font-bold text-foreground ml-1">{totalRevenue.toFixed(2)} LYD</span>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold">All Courses <span className="text-muted-foreground font-normal text-sm">({filtered.length})</span></h2>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading courses...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No courses found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teacher</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Students</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm max-w-[200px] line-clamp-1">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.lessonCount} lessons · {c.language?.toUpperCase()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{c.teacherName}</div>
                      <div className="text-xs text-muted-foreground">{c.teacherEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.categoryName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${parseFloat(c.price) === 0 ? 'text-green-600' : 'text-primary'}`}>
                        {parseFloat(c.price) === 0 ? 'Free' : `${parseFloat(c.price)} LYD`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{c.enrollmentCount}</td>
                    <td className="px-4 py-3 text-sm font-medium">{(c.revenue || 0).toFixed(2)} LYD</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {c.isPublished ? '✓ Published' : '⏸ Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs gap-1 ${c.isPublished ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                          onClick={() => togglePublish(c.id, c.isPublished)}
                        >
                          {c.isPublished ? <><Lock className="w-3 h-3" /> Unpublish</> : <><Globe className="w-3 h-3" /> Publish</>}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteCourse(c.id, c.title)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAYMENTS TAB ─────────────────────────────────────────────────────────────

function PaymentsTab({ api, queryClient, toast }: any) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState<number | null>(null);

  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/payments', statusFilter],
    queryFn: () => api.get(`/admin/payments?status=${statusFilter}`),
    refetchInterval: 15000,
  });

  const handleAction = async (paymentId: number, action: 'approve' | 'reject') => {
    setProcessing(paymentId);
    try {
      await api.post(`/admin/payments/${paymentId}/${action}`, {});
      toast({ title: action === 'approve' ? '✓ Payment approved — student enrolled' : '✗ Payment rejected' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  };

  const methodLabel: Record<string, string> = {
    gateway: 'Gateway',
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
  };

  const totalRevenue = (payments || []).filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + p.amount, 0);
  const pendingTotal = (payments || []).filter((p: any) => p.status === 'pending').reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap justify-between items-center">
        <div className="flex gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Payments</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed / Rejected</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-700">
            <CheckCircle className="w-3.5 h-3.5" /> Completed: <span className="font-bold">{totalRevenue.toFixed(2)} LYD</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-700">
            <Clock className="w-3.5 h-3.5" /> Pending: <span className="font-bold">{pendingTotal.toFixed(2)} LYD</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading payments...</div>
      ) : (payments || []).length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
          <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
          <h3 className="font-bold">No payments found</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(payments || []).map((p: any) => (
            <div key={p.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusColors[p.status] || 'bg-gray-100 text-gray-700'}`}>
                  {p.status === 'pending' ? '⏳ Pending' : p.status === 'completed' ? '✓ Completed' : '✗ Failed'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">#{p.id}</span>
              </div>
              <div className="mb-4">
                <div className="text-2xl font-bold text-primary">{p.amount} <span className="text-sm font-normal text-muted-foreground">{p.currency}</span></div>
                <div className="text-xs text-muted-foreground mt-1">Method: {methodLabel[p.method] || p.method}</div>
              </div>
              <div className="space-y-1.5 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{p.studentName}</span>
                </div>
                <div className="text-xs text-muted-foreground ml-5">{p.studentEmail}</div>
                <div className="flex items-center gap-2 mt-2">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{p.itemName}</span>
                </div>
                {p.reference && (
                  <div className="text-xs text-muted-foreground font-mono ml-5">Ref: {p.reference}</div>
                )}
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {new Date(p.createdAt).toLocaleString()}
              </div>
              {p.status === 'pending' && (
                <div className="flex gap-2 mt-auto">
                  <Button
                    className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white text-xs h-9"
                    disabled={processing === p.id}
                    onClick={() => handleAction(p.id, 'approve')}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {processing === p.id ? 'Processing...' : 'Approve & Enroll'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/5 text-xs h-9"
                    disabled={processing === p.id}
                    onClick={() => handleAction(p.id, 'reject')}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FINANCE TAB ──────────────────────────────────────────────────────────────

function FinanceTab({ api, queryClient, toast }: any) {
  const [paying, setPaying] = useState<number | null>(null);
  const [teacherFilter, setTeacherFilter] = useState('all');

  const { data: earnings, isLoading } = useQuery({
    queryKey: ['/api/admin/earnings'],
    queryFn: () => api.get('/admin/earnings'),
  });

  const handlePay = async (earningId: number, teacherId: number) => {
    setPaying(earningId);
    try {
      await api.post(`/admin/earnings/${earningId}/pay`, {});
      toast({ title: '✓ Payout marked — teacher has been paid' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/earnings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(null);
    }
  };

  const handlePayAll = async (teacherId: number, teacherName: string) => {
    if (!confirm(`Pay all available earnings to ${teacherName}?`)) return;
    try {
      await api.post(`/admin/earnings/pay-all/${teacherId}`, {});
      toast({ title: `All earnings paid to ${teacherName}` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/earnings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const earningList = earnings || [];
  const uniqueTeachers = [...new Set(earningList.map((e: any) => e.teacherName))] as string[];

  const filtered = earningList.filter((e: any) =>
    teacherFilter === 'all' || e.teacherName === teacherFilter
  );

  const available = filtered.filter((e: any) => e.status === 'available').reduce((s: number, e: any) => s + e.net, 0);
  const totalPaid = filtered.filter((e: any) => e.status === 'paid').reduce((s: number, e: any) => s + e.net, 0);
  const platformFees = filtered.reduce((s: number, e: any) => s + e.platformFee, 0);

  // Group by teacher for pay-all
  const teacherGroups = earningList.reduce((acc: any, e: any) => {
    if (!acc[e.teacherId]) acc[e.teacherId] = { id: e.teacherId, name: e.teacherName, email: e.teacherEmail, available: 0, paid: 0 };
    if (e.status === 'available') acc[e.teacherId].available += e.net;
    if (e.status === 'paid') acc[e.teacherId].paid += e.net;
    return acc;
  }, {});

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    paid: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="space-y-6">
      {/* Teacher payouts summary */}
      {Object.values(teacherGroups).length > 0 && (
        <div>
          <h3 className="font-bold text-base mb-3">Teacher Payout Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(teacherGroups).map((t: any) => (
              <div key={t.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {t.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-green-700">{t.available.toFixed(2)}</div>
                    <div className="text-xs text-green-600">LYD Available</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-blue-700">{t.paid.toFixed(2)}</div>
                    <div className="text-xs text-blue-600">LYD Paid</div>
                  </div>
                </div>
                {t.available > 0 && (
                  <Button
                    className="w-full gap-2 bg-primary hover:bg-primary/90 text-xs h-9"
                    onClick={() => handlePayAll(t.id, t.name)}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Pay All {t.available.toFixed(2)} LYD
                  </Button>
                )}
                {t.available === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-2">No pending payouts</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finance Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Available for Payout', value: `${available.toFixed(2)} LYD`, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Total Paid to Teachers', value: `${totalPaid.toFixed(2)} LYD`, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Platform Fees (20%)', value: `${platformFees.toFixed(2)} LYD`, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Earnings Table */}
      <div className="space-y-3">
        <div className="flex gap-3 justify-between items-center">
          <h3 className="font-bold text-base">Earnings Ledger</h3>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Teachers</option>
            {uniqueTeachers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Loading earnings...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No earnings records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teacher</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course / Session</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gross</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net (Teacher)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{e.teacherName}</div>
                        <div className="text-xs text-muted-foreground">{e.teacherEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[180px]">
                        <span className="line-clamp-1">{e.itemName}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{e.gross} {e.currency}</td>
                      <td className="px-4 py-3 text-sm text-red-600">-{e.platformFee} {e.currency}</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-700">{e.net} {e.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[e.status] || 'bg-gray-100 text-gray-700'}`}>
                          {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {e.status === 'available' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
                            disabled={paying === e.id}
                            onClick={() => handlePay(e.id, e.teacherId)}
                          >
                            <DollarSign className="w-3 h-3" />
                            {paying === e.id ? '...' : 'Pay Out'}
                          </Button>
                        )}
                        {e.status === 'paid' && <span className="text-xs text-muted-foreground">✓ Paid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Expenses P&L Section */}
      <ExpensesPL api={api} queryClient={queryClient} toast={toast} platformFees={platformFees} />
    </div>
  );
}

// ─── EXPENSES P&L ─────────────────────────────────────────────────────────────

function ExpensesPL({ api, queryClient, toast, platformFees }: any) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { title: '', amount: '', category: 'hosting', notes: '', expenseDate: '' }
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['/api/expenses'],
    queryFn: () => api.get('/expenses'),
  });

  const addExpense = async (data: any) => {
    try {
      await api.post('/expenses', { ...data, amount: parseFloat(data.amount) });
      toast({ title: 'Expense added' });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      setIsAddOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const deleteExpense = async (id: number) => {
    try {
      await api.del(`/expenses/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
  const netProfit = platformFees - totalExpenses;

  const categoryColors: Record<string, string> = {
    hosting: 'bg-blue-100 text-blue-700',
    domain: 'bg-purple-100 text-purple-700',
    marketing: 'bg-orange-100 text-orange-700',
    salary: 'bg-green-100 text-green-700',
    tools: 'bg-gray-100 text-gray-700',
    other: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-4 mt-8 border-t border-border pt-8">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-base">Platform P&L (Profit & Loss)</h3>
        <Button size="sm" className="gap-2" onClick={() => setIsAddOpen(true)}>
          <PlusCircle className="w-3.5 h-3.5" /> Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="text-xs text-green-700 font-medium mb-1">Platform Revenue (20% fees)</div>
          <div className="text-xl font-bold text-green-700">+{(platformFees || 0).toFixed(2)} LYD</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="text-xs text-red-700 font-medium mb-1">Total Expenses</div>
          <div className="text-xl font-bold text-red-700">-{totalExpenses.toFixed(2)} LYD</div>
        </div>
        <div className={`border rounded-2xl p-4 ${netProfit >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-red-50 border-red-200'}`}>
          <div className={`text-xs font-medium mb-1 ${netProfit >= 0 ? 'text-primary' : 'text-red-700'}`}>Net Profit</div>
          <div className={`text-xl font-bold ${netProfit >= 0 ? 'text-primary' : 'text-red-700'}`}>
            {netProfit >= 0 ? '+' : ''}{netProfit.toFixed(2)} LYD
          </div>
        </div>
      </div>

      {(expenses || []).length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expense</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(expenses || []).map((e: any) => (
                  <tr key={e.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{e.title}</div>
                      {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[e.category] || 'bg-gray-100 text-gray-700'}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600">{e.amount} {e.currency}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(e.expenseDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => deleteExpense(e.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(addExpense)} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input {...register('title', { required: true })} placeholder="e.g. Replit Hosting" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Amount (LYD) *</label>
                <Input {...register('amount', { required: true })} type="number" step="0.01" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <select {...register('category')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="hosting">Hosting</option>
                  <option value="domain">Domain</option>
                  <option value="marketing">Marketing</option>
                  <option value="salary">Salary</option>
                  <option value="tools">Tools / Software</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Date</label>
              <Input {...register('expenseDate')} type="date" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
              <Input {...register('notes')} placeholder="Additional details..." />
            </div>
            <Button type="submit" className="w-full">Add Expense</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TEACHER MANAGEMENT TAB ───────────────────────────────────────────────────

function TeachersManagementTab({ api, queryClient, toast }: any) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['/api/teachers'],
    queryFn: () => api.get('/teachers'),
  });

  const { data: earnings } = useQuery({
    queryKey: ['/api/admin/earnings'],
    queryFn: () => api.get('/admin/earnings'),
  });

  const toggleVerify = async (teacherId: number, current: boolean) => {
    try {
      await api.put(`/admin/users/${teacherId}/role`, { role: 'teacher' });
      await api.post(`/admin/users/${teacherId}/verify`, { isVerified: !current });
      queryClient.invalidateQueries({ queryKey: ['/api/teachers'] });
      toast({ title: current ? 'Verification removed' : 'Teacher verified!' });
    } catch {}
  };

  const toggleCertificates = async (teacherId: number, current: boolean) => {
    try {
      await api.post(`/admin/users/${teacherId}/certificates-approval`, { approved: !current });
      queryClient.invalidateQueries({ queryKey: ['/api/teachers'] });
      toast({ title: current ? 'Certificate approval revoked' : 'Teacher approved for certificates 🎓' });
    } catch (err: any) {
      toast({ title: err.message || 'Failed', variant: 'destructive' });
    }
  };

  const payAllTeacher = async (teacherId: number, name: string) => {
    if (!confirm(`Pay all available earnings to ${name}?`)) return;
    try {
      await api.post(`/admin/earnings/pay-all/${teacherId}`, {});
      toast({ title: `All earnings paid to ${name}` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/earnings'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const getTeacherEarnings = (teacherId: number) => {
    const list = (earnings || []).filter((e: any) => e.teacherId === teacherId);
    const available = list.filter((e: any) => e.status === 'available').reduce((s: number, e: any) => s + e.net, 0);
    const paid = list.filter((e: any) => e.status === 'paid').reduce((s: number, e: any) => s + e.net, 0);
    return { available, paid, total: available + paid };
  };

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading teachers...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Teacher Management <span className="text-muted-foreground font-normal text-sm">({(teachers || []).length})</span></h2>
      </div>
      <div className="space-y-3">
        {(teachers || []).length === 0 && (
          <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
            <Presentation className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">No teachers yet</p>
          </div>
        )}
        {(teachers || []).map((teacher: any) => {
          const erng = getTeacherEarnings(teacher.id);
          const isOpen = expanded === teacher.id;
          return (
            <div key={teacher.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {teacher.fullName?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{teacher.fullName}</h3>
                      {teacher.isVerified && <BadgeCheck className="w-4 h-4 text-primary" />}
                      {teacher.isTutoringEnabled && <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">Tutoring</span>}
                    </div>
                    {teacher.expertise && <p className="text-xs text-muted-foreground">{teacher.expertise}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Courses', value: teacher.courseCount },
                    { label: 'Students', value: teacher.studentCount },
                    { label: 'Available', value: `${erng.available.toFixed(0)} LYD` },
                    { label: 'Paid Out', value: `${erng.paid.toFixed(0)} LYD` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/40 rounded-xl px-3 py-2">
                      <div className="font-bold text-sm">{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 shrink-0">
                  {erng.available > 0 && (
                    <Button
                      size="sm"
                      className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                      onClick={() => payAllTeacher(teacher.id, teacher.fullName)}
                    >
                      <DollarSign className="w-3 h-3" /> Pay {erng.available.toFixed(0)} LYD
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={teacher.isVerified ? 'outline' : 'default'}
                    className={`gap-1 text-xs ${teacher.isVerified ? 'border-primary text-primary' : ''}`}
                    onClick={() => toggleVerify(teacher.id, teacher.isVerified)}
                  >
                    <BadgeCheck className="w-3 h-3" />
                    {teacher.isVerified ? 'Verified' : 'Verify'}
                  </Button>
                  <Button
                    size="sm"
                    variant={teacher.certificatesApproved ? 'outline' : 'secondary'}
                    className={`gap-1 text-xs ${teacher.certificatesApproved ? 'border-amber-500 text-amber-600' : ''}`}
                    onClick={() => toggleCertificates(teacher.id, teacher.certificatesApproved)}
                  >
                    🎓 {teacher.certificatesApproved ? 'Certificates ✓' : 'Allow Certificates'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs"
                    onClick={() => setExpanded(isOpen ? null : teacher.id)}
                  >
                    <Eye className="w-3 h-3" /> {isOpen ? 'Hide' : 'Details'}
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border p-5 bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Earnings Breakdown</p>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Total Gross</span><span className="font-bold">{(erng.total / 0.8 * 1).toFixed(2)} LYD</span></div>
                        <div className="flex justify-between"><span>Platform (20%)</span><span className="text-red-600">-{(erng.total / 0.8 * 0.2).toFixed(2)} LYD</span></div>
                        <div className="flex justify-between"><span>Teacher Net</span><span className="font-bold text-green-600">{erng.total.toFixed(2)} LYD</span></div>
                        <div className="flex justify-between"><span>Available</span><span className="font-bold text-amber-600">{erng.available.toFixed(2)} LYD</span></div>
                        <div className="flex justify-between"><span>Already Paid</span><span className="font-bold text-blue-600">{erng.paid.toFixed(2)} LYD</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Activity</p>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Published Courses</span><span className="font-bold">{teacher.courseCount}</span></div>
                        <div className="flex justify-between"><span>Total Students</span><span className="font-bold">{teacher.studentCount}</span></div>
                        <div className="flex justify-between"><span>Reviews</span><span className="font-bold">{teacher.reviewCount}</span></div>
                        <div className="flex justify-between"><span>Avg Rating</span><span className="font-bold">{teacher.rating?.toFixed(1) || '–'} ★</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Account</p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>Tutoring: {teacher.isTutoringEnabled ? `${teacher.tutoringHourlyRate} LYD/hr` : 'Disabled'}</div>
                        <div>Verified: {teacher.isVerified ? '✓ Yes' : '✗ No'}</div>
                        <div>Expertise: {teacher.expertise || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────

function ReportsTab({ api, queryClient, toast }: any) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [resolveNote, setResolveNote] = useState('');
  const [activeReport, setActiveReport] = useState<any>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: () => api.get('/reports'),
    refetchInterval: 30000,
  });

  const updateStatus = async (reportId: number, status: string) => {
    try {
      await api.put(`/reports/${reportId}/status`, { status, adminNote: resolveNote });
      toast({ title: `Report marked as ${status}` });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      setActiveReport(null);
      setResolveNote('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = (reports || []).filter((r: any) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchStatus && matchType;
  });

  const statusColors: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    under_review: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-700',
    dismissed: 'bg-gray-100 text-gray-500',
  };

  const reasonLabels: Record<string, string> = {
    wrong_content: 'Wrong Content',
    offensive: 'Offensive',
    technical_issue: 'Technical Issue',
    no_show: 'No-show',
    inappropriate_behavior: 'Inappropriate Behavior',
    copyright: 'Copyright',
    spam: 'Spam',
    other: 'Other',
  };

  const openCount = (reports || []).filter((r: any) => r.status === 'open').length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-lg">Reports</h2>
          {openCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{openCount} open</span>
          )}
        </div>
        <div className="flex gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm">
            <option value="all">All Types</option>
            <option value="lesson">Lesson</option>
            <option value="session">Session</option>
            <option value="teacher">Teacher</option>
            <option value="course">Course</option>
            <option value="tutoring_misbehave">🚨 Misbehave Report</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading reports...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
          <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
          <h3 className="font-bold">No reports found</h3>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reporter</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reported</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{r.reporterName}</div>
                      <div className="text-xs text-muted-foreground">{r.reporterEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium capitalize">{r.type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{reasonLabels[r.reason] || r.reason}</td>
                    <td className="px-4 py-3">
                      {r.reportedName ? (
                        <div>
                          <div className="text-sm font-medium">{r.reportedName}</div>
                          <div className="text-xs text-muted-foreground">{r.reportedEmail}</div>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">–</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[r.status] || 'bg-gray-100 text-gray-700'}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveReport(r)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!activeReport} onOpenChange={(o) => { if (!o) { setActiveReport(null); setResolveNote(''); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Review Report #{activeReport?.id}</DialogTitle></DialogHeader>
          {activeReport && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                <div><span className="font-medium">Reporter:</span> {activeReport.reporterName} ({activeReport.reporterEmail})</div>
                <div><span className="font-medium">Type:</span> {activeReport.type}</div>
                <div><span className="font-medium">Reason:</span> {reasonLabels[activeReport.reason] || activeReport.reason}</div>
                {activeReport.reportedName && <div><span className="font-medium">Reported:</span> {activeReport.reportedName}</div>}
                {activeReport.description && <div><span className="font-medium">Description:</span> {activeReport.description}</div>}
                {activeReport.recordingUrl && (
                  <div className="pt-2 border-t border-border">
                    <a
                      href={activeReport.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" /> View Incident Recording
                    </a>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Admin Note (optional)</label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  rows={3}
                  placeholder="Add a resolution note..."
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button className="gap-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs" onClick={() => updateStatus(activeReport.id, 'under_review')}>
                  Under Review
                </Button>
                <Button className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => updateStatus(activeReport.id, 'resolved')}>
                  <CheckCircle className="w-3.5 h-3.5" /> Resolved
                </Button>
                <Button variant="outline" className="gap-1 text-muted-foreground text-xs" onClick={() => updateStatus(activeReport.id, 'dismissed')}>
                  Dismiss
                </Button>
                <Button variant="outline" className="gap-1 text-destructive text-xs border-destructive/30" onClick={() => setActiveReport(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CATEGORIES TAB ───────────────────────────────────────────────────────────

const EMOJI_OPTIONS = ['📐','🔬','📖','🇬🇧','🏛️','⚛️','🧪','🧬','💻','🌙','🎨','🎵','⚽','🌍','📊','🧮','🔭','🏥','⚖️','🏗️'];

function CategoriesTab({ api, queryClient, toast }: any) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: { name: '', nameAr: '', icon: '📚' },
  });
  const icon = watch('icon');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: () => api.get('/categories'),
  });

  const openCreate = () => {
    reset({ name: '', nameAr: '', icon: '📚' });
    setEditCat(null);
    setIsCreateOpen(true);
  };

  const openEdit = (cat: any) => {
    reset({ name: cat.name, nameAr: cat.nameAr, icon: cat.icon || '📚' });
    setEditCat(cat);
    setIsCreateOpen(true);
  };

  const saveCategory = async (data: any) => {
    try {
      if (editCat) {
        await api.put(`/categories/${editCat.id}`, data);
        toast({ title: 'Category updated!' });
      } else {
        await api.post('/categories', data);
        toast({ title: 'Category created!' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsCreateOpen(false);
      reset();
      setEditCat(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const deleteCategory = async (cat: any) => {
    if (cat.courseCount > 0) {
      toast({ title: 'Cannot delete', description: `This category has ${cat.courseCount} courses. Move them first.`, variant: 'destructive' });
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.del(`/categories/${cat.id}`);
      toast({ title: 'Category deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-lg">Course Categories <span className="text-muted-foreground font-normal text-sm">({(categories as any[]).length})</span></h2>
        <Button onClick={openCreate} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading categories...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(categories as any[]).map((cat: any) => (
            <div key={cat.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{cat.icon || '📚'}</div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteCategory(cat)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="font-bold text-base">{cat.nameAr}</div>
              <div className="text-sm text-muted-foreground">{cat.name}</div>
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />{cat.courseCount} course{cat.courseCount !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={v => { if (!v) { setIsCreateOpen(false); setEditCat(null); reset(); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editCat ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(saveCategory)} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Category Name (Arabic) *</label>
              <Input {...register('nameAr', { required: true })} placeholder="مثال: الرياضيات" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category Name (English) *</label>
              <Input {...register('name', { required: true })} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setValue('icon', e)}
                    className={`text-2xl p-2 rounded-lg border-2 transition-all ${icon === e ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                {editCat ? 'Save Changes' : 'Create Category'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setEditCat(null); reset(); }}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DMCA COMPLAINTS TAB ──────────────────────────────────────────────────────

function DMCAComplaintsTab({ api, queryClient, toast }: any) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeComplaint, setActiveComplaint] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['/api/copyright-complaints'],
    queryFn: () => api.get('/copyright-complaints'),
    refetchInterval: 30000,
  });

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/copyright-complaints/${id}`, { status, adminNotes });
      toast({ title: `Complaint marked as ${status}` });
      queryClient.invalidateQueries({ queryKey: ['/api/copyright-complaints'] });
      setActiveComplaint(null);
      setAdminNotes('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = (complaints || []).filter((c: any) => {
    return statusFilter === 'all' || c.status === statusFilter;
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    reviewing: 'bg-blue-100 text-blue-800 border-blue-200',
    resolved: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };

  const pendingCount = (complaints || []).filter((c: any) => c.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-lg">DMCA Complaints</h2>
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} pending</span>
          )}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewing">Under Review</option>
          <option value="resolved">Resolved / Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading complaints...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
          <h3 className="font-bold">No DMCA complaints</h3>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reporter</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reported Teacher</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{c.reporterName}</div>
                      <div className="text-xs text-muted-foreground">{c.reporterEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-primary">ID: {c.reportedTeacherId}</div>
                      <div className="text-xs text-muted-foreground">{c.reportedTeacherName || 'Unknown Teacher'}</div>
                      {c.reportedLessonId && <div className="text-[10px] text-muted-foreground bg-muted inline-block px-1 mt-0.5 rounded">Lesson: {c.reportedLessonId}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={c.description}>
                      {c.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusColors[c.status] || 'bg-gray-100 text-gray-700'}`}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setActiveComplaint(c); setAdminNotes(c.adminNotes || ''); }}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!activeComplaint} onOpenChange={(o) => { if (!o) { setActiveComplaint(null); setAdminNotes(''); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review DMCA Complaint #{activeComplaint?.id}</DialogTitle></DialogHeader>
          {activeComplaint && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 space-y-2 text-sm">
                  <h4 className="font-bold text-amber-900 border-b border-amber-200 pb-1 mb-2">Reporter Details</h4>
                  <div><span className="font-semibold">Name:</span> {activeComplaint.reporterName}</div>
                  <div><span className="font-semibold">Email:</span> {activeComplaint.reporterEmail}</div>
                  {activeComplaint.proofUrl && (
                    <div><span className="font-semibold">Proof Link:</span> <a href={activeComplaint.proofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{activeComplaint.proofUrl}</a></div>
                  )}
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-100 space-y-2 text-sm">
                  <h4 className="font-bold text-red-900 border-b border-red-200 pb-1 mb-2">Reported Target</h4>
                  <div><span className="font-semibold">Teacher ID:</span> {activeComplaint.reportedTeacherId} ({activeComplaint.reportedTeacherName})</div>
                  {activeComplaint.reportedLessonId && <div><span className="font-semibold">Lesson ID:</span> {activeComplaint.reportedLessonId}</div>}
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <h4 className="font-bold">Infringement Description</h4>
                <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border">
                  {activeComplaint.description}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold mb-1 block">Internal Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Record your investigation results here..."
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                />
              </div>

              <div className="bg-card border rounded-xl p-4">
                <h4 className="font-bold text-sm mb-3">Resolution Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => updateStatus(activeComplaint.id, 'reviewing')}>
                    ⏳ Mark as Under Review
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(activeComplaint.id, 'resolved')}>
                    ✓ Approve (Take Down Content)
                  </Button>
                  <Button variant="outline" className="text-destructive border-destructive" onClick={() => updateStatus(activeComplaint.id, 'rejected')}>
                    ✗ Reject (Baseless)
                  </Button>
                  <Button variant="ghost" onClick={() => setActiveComplaint(null)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Note: Taking down content currently requires you to manually navigate to the Courses tab and unpublish the reported course or delete the lesson.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ACADEMY ADMIN TAB ────────────────────────────────────────────────────────

function AcademyAdminTab({ api, queryClient, toast }: any) {
  const [activeSubTab, setActiveSubTab] = useState('applications');

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['admin-academy-applications'],
    queryFn: () => api.get('/academy/admin/applications'),
  });

  const { data: programs, isLoading: progsLoading } = useQuery({
    queryKey: ['admin-academy-programs'],
    queryFn: () => api.get('/academy/programs'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status, notes }: any) => api.put(`/academy/admin/applications/${id}`, { status, reviewNotes: notes }),
    onSuccess: () => {
      toast({ title: 'Application updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['admin-academy-applications'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error updating application', description: err.message, variant: 'destructive' });
    }
  });

  const handleApprove = (appId: number, currentStatus: string) => {
    const isApproved = currentStatus === 'approved';
    const notes = window.prompt(`Admin notes for ${isApproved ? 'rejecting' : 'approving'} application:`);
    if (notes !== null) {
      approveMutation.mutate({ id: appId, status: isApproved ? 'rejected' : 'approved', notes });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-border pb-4">
        <button
          onClick={() => setActiveSubTab('applications')}
          className={`font-semibold text-sm pb-1 border-b-2 ${activeSubTab === 'applications' ? 'border-amber-500 text-amber-600' : 'border-transparent text-muted-foreground'}`}
        >
          Applications
        </button>
        <button
          onClick={() => setActiveSubTab('programs')}
          className={`font-semibold text-sm pb-1 border-b-2 ${activeSubTab === 'programs' ? 'border-amber-500 text-amber-600' : 'border-transparent text-muted-foreground'}`}
        >
          Programs
        </button>
      </div>

      {activeSubTab === 'applications' && (
        <div className="bg-card border border-border rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground uppercase">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Program / Grade</th>
                  <th className="px-6 py-4">Parent Info</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appsLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-500" /></td></tr>
                ) : applications?.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No applications found</td></tr>
                ) : applications?.map((app: any) => (
                  <tr key={app.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="font-bold">{app.studentName}</div>
                      <div className="text-muted-foreground text-xs">{app.studentEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold">{app.programName}</div>
                      <div className="text-muted-foreground text-xs">Grade {app.gradeLevel} • {app.programType}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold">{app.parentName}</div>
                      <div className="text-muted-foreground text-xs">{app.parentPhone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        app.status === 'rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }>
                        {app.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 flex gap-2 justify-center">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className={app.status === 'approved' ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}
                        onClick={() => handleApprove(app.id, app.status)}
                        disabled={approveMutation.isPending}
                      >
                        {app.status === 'approved' ? 'Reject' : 'Approve'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'programs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-card p-6 border border-border rounded-xl">
            <div>
              <h3 className="text-xl font-bold">Programs Matrix</h3>
              <p className="text-muted-foreground">Active Academy programs available for enrollment.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {progsLoading ? (
               <div className="col-span-full py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-500" /></div>
            ) : programs?.length === 0 ? (
               <div className="col-span-full py-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">No active programs found. Create one directly via DB for now.</div>
            ) : programs?.map((prog: any) => (
              <div key={prog.id} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-amber-600" />
                  </div>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full">Active</Badge>
                </div>
                <h4 className="font-bold text-lg mb-1">{prog.name}</h4>
                <div className="text-sm font-medium text-amber-600 mb-4">{prog.type}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Grade</span> <span className="text-foreground font-semibold">{prog.gradeLevel}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Duration</span> <span className="text-foreground font-semibold">{prog.durationYears} Years</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Tuition</span> <span className="text-foreground font-semibold">{prog.tuitionPerSemester} {prog.currency} / sem</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Subjects</span> <span className="text-foreground font-semibold">{prog.subjectCount || 0}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────

function SettingsTab({ api, queryClient, toast }: any) {
  const [commission, setCommission] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: () => api.get('/admin/settings'),
  });

  useEffect(() => {
    if (settings) {
      const comm = settings.find((s: any) => s.key === 'teacher_commission_percent');
      if (comm) {
        setCommission(comm.value);
      }
    }
  }, [settings]);

  const handleSaveCommission = async () => {
    const val = parseFloat(commission);
    if (isNaN(val) || val < 0 || val > 100) {
      toast({ title: 'Error', description: 'Commission must be between 0 and 100', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        key: 'teacher_commission_percent',
        value: commission,
        description: 'Platform fee percentage retained from teacher sales'
      });
      toast({ title: 'Success', description: 'Commission rate updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm p-6">
        <h3 className="font-bold text-lg mb-1">Financial Settings</h3>
        <p className="text-sm text-muted-foreground mb-6">Configure global financial parameters and commission rates.</p>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1.5">Teacher Commission Percentage (%)</label>
            <div className="flex gap-3">
              <Input
                type="number"
                min="0"
                max="100"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="e.g., 20"
                className="font-mono text-lg h-12"
              />
              <Button onClick={handleSaveCommission} disabled={saving} className="h-12 px-6">
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This is the percentage of a course or session price that the platform retains. 
              The teacher receives the remaining amount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WITHDRAWALS TAB ────────────────────────────────────────────────────────
function WithdrawalsTab({ api, queryClient, toast }: any) {
  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['/api/admin/withdrawals'],
    queryFn: () => api.get('/admin/withdrawals'),
    refetchInterval: 15000,
  });

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/admin/withdrawals/${id}/status`, { status });
      toast({ title: `Withdrawal ${status}` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold font-display">Teacher Payout Requests</h2>
      </div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading withdrawals...</div>
        ) : withdrawals?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No withdrawal requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Teacher</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {withdrawals?.map((w: any) => (
                  <tr key={w.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="font-medium">{w.teacherName}</div>
                      <div className="text-xs text-muted-foreground">{w.teacherEmail}</div>
                    </td>
                    <td className="px-4 py-3 font-bold">{w.amount} LYD</td>
                    <td className="px-4 py-3 capitalize">{(w.paymentMethod || 'bank_transfer').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 max-w-xs truncate" title={w.details}>{w.details}</td>
                    <td className="px-4 py-3">
                      <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'outline'} className={w.status === 'approved' ? 'bg-green-500 text-white' : w.status === 'pending' ? 'bg-amber-100 text-amber-700' : ''}>
                        {w.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {w.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUpdateStatus(w.id, 'approved')} className="bg-green-600 hover:bg-green-700 h-8 text-xs">Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(w.id, 'rejected')} className="h-8 text-xs">Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── REDEEM CARDS TAB ─────────────────────────────────────────────────────────
function RedeemCardsTab({ api, queryClient, toast }: any) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [value, setValue] = useState('');
  const [count, setCount] = useState('1');

  const { data: cards, isLoading } = useQuery({
    queryKey: ['/api/admin/redeem-cards'],
    queryFn: () => api.get('/admin/redeem-cards'),
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/redeem-cards/generate', { 
        value: parseFloat(value), 
        count: parseInt(count, 10) 
      });
      toast({ title: `${count} card(s) generated successfully` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/redeem-cards'] });
      setIsCreateOpen(false);
      setValue('');
      setCount('1');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await api.put(`/admin/redeem-cards/${id}/deactivate`, {});
      toast({ title: 'Card deactivated' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/redeem-cards'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold font-display">Redeem Cards Management</h2>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Generate Cards
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading cards...</div>
        ) : cards?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No redeem cards found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Used By</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Generated Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cards?.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono text-lg tracking-widest">{c.code}</td>
                    <td className="px-4 py-3 font-bold">{c.value} LYD</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === 'active' ? 'default' : c.status === 'redeemed' ? 'secondary' : 'destructive'} className={c.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.status === 'redeemed'
                        ? `${c.studentEmail || `User #${c.redeemedBy}`} on ${c.redeemedAt ? new Date(c.redeemedAt).toLocaleDateString() : '–'}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {c.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => handleDeactivate(c.id)} className="h-8 text-xs text-destructive hover:bg-destructive/10">
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Generate Redeem Cards</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Card Value (LYD)</label>
              <Input type="number" required min="1" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 50" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Number of Cards</label>
              <Input type="number" required min="1" max="100" value={count} onChange={e => setCount(e.target.value)} placeholder="1" />
            </div>
            <Button type="submit" className="w-full">Generate</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PENDING APPROVALS TAB ──────────────────────────────────────────────────────
function PendingApprovalsTab({ api, queryClient, toast, initialPendingCourses }: any) {
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: courses, isLoading } = useQuery({
    queryKey: ['/api/admin/courses', 'pending_review'],
    queryFn: () => api.get('/admin/courses?status=pending_review'),
    initialData: initialPendingCourses,
  });

  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['/api/courses', selectedCourse?.id, 'lessons'],
    queryFn: () => api.get(`/courses/${selectedCourse?.id}/lessons`),
    enabled: !!selectedCourse,
  });

  const handleReviewClick = (course: any) => {
    setSelectedCourse(course);
    setRejectionReason('');
    setIsReviewModalOpen(true);
  };

  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve and publish this course?')) return;
    setIsSubmitting(true);
    try {
      await api.put(`/admin/courses/${selectedCourse.id}/publish`, { isPublished: true });
      toast({ title: 'Course approved and published successfully' });
      setIsReviewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/courses'] });
    } catch (err: any) {
      toast({ title: 'Error approving course', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason || rejectionReason.length < 20) {
      toast({ title: 'Validation Error', description: 'Please provide a clear rejection reason (at least 20 chars) for the teacher.', variant: 'destructive' });
      return;
    }
    if (!window.confirm('Are you sure you want to reject this course?')) return;
    setIsSubmitting(true);
    try {
      await api.put(`/admin/courses/${selectedCourse.id}/reject`, { rejectionReason });
      toast({ title: 'Course rejected successfully' });
      setIsReviewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/courses'] });
    } catch (err: any) {
      toast({ title: 'Error rejecting course', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingList = courses?.courses || courses || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold font-display">Pending Course Approvals</h2>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading pending courses...</div>
        ) : pendingList.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
            <CheckCircle className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
            <h3 className="text-xl font-bold">All Caught Up!</h3>
            <p className="text-muted-foreground mt-2">There are no courses waiting for review right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingList.map((course: any) => (
              <div key={course.id} className="bg-background rounded-xl border border-border overflow-hidden flex flex-col shadow-sm">
                <div className="aspect-video bg-muted relative">
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <Video className="w-10 h-10 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute top-2 start-2">
                    <Badge className="bg-blue-500 hover:bg-blue-600 shadow-md">Under Review</Badge>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold line-clamp-1">{course.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{course.titleAr}</p>
                  
                  <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Presentation className="w-3 h-3 text-primary" />
                    </div>
                    <span className="truncate">{course.teacherName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-center mb-4">
                    <div className="bg-muted/50 p-2 rounded">
                      <div className="font-bold">{course.lessonCount || 0}</div>
                      <div className="text-muted-foreground">Lessons</div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <div className="font-bold">{course.price === 0 ? 'Free' : course.price}</div>
                      <div className="text-muted-foreground">Price</div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <Button className="w-full gap-2" onClick={() => handleReviewClick(course)}>
                      <Search className="w-4 h-4" /> Review Course
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Course Review</DialogTitle>
          </DialogHeader>
          
          {selectedCourse && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div className="md:col-span-2 space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-1">{selectedCourse.title}</h3>
                  <p className="text-muted-foreground mb-4">{selectedCourse.titleAr}</p>
                  
                  <div className="flex items-center gap-4 text-sm border-y border-border py-3">
                    <div><span className="text-muted-foreground">Teacher:</span> <span className="font-medium">{selectedCourse.teacherName}</span></div>
                    <div><span className="text-muted-foreground">Price:</span> <span className="font-medium text-primary">{selectedCourse.price === 0 ? 'Free' : selectedCourse.price + ' LYD'}</span></div>
                    <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{selectedCourse.categoryName}</span></div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold mb-3 flex items-center gap-2"><Video className="w-4 h-4" /> Course Content ({lessons?.length || 0} lessons)</h4>
                  {lessonsLoading ? (
                    <div className="text-muted-foreground text-sm">Loading lessons...</div>
                  ) : lessons?.length === 0 ? (
                    <div className="text-destructive text-sm bg-destructive/10 p-3 rounded">Warning: This course has no lessons!</div>
                  ) : (
                    <div className="space-y-3">
                      {lessons?.map((lesson: any, i: number) => (
                        <div key={lesson.id} className="bg-muted/30 border border-border p-3 rounded-lg flex items-start gap-3">
                          <div className="bg-primary/10 text-primary w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{lesson.title}</div>
                            {lesson.videoUrl ? (
                              <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                                <PlayCircle className="w-3 h-3" /> View Video Content
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground mt-1 block">No video attached</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">{lesson.duration || 0}m</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/20 p-5 rounded-xl border border-border space-y-5 h-fit sticky top-0">
                <div>
                  <h4 className="font-bold mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Admin Checklist</h4>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li className="flex gap-2"><input type="checkbox" className="mt-1" /> Is audio clear and understandable?</li>
                    <li className="flex gap-2"><input type="checkbox" className="mt-1" /> Is the video quality acceptable?</li>
                    <li className="flex gap-2"><input type="checkbox" className="mt-1" /> Does the course meet Islamic guidelines?</li>
                    <li className="flex gap-2"><input type="checkbox" className="mt-1" /> Are there any prohibited elements?</li>
                    <li className="flex gap-2"><input type="checkbox" className="mt-1" /> Is the pricing fair for the content?</li>
                  </ul>
                </div>

                <hr className="border-border" />

                <div className="space-y-3">
                  <Button 
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" 
                    onClick={handleApprove}
                    disabled={isSubmitting || !lessons || lessons.length === 0}
                  >
                    <CheckCircle className="w-4 h-4" /> Approve & Publish
                  </Button>
                  
                  <div className="pt-2">
                    <label className="text-sm font-bold mb-1 block text-destructive">Rejection Reason</label>
                    <Textarea 
                      placeholder="Explain what needs to be fixed (min 20 characters)..." 
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="text-sm min-h-[100px] mb-2"
                    />
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" 
                      onClick={handleReject}
                      disabled={isSubmitting}
                    >
                      <XCircle className="w-4 h-4" /> Reject Course
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TUTORING REVIEWS TAB ─────────────────────────────────────────────────────

function TutoringReviewsTab({ api, queryClient, toast }: any) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState<number | null>(null);
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});
  const [adminReviews, setAdminReviews] = useState<Record<number, string>>({});

  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/tutoring-reviews', statusFilter],
    queryFn: () => api.get(`/admin/tutoring-reviews?status=${statusFilter}`),
    refetchInterval: 15000,
  });

  const handleAction = async (id: number, action: 'approve' | 'reject' | 'partial-approve') => {
    setProcessing(id);
    try {
      const payload: any = { adminReview: adminReviews[id] };
      if (action === 'partial-approve') {
        payload.teacherAmount = partialAmounts[id];
      }
      await api.post(`/admin/tutoring-reviews/${id}/${action}`, payload);
      toast({ title: `Session marked as ${action.replace('-', ' ')}` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tutoring-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const statusColors: Record<string, string> = {
    completed_pending_review: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    cancelled_no_show: 'bg-orange-100 text-orange-800 border-orange-200',
    terminated_due_to_report: 'bg-red-100 text-red-800 border-red-300',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    partially_approved: 'bg-teal-100 text-teal-800 border-teal-200',
  };

  const statusLabels: Record<string, string> = {
    completed_pending_review: 'Pending Review',
    cancelled_no_show: 'No-Show (Needs Review)',
    terminated_due_to_report: '🚨 Misbehave Report — On Hold',
    approved: 'Approved (Teacher Paid)',
    rejected: 'Rejected (Student Refunded)',
    partially_approved: 'Partially Approved',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap justify-between items-center">
        <div className="flex gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Reviews</option>
            <option value="completed_pending_review">Pending Review</option>
            <option value="cancelled_no_show">No-Shows</option>
            <option value="terminated_due_to_report">🚨 Misbehave Reports</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="partially_approved">Partially Approved</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading reviews...</div>
      ) : (reviews || []).length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
          <Presentation className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
          <h3 className="font-bold">No sessions pending review</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          {(reviews || []).map((r: any) => (
            <div key={r.id} className={`bg-card rounded-2xl border p-5 shadow-sm flex flex-col ${r.earlyTerminationFlagged || r.status === 'cancelled_no_show' ? 'border-red-400/60 bg-red-50/30 dark:bg-red-950/10' : 'border-border'}`}>
              <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusColors[r.status] || 'bg-gray-100 text-gray-700'}`}>
                    {statusLabels[r.status] || r.status}
                  </span>
                  {r.earlyTerminationFlagged && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold border bg-red-100 text-red-700 border-red-300 flex items-center gap-1">
                      ⚠ Early Termination
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">#{r.id}</span>
              </div>
              <div className="mb-4">
                <div className="text-xl font-bold text-primary">{r.totalAmount} <span className="text-sm font-normal text-muted-foreground">LYD</span></div>
                <div className="text-sm font-bold mt-1">{r.subject} {r.topic ? `— ${r.topic}` : ''}</div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="text-xs text-muted-foreground">{r.durationMinutes} min scheduled</div>
                  {r.elapsedSeconds != null && r.elapsedSeconds > 0 && (
                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.elapsedSeconds >= r.durationMinutes * 60
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {Math.floor(r.elapsedSeconds / 60)}m {r.elapsedSeconds % 60}s elapsed
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student:</span>
                  <span className="font-medium text-right">{r.studentName} <br/><span className="text-xs text-muted-foreground">{r.studentEmail}</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teacher:</span>
                  <span className="font-medium text-right">{r.teacherName} <br/><span className="text-xs text-muted-foreground">{r.teacherEmail}</span></span>
                </div>
              </div>

              {/* Feedback Section */}
              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm border border-border/50">
                <div className="font-semibold mb-1">Student Feedback:</div>
                {r.studentRating ? (
                  <>
                    <div className="flex items-center gap-1 text-yellow-500 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={i < r.studentRating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      ))}
                      <span className="text-muted-foreground text-xs ml-1">({r.studentRating}/5)</span>
                    </div>
                    <div className="italic text-muted-foreground">"{r.studentReview || 'No comment provided'}"</div>
                  </>
                ) : (
                  <div className="text-muted-foreground italic">Student has not provided feedback yet.</div>
                )}
              </div>

              {r.recordingUrl && (
                <div className="mb-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                  <div className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground">
                    <Radio className="w-3.5 h-3.5 text-blue-500" />
                    Temporary Session Audio
                  </div>
                  <audio src={r.recordingUrl} controls className="w-full" style={{ minHeight: '40px' }} />
                </div>
              )}

              {/* Incident Recording for Misbehave cases */}
              {r.status === 'terminated_due_to_report' && r.recordingUrl && (
                <div className="mb-4 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-300/60">
                  <div className="text-xs font-bold mb-2 flex items-center gap-1.5 text-red-700">
                    <Video className="w-3.5 h-3.5" /> Incident Recording (2-min buffer)
                  </div>
                  <a
                    href={r.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <PlayCircle className="w-3.5 h-3.5" /> Watch Recording
                  </a>
                </div>
              )}

              {/* Admin Actions */}
              {(r.status === 'completed_pending_review' || r.status === 'cancelled_no_show' || r.status === 'terminated_due_to_report') ? (
                <div className="mt-auto space-y-3 pt-4 border-t border-border">
                  <div>
                    <label className="text-xs font-medium block mb-1">Admin Note / Reason (Optional)</label>
                    <Textarea 
                      placeholder="Visible in logs..."
                      className="text-xs min-h-[60px]"
                      value={adminReviews[r.id] || ''}
                      onChange={e => setAdminReviews({ ...adminReviews, [r.id]: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs h-9"
                      disabled={processing === r.id}
                      onClick={() => handleAction(r.id, 'approve')}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve Full
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 text-xs h-9"
                      disabled={processing === r.id}
                      onClick={() => handleAction(r.id, 'reject')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject Full
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input 
                      placeholder="Teacher amt" 
                      type="number"
                      step="0.01"
                      className="w-24 text-xs h-9"
                      value={partialAmounts[r.id] || ''}
                      onChange={e => setPartialAmounts({ ...partialAmounts, [r.id]: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      className="flex-1 text-teal-700 border-teal-200 hover:bg-teal-50 text-xs h-9"
                      disabled={processing === r.id || !partialAmounts[r.id]}
                      onClick={() => handleAction(r.id, 'partial-approve')}
                    >
                      Partial Approve
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-auto pt-4 border-t border-border text-sm">
                  <div className="font-semibold mb-1">Admin Review Note:</div>
                  <div className="text-muted-foreground italic">{r.adminReview || 'No note provided'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Device Security Tab (device-switch reviews + account unblocking) ─────────
function DeviceSecurityTab({ api, toast }: any) {
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get(`/admin/device-switch-requests?status=${statusFilter}`)
      .then((data: any) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const review = async (id: number, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      await api.post(`/admin/device-switch-requests/${id}/${action}`, {});
      toast({ title: action === 'approve' ? 'Request approved — device switched & account unblocked.' : 'Request rejected — account stays blocked.' });
      load();
    } catch (err: any) {
      toast({ title: err.message || 'Action failed', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const unblock = async (userId: number) => {
    try {
      await api.post(`/admin/users/${userId}/unblock`, {});
      toast({ title: 'Account unblocked.' });
      load();
    } catch (err: any) {
      toast({ title: err.message || 'Unblock failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-display font-bold">Device Switch Reviews</h3>
          <p className="text-sm text-muted-foreground">
            Students who failed the face identity check while switching devices. Compare the signup face with the new attempt.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground bg-card border border-border rounded-2xl">
          No {statusFilter} requests.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(({ request, student }: any) => (
            <div key={request.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-6">
                <div className="flex-1 min-w-[220px]">
                  <div className="font-bold text-foreground">{student.fullName}</div>
                  <div className="text-xs text-muted-foreground mb-2">{student.email}</div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <div>New device: <span className="font-medium text-foreground">{request.newDeviceName || 'Unknown'}</span> ({request.newPlatform || '—'})</div>
                    <div>IP: {request.newIp || '—'}</div>
                    <div>Face distance: <span className="font-mono">{request.distance ?? '—'}</span></div>
                    <div>Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : '—'}</div>
                    {student.accountBlocked && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Account blocked</span>
                    )}
                  </div>
                </div>

                {/* Side-by-side face evidence */}
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-[11px] font-bold text-muted-foreground mb-1">Signup face</div>
                    {request.originalFaceSnapshotUrl ? (
                      <img src={request.originalFaceSnapshotUrl} alt="Original face" className="w-32 h-32 object-cover rounded-xl border border-border" />
                    ) : (
                      <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">No photo</div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-bold text-muted-foreground mb-1">New attempt</div>
                    {request.attemptFaceSnapshotUrl ? (
                      <img src={request.attemptFaceSnapshotUrl} alt="Attempt face" className="w-32 h-32 object-cover rounded-xl border border-border" />
                    ) : (
                      <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">No photo</div>
                    )}
                  </div>
                </div>

                {request.status === 'pending' ? (
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <Button size="sm" disabled={busyId === request.id} onClick={() => review(request.id, 'approve')} className="bg-green-600 hover:bg-green-700 text-white">
                      Approve switch
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === request.id} onClick={() => review(request.id, 'reject')}>
                      Reject
                    </Button>
                    {student.accountBlocked && (
                      <Button size="sm" variant="outline" onClick={() => unblock(student.id)}>
                        Unblock only
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="min-w-[140px]">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${request.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {request.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Refunds Tab (admin review with watch statistics) ─────────────────────────
function RefundsTab({ api, toast }: any) {
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get(`/admin/refund-requests?status=${statusFilter}`)
      .then((data: any) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const review = async (id: number, action: 'approve' | 'reject') => {
    const adminNotes = window.prompt(action === 'approve' ? 'Optional note for the approval:' : 'Reason for rejection (shown to the student):') || undefined;
    setBusyId(id);
    try {
      await api.post(`/admin/refund-requests/${id}/${action}`, { adminNotes });
      toast({ title: action === 'approve' ? 'Refund approved — wallet credited, access revoked, teacher earnings reversed.' : 'Refund rejected.' });
      load();
    } catch (err: any) {
      toast({ title: err.message || 'Action failed', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const fmtWatch = (secs: number) => {
    const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-display font-bold">Refund Requests</h3>
          <p className="text-sm text-muted-foreground">
            Watch statistics show how much of the course the student actually consumed before requesting a refund.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground bg-card border border-border rounded-2xl">
          No {statusFilter} refund requests.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(({ request, student, course, watchStats }: any) => {
            const openedPct = watchStats.totalLessons > 0 ? Math.round((watchStats.lessonsOpened / watchStats.totalLessons) * 100) : 0;
            const completedPct = watchStats.totalLessons > 0 ? Math.round((watchStats.lessonsCompleted / watchStats.totalLessons) * 100) : 0;
            return (
              <div key={request.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-start gap-6">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-bold text-foreground">{student.fullName}</div>
                    <div className="text-xs text-muted-foreground mb-1">{student.email}</div>
                    <div className="text-sm text-foreground font-medium">{course.title}</div>
                    <div className="text-lg font-extrabold text-primary mt-1">{parseFloat(request.amount).toFixed(2)} LYD</div>
                    {request.reason && (
                      <div className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">
                        “{request.reason}”
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-2">
                      Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : '—'}
                    </div>
                  </div>

                  {/* Watch statistics */}
                  <div className="min-w-[220px] bg-muted/40 rounded-xl p-4 text-sm space-y-2">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Watch activity</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lessons opened</span>
                      <span className="font-bold">{watchStats.lessonsOpened}/{watchStats.totalLessons} ({openedPct}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lessons completed</span>
                      <span className="font-bold">{watchStats.lessonsCompleted}/{watchStats.totalLessons} ({completedPct}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total watch time</span>
                      <span className="font-bold">{fmtWatch(watchStats.totalWatchedSeconds)}</span>
                    </div>
                    <div className={`text-[11px] font-bold mt-1 ${completedPct > 50 ? 'text-red-600' : completedPct > 20 ? 'text-amber-600' : 'text-green-600'}`}>
                      {completedPct > 50 ? 'High consumption — refund questionable' : completedPct > 20 ? 'Moderate consumption' : 'Low consumption'}
                    </div>
                  </div>

                  {request.status === 'pending' ? (
                    <div className="flex flex-col gap-2 min-w-[130px]">
                      <Button size="sm" disabled={busyId === request.id} onClick={() => review(request.id, 'approve')} className="bg-green-600 hover:bg-green-700 text-white">
                        Approve refund
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busyId === request.id} onClick={() => review(request.id, 'reject')}>
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="min-w-[130px]">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${request.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {request.status}
                      </span>
                      {request.adminNotes && <div className="text-[11px] text-muted-foreground mt-2">{request.adminNotes}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab (weekly time-series, dependency-free bar charts) ───────────
function AnalyticsTab({ api }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading analytics…</div>;
  if (!data?.series) return <div className="py-16 text-center text-muted-foreground">Could not load analytics.</div>;

  const series: any[] = data.series;
  const snapshot = data.snapshot || {};

  const BarChart = ({ title, field, color, format }: { title: string; field: string; color: string; format?: (v: number) => string }) => {
    const max = Math.max(1, ...series.map((s) => s[field] || 0));
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-foreground mb-4">{title}</h4>
        <div className="flex items-end gap-1.5 h-36">
          {series.map((s) => {
            const v = s[field] || 0;
            return (
              <div key={s.week + field} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className={`w-full rounded-t-md ${color} transition-all group-hover:opacity-80`}
                  style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
                />
                <div className="absolute -top-6 hidden group-hover:block bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                  {format ? format(v) : v}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
          <span>{series[0]?.week?.slice(5)}</span>
          <span>{series[series.length - 1]?.week?.slice(5)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Subscription snapshot */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Subscriptions', value: snapshot.active_subscriptions ?? 0, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Expired Subscriptions', value: snapshot.expired_subscriptions ?? 0, color: 'text-red-600', bg: 'bg-red-100' },
          { label: 'Permanent (free) Enrollments', value: snapshot.permanent_enrollments ?? 0, color: 'text-blue-600', bg: 'bg-blue-100' },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-2xl p-5 shadow-sm text-center">
            <div className={`text-3xl font-extrabold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly trends (last 12 weeks) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChart title="Weekly Revenue (LYD)" field="revenue" color="bg-primary" format={(v) => `${v.toFixed(0)} LYD`} />
        <BarChart title="Weekly Enrollments" field="enrollments" color="bg-blue-500" />
        <BarChart title="Weekly Renewals" field="renewals" color="bg-green-500" />
        <BarChart title="Weekly Expirations" field="expirations" color="bg-red-400" />
      </div>
      <p className="text-xs text-muted-foreground">
        Renewals vs expirations tells you whether the subscription pricing curve is retaining students — if expirations
        consistently outpace renewals, consider adjusting plan prices or adding renewal incentives (coupons).
      </p>
    </div>
  );
}
// ─── Teacher Registration Approvals Tab ──────────────────────────────────────
function TeacherRegistrationApprovalsTab({ api, toast, onCountChange }: any) {
  const [teachers, setTeachers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [rejectTarget, setRejectTarget] = React.useState<any>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [processing, setProcessing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/teacher-profile/approvals');
      setTeachers(data || []);
      onCountChange?.((data || []).length);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [api, toast, onCountChange]);

  React.useEffect(() => { load(); }, [load]);

  const approve = async (teacher: any) => {
    setProcessing(true);
    try {
      await api.post(`/teacher-profile/approvals/${teacher.id}/approve`, {});
      toast({ title: `✅ ${teacher.fullName} approved!` });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  const reject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setProcessing(true);
    try {
      await api.post(`/teacher-profile/approvals/${rejectTarget.id}/reject`, { reason: rejectReason.trim() });
      toast({ title: `❌ ${rejectTarget.fullName} rejected` });
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading pending teacher registrations...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Teacher Registration Applications</h2>
          <p className="text-muted-foreground text-sm">{teachers.length} pending review</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>

      {teachers.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-2xl border border-dashed border-border">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold">All caught up!</h3>
          <p className="text-muted-foreground text-sm">No pending teacher registrations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teachers.map((t: any) => (
            <div key={t.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar & Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
                    {t.avatarUrl ? <img src={t.avatarUrl} className="w-14 h-14 rounded-2xl object-cover" alt={t.fullName} /> : t.fullName?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t.fullName}</h3>
                    <p className="text-sm text-muted-foreground">{t.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Applied: {new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Documents */}
                <div className="flex flex-col gap-2 md:w-72">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Documents</p>
                  {t.qualificationUrl ? (
                    <a href={t.qualificationUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <GraduationCap className="w-4 h-4" /> Academic Qualification
                    </a>
                  ) : <p className="text-sm text-destructive">⚠ No qualification uploaded</p>}

                  {t.cvUrl ? (
                    <a href={t.cvUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <FileText className="w-4 h-4" /> CV / Resume
                    </a>
                  ) : <p className="text-sm text-muted-foreground">— No CV</p>}

                  {t.experienceLetterUrl && (
                    <a href={t.experienceLetterUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <FileText className="w-4 h-4" /> Experience Letter
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex md:flex-col gap-3 md:w-36 justify-end md:justify-start">
                  <Button
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={processing}
                    onClick={() => approve(t)}
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    disabled={processing}
                    onClick={() => { setRejectTarget(t); setRejectReason(''); }}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setRejectTarget(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">Reject {rejectTarget.fullName}</h3>
            <p className="text-muted-foreground text-sm mb-4">Provide a clear reason — it will be emailed to the teacher.</p>
            <textarea
              className="w-full border border-border rounded-xl p-3 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={4}
              placeholder="e.g. The uploaded qualification document is unclear or illegible. Please resubmit a higher quality image."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={!rejectReason.trim() || processing} onClick={reject}>
                {processing ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
