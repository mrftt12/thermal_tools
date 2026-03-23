import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  Trash2,
  Zap,
  TrendingUp,
  DollarSign,
  ClipboardList
} from "lucide-react";

const cableSteps = [
  { id: 1, name: "Project Setup", icon: <Settings className="w-4 h-4" /> },
  { id: 2, name: "Installation", icon: <Cable className="w-4 h-4" /> },
  { id: 3, name: "Cables", icon: <Cable className="w-4 h-4" /> },
  { id: 4, name: "Calculate", icon: <Thermometer className="w-4 h-4" /> },
];

const transformerSteps = [
  { id: 1, name: "Transformer Setup", icon: <Settings className="w-4 h-4" /> },
  { id: 2, name: "EV Profile", icon: <Zap className="w-4 h-4" /> },
  { id: 3, name: "Environment", icon: <Thermometer className="w-4 h-4" /> },
  { id: 4, name: "Risk & Economics", icon: <DollarSign className="w-4 h-4" /> },
  { id: 5, name: "Review & Run", icon: <ClipboardList className="w-4 h-4" /> },
];

const getDuctbankSlotPosition = (index, installation) => {
  const cols = Math.max(Number(installation?.num_cols) || 1, 1);
  const spacingM = (Number(installation?.duct_spacing_mm) || 200) / 1000;
  const burialDepth = Number(installation?.burial_depth_m) || 1;
  const col = index % cols;
  const row = Math.floor(index / cols);

  return {
    position_x: Number((col * spacingM).toFixed(3)),
    position_y: Number((burialDepth + row * spacingM).toFixed(3)),
  };
};

const normalizeCablePosition = (position, fallbackDepth = 1, index = 0) => ({
  cable_id: position?.cable_id || "",
  position_x: Number(position?.position_x ?? index * 0.3),
  position_y: Number(position?.position_y ?? fallbackDepth),
  current_load_a: Number(position?.current_load_a ?? 0),
  load_factor: Number(position?.load_factor ?? 1),
  phase: position?.phase || "A",
});

const getMethodLabel = (method) => {
  if (method === "neher_mcgrath") return "Neher-McGrath";
  if (method === "iec_60853") return "IEC 60853";
  if (method === "c57_91_2011") return "C57.91-2011 (Transformer Thermal Analysis)";
  return method || "Unknown";
};

const defaultTransformerSettings = {
  // Core thermal params
  rated_power_mva: 50,
  top_oil_rise_rated: 55,
  hot_spot_rise_rated: 65,
  oil_time_constant_min: 90,
  winding_time_constant_min: 7,
  normal_hot_spot_limit_c: 110,
  emergency_hot_spot_limit_c: 140,
  ambient_daily_swing_c: 4,
  // Loss parameters
  no_load_loss_kw: 35,
  load_loss_rated_kw: 235,
  // Cooling stages
  num_cooling_stages: 2,
  fan_trigger_temp_1: 65,
  fan_trigger_temp_2: 75,
  fan_capacity_1: 1.3,
  fan_capacity_2: 1.6,
  // EV charging profile
  ev_num_chargers_l2: 100,
  ev_num_chargers_dcfc: 10,
  ev_power_l2_kw: 11,
  ev_power_dcfc_kw: 150,
  ev_coincidence_l2: 0.25,
  ev_coincidence_dcfc: 0.6,
  ev_weekday_peak_start: 18,
  ev_weekday_peak_end: 22,
  ev_weekend_peak_start: 11,
  ev_weekend_peak_end: 16,
  ev_seasonal_factor: 1.0,
  // Base load
  base_load_mw: 30,
  // Risk assessment
  num_simulations: 500,
  implementation_cost: 250000,
  deferred_investment: 2000000,
  // Analysis horizon
  analysis_horizon_hours: 168,
};

const CalculationWizard = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
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
      transformer_settings: { ...defaultTransformerSettings },
    },
  });

  const isDuctbank = project.installation.installation_type === "ductbank";
  const isTransformerMethod = project.parameters.method === "c57_91_2011";
  const ductRows = Number(project.installation.num_rows) || 1;
  const ductCols = Number(project.installation.num_cols) || 1;
  const ductSpacingMm = Number(project.installation.duct_spacing_mm) || 200;
  const burialDepthM = Number(project.installation.burial_depth_m) || 1;
  const assignedCableCount = selectedCables.filter(pos => pos.cable_id).length;

  const steps = isTransformerMethod ? transformerSteps : cableSteps;
  const totalSteps = steps.length;

  useEffect(() => {
    fetchCables();
    if (isEditing) {
      fetchProject();
    }
  }, [projectId]);

  useEffect(() => {
    const method = searchParams.get('method');
    if (method === 'c57_91_2011' && !isEditing) {
      handleMethodChange('c57_91_2011');
    }
  }, []);

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
      setSelectedCables((response.data.cables || []).map((pos, index) => (
        normalizeCablePosition(pos, response.data.installation?.burial_depth_m, index)
      )));
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

  const handleMethodChange = (method) => {
    setProject(prev => {
      const nextInstallation = method === "c57_91_2011"
        ? prev.installation
        : {
            ...prev.installation,
            installation_type: "direct_burial",
          };

      return {
        ...prev,
        installation: nextInstallation,
        parameters: {
          ...prev.parameters,
          method,
          transformer_settings: {
            ...defaultTransformerSettings,
            ...(prev.parameters?.transformer_settings || {}),
          },
        },
      };
    });
  };

  const updateTransformerSetting = (field, value) => {
    setProject(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        transformer_settings: {
          ...defaultTransformerSettings,
          ...(prev.parameters?.transformer_settings || {}),
          [field]: value,
        },
      },
    }));
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
      load_factor: 1,
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

  useEffect(() => {
    if (!isDuctbank) {
      return;
    }

    const totalSlots = Math.max(
      1,
      ductRows * ductCols
    );

    setSelectedCables(prev => {
      const next = Array.from({ length: totalSlots }, (_, index) => {
        const existing = prev[index] || {};
        const slotPos = getDuctbankSlotPosition(index, {
          num_cols: ductCols,
          duct_spacing_mm: ductSpacingMm,
          burial_depth_m: burialDepthM,
        });

        return {
          cable_id: existing.cable_id || "",
          current_load_a: Number(existing.current_load_a ?? 0),
          load_factor: Number(existing.load_factor ?? 1),
          phase: existing.phase || "A",
          position_x: slotPos.position_x,
          position_y: slotPos.position_y,
        };
      });

      const hasChanged =
        prev.length !== next.length ||
        prev.some((item, i) => {
          const row = next[i];
          return !row ||
            item.cable_id !== row.cable_id ||
            item.current_load_a !== row.current_load_a ||
            Number(item.load_factor ?? 1) !== row.load_factor ||
            item.phase !== row.phase ||
            Number(item.position_x) !== row.position_x ||
            Number(item.position_y) !== row.position_y;
        });

      return hasChanged ? next : prev;
    });
  }, [
    isDuctbank,
    ductRows,
    ductCols,
    ductSpacingMm,
    burialDepthM,
  ]);

  useEffect(() => {
    if (isDuctbank) {
      return;
    }

    setSelectedCables(prev => prev.filter(pos => pos.cable_id));
  }, [isDuctbank]);

  const removeCable = (index) => {
    setSelectedCables(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (currentStep === 1 && !project.name) {
      toast.error("Please enter a project name");
      return;
    }
    // Cable validation: step 3 for cable methods, step 1 for transformer (needs at least one channel)
    if (!isTransformerMethod && currentStep === 3 && assignedCableCount === 0) {
      toast.error("Please assign at least one cable");
      return;
    }
    if (isTransformerMethod && currentStep === 1 && assignedCableCount === 0) {
      toast.error("Please assign at least one load channel");
      return;
    }
    if (currentStep < totalSteps) {
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
      cables: selectedCables
        .filter(pos => pos.cable_id)
        .map((pos, index) => normalizeCablePosition(pos, project.installation.burial_depth_m, index)),
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
    if (assignedCableCount === 0) {
      toast.error("Please assign at least one cable");
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

  const getDuctbankLabel = (index) => {
    const cols = Math.max(Number(project.installation.num_cols) || 1, 1);
    const row = Math.floor(index / cols) + 1;
    const col = (index % cols) + 1;
    return `R${row}-C${col}`;
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
            <p className="text-sm text-zinc-500">
              {isTransformerMethod ? "IEEE C57.91-2011 Dynamic Transformer Rating Analysis" : "Configure your underground cable thermal analysis"}
            </p>
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
                      onValueChange={handleMethodChange}
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

                  {isTransformerMethod && (
                    <div className="md:col-span-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-4">
                      <div>
                        <h3 className="text-cyan-300 font-medium">Transformer Thermal Inputs (IEEE C57.91-2011)</h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Configure the OFAF transformer thermal model parameters.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="text-zinc-400">Rated Power (MVA)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={project.parameters.transformer_settings?.rated_power_mva ?? defaultTransformerSettings.rated_power_mva}
                            onChange={(e) => updateTransformerSetting('rated_power_mva', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400">Top Oil Rise @ Rated (K)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={project.parameters.transformer_settings?.top_oil_rise_rated ?? defaultTransformerSettings.top_oil_rise_rated}
                            onChange={(e) => updateTransformerSetting('top_oil_rise_rated', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400">Hot Spot Rise @ Rated (K)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={project.parameters.transformer_settings?.hot_spot_rise_rated ?? defaultTransformerSettings.hot_spot_rise_rated}
                            onChange={(e) => updateTransformerSetting('hot_spot_rise_rated', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400">Oil Time Constant (min)</Label>
                          <Input
                            type="number"
                            step="1"
                            value={project.parameters.transformer_settings?.oil_time_constant_min ?? defaultTransformerSettings.oil_time_constant_min}
                            onChange={(e) => updateTransformerSetting('oil_time_constant_min', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400">Winding Time Constant (min)</Label>
                          <Input
                            type="number"
                            step="1"
                            value={project.parameters.transformer_settings?.winding_time_constant_min ?? defaultTransformerSettings.winding_time_constant_min}
                            onChange={(e) => updateTransformerSetting('winding_time_constant_min', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400">Normal Hot Spot Limit (°C)</Label>
                          <Input
                            type="number"
                            step="1"
                            value={project.parameters.transformer_settings?.normal_hot_spot_limit_c ?? defaultTransformerSettings.normal_hot_spot_limit_c}
                            onChange={(e) => updateTransformerSetting('normal_hot_spot_limit_c', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-zinc-400">Emergency Hot Spot Limit (°C)</Label>
                          <Input
                            type="number"
                            step="1"
                            value={project.parameters.transformer_settings?.emergency_hot_spot_limit_c ?? defaultTransformerSettings.emergency_hot_spot_limit_c}
                            onChange={(e) => updateTransformerSetting('emergency_hot_spot_limit_c', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                          />
                        </div>
                      </div>

                      {/* Loss Parameters */}
                      <div className="pt-2">
                        <h4 className="text-sm text-cyan-400 font-medium mb-3">Loss Parameters</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label className="text-zinc-400">No-Load Loss (kW)</Label>
                            <Input
                              type="number"
                              step="1"
                              value={project.parameters.transformer_settings?.no_load_loss_kw ?? defaultTransformerSettings.no_load_loss_kw}
                              onChange={(e) => updateTransformerSetting('no_load_loss_kw', parseFloat(e.target.value) || 0)}
                              className="bg-zinc-950 border-zinc-800 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-zinc-400">Load Loss @ Rated (kW)</Label>
                            <Input
                              type="number"
                              step="1"
                              value={project.parameters.transformer_settings?.load_loss_rated_kw ?? defaultTransformerSettings.load_loss_rated_kw}
                              onChange={(e) => updateTransformerSetting('load_loss_rated_kw', parseFloat(e.target.value) || 0)}
                              className="bg-zinc-950 border-zinc-800 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cooling Stages */}
                      <div className="pt-2">
                        <h4 className="text-sm text-cyan-400 font-medium mb-3">Cooling Stages (OFAF)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 rounded border border-zinc-700 bg-zinc-800/40 space-y-3">
                            <span className="text-xs text-zinc-400 uppercase tracking-wide">Stage 1 Fans</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-zinc-400 text-xs">Trigger Temp (°C)</Label>
                                <Input
                                  type="number"
                                  step="1"
                                  value={project.parameters.transformer_settings?.fan_trigger_temp_1 ?? defaultTransformerSettings.fan_trigger_temp_1}
                                  onChange={(e) => updateTransformerSetting('fan_trigger_temp_1', parseFloat(e.target.value) || 0)}
                                  className="bg-zinc-950 border-zinc-800 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-zinc-400 text-xs">Capacity Factor</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={project.parameters.transformer_settings?.fan_capacity_1 ?? defaultTransformerSettings.fan_capacity_1}
                                  onChange={(e) => updateTransformerSetting('fan_capacity_1', parseFloat(e.target.value) || 0)}
                                  className="bg-zinc-950 border-zinc-800 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="p-3 rounded border border-zinc-700 bg-zinc-800/40 space-y-3">
                            <span className="text-xs text-zinc-400 uppercase tracking-wide">Stage 2 Fans (Full)</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-zinc-400 text-xs">Trigger Temp (°C)</Label>
                                <Input
                                  type="number"
                                  step="1"
                                  value={project.parameters.transformer_settings?.fan_trigger_temp_2 ?? defaultTransformerSettings.fan_trigger_temp_2}
                                  onChange={(e) => updateTransformerSetting('fan_trigger_temp_2', parseFloat(e.target.value) || 0)}
                                  className="bg-zinc-950 border-zinc-800 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-zinc-400 text-xs">Capacity Factor</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={project.parameters.transformer_settings?.fan_capacity_2 ?? defaultTransformerSettings.fan_capacity_2}
                                  onChange={(e) => updateTransformerSetting('fan_capacity_2', parseFloat(e.target.value) || 0)}
                                  className="bg-zinc-950 border-zinc-800 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Load Channels */}
                      <div className="pt-2">
                        <h4 className="text-sm text-cyan-400 font-medium mb-3">Load Channels</h4>
                        <div className="flex gap-4 mb-3">
                          <Select onValueChange={addCable}>
                            <SelectTrigger className="flex-1 bg-zinc-950 border-zinc-800">
                              <SelectValue placeholder="Select feeder/load channel..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 max-h-64">
                              {cables.map((cable) => (
                                <SelectItem key={cable.cable_id} value={cable.cable_id}>
                                  {cable.designation} - {cable.voltage_rating_kv}kV ({cable.conductor?.material})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedCables.length > 0 ? (
                          <div className="space-y-2">
                            {selectedCables.map((pos, index) => (
                              <div key={index} className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded border border-zinc-700">
                                <span className="text-sm text-zinc-300 font-mono flex-1 truncate">{getCableName(pos.cable_id)}</span>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-zinc-500">Load (A)</Label>
                                  <Input
                                    type="number"
                                    value={pos.current_load_a}
                                    onChange={(e) => updateCablePosition(index, 'current_load_a', parseFloat(e.target.value) || 0)}
                                    className="w-20 h-8 bg-zinc-950 border-zinc-800 font-mono text-sm"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-zinc-500">LF</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={pos.load_factor ?? 1}
                                    onChange={(e) => updateCablePosition(index, 'load_factor', parseFloat(e.target.value) || 0)}
                                    className="w-16 h-8 bg-zinc-950 border-zinc-800 font-mono text-sm"
                                  />
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeCable(index)} className="text-zinc-400 hover:text-red-400 h-8 w-8">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-500 text-center py-4">No load channels added. Select from the library above.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Installation (cable methods) */}
            {currentStep === 2 && !isTransformerMethod && (
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

            {/* Step 2: EV Charging Profile (transformer method) */}
            {currentStep === 2 && isTransformerMethod && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">EV Charging Profile</CardTitle>
                  <p className="text-sm text-zinc-400 mt-1">Configure the EV charging demand pattern for load forecasting.</p>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Level 2 Chargers */}
                  <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/40 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-emerald-400" />
                      </div>
                      <h4 className="text-sm font-medium text-white">Level 2 Chargers</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-zinc-400 text-xs">Number of Chargers</Label>
                        <Input
                          type="number"
                          value={project.parameters.transformer_settings?.ev_num_chargers_l2 ?? defaultTransformerSettings.ev_num_chargers_l2}
                          onChange={(e) => updateTransformerSetting('ev_num_chargers_l2', parseInt(e.target.value) || 0)}
                          className="bg-zinc-950 border-zinc-800 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-zinc-400 text-xs">Power per Charger (kW)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={project.parameters.transformer_settings?.ev_power_l2_kw ?? defaultTransformerSettings.ev_power_l2_kw}
                          onChange={(e) => updateTransformerSetting('ev_power_l2_kw', parseFloat(e.target.value) || 0)}
                          className="bg-zinc-950 border-zinc-800 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-zinc-400 text-xs">Coincidence Factor</Label>
                        <div className="flex items-center gap-3">
                          <Slider
                            value={[project.parameters.transformer_settings?.ev_coincidence_l2 ?? defaultTransformerSettings.ev_coincidence_l2]}
                            onValueChange={([v]) => updateTransformerSetting('ev_coincidence_l2', v)}
                            min={0}
                            max={1}
                            step={0.05}
                            className="flex-1"
                          />
                          <span className="text-cyan-400 font-mono text-sm w-12">
                            {(project.parameters.transformer_settings?.ev_coincidence_l2 ?? defaultTransformerSettings.ev_coincidence_l2).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DC Fast Chargers */}
                  <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/40 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-amber-400" />
                      </div>
                      <h4 className="text-sm font-medium text-white">DC Fast Chargers</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-zinc-400 text-xs">Number of Chargers</Label>
                        <Input
                          type="number"
                          value={project.parameters.transformer_settings?.ev_num_chargers_dcfc ?? defaultTransformerSettings.ev_num_chargers_dcfc}
                          onChange={(e) => updateTransformerSetting('ev_num_chargers_dcfc', parseInt(e.target.value) || 0)}
                          className="bg-zinc-950 border-zinc-800 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-zinc-400 text-xs">Power per Charger (kW)</Label>
                        <Input
                          type="number"
                          step="1"
                          value={project.parameters.transformer_settings?.ev_power_dcfc_kw ?? defaultTransformerSettings.ev_power_dcfc_kw}
                          onChange={(e) => updateTransformerSetting('ev_power_dcfc_kw', parseFloat(e.target.value) || 0)}
                          className="bg-zinc-950 border-zinc-800 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-zinc-400 text-xs">Coincidence Factor</Label>
                        <div className="flex items-center gap-3">
                          <Slider
                            value={[project.parameters.transformer_settings?.ev_coincidence_dcfc ?? defaultTransformerSettings.ev_coincidence_dcfc]}
                            onValueChange={([v]) => updateTransformerSetting('ev_coincidence_dcfc', v)}
                            min={0}
                            max={1}
                            step={0.05}
                            className="flex-1"
                          />
                          <span className="text-cyan-400 font-mono text-sm w-12">
                            {(project.parameters.transformer_settings?.ev_coincidence_dcfc ?? defaultTransformerSettings.ev_coincidence_dcfc).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Peak Hours and Base Load */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Weekday Peak Hours</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(project.parameters.transformer_settings?.ev_weekday_peak_start ?? defaultTransformerSettings.ev_weekday_peak_start)}
                        onValueChange={(v) => updateTransformerSetting('ev_weekday_peak_start', parseInt(v))}
                      >
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 max-h-48">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-zinc-500">to</span>
                      <Select
                        value={String(project.parameters.transformer_settings?.ev_weekday_peak_end ?? defaultTransformerSettings.ev_weekday_peak_end)}
                        onValueChange={(v) => updateTransformerSetting('ev_weekday_peak_end', parseInt(v))}
                      >
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 max-h-48">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Weekend Peak Hours</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(project.parameters.transformer_settings?.ev_weekend_peak_start ?? defaultTransformerSettings.ev_weekend_peak_start)}
                        onValueChange={(v) => updateTransformerSetting('ev_weekend_peak_start', parseInt(v))}
                      >
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 max-h-48">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-zinc-500">to</span>
                      <Select
                        value={String(project.parameters.transformer_settings?.ev_weekend_peak_end ?? defaultTransformerSettings.ev_weekend_peak_end)}
                        onValueChange={(v) => updateTransformerSetting('ev_weekend_peak_end', parseInt(v))}
                      >
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 max-h-48">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Base Load (MW)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={project.parameters.transformer_settings?.base_load_mw ?? defaultTransformerSettings.base_load_mw}
                      onChange={(e) => updateTransformerSetting('base_load_mw', parseFloat(e.target.value) || 0)}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Environment (transformer method) */}
            {currentStep === 3 && isTransformerMethod && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">Environmental Conditions</CardTitle>
                  <p className="text-sm text-zinc-400 mt-1">Ambient conditions and analysis duration.</p>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      />
                      <span className="text-cyan-400 font-mono w-12">
                        {project.installation.ambient_temp_c}°C
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Ambient Daily Swing (°C)</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[project.parameters.transformer_settings?.ambient_daily_swing_c ?? defaultTransformerSettings.ambient_daily_swing_c]}
                        onValueChange={([v]) => updateTransformerSetting('ambient_daily_swing_c', v)}
                        min={0}
                        max={20}
                        step={0.5}
                        className="flex-1"
                      />
                      <span className="text-cyan-400 font-mono w-12">
                        {(project.parameters.transformer_settings?.ambient_daily_swing_c ?? defaultTransformerSettings.ambient_daily_swing_c)}°C
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Seasonal Factor</Label>
                    <Select
                      value={String(project.parameters.transformer_settings?.ev_seasonal_factor ?? defaultTransformerSettings.ev_seasonal_factor)}
                      onValueChange={(v) => updateTransformerSetting('ev_seasonal_factor', parseFloat(v))}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="1">Summer (1.0x)</SelectItem>
                        <SelectItem value="1.2">Winter (1.2x)</SelectItem>
                        <SelectItem value="1.1">Spring/Fall (1.1x)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Analysis Horizon</Label>
                    <Select
                      value={String(project.parameters.transformer_settings?.analysis_horizon_hours ?? defaultTransformerSettings.analysis_horizon_hours)}
                      onValueChange={(v) => updateTransformerSetting('analysis_horizon_hours', parseInt(v))}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="24">24 Hours (1 Day)</SelectItem>
                        <SelectItem value="72">72 Hours (3 Days)</SelectItem>
                        <SelectItem value="168">168 Hours (1 Week)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Risk & Economics (transformer method) */}
            {currentStep === 4 && isTransformerMethod && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">Risk Assessment & Economics</CardTitle>
                  <p className="text-sm text-zinc-400 mt-1">Configure Monte Carlo simulation and economic analysis parameters.</p>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Monte Carlo Simulations</Label>
                    <Select
                      value={String(project.parameters.transformer_settings?.num_simulations ?? defaultTransformerSettings.num_simulations)}
                      onValueChange={(v) => updateTransformerSetting('num_simulations', parseInt(v))}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="100">100 (Fast, ~5s)</SelectItem>
                        <SelectItem value="250">250 (Moderate, ~10s)</SelectItem>
                        <SelectItem value="500">500 (Standard, ~20s)</SelectItem>
                        <SelectItem value="1000">1000 (High Accuracy, ~40s)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-zinc-500">Higher counts improve statistical accuracy but increase computation time.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Energy Cost ($/kWh)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={project.parameters.transformer_settings?.energy_cost_per_kwh ?? 0.08}
                      onChange={(e) => updateTransformerSetting('energy_cost_per_kwh', parseFloat(e.target.value) || 0)}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">DTR Implementation Cost ($)</Label>
                    <Input
                      type="number"
                      step="10000"
                      value={project.parameters.transformer_settings?.implementation_cost ?? defaultTransformerSettings.implementation_cost}
                      onChange={(e) => updateTransformerSetting('implementation_cost', parseFloat(e.target.value) || 0)}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                    />
                    <p className="text-xs text-zinc-500">Sensors, software, and installation costs.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-400">Deferred Capital Investment ($)</Label>
                    <Input
                      type="number"
                      step="100000"
                      value={project.parameters.transformer_settings?.deferred_investment ?? defaultTransformerSettings.deferred_investment}
                      onChange={(e) => updateTransformerSetting('deferred_investment', parseFloat(e.target.value) || 0)}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                    />
                    <p className="text-xs text-zinc-500">Value of substation upgrade deferred by DTR implementation.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review & Run (transformer method) */}
            {currentStep === 5 && isTransformerMethod && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">Review & Run Analysis</CardTitle>
                </CardHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/40 space-y-2">
                    <h4 className="text-sm text-cyan-400 font-medium">Transformer</h4>
                    <div className="text-sm space-y-1 text-zinc-300">
                      <div className="flex justify-between"><span className="text-zinc-500">Rated Power</span><span className="font-mono">{project.parameters.transformer_settings?.rated_power_mva ?? 50} MVA</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Normal Limit</span><span className="font-mono">{project.parameters.transformer_settings?.normal_hot_spot_limit_c ?? 110}°C</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Emergency Limit</span><span className="font-mono">{project.parameters.transformer_settings?.emergency_hot_spot_limit_c ?? 140}°C</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">No-Load Loss</span><span className="font-mono">{project.parameters.transformer_settings?.no_load_loss_kw ?? 35} kW</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Load Loss</span><span className="font-mono">{project.parameters.transformer_settings?.load_loss_rated_kw ?? 235} kW</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/40 space-y-2">
                    <h4 className="text-sm text-cyan-400 font-medium">EV Charging</h4>
                    <div className="text-sm space-y-1 text-zinc-300">
                      <div className="flex justify-between"><span className="text-zinc-500">L2 Chargers</span><span className="font-mono">{project.parameters.transformer_settings?.ev_num_chargers_l2 ?? 100} x {project.parameters.transformer_settings?.ev_power_l2_kw ?? 11} kW</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">DCFC Chargers</span><span className="font-mono">{project.parameters.transformer_settings?.ev_num_chargers_dcfc ?? 10} x {project.parameters.transformer_settings?.ev_power_dcfc_kw ?? 150} kW</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">L2 Coincidence</span><span className="font-mono">{(project.parameters.transformer_settings?.ev_coincidence_l2 ?? 0.25).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">DCFC Coincidence</span><span className="font-mono">{(project.parameters.transformer_settings?.ev_coincidence_dcfc ?? 0.6).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Base Load</span><span className="font-mono">{project.parameters.transformer_settings?.base_load_mw ?? 30} MW</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/40 space-y-2">
                    <h4 className="text-sm text-cyan-400 font-medium">Environment</h4>
                    <div className="text-sm space-y-1 text-zinc-300">
                      <div className="flex justify-between"><span className="text-zinc-500">Ambient Temp</span><span className="font-mono">{project.installation.ambient_temp_c}°C</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Daily Swing</span><span className="font-mono">±{project.parameters.transformer_settings?.ambient_daily_swing_c ?? 4}°C</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Analysis Horizon</span><span className="font-mono">{project.parameters.transformer_settings?.analysis_horizon_hours ?? 168}h</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/40 space-y-2">
                    <h4 className="text-sm text-cyan-400 font-medium">Risk & Economics</h4>
                    <div className="text-sm space-y-1 text-zinc-300">
                      <div className="flex justify-between"><span className="text-zinc-500">MC Simulations</span><span className="font-mono">{project.parameters.transformer_settings?.num_simulations ?? 500}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Implementation</span><span className="font-mono">${(project.parameters.transformer_settings?.implementation_cost ?? 250000).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Deferred Investment</span><span className="font-mono">${(project.parameters.transformer_settings?.deferred_investment ?? 2000000).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Load Channels</span><span className="font-mono">{assignedCableCount}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Cables (cable methods only) */}
            {currentStep === 3 && !isTransformerMethod && (
              <div className="space-y-6 animate-fade-in">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg text-white">
                    {isTransformerMethod ? "Transformer Load Channels" : "Cable Selection"}
                  </CardTitle>
                </CardHeader>

                {!isDuctbank && (
                  <>
                    {/* Add Cable */}
                    <div className="flex gap-4">
                      <Select onValueChange={addCable}>
                        <SelectTrigger className="flex-1 bg-zinc-950 border-zinc-800" data-testid="add-cable-select">
                          <SelectValue placeholder={isTransformerMethod ? "Select feeder/load channel..." : "Select a cable to add..."} />
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
                  </>
                )}

                {isDuctbank ? (
                  <div className="rounded-lg border border-zinc-700 overflow-hidden">
                    <div className="grid grid-cols-4 gap-3 px-4 py-3 bg-zinc-800/60 text-xs uppercase tracking-wide text-zinc-400 font-medium">
                      <div>Slot</div>
                      <div>Cable</div>
                      <div>Load (A)</div>
                      <div>Load Factor</div>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {selectedCables.map((row, index) => (
                        <div key={index} className="grid grid-cols-4 gap-3 px-4 py-3 items-center" data-testid={`ductbank-row-${index}`}>
                          <div className="text-sm text-zinc-300 font-mono">{getDuctbankLabel(index)}</div>
                          <Select
                            value={row.cable_id || undefined}
                            onValueChange={(v) => updateCablePosition(index, 'cable_id', v)}
                          >
                            <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid={`ductbank-cable-${index}`}>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 max-h-64">
                              {cables.map((cable) => (
                                <SelectItem key={cable.cable_id} value={cable.cable_id}>
                                  {cable.designation}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={row.current_load_a}
                            onChange={(e) => updateCablePosition(index, 'current_load_a', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                            data-testid={`ductbank-load-${index}`}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.load_factor ?? 1}
                            onChange={(e) => updateCablePosition(index, 'load_factor', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-950 border-zinc-800 font-mono"
                            data-testid={`ductbank-load-factor-${index}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedCables.length > 0 ? (
                  /* Selected Cables */
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
                              <Label className="text-xs text-zinc-500">Load Factor</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pos.load_factor ?? 1}
                                onChange={(e) => updateCablePosition(index, 'load_factor', parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 bg-zinc-950 border-zinc-800 font-mono text-sm"
                                data-testid={`cable-load-factor-${index}`}
                              />
                            </div>
                            {isTransformerMethod ? null : (
                              <>
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
                              </>
                            )}
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
                    <p>
                      {isTransformerMethod
                        ? "No load channels selected. Add channels from the library above."
                        : "No cables selected. Add cables from the library above."}
                    </p>
                  </div>
                )}

                {isDuctbank && (
                  <p className="text-xs text-zinc-500">
                    Ductbank slots are fixed by installation dimensions. Assign a cable, load, and load factor for each slot as needed.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Calculate (cable methods only) */}
            {currentStep === 4 && !isTransformerMethod && (
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

                  {!isTransformerMethod && (
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
                  )}

                  {isTransformerMethod && (
                    <div className="space-y-2">
                      <Label className="text-zinc-400">Thermal Standard</Label>
                      <div className="h-10 px-3 rounded-md border border-zinc-800 bg-zinc-950 flex items-center text-zinc-300 font-mono text-sm">
                        IEEE C57.91-2011 aging and hot-spot dynamics
                      </div>
                    </div>
                  )}

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
                      <span className="text-zinc-500">{isTransformerMethod ? 'Channels:' : 'Cables:'}</span>
                      <span className="block text-zinc-200 font-mono">{assignedCableCount}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Method:</span>
                      <span className="block text-zinc-200 font-mono">
                        {getMethodLabel(project.parameters.method)}
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

          {currentStep < totalSteps ? (
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
              disabled={calculating || assignedCableCount === 0}
              className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
              data-testid="run-calculation-btn"
            >
              {calculating ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                  {isTransformerMethod ? "Running DTR Analysis..." : "Calculating..."}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {isTransformerMethod ? "Run DTR Analysis" : "Run Calculation"}
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
