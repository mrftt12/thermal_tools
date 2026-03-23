import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as d3 from "d3";
import { jsPDF } from "jspdf";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  ArrowLeft,
  Download,
  Thermometer,
  Zap,
  AlertTriangle,
  Clock,
  TrendingUp,
  Heart,
  Shield,
  DollarSign,
  Activity,
  Radio
} from "lucide-react";

const getMethodLabel = (method) => {
  if (method === "neher_mcgrath") return "Neher-McGrath";
  if (method === "iec_60853") return "IEC 60853";
  if (method === "c57_91_2011") return "C57.91-2011";
  return method || "Unknown";
};

const Results = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [results, setResults] = useState(null);
  const [cables, setCables] = useState([]);
  const [loading, setLoading] = useState(true);

  const tempChartRef = useRef(null);
  const timeSeriesRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    if (results && !loading) {
      renderTempChart();
      if (results.time_series) {
        renderTimeSeriesChart();
      }
    }
  }, [results, loading]);

  const fetchData = async () => {
    try {
      const [projectRes, resultsRes, cablesRes] = await Promise.all([
        axios.get(`${API}/projects/${projectId}`, { withCredentials: true }),
        axios.get(`${API}/results/${projectId}`, { withCredentials: true }),
        axios.get(`${API}/cables`, { withCredentials: true })
      ]);

      setProject(projectRes.data);
      setResults(resultsRes.data[0]); // Get latest result
      setCables(cablesRes.data);
    } catch (error) {
      console.error("Failed to fetch results:", error);
      toast.error("Failed to load results");
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getCableName = (cableId) => {
    const cable = cables.find(c => c.cable_id === cableId);
    return cable ? cable.designation : cableId;
  };

  const getMaxTemp = (cableId) => {
    const cable = cables.find(c => c.cable_id === cableId);
    return cable?.insulation?.max_operating_temp || 90;
  };

  const getTempColor = (temp, maxTemp) => {
    const ratio = temp / maxTemp;
    if (ratio < 0.7) return "#06b6d4"; // cyan
    if (ratio < 0.9) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  const renderTempChart = () => {
    if (!tempChartRef.current || !results?.cable_temperatures) return;

    const container = tempChartRef.current;
    container.innerHTML = "";

    const data = results.cable_temperatures;
    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(data.map((d, i) => i))
      .range([0, width])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => Math.max(d.temperature_c, d.max_temperature_c)) * 1.1])
      .nice()
      .range([height, 0]);

    // Grid lines
    svg.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
      .selectAll("line")
      .attr("stroke", "#27272a")
      .attr("stroke-opacity", 0.5);

    // Max temp reference lines
    data.forEach((d, i) => {
      svg.append("line")
        .attr("x1", x(i))
        .attr("x2", x(i) + x.bandwidth())
        .attr("y1", y(d.max_temperature_c))
        .attr("y2", y(d.max_temperature_c))
        .attr("stroke", "#ef4444")
        .attr("stroke-dasharray", "4,4")
        .attr("stroke-width", 1);
    });

    // Bars
    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d, i) => x(i))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d.temperature_c))
      .attr("height", d => height - y(d.temperature_c))
      .attr("fill", d => getTempColor(d.temperature_c, d.max_temperature_c))
      .attr("rx", 4);

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat((d, i) => getCableName(data[i].cable_id).slice(0, 15)))
      .selectAll("text")
      .attr("fill", "#a1a1aa")
      .attr("font-family", "JetBrains Mono")
      .attr("font-size", "10px")
      .attr("transform", "rotate(-30)")
      .attr("text-anchor", "end");

    // Y axis
    svg.append("g")
      .call(d3.axisLeft(y).tickFormat(d => `${d}°C`))
      .selectAll("text")
      .attr("fill", "#a1a1aa")
      .attr("font-family", "JetBrains Mono")
      .attr("font-size", "10px");

    // Y axis label
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -40)
      .attr("x", -height / 2)
      .attr("fill", "#71717a")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .text("Temperature (°C)");
  };

  const renderTimeSeriesChart = () => {
    if (!timeSeriesRef.current || !results?.time_series) return;

    const container = timeSeriesRef.current;
    container.innerHTML = "";

    const data = results.time_series;
    const cableIds = Object.keys(data[0].temperatures);
    
    const margin = { top: 20, right: 100, bottom: 40, left: 50 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.time_hours)])
      .range([0, width]);

    const allTemps = data.flatMap(d => Object.values(d.temperatures));
    const y = d3.scaleLinear()
      .domain([d3.min(allTemps) - 5, d3.max(allTemps) + 5])
      .nice()
      .range([height, 0]);

    const colors = d3.scaleOrdinal(d3.schemeCategory10);

    // Grid
    svg.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
      .selectAll("line")
      .attr("stroke", "#27272a")
      .attr("stroke-opacity", 0.5);

    // Lines for each cable
    cableIds.forEach((cableId, i) => {
      const line = d3.line()
        .x(d => x(d.time_hours))
        .y(d => y(d.temperatures[cableId]))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", colors(i))
        .attr("stroke-width", 2)
        .attr("d", line);

      // Legend
      svg.append("text")
        .attr("x", width + 10)
        .attr("y", i * 20 + 10)
        .attr("fill", colors(i))
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", "10px")
        .text(getCableName(cableId).slice(0, 12));
    });

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `${d}h`))
      .selectAll("text")
      .attr("fill", "#a1a1aa")
      .attr("font-family", "JetBrains Mono")
      .attr("font-size", "10px");

    // Y axis
    svg.append("g")
      .call(d3.axisLeft(y).tickFormat(d => `${d}°C`))
      .selectAll("text")
      .attr("fill", "#a1a1aa")
      .attr("font-family", "JetBrains Mono")
      .attr("font-size", "10px");

    // Labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 35)
      .attr("fill", "#71717a")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .text("Time (hours)");
  };

  const isC57 = results?.calculation_method === "c57_91_2011";
  const dtr = results?.dtr_results;

  // Prepare Recharts data for C57 thermal tab
  const thermalChartData = dtr?.thermal?.time?.map((t, i) => ({
    hour: t,
    top_oil: parseFloat(dtr.thermal.top_oil[i]?.toFixed(1)),
    hot_spot: parseFloat(dtr.thermal.hot_spot[i]?.toFixed(1)),
    ambient: parseFloat(dtr.thermal.ambient[i]?.toFixed(1)),
  })) || [];

  // Prepare forecast chart data
  const forecastChartData = dtr?.forecast?.time_index?.map((t, i) => ({
    hour: t,
    day: dtr.forecast.days[i],
    base_load: parseFloat(dtr.forecast.base_load_mw[i]?.toFixed(2)),
    ev_load: parseFloat(dtr.forecast.ev_load_mw[i]?.toFixed(2)),
    total_load: parseFloat(dtr.forecast.total_load_mw[i]?.toFixed(2)),
  })) || [];

  // Prepare ratings chart data
  const ratingsChartData = dtr?.ratings?.time_index?.map((t, i) => ({
    hour: t,
    normal_rating: parseFloat(dtr.ratings.normal_rating_mva[i]?.toFixed(1)),
    emergency_rating: parseFloat(dtr.ratings.emergency_rating_mva[i]?.toFixed(1)),
    utilization: parseFloat(dtr.ratings.utilization_normal[i]?.toFixed(1)),
    load_mva: parseFloat((dtr.ratings.load_pu[i] * (results?.hotspot_info?.normal_rating_mva / (dtr.ratings.normal_rating_mva[i] || 1) * dtr.ratings.load_pu[i] || 1))?.toFixed(1)),
  })) || [];

  // Prepare cooling chart data
  const coolingChartData = dtr?.cooling?.cooling_schedule?.map((stage, i) => ({
    hour: i,
    stage,
    savings: parseFloat(dtr.cooling.hourly_savings[i]?.toFixed(4)),
  })) || [];

  const getHealthColor = (category) => {
    const colors = { Excellent: "#10b981", Good: "#06b6d4", Fair: "#f59e0b", Poor: "#f97316", Critical: "#ef4444" };
    return colors[category] || "#71717a";
  };

  const generateC57PDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.setTextColor(6, 182, 212);
    doc.text("DTR Transformer Analysis Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("IEEE C57.91-2011 Dynamic Transformer Rating", pageWidth / 2, 28, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Project: ${project?.name || "N/A"}`, 20, 40);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 47);

    let y = 60;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Thermal Analysis Summary", 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Peak Hot Spot: ${results?.hotspot_info?.temperature_c?.toFixed(1)}°C`, 20, y);
    doc.text(`Peak Top Oil: ${results?.hotspot_info?.top_oil_temp_c?.toFixed(1)}°C`, 20, y + 7);
    doc.text(`Loss of Life: ${dtr?.loss_of_life?.lol_percent?.toFixed(4)}%`, 20, y + 14);
    doc.text(`Aging Factor (FEQA): ${dtr?.loss_of_life?.feqa?.toFixed(2)}`, 20, y + 21);

    y += 35;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Health Assessment", 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Health Index: ${dtr?.health?.health_index?.toFixed(1)} (${dtr?.health?.category})`, 20, y);
    y += 10;
    dtr?.health?.recommendations?.forEach((rec) => {
      doc.text(`• ${rec}`, 25, y);
      y += 7;
    });

    y += 5;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Economic Analysis", 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Payback Period: ${dtr?.economic?.simple_payback_years?.toFixed(1)} years`, 20, y);
    doc.text(`20-Year NPV: $${dtr?.economic?.npv_20_year?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 20, y + 7);
    doc.text(`ROI: ${dtr?.economic?.roi_percent?.toFixed(1)}%`, 20, y + 14);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Generated by Thermal Tools - IEEE C57.91-2011 DTR System", pageWidth / 2, 285, { align: "center" });

    doc.save(`dtr_analysis_${project?.name || "report"}.pdf`);
    toast.success("DTR report downloaded");
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(6, 182, 212);
    doc.text("Cable Thermal Analysis Report", pageWidth / 2, 20, { align: "center" });
    
    // Project Info
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Project: ${project?.name || "N/A"}`, 20, 35);
    doc.text(`Method: ${getMethodLabel(results?.calculation_method)}`, 20, 42);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 49);
    
    // Installation Info
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Installation Configuration", 20, 65);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Type: ${project?.installation?.installation_type || "N/A"}`, 20, 72);
    doc.text(`Burial Depth: ${project?.installation?.burial_depth_m || "N/A"} m`, 20, 79);
    doc.text(`Ambient Temperature: ${project?.installation?.ambient_temp_c || "N/A"}°C`, 20, 86);
    doc.text(`Soil Thermal Resistivity: ${project?.installation?.soil_thermal_resistivity || "N/A"} K.m/W`, 20, 93);
    
    // Results Table
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Temperature Results", 20, 110);
    
    let y = 120;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Cable", 20, y);
    doc.text("Temp (°C)", 80, y);
    doc.text("Max (°C)", 110, y);
    doc.text("Ampacity (A)", 140, y);
    doc.text("Derating", 175, y);
    
    y += 7;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 5;
    
    results?.cable_temperatures?.forEach((temp) => {
      doc.setTextColor(0);
      doc.text(getCableName(temp.cable_id).slice(0, 25), 20, y);
      doc.text(temp.temperature_c.toFixed(1), 80, y);
      doc.text(temp.max_temperature_c.toString(), 110, y);
      
      const ampacity = results.ampacity_values?.find(a => a.cable_id === temp.cable_id);
      doc.text(ampacity?.ampacity_a?.toString() || "-", 140, y);
      doc.text(ampacity?.derating?.toFixed(3) || "-", 175, y);
      y += 7;
    });
    
    // Hotspot
    if (results?.hotspot_info?.cable_id) {
      y += 10;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Hotspot Analysis", 20, y);
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Location: ${getCableName(results.hotspot_info.cable_id)}`, 20, y);
      doc.text(`Temperature: ${results.hotspot_info.temperature_c}°C`, 20, y + 7);
      doc.text(`Margin: ${results.hotspot_info.margin_c}°C`, 20, y + 14);
    }
    
    // Emergency Rating
    if (results?.emergency_rating?.emergency_ratings) {
      y += 30;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Emergency Rating (IEC 60853-2)", 20, y);
      y += 10;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("Cable", 20, y);
      doc.text("Emergency (A)", 80, y);
      doc.text("Factor", 130, y);
      doc.text("Duration (h)", 160, y);
      y += 7;
      doc.line(20, y, 190, y);
      y += 5;
      
      results.emergency_rating.emergency_ratings.forEach((er) => {
        doc.setTextColor(0);
        doc.text(getCableName(er.cable_id).slice(0, 25), 20, y);
        doc.text(er.emergency_ampacity_a.toString(), 80, y);
        doc.text(er.emergency_factor.toFixed(2), 130, y);
        doc.text(er.duration_hours.toString(), 160, y);
        y += 7;
      });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Generated by CableThermal AI", pageWidth / 2, 285, { align: "center" });
    
    doc.save(`thermal_analysis_${project?.name || "report"}.pdf`);
    toast.success("PDF report downloaded");
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

  if (!results) {
    return (
      <Sidebar>
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Results Found</h2>
          <p className="text-zinc-500 mb-6">This project hasn't been calculated yet.</p>
          <Button 
            onClick={() => navigate(`/calculate/${projectId}`)}
            className="bg-cyan-500 text-black hover:bg-cyan-400"
          >
            Run Calculation
          </Button>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6" data-testid="results-page">
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
              <h1 className="text-2xl font-bold text-white">{project?.name}</h1>
              <p className="text-sm text-zinc-500">
                {getMethodLabel(results.calculation_method)} Analysis
              </p>
            </div>
          </div>
          <Button
            onClick={isC57 ? generateC57PDF : generatePDF}
            className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
            data-testid="download-pdf-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>

        {/* ===== C57.91-2011 DTR Results ===== */}
        {isC57 && dtr ? (
          <>
            {/* C57 Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Thermometer className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Peak Hot Spot</p>
                      <p className="text-xl font-mono font-bold text-red-400">
                        {results.hotspot_info?.temperature_c?.toFixed(1) || "-"}°C
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${getHealthColor(dtr.health?.category)}15` }}>
                      <Heart className="w-5 h-5" style={{ color: getHealthColor(dtr.health?.category) }} />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Health Index</p>
                      <p className="text-xl font-mono font-bold" style={{ color: getHealthColor(dtr.health?.category) }}>
                        {dtr.health?.health_index?.toFixed(1)}
                        <span className="text-xs ml-1 font-normal">{dtr.health?.category}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Loss of Life</p>
                      <p className="text-xl font-mono font-bold text-amber-400">
                        {dtr.loss_of_life?.lol_percent?.toFixed(4)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Normal Rating</p>
                      <p className="text-xl font-mono font-bold text-cyan-400">
                        {results.hotspot_info?.normal_rating_mva?.toFixed(1) || "-"} MVA
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* C57 Tabs */}
            <Tabs defaultValue="thermal" className="space-y-4">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="thermal" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">Thermal</TabsTrigger>
                <TabsTrigger value="forecast" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">EV Forecast</TabsTrigger>
                <TabsTrigger value="ratings" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">Ratings</TabsTrigger>
                <TabsTrigger value="risk" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">Risk</TabsTrigger>
                <TabsTrigger value="integration" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">System</TabsTrigger>
              </TabsList>

              {/* Thermal Analysis Tab */}
              <TabsContent value="thermal">
                <div className="space-y-4">
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Temperature Profile</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={thermalChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="hour" stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} label={{ value: "Hours", position: "insideBottom", offset: -5, fill: "#71717a" }} />
                          <YAxis stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} label={{ value: "°C", angle: -90, position: "insideLeft", fill: "#71717a" }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontFamily: "JetBrains Mono", fontSize: 12 }} />
                          <Legend />
                          <ReferenceLine y={results.hotspot_info?.max_temperature_c || 110} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Normal Limit", fill: "#ef4444", fontSize: 10 }} />
                          <Line type="monotone" dataKey="hot_spot" name="Hot Spot" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="top_oil" name="Top Oil" stroke="#f97316" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="ambient" name="Ambient" stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <p className="text-xs text-zinc-500 uppercase">Loss of Life</p>
                      <p className="text-lg font-mono font-bold text-amber-400">{dtr.loss_of_life?.lol_percent?.toFixed(4)}%</p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <p className="text-xs text-zinc-500 uppercase">Aging Factor (FEQA)</p>
                      <p className="text-lg font-mono font-bold text-zinc-200">{dtr.loss_of_life?.feqa?.toFixed(3)}</p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <p className="text-xs text-zinc-500 uppercase">Peak FAA</p>
                      <p className="text-lg font-mono font-bold text-zinc-200">{dtr.loss_of_life?.peak_faa?.toFixed(3)}</p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <p className="text-xs text-zinc-500 uppercase">LoL Hours</p>
                      <p className="text-lg font-mono font-bold text-zinc-200">{dtr.loss_of_life?.lol_hours?.toFixed(2)}h</p>
                    </div>
                  </div>

                  {/* Health Index */}
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Health Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6 mb-4">
                        <div className="text-center">
                          <div className="text-4xl font-mono font-bold" style={{ color: getHealthColor(dtr.health?.category) }}>
                            {dtr.health?.health_index?.toFixed(0)}
                          </div>
                          <div className="text-sm mt-1" style={{ color: getHealthColor(dtr.health?.category) }}>
                            {dtr.health?.category}
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          {[
                            { label: "Thermal (40%)", value: dtr.health?.thermal_component, max: 40 },
                            { label: "Loading (30%)", value: dtr.health?.loading_component, max: 30 },
                            { label: "Temperature (20%)", value: dtr.health?.temperature_component, max: 20 },
                            { label: "Operational (10%)", value: dtr.health?.operational_component, max: 10 },
                          ].map((comp) => (
                            <div key={comp.label} className="flex items-center gap-3">
                              <span className="text-xs text-zinc-500 w-32">{comp.label}</span>
                              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-cyan-500"
                                  style={{ width: `${(comp.value / comp.max) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-zinc-400 w-12 text-right">{comp.value?.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {dtr.health?.recommendations?.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                          <h4 className="text-sm text-zinc-400 mb-2">Recommendations</h4>
                          <ul className="space-y-1">
                            {dtr.health.recommendations.map((rec, i) => (
                              <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                                <span className="text-cyan-400 mt-0.5">•</span> {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* EV Load Forecast Tab */}
              <TabsContent value="forecast">
                <div className="space-y-4">
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Weekly Load Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={forecastChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="hour" stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} label={{ value: "Hours", position: "insideBottom", offset: -5, fill: "#71717a" }} />
                          <YAxis stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} label={{ value: "MW", angle: -90, position: "insideLeft", fill: "#71717a" }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontFamily: "JetBrains Mono", fontSize: 12 }} />
                          <Legend />
                          <Area type="monotone" dataKey="base_load" name="Base Load" stackId="1" stroke="#71717a" fill="#3f3f46" />
                          <Area type="monotone" dataKey="ev_load" name="EV Load" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <p className="text-xs text-zinc-500 uppercase">Peak EV Load</p>
                      <p className="text-lg font-mono font-bold text-cyan-400">
                        {dtr.forecast?.ev_load_mw ? Math.max(...dtr.forecast.ev_load_mw).toFixed(1) : "-"} MW
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <p className="text-xs text-zinc-500 uppercase">Peak Total Load</p>
                      <p className="text-lg font-mono font-bold text-zinc-200">
                        {dtr.forecast?.total_load_mw ? Math.max(...dtr.forecast.total_load_mw).toFixed(1) : "-"} MW
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <p className="text-xs text-zinc-500 uppercase">Avg Load (p.u.)</p>
                      <p className="text-lg font-mono font-bold text-zinc-200">
                        {dtr.forecast?.load_pu ? (dtr.forecast.load_pu.reduce((a, b) => a + b, 0) / dtr.forecast.load_pu.length).toFixed(3) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Dynamic Ratings Tab */}
              <TabsContent value="ratings">
                <div className="space-y-4">
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Dynamic Ratings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={ratingsChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="hour" stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                          <YAxis stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} label={{ value: "MVA", angle: -90, position: "insideLeft", fill: "#71717a" }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontFamily: "JetBrains Mono", fontSize: 12 }} />
                          <Legend />
                          <Line type="monotone" dataKey="normal_rating" name="Normal Rating" stroke="#06b6d4" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="emergency_rating" name="Emergency Rating" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Cooling Schedule */}
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Cooling Schedule Optimization</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={coolingChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="hour" stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                          <YAxis stroke="#71717a" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={(v) => ["ONAN", "Stage 1", "Full"][v] || v} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontFamily: "JetBrains Mono", fontSize: 12 }} formatter={(v) => ["ONAN", "Stage 1", "Full OFAF"][v] || v} />
                          <Bar dataKey="stage" name="Cooling Stage" fill="#06b6d4" />
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                          <p className="text-xs text-zinc-500">Weekly Savings</p>
                          <p className="text-sm font-mono font-bold text-emerald-400">${dtr.cooling?.total_daily_savings?.toFixed(2)}</p>
                        </div>
                        <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                          <p className="text-xs text-zinc-500">Annual Savings</p>
                          <p className="text-sm font-mono font-bold text-emerald-400">${dtr.cooling?.annual_savings_estimate?.toFixed(0)}</p>
                        </div>
                        <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                          <p className="text-xs text-zinc-500">Energy Efficiency</p>
                          <p className="text-sm font-mono font-bold text-cyan-400">{((dtr.cooling?.energy_efficiency || 0) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Risk Assessment Tab */}
              <TabsContent value="risk">
                <div className="space-y-4">
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Monte Carlo Risk Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                          <p className="text-xs text-zinc-500 uppercase">Overload Probability</p>
                          <p className="text-2xl font-mono font-bold text-amber-400">{dtr.risk?.overload_probability?.toFixed(1)}%</p>
                        </div>
                        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                          <p className="text-xs text-zinc-500 uppercase">Mean LoL</p>
                          <p className="text-lg font-mono font-bold text-zinc-200">{dtr.risk?.mean_lol?.toFixed(4)}%</p>
                        </div>
                        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                          <p className="text-xs text-zinc-500 uppercase">P95 Hot Spot</p>
                          <p className="text-lg font-mono font-bold text-red-400">{dtr.risk?.hot_spot_max_percentiles?.[4]?.toFixed(1)}°C</p>
                        </div>
                        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                          <p className="text-xs text-zinc-500 uppercase">P50 Hot Spot</p>
                          <p className="text-lg font-mono font-bold text-zinc-200">{dtr.risk?.hot_spot_max_percentiles?.[2]?.toFixed(1)}°C</p>
                        </div>
                      </div>

                      {/* Percentile Distribution */}
                      <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <h4 className="text-sm text-zinc-400 mb-3">Hot Spot Temperature Distribution (Percentiles)</h4>
                        <div className="flex items-end gap-2 h-32">
                          {["P5", "P25", "P50", "P75", "P95"].map((label, i) => {
                            const val = dtr.risk?.hot_spot_max_percentiles?.[i] || 0;
                            const maxVal = dtr.risk?.hot_spot_max_percentiles?.[4] || 100;
                            const height = (val / maxVal) * 100;
                            return (
                              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-mono text-zinc-300">{val.toFixed(0)}°C</span>
                                <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: i >= 3 ? "#f59e0b" : i >= 2 ? "#06b6d4" : "#3f3f46" }} />
                                <span className="text-xs text-zinc-500">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Economic Analysis */}
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-400" /> Economic Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <tbody className="divide-y divide-zinc-800">
                            {[
                              { label: "Implementation Cost", value: `$${dtr.economic?.implementation_cost?.toLocaleString()}` },
                              { label: "Annual Capacity Value", value: `$${dtr.economic?.annual_capacity_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                              { label: "Annual Energy Savings", value: `$${dtr.economic?.annual_energy_savings?.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                              { label: "Total Annual Benefits", value: `$${dtr.economic?.total_annual_benefits?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, highlight: true },
                              { label: "Simple Payback", value: `${dtr.economic?.simple_payback_years?.toFixed(1)} years` },
                              { label: "20-Year NPV", value: `$${dtr.economic?.npv_20_year?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, highlight: true },
                              { label: "ROI", value: `${dtr.economic?.roi_percent?.toFixed(1)}%`, highlight: true },
                              { label: "Deferred Investment", value: `$${dtr.economic?.deferred_investment?.toLocaleString()}` },
                            ].map((row) => (
                              <tr key={row.label}>
                                <td className="py-3 text-sm text-zinc-400">{row.label}</td>
                                <td className={`py-3 text-right text-sm font-mono ${row.highlight ? "text-emerald-400 font-bold" : "text-zinc-200"}`}>{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* System Integration Tab */}
              <TabsContent value="integration">
                <div className="space-y-4">
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <Radio className="w-5 h-5 text-cyan-400" /> SCADA Points
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {dtr.scada && Object.entries(dtr.scada).map(([key, value]) => (
                          <div key={key} className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                            <p className="text-xs text-zinc-500 font-mono truncate">{key}</p>
                            <p className={`text-sm font-mono font-bold mt-1 ${
                              typeof value === "boolean"
                                ? value ? "text-red-400" : "text-emerald-400"
                                : "text-zinc-200"
                            }`}>
                              {typeof value === "boolean" ? (value ? "ALARM" : "OK") : typeof value === "number" ? value.toFixed(2) : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-cyan-400" /> IEC 61850 Report
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-300 font-mono overflow-x-auto max-h-96 overflow-y-auto">
                        {JSON.stringify(dtr.iec_61850_report, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <>
            {/* ===== Cable Analysis Results (existing) ===== */}
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Thermometer className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Hotspot</p>
                      <p className="text-xl font-mono font-bold text-red-400">
                        {results.hotspot_info?.temperature_c?.toFixed(1) || "-"}°C
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Avg Ampacity</p>
                      <p className="text-xl font-mono font-bold text-cyan-400">
                        {results.ampacity_values?.length > 0
                          ? Math.round(results.ampacity_values.reduce((sum, a) => sum + a.ampacity_a, 0) / results.ampacity_values.length)
                          : "-"} A
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Margin</p>
                      <p className="text-xl font-mono font-bold text-emerald-400">
                        {results.hotspot_info?.margin_c?.toFixed(1) || "-"}°C
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Calc Time</p>
                      <p className="text-xl font-mono font-bold text-amber-400">
                        {results.calculation_time_ms?.toFixed(1) || "-"} ms
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="temperatures" className="space-y-4">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="temperatures" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
                  Temperatures
                </TabsTrigger>
                <TabsTrigger value="ampacity" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
                  Ampacity
                </TabsTrigger>
                {results.time_series && (
                  <TabsTrigger value="transient" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
                    Transient
                  </TabsTrigger>
                )}
                {results.emergency_rating && (
                  <TabsTrigger value="emergency" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
                    Emergency
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Temperatures Tab */}
              <TabsContent value="temperatures">
                <Card className="bg-zinc-900/60 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Temperature Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div ref={tempChartRef} className="w-full h-[300px]" data-testid="temp-chart"></div>

                    {/* Table */}
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full thermal-table">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            <th className="text-left p-3">Cable</th>
                            <th className="text-right p-3">Temperature</th>
                            <th className="text-right p-3">Max Temp</th>
                            <th className="text-right p-3">Margin</th>
                            <th className="text-right p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.cable_temperatures?.map((temp, i) => (
                            <tr key={i} className="border-b border-zinc-800/50">
                              <td className="p-3 text-zinc-300">{getCableName(temp.cable_id)}</td>
                              <td className="p-3 text-right">
                                <span style={{ color: getTempColor(temp.temperature_c, temp.max_temperature_c) }}>
                                  {temp.temperature_c.toFixed(1)}°C
                                </span>
                              </td>
                              <td className="p-3 text-right text-zinc-400">{temp.max_temperature_c}°C</td>
                              <td className="p-3 text-right text-emerald-400">
                                {(temp.max_temperature_c - temp.temperature_c).toFixed(1)}°C
                              </td>
                              <td className="p-3 text-right">
                                {temp.temperature_c < temp.max_temperature_c * 0.9 ? (
                                  <span className="text-emerald-400">OK</span>
                                ) : temp.temperature_c < temp.max_temperature_c ? (
                                  <span className="text-amber-400">Warning</span>
                                ) : (
                                  <span className="text-red-400">Critical</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Ampacity Tab */}
              <TabsContent value="ampacity">
                <Card className="bg-zinc-900/60 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Ampacity Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {results.ampacity_values?.map((amp, i) => (
                        <div
                          key={i}
                          className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700"
                          data-testid={`ampacity-card-${i}`}
                        >
                          <h4 className="text-sm text-zinc-400 mb-2 truncate">{getCableName(amp.cable_id)}</h4>
                          <div className="flex items-end gap-2">
                            <span className="text-3xl font-mono font-bold text-cyan-400">{amp.ampacity_a}</span>
                            <span className="text-zinc-500 mb-1">A</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-zinc-500">Derating:</span>
                            <span className={amp.derating < 0.8 ? "text-amber-400" : "text-emerald-400"}>
                              {amp.derating.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Transient Tab */}
              {results.time_series && (
                <TabsContent value="transient">
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Transient Temperature Response</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div ref={timeSeriesRef} className="w-full h-[300px]" data-testid="time-series-chart"></div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Emergency Tab */}
              {results.emergency_rating && (
                <TabsContent value="emergency">
                  <Card className="bg-zinc-900/60 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Emergency Rating (IEC 60853-2)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-sm text-amber-400">
                          Emergency ratings for {results.emergency_rating.duration_hours} hour duration
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full thermal-table">
                          <thead>
                            <tr className="border-b border-zinc-800">
                              <th className="text-left p-3">Cable</th>
                              <th className="text-right p-3">Emergency Ampacity</th>
                              <th className="text-right p-3">Factor</th>
                              <th className="text-right p-3">Max Temp</th>
                              <th className="text-right p-3">Est. Temp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.emergency_rating.emergency_ratings?.map((er, i) => (
                              <tr key={i} className="border-b border-zinc-800/50">
                                <td className="p-3 text-zinc-300">{getCableName(er.cable_id)}</td>
                                <td className="p-3 text-right text-amber-400 font-mono">{er.emergency_ampacity_a} A</td>
                                <td className="p-3 text-right text-zinc-300 font-mono">×{er.emergency_factor}</td>
                                <td className="p-3 text-right text-zinc-400">{er.max_emergency_temp_c}°C</td>
                                <td className="p-3 text-right text-zinc-300">{er.estimated_temp_c}°C</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </Sidebar>
  );
};

export default Results;
