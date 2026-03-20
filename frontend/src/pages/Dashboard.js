import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Plus, 
  Thermometer, 
  Database, 
  FolderOpen, 
  Calculator,
  ArrowRight,
  Clock,
  Zap
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`, { withCredentials: true });
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const seedCables = async () => {
    try {
      const response = await axios.post(`${API}/seed-cables`, {}, { withCredentials: true });
      toast.success(response.data.message);
      fetchStats();
    } catch (error) {
      console.error("Failed to seed cables:", error);
      toast.error("Failed to seed cable library");
    }
  };

  const statCards = [
    {
      title: "Projects",
      value: stats?.project_count || 0,
      icon: <FolderOpen className="w-5 h-5" />,
      color: "text-cyan-400"
    },
    {
      title: "Cables in Library",
      value: stats?.cable_count || 0,
      icon: <Database className="w-5 h-5" />,
      color: "text-emerald-400"
    },
    {
      title: "Calculations",
      value: stats?.calculation_count || 0,
      icon: <Calculator className="w-5 h-5" />,
      color: "text-amber-400"
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'calculated': return 'text-emerald-400 bg-emerald-400/10';
      case 'draft': return 'text-amber-400 bg-amber-400/10';
      default: return 'text-zinc-400 bg-zinc-400/10';
    }
  };

  return (
    <Sidebar>
      <div className="space-y-6" data-testid="dashboard">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-zinc-500">Underground cable thermal analysis overview</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/calculate')}
              className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
              data-testid="new-calculation-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Calculation
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="bg-zinc-900/60 border-zinc-800 card-interactive">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 font-mono">{stat.title}</p>
                    <p className={`text-3xl font-mono font-bold mt-1 ${stat.color}`}>
                      {loading ? '-' : stat.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center ${stat.color}`}>
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions & Recent Projects */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => navigate('/calculate')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
                data-testid="quick-new-project"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Thermometer className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-zinc-300">New Thermal Calculation</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
              </button>
              
              <button
                onClick={() => navigate('/cables')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
                data-testid="quick-cable-library"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-zinc-300">Browse Cable Library</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
              </button>

              <button
                onClick={() => navigate('/cables/new')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
                data-testid="quick-add-cable"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-zinc-300">Add Custom Cable</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
              </button>

              {stats?.cable_count === 0 && (
                <button
                  onClick={seedCables}
                  className="w-full flex items-center justify-between p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors group"
                  data-testid="seed-cables-btn"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-cyan-400">Load Sample Cables</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </button>
              )}
            </CardContent>
          </Card>

          {/* Recent Projects */}
          <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium text-white">Recent Projects</CardTitle>
              {stats?.recent_projects?.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-zinc-400 hover:text-cyan-400"
                  onClick={() => navigate('/projects')}
                >
                  View All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-zinc-800/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : stats?.recent_projects?.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_projects.map((project) => (
                    <button
                      key={project.project_id}
                      onClick={() => navigate(`/projects/${project.project_id}`)}
                      className="w-full flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
                      data-testid={`project-${project.project_id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-400">
                          <FolderOpen className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-white">{project.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(project.status)}`}>
                              {project.status}
                            </span>
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(project.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">No projects yet</p>
                  <Button
                    onClick={() => navigate('/calculate')}
                    variant="outline"
                    className="mt-4 border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-400"
                    data-testid="create-first-project"
                  >
                    Create Your First Project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Info */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-500 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>System Operational</span>
              </div>
              <div>Calculation Engine: Neher-McGrath + IEC 60853</div>
              <div>Standards: AIEE 1957, IEC 60853-1/2</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
};

export default Dashboard;
