import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Cable,
  Thermometer,
  Settings,
  Play,
  Plus,
  X,
  Trash2
} from "lucide-react";

const steps = [
  { id: 1, name: "Project Setup", icon: <Settings className="w-4 h-4" /> },
  { id: 2, name: "Installation", icon: <Cable className="w-4 h-4" /> },
  { id: 3, name: "Cables", icon: <Cable className="w-4 h-4" /> },
  { id: 4, name: "Calculate", icon: <Thermometer className="w-4 h-4" /> },
];

const CalculationWizard = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isEditing = !!projectId;

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(isEditing);
  const [calculating, setCalculating] = useState(false);
  const [cables, setCables] = useState([]);
  const [selectedCables, setSelectedCables] = useState([]);

  const [project, setProject] = useState({
    name: "",
    description: "",
    installation: {
      installation_type: "direct_burial",
      burial_depth_m: 1.0,
      ambient_temp_c: 20,
      soil_thermal_resistivity: 1.0,
      num_rows: 3,
      num_cols: 3,
      duct_spacing_mm: 200,
    },
    cables: [],
    parameters: {
      method: "neher_mcgrath",
      calculation_type: "steady_state",
      duration_hours: null,
      emergency_factor: null,
      daily_loss_factor: 0.7,
    },
  });

  useEffect(() => {
    fetchCables();
    if (isEditing) {
      fetchProject();
    }
  }, [projectId]);

  const fetchCables = async () => {
    try {
      const response = await axios.get(`${API}/cables`, { withCredentials: true });
      setCables(response.data);
    } catch (error) {
      console.error("Failed to fetch cables:", error);
    }
  };

  const fetchProject = async () => {
    try {
      const response = await axios.get(`${API}/projects/${projectId}`, { withCredentials: true });
      setProject(response.data);
      setSelectedCables(response.data.cables || []);
    } catch (error) {
      toast.error("Failed to load project");
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (section, field, value) => {
    if (section) {
      setProject(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setProject(prev => ({ ...prev, [field]: value }));
    }
  };

  const addCable = (cableId) => {
    if (!cableId) return;
    
    const cable = cables.find(c => c.cable_id === cableId);
    if (!cable) return;

    const newPosition = {
      cable_id: cableId,
      position_x: selectedCables.length * 0.3,
      position_y: project.installation.burial_depth_m,
      current_load_a: 0,
      phase: "A"
    };

    setSelectedCables(prev => [...prev, newPosition]);
  };

  const updateCablePosition = (index, field, value) => {
    setSelectedCables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeCable = (index) => {
    setSelectedCables(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (currentStep === 1 && !project.name) {
      toast.error("Please enter a project name");
      return;
    }
    if (currentStep === 3 && selectedCables.length === 0) {
      toast.error("Please add at least one cable");
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const saveProject = async () => {
    const projectData = {
      ...project,
      cables: selectedCables,
    };

    try {
      if (isEditing) {
        await axios.put(`${API}/projects/${projectId}`, projectData, { withCredentials: true });
        return projectId;
      } else {
        const response = await axios.post(`${API}/projects`, projectData, { withCredentials: true });
        return response.data.project_id;
      }
    } catch (error) {
      throw error;
    }
  };

  const runCalculation = async () => {
    if (selectedCables.length === 0) {
      toast.error("Please add at least one cable");
      return;
    }

    setCalculating(true);
    try {
      const savedProjectId = await saveProject();
      
      await axios.post(`${API}/calculate/${savedProjectId}`, {}, { withCredentials: true });
      
      toast.success("Calculation completed!");
      navigate(`/results/${savedProjectId}`);
    } catch (error) {
      console.error("Calculation failed:", error);
      toast.error("Calculation failed. Please try again.");
    } finally {
      setCalculating(false);
    }
  };

  const getCableName = (cableId) => {
    const cable = cables.find(c => c.cable_id === cableId);
    return cable ? cable.designation : cableId;
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

  return (
    <Sidebar>
      <div className="space-y-6" data-testid="calculation-wizard">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-zinc-400 hover:text-cyan-400"
            data-testid="back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isEditing ? 'Edit Calculation' : 'New Thermal Calculation'}
            </h1>
            <p className="text-sm text-zinc-500">Configure your underground cable thermal analysis</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between max-w-2xl">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div 
                className={`wizard-step-number ${
                  currentStep === step.id ? 'active' : 
                  currentStep > step.id ? 'completed' : ''
                }`}
                data-testid={`step-${step.id}`}
              >
                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
              </div>
              <span className={`ml-2 text-sm hidden sm:block ${
                currentStep >= step.id ? 'text-zinc-200' : 'text-zinc-500'
              }`}>
                {step.name}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-12 sm:w-24 h-0.5 mx-2 ${
                  currentStep > step.id ? 'bg-cyan-500' : 'bg-zinc-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-6">
            {/* Step 1: Project Setup */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">Project Information</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Project Name *</Label>
                    <Input
                      value={project.name}
                      onChange={(e) => handleChange(null, 'name', e.target.value)}
                      placeholder="e.g., Substation A Feeder Cable"
                      className="bg-zinc-950 border-zinc-800 font-mono"
                      required
                      data-testid="project-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Calculation Method</Label>
                    <Select 
                      value={project.parameters.method} 
                      onValueChange={(v) => handleChange('parameters', 'method', v)}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="method-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="neher_mcgrath">Neher-McGrath</SelectItem>
                        <SelectItem value="iec_60853">IEC 60853</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-zinc-400">Description (Optional)</Label>
                    <Input
                      value={project.description || ''}
                      onChange={(e) => handleChange(null, 'description', e.target.value)}
                      placeholder="Brief description of the project"
                      className="bg-zinc-950 border-zinc-800"
                      data-testid="project-description-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Installation */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">Installation Configuration</CardTitle>
                </CardHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Installation Type</Label>
                    <Select 
                      value={project.installation.installation_type} 
                      onValueChange={(v) => handleChange('installation', 'installation_type', v)}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="installation-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="direct_burial">Direct Burial</SelectItem>
                        <SelectItem value="ductbank">Ductbank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Burial Depth (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={project.installation.burial_depth_m}
                      onChange={(e) => handleChange('installation', 'burial_depth_m', parseFloat(e.target.value))}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                      data-testid="burial-depth-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Ambient Temperature (°C)</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[project.installation.ambient_temp_c]}
                        onValueChange={([v]) => handleChange('installation', 'ambient_temp_c', v)}
                        min={-10}
                        max={50}
                        step={1}
                        className="flex-1"
                        data-testid="ambient-temp-slider"
                      />
                      <span className="text-cyan-400 font-mono w-12">
                        {project.installation.ambient_temp_c}°C
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Soil Thermal Resistivity (K.m/W)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={project.installation.soil_thermal_resistivity}
                      onChange={(e) => handleChange('installation', 'soil_thermal_resistivity', parseFloat(e.target.value))}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                      data-testid="soil-resistivity-input"
                    />
                  </div>

                  {project.installation.installation_type === 'ductbank' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-zinc-400">Number of Rows</Label>
                        <Select 
                          value={String(project.installation.num_rows)} 
                          onValueChange={(v) => handleChange('installation', 'num_rows', parseInt(v))}
                        >
                          <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="num-rows-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800">
                            {[1, 2, 3, 4, 5].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-400">Number of Columns</Label>
                        <Select 
                          value={String(project.installation.num_cols)} 
                          onValueChange={(v) => handleChange('installation', 'num_cols', parseInt(v))}
                        >
                          <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="num-cols-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800">
                            {[1, 2, 3, 4, 5].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {/* Ductbank Preview */}
                {project.installation.installation_type === 'ductbank' && (
                  <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
                    <Label className="text-zinc-400 text-sm mb-3 block">Ductbank Preview</Label>
                    <div className="flex justify-center">
                      <div 
                        className="grid gap-2 p-4 bg-zinc-700/30 rounded border border-zinc-600"
                        style={{
                          gridTemplateColumns: `repeat(${project.installation.num_cols}, 40px)`,
                          gridTemplateRows: `repeat(${project.installation.num_rows}, 40px)`
                        }}
                      >
                        {Array.from({ length: project.installation.num_rows * project.installation.num_cols }).map((_, i) => (
                          <div 
                            key={i}
                            className="w-10 h-10 rounded-full border-2 border-zinc-600 bg-zinc-800"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Cables */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">Cable Selection</CardTitle>
                </CardHeader>

                {/* Add Cable */}
                <div className="flex gap-4">
                  <Select onValueChange={addCable}>
                    <SelectTrigger className="flex-1 bg-zinc-950 border-zinc-800" data-testid="add-cable-select">
                      <SelectValue placeholder="Select a cable to add..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 max-h-64">
                      {cables.map((cable) => (
                        <SelectItem key={cable.cable_id} value={cable.cable_id}>
                          {cable.designation} - {cable.voltage_rating_kv}kV ({cable.conductor?.material})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/cables')}
                    className="border-zinc-700 text-zinc-300 hover:border-cyan-500"
                    data-testid="browse-cables-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Browse Library
                  </Button>
                </div>

                {/* Selected Cables */}
                {selectedCables.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCables.map((pos, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700"
                        data-testid={`selected-cable-${index}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                          <Cable className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white font-mono">
                            {getCableName(pos.cable_id)}
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-zinc-500">Load (A)</Label>
                              <Input
                                type="number"
                                value={pos.current_load_a}
                                onChange={(e) => updateCablePosition(index, 'current_load_a', parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 bg-zinc-950 border-zinc-800 font-mono text-sm"
                                data-testid={`cable-load-${index}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-zinc-500">X (m)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={pos.position_x}
                                onChange={(e) => updateCablePosition(index, 'position_x', parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 bg-zinc-950 border-zinc-800 font-mono text-sm"
                                data-testid={`cable-x-${index}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-zinc-500">Depth (m)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={pos.position_y}
                                onChange={(e) => updateCablePosition(index, 'position_y', parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 bg-zinc-950 border-zinc-800 font-mono text-sm"
                                data-testid={`cable-depth-${index}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-zinc-500">Phase</Label>
                              <Select 
                                value={pos.phase} 
                                onValueChange={(v) => updateCablePosition(index, 'phase', v)}
                              >
                                <SelectTrigger className="w-16 h-8 bg-zinc-950 border-zinc-800" data-testid={`cable-phase-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                  <SelectItem value="A">A</SelectItem>
                                  <SelectItem value="B">B</SelectItem>
                                  <SelectItem value="C">C</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCable(index)}
                          className="text-zinc-400 hover:text-red-400"
                          data-testid={`remove-cable-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <Cable className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No cables selected. Add cables from the library above.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Calculate */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">Calculation Parameters</CardTitle>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Calculation Type</Label>
                    <Select 
                      value={project.parameters.calculation_type} 
                      onValueChange={(v) => handleChange('parameters', 'calculation_type', v)}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="calculation-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="steady_state">Steady State</SelectItem>
                        <SelectItem value="transient">Transient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Daily Loss Factor</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[project.parameters.daily_loss_factor]}
                        onValueChange={([v]) => handleChange('parameters', 'daily_loss_factor', v)}
                        min={0}
                        max={1}
                        step={0.05}
                        className="flex-1"
                        data-testid="loss-factor-slider"
                      />
                      <span className="text-cyan-400 font-mono w-12">
                        {project.parameters.daily_loss_factor.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {project.parameters.calculation_type === 'transient' && (
                    <div className="space-y-2">
                      <Label className="text-zinc-400">Duration (hours)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={project.parameters.duration_hours || 4}
                        onChange={(e) => handleChange('parameters', 'duration_hours', parseFloat(e.target.value))}
                        className="bg-zinc-950 border-zinc-800 font-mono"
                        data-testid="duration-input"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Emergency Factor (Optional)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      max="2.5"
                      placeholder="1.0 - 2.5"
                      value={project.parameters.emergency_factor || ''}
                      onChange={(e) => handleChange('parameters', 'emergency_factor', e.target.value ? parseFloat(e.target.value) : null)}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                      data-testid="emergency-factor-input"
                    />
                    <p className="text-xs text-zinc-500">Leave empty for no emergency rating calculation</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-3">Calculation Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-zinc-500">Project:</span>
                      <span className="block text-zinc-200 font-mono">{project.name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Cables:</span>
                      <span className="block text-zinc-200 font-mono">{selectedCables.length}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Method:</span>
                      <span className="block text-zinc-200 font-mono">
                        {project.parameters.method === 'neher_mcgrath' ? 'Neher-McGrath' : 'IEC 60853'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Type:</span>
                      <span className="block text-zinc-200 font-mono">
                        {project.parameters.calculation_type === 'steady_state' ? 'Steady State' : 'Transient'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="border-zinc-700 text-zinc-300 hover:border-cyan-500"
            data-testid="prev-step-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono"
              data-testid="next-step-btn"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={runCalculation}
              disabled={calculating || selectedCables.length === 0}
              className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
              data-testid="run-calculation-btn"
            >
              {calculating ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                  Calculating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Calculation
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Sidebar>
  );
};

export default CalculationWizard;
