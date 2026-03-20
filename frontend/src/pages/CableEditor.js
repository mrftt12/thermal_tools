import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, ArrowLeft, Trash2 } from "lucide-react";
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

const defaultCable = {
  designation: "",
  manufacturer: "",
  voltage_rating_kv: 12,
  num_conductors: 1,
  cable_type: "single-core",
  conductor: {
    material: "copper",
    size_mm2: 240,
    construction: "stranded",
    dc_resistance_20c: 0.0754,
    ac_resistance_factor: 1.02,
    temperature_coefficient: 0.00393
  },
  insulation: {
    material: "XLPE",
    thickness_mm: 5.5,
    dielectric_constant: 2.5,
    dielectric_loss_factor: 0.0005,
    max_operating_temp: 90,
    emergency_temp: 130,
    thermal_resistivity: 3.5
  },
  sheath: {
    material: "copper",
    thickness_mm: 0.5,
    grounding: "single-point"
  },
  armor: {
    armor_type: null,
    material: null,
    thickness_mm: null
  },
  jacket: {
    material: "PVC",
    thickness_mm: 3.0,
    uv_resistant: false,
    temp_rating: 70,
    thermal_resistivity: 5.0
  },
  dimensions: {
    overall_diameter_mm: 50,
    weight_kg_per_m: 3.5,
    min_bending_radius_mm: 500
  },
  thermal: {
    thermal_resistance_insulation: 0.5,
    thermal_resistance_jacket: 0.2,
    thermal_capacitance: 400
  }
};

const CableEditor = () => {
  const navigate = useNavigate();
  const { cableId } = useParams();
  const isEditing = !!cableId;

  const [cable, setCable] = useState(defaultCable);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      fetchCable();
    }
  }, [cableId]);

  const fetchCable = async () => {
    try {
      const response = await axios.get(`${API}/cables/${cableId}`, { withCredentials: true });
      setCable(response.data);
    } catch (error) {
      toast.error("Failed to load cable");
      navigate('/cables');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (section, field, value) => {
    if (section) {
      setCable(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setCable(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!cable.designation || !cable.manufacturer) {
      toast.error("Please fill in required fields");
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await axios.put(`${API}/cables/${cableId}`, cable, { withCredentials: true });
        toast.success("Cable updated successfully");
      } else {
        await axios.post(`${API}/cables`, cable, { withCredentials: true });
        toast.success("Cable created successfully");
      }
      navigate('/cables');
    } catch (error) {
      toast.error(isEditing ? "Failed to update cable" : "Failed to create cable");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/cables/${cableId}`, { withCredentials: true });
      toast.success("Cable deleted");
      navigate('/cables');
    } catch (error) {
      toast.error("Failed to delete cable");
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

  return (
    <Sidebar>
      <form onSubmit={handleSubmit} className="space-y-6" data-testid="cable-editor">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/cables')}
              className="text-zinc-400 hover:text-cyan-400"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isEditing ? 'Edit Cable' : 'New Cable'}
              </h1>
              <p className="text-sm text-zinc-500">
                {isEditing ? cable.designation : 'Add a new cable to the library'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    data-testid="delete-cable-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Delete Cable?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This action cannot be undone. This will permanently delete the cable from the library.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-zinc-800 text-zinc-300 border-zinc-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="bg-red-500 text-white hover:bg-red-600"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="submit"
              disabled={saving}
              className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
              data-testid="save-cable-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Cable'}
            </Button>
          </div>
        </div>

        {/* Form Tabs */}
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="basic" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="conductor" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
              Conductor
            </TabsTrigger>
            <TabsTrigger value="insulation" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
              Insulation
            </TabsTrigger>
            <TabsTrigger value="sheath" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
              Sheath & Armor
            </TabsTrigger>
            <TabsTrigger value="thermal" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
              Thermal
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Designation *</Label>
                  <Input
                    value={cable.designation}
                    onChange={(e) => handleChange(null, 'designation', e.target.value)}
                    placeholder="e.g., N2XS(F)2Y 1x240/25"
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    required
                    data-testid="cable-designation-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Manufacturer *</Label>
                  <Input
                    value={cable.manufacturer}
                    onChange={(e) => handleChange(null, 'manufacturer', e.target.value)}
                    placeholder="e.g., Nexans, Prysmian"
                    className="bg-zinc-950 border-zinc-800"
                    required
                    data-testid="cable-manufacturer-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Voltage Rating (kV)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cable.voltage_rating_kv}
                    onChange={(e) => handleChange(null, 'voltage_rating_kv', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="cable-voltage-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Number of Conductors</Label>
                  <Select 
                    value={String(cable.num_conductors)} 
                    onValueChange={(v) => handleChange(null, 'num_conductors', parseInt(v))}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="cable-conductors-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Cable Type</Label>
                  <Select 
                    value={cable.cable_type} 
                    onValueChange={(v) => handleChange(null, 'cable_type', v)}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="cable-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="single-core">Single-core</SelectItem>
                      <SelectItem value="three-core">Three-core</SelectItem>
                      <SelectItem value="multi-core">Multi-core</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Overall Diameter (mm)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cable.dimensions?.overall_diameter_mm || 50}
                    onChange={(e) => handleChange('dimensions', 'overall_diameter_mm', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="cable-diameter-input"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conductor Tab */}
          <TabsContent value="conductor">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Conductor Properties</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Material</Label>
                  <Select 
                    value={cable.conductor?.material} 
                    onValueChange={(v) => handleChange('conductor', 'material', v)}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="conductor-material-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="copper">Copper</SelectItem>
                      <SelectItem value="aluminum">Aluminum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Size (mm²)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cable.conductor?.size_mm2 || 240}
                    onChange={(e) => handleChange('conductor', 'size_mm2', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="conductor-size-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Construction</Label>
                  <Select 
                    value={cable.conductor?.construction} 
                    onValueChange={(v) => handleChange('conductor', 'construction', v)}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="conductor-construction-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="stranded">Stranded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">DC Resistance at 20°C (Ω/km)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={cable.conductor?.dc_resistance_20c || 0.0754}
                    onChange={(e) => handleChange('conductor', 'dc_resistance_20c', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="conductor-resistance-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">AC Resistance Factor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cable.conductor?.ac_resistance_factor || 1.02}
                    onChange={(e) => handleChange('conductor', 'ac_resistance_factor', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="conductor-ac-factor-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Temperature Coefficient</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    value={cable.conductor?.temperature_coefficient || 0.00393}
                    onChange={(e) => handleChange('conductor', 'temperature_coefficient', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="conductor-temp-coeff-input"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Insulation Tab */}
          <TabsContent value="insulation">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Insulation Properties</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Material</Label>
                  <Select 
                    value={cable.insulation?.material} 
                    onValueChange={(v) => handleChange('insulation', 'material', v)}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="insulation-material-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="XLPE">XLPE</SelectItem>
                      <SelectItem value="EPR">EPR</SelectItem>
                      <SelectItem value="PVC">PVC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Thickness (mm)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cable.insulation?.thickness_mm || 5.5}
                    onChange={(e) => handleChange('insulation', 'thickness_mm', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="insulation-thickness-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Max Operating Temperature (°C)</Label>
                  <Input
                    type="number"
                    value={cable.insulation?.max_operating_temp || 90}
                    onChange={(e) => handleChange('insulation', 'max_operating_temp', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="insulation-max-temp-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Emergency Temperature (°C)</Label>
                  <Input
                    type="number"
                    value={cable.insulation?.emergency_temp || 130}
                    onChange={(e) => handleChange('insulation', 'emergency_temp', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="insulation-emergency-temp-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Thermal Resistivity (K.m/W)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cable.insulation?.thermal_resistivity || 3.5}
                    onChange={(e) => handleChange('insulation', 'thermal_resistivity', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="insulation-thermal-resistivity-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Dielectric Constant</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cable.insulation?.dielectric_constant || 2.5}
                    onChange={(e) => handleChange('insulation', 'dielectric_constant', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="insulation-dielectric-input"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sheath & Armor Tab */}
          <TabsContent value="sheath">
            <div className="space-y-6">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Sheath Properties</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Material</Label>
                    <Select 
                      value={cable.sheath?.material} 
                      onValueChange={(v) => handleChange('sheath', 'material', v)}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="sheath-material-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="copper">Copper</SelectItem>
                        <SelectItem value="aluminum">Aluminum</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Thickness (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={cable.sheath?.thickness_mm || 0.5}
                      onChange={(e) => handleChange('sheath', 'thickness_mm', parseFloat(e.target.value))}
                      className="bg-zinc-950 border-zinc-800 font-mono"
                      data-testid="sheath-thickness-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Grounding</Label>
                    <Select 
                      value={cable.sheath?.grounding} 
                      onValueChange={(v) => handleChange('sheath', 'grounding', v)}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="sheath-grounding-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="single-point">Single-point</SelectItem>
                        <SelectItem value="both-ends">Both-ends</SelectItem>
                        <SelectItem value="cross-bonded">Cross-bonded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Armor Properties (Optional)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Armor Type</Label>
                    <Select 
                      value={cable.armor?.armor_type || "none"} 
                      onValueChange={(v) => handleChange('armor', 'armor_type', v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="armor-type-select">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="steel-wire">Steel Wire</SelectItem>
                        <SelectItem value="steel-tape">Steel Tape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {cable.armor?.armor_type && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-zinc-400">Material</Label>
                        <Input
                          value={cable.armor?.material || ''}
                          onChange={(e) => handleChange('armor', 'material', e.target.value)}
                          placeholder="e.g., galvanized-steel"
                          className="bg-zinc-950 border-zinc-800"
                          data-testid="armor-material-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-400">Thickness (mm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={cable.armor?.thickness_mm || ''}
                          onChange={(e) => handleChange('armor', 'thickness_mm', parseFloat(e.target.value))}
                          className="bg-zinc-950 border-zinc-800 font-mono"
                          data-testid="armor-thickness-input"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Thermal Tab */}
          <TabsContent value="thermal">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Thermal Properties</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Thermal Resistance - Insulation (K.m/W)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cable.thermal?.thermal_resistance_insulation || 0.5}
                    onChange={(e) => handleChange('thermal', 'thermal_resistance_insulation', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="thermal-resistance-insulation-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Thermal Resistance - Jacket (K.m/W)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cable.thermal?.thermal_resistance_jacket || 0.2}
                    onChange={(e) => handleChange('thermal', 'thermal_resistance_jacket', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="thermal-resistance-jacket-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Thermal Capacitance (J/(K.m))</Label>
                  <Input
                    type="number"
                    step="1"
                    value={cable.thermal?.thermal_capacitance || 400}
                    onChange={(e) => handleChange('thermal', 'thermal_capacitance', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="thermal-capacitance-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Weight (kg/m)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cable.dimensions?.weight_kg_per_m || 3.5}
                    onChange={(e) => handleChange('dimensions', 'weight_kg_per_m', parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 font-mono"
                    data-testid="cable-weight-input"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </Sidebar>
  );
};

export default CableEditor;
