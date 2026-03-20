from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import math
import numpy as np

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="CableThermal AI - Underground Cable Thermal Analysis")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== AUTH MODELS ==============
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionData(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== CABLE MODELS ==============
class ConductorProperties(BaseModel):
    material: str = "copper"  # copper, aluminum
    size_mm2: float = 240.0
    size_awg: Optional[str] = None
    construction: str = "stranded"  # solid, stranded
    dc_resistance_20c: float = 0.0754  # ohm/km
    ac_resistance_factor: float = 1.02
    temperature_coefficient: float = 0.00393

class InsulationProperties(BaseModel):
    material: str = "XLPE"  # XLPE, EPR, PVC, etc.
    thickness_mm: float = 16.0
    dielectric_constant: float = 2.5
    dielectric_loss_factor: float = 0.0005
    max_operating_temp: float = 90.0
    emergency_temp: float = 130.0
    thermal_resistivity: float = 3.5  # K.m/W

class SheathProperties(BaseModel):
    material: str = "copper"  # copper, aluminum, lead
    thickness_mm: float = 0.5
    grounding: str = "single-point"  # single-point, both-ends, cross-bonded

class ArmorProperties(BaseModel):
    armor_type: Optional[str] = None  # steel-wire, steel-tape, none
    material: Optional[str] = None
    thickness_mm: Optional[float] = None

class JacketProperties(BaseModel):
    material: str = "PVC"  # PVC, PE, PUR
    thickness_mm: float = 3.0
    uv_resistant: bool = False
    temp_rating: float = 70.0
    thermal_resistivity: float = 5.0  # K.m/W

class CableDimensions(BaseModel):
    overall_diameter_mm: float = 50.0
    weight_kg_per_m: float = 3.5
    min_bending_radius_mm: float = 500.0

class ThermalProperties(BaseModel):
    thermal_resistance_insulation: float = 0.5  # K.m/W
    thermal_resistance_jacket: float = 0.2
    thermal_capacitance: float = 400.0  # J/(K.m)

class Cable(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cable_id: str = Field(default_factory=lambda: f"cable_{uuid.uuid4().hex[:12]}")
    designation: str
    manufacturer: str
    voltage_rating_kv: float
    num_conductors: int = 1
    cable_type: str = "single-core"  # single-core, three-core
    conductor: ConductorProperties = Field(default_factory=ConductorProperties)
    insulation: InsulationProperties = Field(default_factory=InsulationProperties)
    sheath: SheathProperties = Field(default_factory=SheathProperties)
    armor: ArmorProperties = Field(default_factory=ArmorProperties)
    jacket: JacketProperties = Field(default_factory=JacketProperties)
    dimensions: CableDimensions = Field(default_factory=CableDimensions)
    thermal: ThermalProperties = Field(default_factory=ThermalProperties)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class CableCreate(BaseModel):
    designation: str
    manufacturer: str
    voltage_rating_kv: float
    num_conductors: int = 1
    cable_type: str = "single-core"
    conductor: ConductorProperties = Field(default_factory=ConductorProperties)
    insulation: InsulationProperties = Field(default_factory=InsulationProperties)
    sheath: SheathProperties = Field(default_factory=SheathProperties)
    armor: ArmorProperties = Field(default_factory=ArmorProperties)
    jacket: JacketProperties = Field(default_factory=JacketProperties)
    dimensions: CableDimensions = Field(default_factory=CableDimensions)
    thermal: ThermalProperties = Field(default_factory=ThermalProperties)

# ============== PROJECT MODELS ==============
class InstallationConfig(BaseModel):
    installation_type: str = "direct_burial"  # direct_burial, ductbank
    burial_depth_m: float = 1.0
    ambient_temp_c: float = 20.0
    soil_thermal_resistivity: float = 1.0  # K.m/W
    # Ductbank specific
    num_rows: Optional[int] = None
    num_cols: Optional[int] = None
    duct_inner_diameter_mm: Optional[float] = None
    duct_spacing_mm: Optional[float] = None
    concrete_thermal_resistivity: Optional[float] = None

class CablePosition(BaseModel):
    cable_id: str
    position_x: float  # meters from reference
    position_y: float  # depth in meters
    current_load_a: float = 0.0
    phase: str = "A"  # A, B, C for three-phase

class CalculationParameters(BaseModel):
    method: str = "neher_mcgrath"  # neher_mcgrath, iec_60853
    calculation_type: str = "steady_state"  # steady_state, transient
    duration_hours: Optional[float] = None  # for transient
    emergency_factor: Optional[float] = None  # 1.0 to 2.5
    daily_loss_factor: float = 0.7

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str = Field(default_factory=lambda: f"proj_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    user_id: str
    installation: InstallationConfig = Field(default_factory=InstallationConfig)
    cables: List[CablePosition] = Field(default_factory=list)
    parameters: CalculationParameters = Field(default_factory=CalculationParameters)
    status: str = "draft"  # draft, calculated, archived
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    installation: InstallationConfig = Field(default_factory=InstallationConfig)
    cables: List[CablePosition] = Field(default_factory=list)
    parameters: CalculationParameters = Field(default_factory=CalculationParameters)

class CalculationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    result_id: str = Field(default_factory=lambda: f"result_{uuid.uuid4().hex[:12]}")
    project_id: str
    cable_temperatures: List[Dict[str, Any]]  # [{cable_id, temp_c, max_temp_c, ...}]
    ampacity_values: List[Dict[str, Any]]  # [{cable_id, ampacity_a, derating, ...}]
    mutual_heating: List[List[float]]  # mutual heating matrix
    hotspot_info: Dict[str, Any]
    time_series: Optional[List[Dict[str, Any]]] = None  # for transient
    emergency_rating: Optional[Dict[str, Any]] = None
    calculation_method: str
    calculation_time_ms: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== AUTH HELPERS ==============
async def get_current_user(request: Request) -> User:
    """Get current user from session token"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    # Check expiry with timezone awareness
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    return User(**user)

# ============== AUTH ROUTES ==============
@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get session data
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    
    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    
    auth_data = auth_response.json()
    
    # Create or update user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data["name"],
                "picture": auth_data.get("picture")
            }}
        )
    else:
        user_doc = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = auth_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ============== CABLE LIBRARY ROUTES ==============
@api_router.get("/cables", response_model=List[Cable])
async def get_cables(
    voltage: Optional[float] = None,
    material: Optional[str] = None,
    manufacturer: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get cables from library with filtering"""
    query = {}
    
    if voltage:
        query["voltage_rating_kv"] = voltage
    if material:
        query["conductor.material"] = material
    if manufacturer:
        query["manufacturer"] = {"$regex": manufacturer, "$options": "i"}
    if search:
        query["$or"] = [
            {"designation": {"$regex": search, "$options": "i"}},
            {"manufacturer": {"$regex": search, "$options": "i"}}
        ]
    
    cables = await db.cables.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Convert datetime strings
    for cable in cables:
        for field in ["created_at", "updated_at"]:
            if isinstance(cable.get(field), str):
                cable[field] = datetime.fromisoformat(cable[field])
    
    return cables

@api_router.get("/cables/{cable_id}", response_model=Cable)
async def get_cable(cable_id: str):
    """Get a specific cable"""
    cable = await db.cables.find_one({"cable_id": cable_id}, {"_id": 0})
    if not cable:
        raise HTTPException(status_code=404, detail="Cable not found")
    
    for field in ["created_at", "updated_at"]:
        if isinstance(cable.get(field), str):
            cable[field] = datetime.fromisoformat(cable[field])
    
    return cable

@api_router.post("/cables", response_model=Cable)
async def create_cable(cable_data: CableCreate, user: User = Depends(get_current_user)):
    """Create a new cable"""
    cable = Cable(**cable_data.model_dump(), created_by=user.user_id)
    doc = cable.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.cables.insert_one(doc)
    return cable

@api_router.put("/cables/{cable_id}", response_model=Cable)
async def update_cable(cable_id: str, cable_data: CableCreate, user: User = Depends(get_current_user)):
    """Update a cable"""
    existing = await db.cables.find_one({"cable_id": cable_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cable not found")
    
    update_data = cable_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.cables.update_one({"cable_id": cable_id}, {"$set": update_data})
    
    updated = await db.cables.find_one({"cable_id": cable_id}, {"_id": 0})
    for field in ["created_at", "updated_at"]:
        if isinstance(updated.get(field), str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return updated

@api_router.delete("/cables/{cable_id}")
async def delete_cable(cable_id: str, user: User = Depends(get_current_user)):
    """Delete a cable"""
    result = await db.cables.delete_one({"cable_id": cable_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cable not found")
    return {"message": "Cable deleted"}

# ============== PROJECT ROUTES ==============
@api_router.get("/projects", response_model=List[Project])
async def get_projects(user: User = Depends(get_current_user)):
    """Get user's projects"""
    projects = await db.projects.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    
    for proj in projects:
        for field in ["created_at", "updated_at"]:
            if isinstance(proj.get(field), str):
                proj[field] = datetime.fromisoformat(proj[field])
    
    return projects

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, user: User = Depends(get_current_user)):
    """Get a specific project"""
    project = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    for field in ["created_at", "updated_at"]:
        if isinstance(project.get(field), str):
            project[field] = datetime.fromisoformat(project[field])
    
    return project

@api_router.post("/projects", response_model=Project)
async def create_project(project_data: ProjectCreate, user: User = Depends(get_current_user)):
    """Create a new project"""
    project = Project(**project_data.model_dump(), user_id=user.user_id)
    doc = project.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.projects.insert_one(doc)
    return project

@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, project_data: ProjectCreate, user: User = Depends(get_current_user)):
    """Update a project"""
    existing = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.projects.update_one({"project_id": project_id}, {"$set": update_data})
    
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    for field in ["created_at", "updated_at"]:
        if isinstance(updated.get(field), str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return updated

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: User = Depends(get_current_user)):
    """Delete a project"""
    result = await db.projects.delete_one({"project_id": project_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Also delete associated results
    await db.calculation_results.delete_many({"project_id": project_id})
    return {"message": "Project deleted"}

# ============== THERMAL CALCULATION ENGINE ==============
class ThermalCalculator:
    """Implementation of Neher-McGrath and IEC 60853 thermal calculations"""
    
    @staticmethod
    def calculate_ac_resistance(dc_resistance: float, temp_c: float, temp_coeff: float, ac_factor: float) -> float:
        """Calculate AC resistance at operating temperature"""
        r_temp = dc_resistance * (1 + temp_coeff * (temp_c - 20))
        return r_temp * ac_factor
    
    @staticmethod
    def calculate_thermal_resistance_soil(depth: float, diameter: float, soil_resistivity: float) -> float:
        """Calculate external thermal resistance in soil (Neher-McGrath)"""
        # T4 = (rho_soil / (2 * pi)) * ln(4 * depth / diameter)
        u = 2 * depth / (diameter / 1000)  # diameter in meters
        T4 = (soil_resistivity / (2 * math.pi)) * math.log(u + math.sqrt(u**2 - 1))
        return T4
    
    @staticmethod
    def calculate_mutual_heating_factor(distance: float, depth1: float, depth2: float, soil_resistivity: float) -> float:
        """Calculate mutual heating between cables"""
        if distance == 0:
            return 0
        
        # F = (rho / (2*pi)) * ln(sqrt((d1+d2)^2 + D^2) / sqrt((d1-d2)^2 + D^2))
        d_sum = depth1 + depth2
        d_diff = abs(depth1 - depth2)
        
        numerator = math.sqrt(d_sum**2 + distance**2)
        denominator = max(math.sqrt(d_diff**2 + distance**2), 0.001)
        
        F = (soil_resistivity / (2 * math.pi)) * math.log(numerator / denominator)
        return F
    
    @staticmethod
    def neher_mcgrath_steady_state(
        cables: List[Dict],
        cable_positions: List[CablePosition],
        installation: InstallationConfig,
        daily_loss_factor: float = 0.7
    ) -> Dict:
        """
        Neher-McGrath steady-state temperature calculation
        Returns temperatures and ampacities for each cable
        """
        import time
        start_time = time.time()
        
        n_cables = len(cable_positions)
        if n_cables == 0:
            return {"error": "No cables in project"}
        
        results = []
        mutual_heating = [[0.0] * n_cables for _ in range(n_cables)]
        
        for i, pos in enumerate(cable_positions):
            cable = next((c for c in cables if c["cable_id"] == pos.cable_id), None)
            if not cable:
                continue
            
            # Get cable properties
            conductor = cable.get("conductor", {})
            insulation = cable.get("insulation", {})
            jacket = cable.get("jacket", {})
            thermal = cable.get("thermal", {})
            dimensions = cable.get("dimensions", {})
            
            max_temp = insulation.get("max_operating_temp", 90)
            ambient = installation.ambient_temp_c
            
            # Calculate thermal resistances
            T1 = thermal.get("thermal_resistance_insulation", 0.5)  # Insulation
            T3 = thermal.get("thermal_resistance_jacket", 0.2)  # Jacket
            
            # External thermal resistance (soil)
            diameter_mm = dimensions.get("overall_diameter_mm", 50)
            T4 = ThermalCalculator.calculate_thermal_resistance_soil(
                installation.burial_depth_m,
                diameter_mm,
                installation.soil_thermal_resistivity
            )
            
            # Total thermal resistance
            T_total = T1 + T3 + T4
            
            # Calculate mutual heating from other cables
            delta_theta_mutual = 0
            for j, other_pos in enumerate(cable_positions):
                if i != j:
                    distance = math.sqrt((pos.position_x - other_pos.position_x)**2)
                    if distance > 0:
                        F_ij = ThermalCalculator.calculate_mutual_heating_factor(
                            distance, pos.position_y, other_pos.position_y,
                            installation.soil_thermal_resistivity
                        )
                        mutual_heating[i][j] = F_ij
                        # Estimate losses from other cable
                        other_cable = next((c for c in cables if c["cable_id"] == other_pos.cable_id), None)
                        if other_cable and other_pos.current_load_a > 0:
                            other_r = other_cable.get("conductor", {}).get("dc_resistance_20c", 0.1)
                            other_loss = (other_pos.current_load_a ** 2) * other_r / 1000  # W/m
                            delta_theta_mutual += other_loss * F_ij * daily_loss_factor
            
            # Temperature rise available for losses
            delta_theta_max = max_temp - ambient - delta_theta_mutual
            
            # AC resistance at max temp
            dc_r = conductor.get("dc_resistance_20c", 0.0754)
            ac_factor = conductor.get("ac_resistance_factor", 1.02)
            temp_coeff = conductor.get("temperature_coefficient", 0.00393)
            r_ac = ThermalCalculator.calculate_ac_resistance(dc_r, max_temp, temp_coeff, ac_factor)
            
            # Calculate ampacity: I = sqrt(delta_theta / (R_ac * T_total * (1 + daily_loss_factor * T4/T_total)))
            denominator = r_ac / 1000 * T_total * (1 + daily_loss_factor * T4 / T_total)
            if denominator > 0 and delta_theta_max > 0:
                ampacity = math.sqrt(delta_theta_max / denominator)
            else:
                ampacity = 0
            
            # Calculate actual temperature if current is specified
            if pos.current_load_a > 0:
                losses = (pos.current_load_a ** 2) * r_ac / 1000  # W/m
                temp_rise = losses * T_total + delta_theta_mutual
                actual_temp = ambient + temp_rise
            else:
                actual_temp = ambient
            
            # Derating factor (ratio of actual ampacity to base ampacity without mutual heating)
            base_ampacity = math.sqrt((max_temp - ambient) / denominator) if denominator > 0 else 0
            derating = ampacity / base_ampacity if base_ampacity > 0 else 1.0
            
            results.append({
                "cable_id": pos.cable_id,
                "position": {"x": pos.position_x, "y": pos.position_y},
                "current_load_a": pos.current_load_a,
                "temperature_c": round(actual_temp, 2),
                "max_temperature_c": max_temp,
                "ampacity_a": round(ampacity, 1),
                "derating_factor": round(derating, 3),
                "thermal_resistance_total": round(T_total, 4),
                "thermal_resistance_soil": round(T4, 4),
                "mutual_heating_rise_c": round(delta_theta_mutual, 2)
            })
        
        # Find hotspot
        if results:
            hotspot = max(results, key=lambda x: x["temperature_c"])
            hotspot_info = {
                "cable_id": hotspot["cable_id"],
                "temperature_c": hotspot["temperature_c"],
                "max_temperature_c": hotspot["max_temperature_c"],
                "margin_c": round(hotspot["max_temperature_c"] - hotspot["temperature_c"], 2)
            }
        else:
            hotspot_info = {}
        
        calc_time = (time.time() - start_time) * 1000
        
        return {
            "cable_temperatures": results,
            "ampacity_values": [{"cable_id": r["cable_id"], "ampacity_a": r["ampacity_a"], "derating": r["derating_factor"]} for r in results],
            "mutual_heating": mutual_heating,
            "hotspot_info": hotspot_info,
            "calculation_time_ms": round(calc_time, 2)
        }
    
    @staticmethod
    def calculate_emergency_rating(
        base_result: Dict,
        emergency_factor: float,
        duration_hours: float,
        cables: List[Dict],
        cable_positions: List[CablePosition],
        installation: InstallationConfig
    ) -> Dict:
        """
        IEC 60853-2 Emergency rating calculation
        """
        emergency_results = []
        
        for temp_result in base_result.get("cable_temperatures", []):
            cable_id = temp_result["cable_id"]
            cable = next((c for c in cables if c["cable_id"] == cable_id), None)
            pos = next((p for p in cable_positions if p.cable_id == cable_id), None)
            
            if not cable or not pos:
                continue
            
            insulation = cable.get("insulation", {})
            max_normal_temp = insulation.get("max_operating_temp", 90)
            emergency_temp = insulation.get("emergency_temp", 130)
            
            # Emergency ampacity based on higher allowed temperature
            base_ampacity = temp_result["ampacity_a"]
            temp_margin_ratio = (emergency_temp - installation.ambient_temp_c) / (max_normal_temp - installation.ambient_temp_c)
            
            # Account for thermal time constant (simplified)
            # Short durations allow higher overloads due to thermal mass
            time_factor = 1 + (1 - math.exp(-duration_hours / 2)) * 0.5  # Simplified time factor
            
            emergency_ampacity = base_ampacity * math.sqrt(temp_margin_ratio) * time_factor
            emergency_ampacity = min(emergency_ampacity, base_ampacity * emergency_factor)
            
            # Estimated temperature at emergency load
            current_ratio = emergency_ampacity / base_ampacity if base_ampacity > 0 else 1
            temp_rise = (emergency_temp - max_normal_temp) * (current_ratio ** 2 - 1) / (current_ratio ** 2)
            estimated_temp = temp_result["temperature_c"] + temp_rise * (pos.current_load_a / base_ampacity if base_ampacity > 0 else 0) ** 2
            
            emergency_results.append({
                "cable_id": cable_id,
                "emergency_ampacity_a": round(emergency_ampacity, 1),
                "emergency_factor": round(emergency_ampacity / base_ampacity, 2) if base_ampacity > 0 else 0,
                "duration_hours": duration_hours,
                "max_emergency_temp_c": emergency_temp,
                "estimated_temp_c": round(min(estimated_temp, emergency_temp), 2)
            })
        
        return {
            "emergency_ratings": emergency_results,
            "duration_hours": duration_hours,
            "requested_factor": emergency_factor
        }
    
    @staticmethod
    def transient_analysis(
        cables: List[Dict],
        cable_positions: List[CablePosition],
        installation: InstallationConfig,
        duration_hours: float,
        time_steps: int = 50
    ) -> List[Dict]:
        """
        Simplified transient thermal analysis
        Returns temperature time series
        """
        time_series = []
        dt = duration_hours / time_steps
        
        # Get initial steady-state
        steady_state = ThermalCalculator.neher_mcgrath_steady_state(
            cables, cable_positions, installation
        )
        
        # Initial temperatures (ambient)
        temps = {pos.cable_id: installation.ambient_temp_c for pos in cable_positions}
        
        for step in range(time_steps + 1):
            t = step * dt
            
            cable_temps = {}
            for temp_result in steady_state.get("cable_temperatures", []):
                cable_id = temp_result["cable_id"]
                final_temp = temp_result["temperature_c"]
                
                # Exponential approach to steady-state
                # tau = thermal time constant (simplified: 1-2 hours for typical cables)
                tau = 1.5
                current_temp = temps[cable_id] + (final_temp - temps[cable_id]) * (1 - math.exp(-t / tau))
                temps[cable_id] = current_temp
                cable_temps[cable_id] = round(current_temp, 2)
            
            time_series.append({
                "time_hours": round(t, 3),
                "temperatures": cable_temps
            })
        
        return time_series

# ============== CALCULATION ROUTES ==============
@api_router.post("/calculate/{project_id}")
async def run_calculation(project_id: str, user: User = Depends(get_current_user)):
    """Run thermal calculation for a project"""
    project = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get cables
    cable_ids = [pos["cable_id"] for pos in project.get("cables", [])]
    cables = await db.cables.find({"cable_id": {"$in": cable_ids}}, {"_id": 0}).to_list(100)
    
    if not cables:
        raise HTTPException(status_code=400, detail="No cables found for this project")
    
    # Convert cable positions
    cable_positions = [CablePosition(**pos) for pos in project.get("cables", [])]
    installation = InstallationConfig(**project.get("installation", {}))
    parameters = CalculationParameters(**project.get("parameters", {}))
    
    # Run calculation
    if parameters.method == "neher_mcgrath":
        result = ThermalCalculator.neher_mcgrath_steady_state(
            cables, cable_positions, installation, parameters.daily_loss_factor
        )
    else:
        # IEC 60853 - use same base calculation for now
        result = ThermalCalculator.neher_mcgrath_steady_state(
            cables, cable_positions, installation, parameters.daily_loss_factor
        )
    
    # Transient analysis if requested
    if parameters.calculation_type == "transient" and parameters.duration_hours:
        result["time_series"] = ThermalCalculator.transient_analysis(
            cables, cable_positions, installation, parameters.duration_hours
        )
    
    # Emergency rating if requested
    if parameters.emergency_factor and parameters.emergency_factor > 1.0:
        result["emergency_rating"] = ThermalCalculator.calculate_emergency_rating(
            result, parameters.emergency_factor,
            parameters.duration_hours or 2.0,
            cables, cable_positions, installation
        )
    
    # Save result
    calc_result = CalculationResult(
        project_id=project_id,
        cable_temperatures=result.get("cable_temperatures", []),
        ampacity_values=result.get("ampacity_values", []),
        mutual_heating=result.get("mutual_heating", []),
        hotspot_info=result.get("hotspot_info", {}),
        time_series=result.get("time_series"),
        emergency_rating=result.get("emergency_rating"),
        calculation_method=parameters.method,
        calculation_time_ms=result.get("calculation_time_ms", 0)
    )
    
    doc = calc_result.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.calculation_results.insert_one(doc)
    
    # Update project status
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"status": "calculated", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return calc_result

@api_router.get("/results/{project_id}")
async def get_results(project_id: str, user: User = Depends(get_current_user)):
    """Get calculation results for a project"""
    project = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    results = await db.calculation_results.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    for r in results:
        if isinstance(r.get("created_at"), str):
            r["created_at"] = datetime.fromisoformat(r["created_at"])
    
    return results

# ============== STATS ROUTES ==============
@api_router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    """Get user dashboard stats"""
    project_count = await db.projects.count_documents({"user_id": user.user_id})
    calculation_count = await db.calculation_results.count_documents({})
    cable_count = await db.cables.count_documents({})
    
    # Recent projects
    recent_projects = await db.projects.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("updated_at", -1).limit(5).to_list(5)
    
    for proj in recent_projects:
        for field in ["created_at", "updated_at"]:
            if isinstance(proj.get(field), str):
                proj[field] = datetime.fromisoformat(proj[field])
    
    return {
        "project_count": project_count,
        "calculation_count": calculation_count,
        "cable_count": cable_count,
        "recent_projects": recent_projects
    }

# ============== SEED DATA ==============
@api_router.post("/seed-cables")
async def seed_cables():
    """Seed initial cable library with common cables"""
    existing = await db.cables.count_documents({})
    if existing > 0:
        return {"message": f"Cable library already has {existing} cables"}
    
    # Pre-populated cable library
    cables_data = [
        # Low Voltage Cables
        {"designation": "NYY 4x95", "manufacturer": "Nexans", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "copper", "size_mm2": 95, "dc_resistance_20c": 0.193, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.4, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 42, "weight_kg_per_m": 2.8}},
        
        {"designation": "NYY 4x150", "manufacturer": "Nexans", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "copper", "size_mm2": 150, "dc_resistance_20c": 0.124, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.6, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 48, "weight_kg_per_m": 4.2}},
        
        {"designation": "NAYY 4x240", "manufacturer": "Prysmian", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "aluminum", "size_mm2": 240, "dc_resistance_20c": 0.125, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.8, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 55, "weight_kg_per_m": 2.9}},
        
        # Medium Voltage XLPE Cables
        {"designation": "NA2XS(F)2Y 1x240/25", "manufacturer": "Prysmian", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 240, "dc_resistance_20c": 0.125, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 38, "weight_kg_per_m": 1.4}},
        
        {"designation": "NA2XS(F)2Y 1x400/35", "manufacturer": "Prysmian", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 400, "dc_resistance_20c": 0.0778, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.6},
         "dimensions": {"overall_diameter_mm": 44, "weight_kg_per_m": 2.0}},
        
        {"designation": "N2XS(F)2Y 1x240/25", "manufacturer": "Nexans", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 240, "dc_resistance_20c": 0.0754, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 40, "weight_kg_per_m": 2.8}},
        
        {"designation": "N2XS(F)2Y 1x500/35", "manufacturer": "Nexans", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 500, "dc_resistance_20c": 0.0366, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.7},
         "dimensions": {"overall_diameter_mm": 52, "weight_kg_per_m": 5.5}},
        
        # 20kV Cables
        {"designation": "NA2XS(F)2Y 1x240/25 20kV", "manufacturer": "ABB", "voltage_rating_kv": 20,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 240, "dc_resistance_20c": 0.125, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 8.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 45, "weight_kg_per_m": 1.7}},
        
        {"designation": "N2XS(F)2Y 1x400/35 20kV", "manufacturer": "ABB", "voltage_rating_kv": 20,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 400, "dc_resistance_20c": 0.047, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 8.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.6},
         "dimensions": {"overall_diameter_mm": 52, "weight_kg_per_m": 4.5}},
        
        # 33kV Cables
        {"designation": "N2XS(FL)2Y 1x630/35 33kV", "manufacturer": "Brugg", "voltage_rating_kv": 33,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 630, "dc_resistance_20c": 0.0283, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 10.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "lead", "thickness_mm": 2.0},
         "dimensions": {"overall_diameter_mm": 68, "weight_kg_per_m": 8.5}},
        
        {"designation": "NA2XS(FL)2Y 1x800/50 33kV", "manufacturer": "Brugg", "voltage_rating_kv": 33,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 800, "dc_resistance_20c": 0.0367, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 10.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "lead", "thickness_mm": 2.0},
         "dimensions": {"overall_diameter_mm": 72, "weight_kg_per_m": 6.2}},
        
        # EPR Insulated Cables
        {"designation": "N2XSEY 3x95/16 12kV", "manufacturer": "General Cable", "voltage_rating_kv": 12,
         "num_conductors": 3, "cable_type": "three-core",
         "conductor": {"material": "copper", "size_mm2": 95, "dc_resistance_20c": 0.193, "construction": "stranded"},
         "insulation": {"material": "EPR", "thickness_mm": 4.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.4},
         "dimensions": {"overall_diameter_mm": 58, "weight_kg_per_m": 5.8}},
        
        {"designation": "N2XSEY 3x150/25 12kV", "manufacturer": "General Cable", "voltage_rating_kv": 12,
         "num_conductors": 3, "cable_type": "three-core",
         "conductor": {"material": "copper", "size_mm2": 150, "dc_resistance_20c": 0.124, "construction": "stranded"},
         "insulation": {"material": "EPR", "thickness_mm": 4.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 65, "weight_kg_per_m": 7.5}},
        
        # High Voltage Cables (66kV+)
        {"designation": "2XS(FL)2Y 1x1000/50 66kV", "manufacturer": "Southwire", "voltage_rating_kv": 66,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 1000, "dc_resistance_20c": 0.0176, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 17.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "lead", "thickness_mm": 2.5},
         "armor": {"armor_type": "steel-wire", "material": "galvanized-steel", "thickness_mm": 3.0},
         "dimensions": {"overall_diameter_mm": 98, "weight_kg_per_m": 18.5}},
        
        {"designation": "2XS(FL)2Y 1x1600/70 66kV", "manufacturer": "Southwire", "voltage_rating_kv": 66,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 1600, "dc_resistance_20c": 0.0113, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 17.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "lead", "thickness_mm": 2.8},
         "armor": {"armor_type": "steel-wire", "material": "galvanized-steel", "thickness_mm": 3.5},
         "dimensions": {"overall_diameter_mm": 115, "weight_kg_per_m": 28.0}},
        
        # 110kV/132kV Cables
        {"designation": "2XS(FL)2Y 1x1200/70 110kV", "manufacturer": "NKT", "voltage_rating_kv": 110,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 1200, "dc_resistance_20c": 0.0151, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 23.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "lead", "thickness_mm": 3.0},
         "armor": {"armor_type": "steel-wire", "material": "galvanized-steel", "thickness_mm": 4.0},
         "dimensions": {"overall_diameter_mm": 125, "weight_kg_per_m": 25.0}},
        
        {"designation": "A2XS(FL)2Y 1x2000/95 132kV", "manufacturer": "NKT", "voltage_rating_kv": 132,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 2000, "dc_resistance_20c": 0.0145, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 26.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "aluminum", "thickness_mm": 2.5},
         "dimensions": {"overall_diameter_mm": 135, "weight_kg_per_m": 15.0}},
        
        # Additional common sizes
        {"designation": "NYY 4x35", "manufacturer": "Draka", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "copper", "size_mm2": 35, "dc_resistance_20c": 0.524, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.0, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 28, "weight_kg_per_m": 1.2}},
        
        {"designation": "NYY 4x70", "manufacturer": "Draka", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "copper", "size_mm2": 70, "dc_resistance_20c": 0.268, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.2, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 36, "weight_kg_per_m": 2.2}},
        
        # Submarine/Special cables
        {"designation": "2XS(FL)2YRAA 1x800 33kV Submarine", "manufacturer": "Prysmian", "voltage_rating_kv": 33,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 800, "dc_resistance_20c": 0.0221, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 10.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "lead", "thickness_mm": 3.0},
         "armor": {"armor_type": "steel-wire", "material": "galvanized-steel", "thickness_mm": 5.0},
         "dimensions": {"overall_diameter_mm": 95, "weight_kg_per_m": 22.0}},
        
        # Fire-resistant cables
        {"designation": "N2XH 4x95 FR", "manufacturer": "Leoni", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "copper", "size_mm2": 95, "dc_resistance_20c": 0.193, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 1.4, "max_operating_temp": 90, "emergency_temp": 130},
         "jacket": {"material": "HFFR", "thickness_mm": 2.5, "temp_rating": 90},
         "dimensions": {"overall_diameter_mm": 44, "weight_kg_per_m": 3.0}},
        
        # More MV cables
        {"designation": "NA2XS(F)2Y 1x150/25", "manufacturer": "Nexans", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 150, "dc_resistance_20c": 0.206, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.4},
         "dimensions": {"overall_diameter_mm": 32, "weight_kg_per_m": 0.95}},
        
        {"designation": "NA2XS(F)2Y 1x300/25", "manufacturer": "Nexans", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 300, "dc_resistance_20c": 0.100, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 40, "weight_kg_per_m": 1.5}},
        
        {"designation": "N2XS(F)2Y 1x95/16", "manufacturer": "Prysmian", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 95, "dc_resistance_20c": 0.193, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.3},
         "dimensions": {"overall_diameter_mm": 30, "weight_kg_per_m": 1.4}},
        
        {"designation": "N2XS(F)2Y 1x185/25", "manufacturer": "Prysmian", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 185, "dc_resistance_20c": 0.0991, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 36, "weight_kg_per_m": 2.2}},
        
        # 20kV additional
        {"designation": "NA2XS(F)2Y 1x150/25 20kV", "manufacturer": "Brugg", "voltage_rating_kv": 20,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "aluminum", "size_mm2": 150, "dc_resistance_20c": 0.206, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 8.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.4},
         "dimensions": {"overall_diameter_mm": 38, "weight_kg_per_m": 1.2}},
        
        {"designation": "N2XS(F)2Y 1x240/25 20kV", "manufacturer": "Brugg", "voltage_rating_kv": 20,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 240, "dc_resistance_20c": 0.0754, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 8.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 48, "weight_kg_per_m": 3.2}},
        
        # American AWG sizes (for US market)
        {"designation": "MV-105 500kcmil 15kV", "manufacturer": "Southwire", "voltage_rating_kv": 15,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 253, "size_awg": "500 kcmil", "dc_resistance_20c": 0.0707, "construction": "stranded"},
         "insulation": {"material": "EPR", "thickness_mm": 5.6, "max_operating_temp": 105, "emergency_temp": 140},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 45, "weight_kg_per_m": 3.0}},
        
        {"designation": "MV-105 750kcmil 15kV", "manufacturer": "Southwire", "voltage_rating_kv": 15,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 380, "size_awg": "750 kcmil", "dc_resistance_20c": 0.0472, "construction": "stranded"},
         "insulation": {"material": "EPR", "thickness_mm": 5.6, "max_operating_temp": 105, "emergency_temp": 140},
         "sheath": {"material": "copper", "thickness_mm": 0.6},
         "dimensions": {"overall_diameter_mm": 52, "weight_kg_per_m": 4.3}},
        
        {"designation": "MV-90 4/0 AWG 15kV", "manufacturer": "General Cable", "voltage_rating_kv": 15,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 107, "size_awg": "4/0 AWG", "dc_resistance_20c": 0.161, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.6, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.4},
         "dimensions": {"overall_diameter_mm": 32, "weight_kg_per_m": 1.5}},
        
        # Three-core MV cables
        {"designation": "N2XSEY 3x240/25 12kV", "manufacturer": "ABB", "voltage_rating_kv": 12,
         "num_conductors": 3, "cable_type": "three-core",
         "conductor": {"material": "copper", "size_mm2": 240, "dc_resistance_20c": 0.0754, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 78, "weight_kg_per_m": 11.0}},
        
        {"designation": "NA2XSEY 3x150/25 20kV", "manufacturer": "ABB", "voltage_rating_kv": 20,
         "num_conductors": 3, "cable_type": "three-core",
         "conductor": {"material": "aluminum", "size_mm2": 150, "dc_resistance_20c": 0.206, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 8.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "dimensions": {"overall_diameter_mm": 72, "weight_kg_per_m": 5.5}},
        
        # Armored cables
        {"designation": "N2XSYBY 1x240/25 12kV", "manufacturer": "Nexans", "voltage_rating_kv": 12,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 240, "dc_resistance_20c": 0.0754, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 5.5, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.5},
         "armor": {"armor_type": "steel-tape", "material": "galvanized-steel", "thickness_mm": 1.0},
         "dimensions": {"overall_diameter_mm": 48, "weight_kg_per_m": 3.8}},
        
        {"designation": "N2XSYRY 1x400/35 20kV", "manufacturer": "Nexans", "voltage_rating_kv": 20,
         "num_conductors": 1, "cable_type": "single-core",
         "conductor": {"material": "copper", "size_mm2": 400, "dc_resistance_20c": 0.047, "construction": "stranded"},
         "insulation": {"material": "XLPE", "thickness_mm": 8.0, "max_operating_temp": 90, "emergency_temp": 130},
         "sheath": {"material": "copper", "thickness_mm": 0.6},
         "armor": {"armor_type": "steel-wire", "material": "galvanized-steel", "thickness_mm": 2.5},
         "dimensions": {"overall_diameter_mm": 65, "weight_kg_per_m": 7.5}},
        
        # More LV options
        {"designation": "NAYY 4x120", "manufacturer": "Nexans", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "aluminum", "size_mm2": 120, "dc_resistance_20c": 0.253, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.4, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 38, "weight_kg_per_m": 1.4}},
        
        {"designation": "NAYY 4x185", "manufacturer": "Nexans", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "aluminum", "size_mm2": 185, "dc_resistance_20c": 0.164, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.6, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 45, "weight_kg_per_m": 2.0}},
        
        {"designation": "NYY 4x185", "manufacturer": "Prysmian", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "copper", "size_mm2": 185, "dc_resistance_20c": 0.0991, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.6, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 52, "weight_kg_per_m": 5.2}},
        
        {"designation": "NYY 4x240", "manufacturer": "Prysmian", "voltage_rating_kv": 0.6,
         "num_conductors": 4, "cable_type": "multi-core",
         "conductor": {"material": "copper", "size_mm2": 240, "dc_resistance_20c": 0.0754, "construction": "stranded"},
         "insulation": {"material": "PVC", "thickness_mm": 1.8, "max_operating_temp": 70},
         "dimensions": {"overall_diameter_mm": 58, "weight_kg_per_m": 6.8}},
    ]
    
    cables_to_insert = []
    for cable_data in cables_data:
        cable = Cable(
            designation=cable_data["designation"],
            manufacturer=cable_data["manufacturer"],
            voltage_rating_kv=cable_data["voltage_rating_kv"],
            num_conductors=cable_data.get("num_conductors", 1),
            cable_type=cable_data.get("cable_type", "single-core"),
            conductor=ConductorProperties(**cable_data.get("conductor", {})),
            insulation=InsulationProperties(**cable_data.get("insulation", {})),
            sheath=SheathProperties(**cable_data.get("sheath", {})),
            armor=ArmorProperties(**cable_data.get("armor", {})),
            jacket=JacketProperties(**cable_data.get("jacket", {})),
            dimensions=CableDimensions(**cable_data.get("dimensions", {})),
            created_by="system"
        )
        doc = cable.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        cables_to_insert.append(doc)
    
    await db.cables.insert_many(cables_to_insert)
    return {"message": f"Seeded {len(cables_to_insert)} cables"}

# ============== HEALTH CHECK ==============
@api_router.get("/")
async def root():
    return {"message": "CableThermal AI API", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
