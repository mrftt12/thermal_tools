import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Play, 
  Edit, 
  Trash2,
  Cable,
  Settings,
  Thermometer,
  Clock
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ProjectView = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [cables, setCables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [projectRes, cablesRes] = await Promise.all([
        axios.get(`${API}/projects/${projectId}`, { withCredentials: true }),
        axios.get(`${API}/cables`, { withCredentials: true })
      ]);

      setProject(projectRes.data);
      setCables(cablesRes.data);
    } catch (error) {
      console.error("Failed to fetch project:", error);
      toast.error("Failed to load project");
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getCableName = (cableId) => {
    const cable = cables.find(c => c.cable_id === cableId);
    return cable ? cable.designation : cableId;
  };

  const runCalculation = async () => {
    try {
      await axios.post(`${API}/calculate/${projectId}`, {}, { withCredentials: true });
      toast.success("Calculation completed!");
      navigate(`/results/${projectId}`);
    } catch (error) {
      toast.error("Calculation failed");
    }
  };

  const deleteProject = async () => {
    try {
      await axios.delete(`${API}/projects/${projectId}`, { withCredentials: true });
      toast.success("Project deleted");
      navigate('/dashboard');
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'calculated': return 'text-emerald-400 bg-emerald-400/10';
      case 'draft': return 'text-amber-400 bg-amber-400/10';
      default: return 'text-zinc-400 bg-zinc-400/10';
    }
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Sidebar>
    );
  }

  if (!project) {
    return (
      <Sidebar>
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-white mb-2">Project Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6" data-testid="project-view">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="text-zinc-400 hover:text-cyan-400"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-zinc-500 mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/calculate/${projectId}`)}
              className="border-zinc-700 text-zinc-300 hover:border-cyan-500"
              data-testid="edit-project-btn"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            {project.status === 'calculated' && (
              <Button
                variant="outline"
                onClick={() => navigate(`/results/${projectId}`)}
                className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                data-testid="view-results-btn"
              >
                <Thermometer className="w-4 h-4 mr-2" />
                View Results
              </Button>
            )}
            <Button
              onClick={runCalculation}
              className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
              data-testid="run-calc-btn"
            >
              <Play className="w-4 h-4 mr-2" />
              {project.status === 'calculated' ? 'Recalculate' : 'Calculate'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  data-testid="delete-project-btn"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Project?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    This will permanently delete the project and all associated calculation results.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-zinc-800 text-zinc-300 border-zinc-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={deleteProject}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Installation Configuration */}
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                Installation Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Type</p>
                  <p className="text-sm text-zinc-200 font-mono mt-1">
                    {project.installation?.installation_type === 'direct_burial' ? 'Direct Burial' : 'Ductbank'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Burial Depth</p>
                  <p className="text-sm text-zinc-200 font-mono mt-1">{project.installation?.burial_depth_m} m</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Ambient Temp</p>
                  <p className="text-sm text-zinc-200 font-mono mt-1">{project.installation?.ambient_temp_c}°C</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Soil Resistivity</p>
                  <p className="text-sm text-zinc-200 font-mono mt-1">{project.installation?.soil_thermal_resistivity} K.m/W</p>
                </div>
              </div>
              
              {project.installation?.installation_type === 'ductbank' && (
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Ductbank Layout</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-200 font-mono">
                      {project.installation?.num_rows} × {project.installation?.num_cols} ducts
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calculation Parameters */}
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-cyan-400" />
                Calculation Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Method</p>
                  <p className="text-sm text-zinc-200 font-mono mt-1">
                    {project.parameters?.method === 'neher_mcgrath' ? 'Neher-McGrath' : 'IEC 60853'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Type</p>
                  <p className="text-sm text-zinc-200 font-mono mt-1">
                    {project.parameters?.calculation_type === 'steady_state' ? 'Steady State' : 'Transient'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Daily Loss Factor</p>
                  <p className="text-sm text-zinc-200 font-mono mt-1">{project.parameters?.daily_loss_factor}</p>
                </div>
                {project.parameters?.emergency_factor && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Emergency Factor</p>
                    <p className="text-sm text-amber-400 font-mono mt-1">×{project.parameters?.emergency_factor}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cables */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Cable className="w-5 h-5 text-cyan-400" />
              Cables ({project.cables?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.cables?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full thermal-table">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left p-3">Cable</th>
                      <th className="text-right p-3">Load (A)</th>
                      <th className="text-right p-3">Position X (m)</th>
                      <th className="text-right p-3">Depth (m)</th>
                      <th className="text-center p-3">Phase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.cables.map((pos, i) => (
                      <tr key={i} className="border-b border-zinc-800/50">
                        <td className="p-3 text-zinc-300 font-mono">{getCableName(pos.cable_id)}</td>
                        <td className="p-3 text-right text-cyan-400 font-mono">{pos.current_load_a} A</td>
                        <td className="p-3 text-right text-zinc-400 font-mono">{pos.position_x}</td>
                        <td className="p-3 text-right text-zinc-400 font-mono">{pos.position_y}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-mono text-zinc-300">
                            {pos.phase}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Cable className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No cables configured</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timestamps */}
        <div className="flex items-center gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Created: {new Date(project.created_at).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Updated: {new Date(project.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Sidebar>
  );
};

export default ProjectView;
