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
  ArrowLeft, 
  Download, 
  Thermometer,
  Zap,
  AlertTriangle,
  Clock,
  TrendingUp
} from "lucide-react";

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
    doc.text(`Method: ${results?.calculation_method === "neher_mcgrath" ? "Neher-McGrath" : "IEC 60853"}`, 20, 42);
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
                {results.calculation_method === "neher_mcgrath" ? "Neher-McGrath" : "IEC 60853"} Analysis
              </p>
            </div>
          </div>
          <Button
            onClick={generatePDF}
            className="bg-cyan-500 text-black hover:bg-cyan-400 font-mono btn-glow"
            data-testid="download-pdf-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>

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
      </div>
    </Sidebar>
  );
};

export default Results;
