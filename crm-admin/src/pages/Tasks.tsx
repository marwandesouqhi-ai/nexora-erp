import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getTasks, createTask, updateTaskStatus } from '../services/tasksService';
import { getTeamMembers } from '../services/teamService';
import type { Task, TeamMember } from '../types';
import { ClipboardList, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { PageHero } from '../components/page';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssigned, setNewAssigned] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchData = async () => {
    try {
      const [tasksData, teamData] = await Promise.all([
        getTasks(),
        getTeamMembers()
      ]);
      setTasks(tasksData);
      setTeam(teamData);
      if (teamData.length > 0) {
        setNewAssigned(teamData[0].email);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await createTask(newTitle, newAssigned, newDesc, newDeadline);
      setShowAddModal(false);
      setNewTitle('');
      setNewDesc('');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('خطأ أثناء إضافة المهمة');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: Task['status']) => {
    try {
      await updateTaskStatus(id, status);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <div>
        
        {/* Header */}
        <PageHero
          icon={ClipboardList}
          tone="amber"
          title="المهام والمتابعة"
          subtitle="إدارة مهام فريق العمل ومتابعة تنفيذها."
          actions={
            <button onClick={() => setShowAddModal(true)} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary-hover">
              <Plus className="h-4 w-4" />
              إسناد مهمة جديدة
            </button>
          }
        />

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          
          {/* Pending Column */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-500"/>
              <h2 className="font-bold text-secondary-text">قيد الانتظار ({tasks.filter(t => t.status === 'pending').length})</h2>
            </div>
            {tasks.filter(t => t.status === 'pending').map(task => (
              <TaskCard key={task.id} task={task} onUpdate={handleUpdateStatus} />
            ))}
          </div>

          {/* In Progress Column */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-blue-500"/>
              <h2 className="font-bold text-secondary-text">جاري التنفيذ ({tasks.filter(t => t.status === 'in_progress').length})</h2>
            </div>
            {tasks.filter(t => t.status === 'in_progress').map(task => (
              <TaskCard key={task.id} task={task} onUpdate={handleUpdateStatus} />
            ))}
          </div>

          {/* Completed Column */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-500"/>
              <h2 className="font-bold text-secondary-text">مكتملة ({tasks.filter(t => t.status === 'completed').length})</h2>
            </div>
            {tasks.filter(t => t.status === 'completed').map(task => (
              <TaskCard key={task.id} task={task} onUpdate={handleUpdateStatus} />
            ))}
          </div>

        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center font-cairo">
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm dark:bg-black/55 transition-opacity" onClick={() => setShowAddModal(false)}></div>
            <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up mx-4">
              <h2 className="text-xl font-bold text-foreground mb-4">إسناد مهمة جديدة</h2>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1">عنوان المهمة</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary sm:text-sm bg-card-muted"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1">التفاصيل</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary sm:text-sm bg-card-muted min-h-[100px]"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1">الموظف المسؤول</label>
                  <select
                    value={newAssigned}
                    onChange={(e) => setNewAssigned(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary sm:text-sm bg-card-muted"
                  >
                    {team.map(m => (
                      <option key={m.id} value={m.email}>{m.name} ({m.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1">الموعد النهائي</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary sm:text-sm bg-card-muted text-left"
                    dir="ltr"
                  />
                </div>
                
                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-secondary-text bg-card border border-border-strong rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl disabled:opacity-50"
                  >
                    حفظ وإسناد
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onUpdate }: { task: Task, onUpdate: (id: string, status: Task['status']) => void }) {
  return (
    <div className="premium-card p-4 flex flex-col gap-3">
      <h3 className="font-bold text-foreground">{task.title}</h3>
      {task.description && <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>}
      
      <div className="text-xs font-medium text-muted-foreground mt-2 flex items-center justify-between">
        <span>المسؤول: {task.assignedTo.split('@')[0]}</span>
        {task.deadline && <span>{format(new Date(task.deadline), 'dd MMM', {locale: ar})}</span>}
      </div>

      <div className="pt-3 border-t border-border mt-2 flex gap-2">
        {task.status !== 'pending' && (
          <button onClick={() => onUpdate(task.id, 'pending')} className="flex-1 py-1 text-xs font-bold text-amber-600 bg-amber-50 rounded-lg">انتظار</button>
        )}
        {task.status !== 'in_progress' && (
          <button onClick={() => onUpdate(task.id, 'in_progress')} className="flex-1 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">تنفيذ</button>
        )}
        {task.status !== 'completed' && (
          <button onClick={() => onUpdate(task.id, 'completed')} className="flex-1 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg">اكتمال</button>
        )}
      </div>
    </div>
  );
}
