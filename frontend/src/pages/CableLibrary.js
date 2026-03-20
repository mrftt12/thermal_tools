import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Cable, 
  Zap,
  Filter,
  X,
  ExternalLink
} from "lucide-react";

const CableLibrary = () => {
  const navigate = useNavigate();
  const [cables, setCables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [voltageFilter, setVoltageFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCables();
  }, [search, voltageFilter, materialFilter]);

  const fetchCables = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (voltageFilter && voltageFilter !== "all") params.append("voltage", voltageFilter);
      if (materialFilter && materialFilter !== "all") params.append("material", materialFilter);

      const response = await axios.get(`${API}/cables?${params}`, { withCredentials: true });
      setCables(response.data);
    } catch (error) {
      console.error("Failed to fetch cables:", error);
      toast.error("Failed to load cables");
    } finally {
      setLoading(false);
    }
  };

  const seedCables = async () => {
    try {
      const response = await axios.post(`${API}/seed-cables`, {}, { withCredentials: true });
      toast.success(response.data.message);
      fetchCables();
    } catch (error) {
      toast.error("Failed to seed cables");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setVoltageFilter("");
    setMaterialFilter("");
  };

  const hasFilters = search || voltageFilter || materialFilter;

  const voltageOptions = ["0.6", "12", "15", "20", "33", "66", "110", "132"];

  const getVoltageColor = (voltage) => {
    if (voltage <= 1) return "text-emerald-400 bg-emerald-400/10";
    if (voltage <= 20) return "text-amber-400 bg-amber-400/10";
    if (voltage <= 66) return "text-orange-400 bg-orange-400/10";
    return "text-red-400 bg-red-400/10";
  };

  return (
    <Sidebar>
      <div className="space-y-6" data-testid="cable-library">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Cable Library</h1>
            <p className="text-sm text-zinc-500">
              {cables.length} cable{cables.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-400"
              data-testid="toggle-filters-btn"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button
              onClick={() => navigate('/cables/new')}
              className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
              data-testid="add-cable-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Cable
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search by designation or manufacturer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500"
                data-testid="cable-search-input"
              />
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono uppercase">Voltage:</span>
                  <Select value={voltageFilter} onValueChange={setVoltageFilter}>
                    <SelectTrigger className="w-32 bg-zinc-950 border-zinc-800 text-zinc-100" data-testid="voltage-filter">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="all">All</SelectItem>
                      {voltageOptions.map((v) => (
                        <SelectItem key={v} value={v}>{v} kV</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono uppercase">Material:</span>
                  <Select value={materialFilter} onValueChange={setMaterialFilter}>
                    <SelectTrigger className="w-32 bg-zinc-950 border-zinc-800 text-zinc-100" data-testid="material-filter">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="copper">Copper</SelectItem>
                      <SelectItem value="aluminum">Aluminum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-zinc-400 hover:text-cyan-400"
                    data-testid="clear-filters-btn"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cable Grid */}
        {loading ? (
          <div className="cable-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-zinc-900/60 border border-zinc-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : cables.length > 0 ? (
          <div className="cable-grid">
            {cables.map((cable) => (
              <div
                key={cable.cable_id}
                onClick={() => navigate(`/cables/${cable.cable_id}`)}
                className="cable-card group"
                data-testid={`cable-card-${cable.cable_id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-cyan-400 transition-colors">
                    <Cable className="w-5 h-5" />
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-mono ${getVoltageColor(cable.voltage_rating_kv)}`}>
                    {cable.voltage_rating_kv} kV
                  </span>
                </div>

                <h3 className="font-mono text-sm font-medium text-white mb-1 truncate">
                  {cable.designation}
                </h3>
                <p className="text-xs text-zinc-500 mb-3">{cable.manufacturer}</p>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Conductor</span>
                    <span className="text-zinc-300 font-mono">
                      {cable.conductor?.material} {cable.conductor?.size_mm2} mm²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Insulation</span>
                    <span className="text-zinc-300 font-mono">{cable.insulation?.material}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Max Temp</span>
                    <span className="text-zinc-300 font-mono">{cable.insulation?.max_operating_temp}°C</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {cable.num_conductors}×{cable.cable_type}
                  </span>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="py-12 text-center">
              <Zap className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Cables Found</h3>
              <p className="text-sm text-zinc-500 mb-6">
                {hasFilters 
                  ? "No cables match your current filters. Try adjusting your search."
                  : "Get started by loading sample cables or adding your own."}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {!hasFilters && (
                  <Button
                    onClick={seedCables}
                    className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono"
                    data-testid="seed-cables-btn"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Load Sample Cables
                  </Button>
                )}
                <Button
                  onClick={() => navigate('/cables/new')}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-400"
                  data-testid="add-custom-cable-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Cable
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Sidebar>
  );
};

export default CableLibrary;
