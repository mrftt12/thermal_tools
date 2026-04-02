#!/usr/bin/env python3
"""
Backend API Testing Script for Mobile Guest Endpoints
Tests all /api/mobile endpoints with device-scoped identity
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://thermal-preview.preview.emergentagent.com"
DEVICE_ID = "device_test_12345678"
HEADERS = {
    "Content-Type": "application/json",
    "x-mobile-device-id": DEVICE_ID
}

class MobileAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS
        self.test_results = []
        self.created_cable_id = None
        self.created_project_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def test_mobile_stats(self):
        """Test GET /api/mobile/stats"""
        try:
            response = self.make_request("GET", "/api/mobile/stats")
            if response.status_code == 200:
                data = response.json()
                required_fields = ["project_count", "calculation_count", "cable_count", "recent_projects"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("GET /api/mobile/stats", True, 
                                f"Status: {response.status_code}, Projects: {data['project_count']}, Cables: {data['cable_count']}")
                else:
                    self.log_test("GET /api/mobile/stats", False, 
                                f"Missing fields: {missing_fields}")
            else:
                self.log_test("GET /api/mobile/stats", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/mobile/stats", False, f"Exception: {str(e)}")
    
    def test_seed_cables(self):
        """Test POST /api/mobile/seed-cables"""
        try:
            response = self.make_request("POST", "/api/mobile/seed-cables")
            if response.status_code in [200, 201]:
                data = response.json()
                self.log_test("POST /api/mobile/seed-cables", True, 
                            f"Status: {response.status_code}, Seeded cables")
            else:
                self.log_test("POST /api/mobile/seed-cables", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("POST /api/mobile/seed-cables", False, f"Exception: {str(e)}")
    
    def test_get_cables(self):
        """Test GET /api/mobile/cables with and without search"""
        # Test without search
        try:
            response = self.make_request("GET", "/api/mobile/cables")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /api/mobile/cables", True, 
                                f"Status: {response.status_code}, Found {len(data)} cables")
                else:
                    self.log_test("GET /api/mobile/cables", False, 
                                f"Expected list, got {type(data)}")
            else:
                self.log_test("GET /api/mobile/cables", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/mobile/cables", False, f"Exception: {str(e)}")
        
        # Test with search query
        try:
            response = self.make_request("GET", "/api/mobile/cables", params={"search": "copper"})
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /api/mobile/cables?search=copper", True, 
                                f"Status: {response.status_code}, Found {len(data)} cables with search")
                else:
                    self.log_test("GET /api/mobile/cables?search=copper", False, 
                                f"Expected list, got {type(data)}")
            else:
                self.log_test("GET /api/mobile/cables?search=copper", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/mobile/cables?search=copper", False, f"Exception: {str(e)}")
    
    def test_create_cable(self):
        """Test POST /api/mobile/cables"""
        cable_data = {
            "designation": "Test Mobile Cable 11kV",
            "manufacturer": "Mobile Test Corp",
            "voltage_rating_kv": 11.0,
            "num_conductors": 1,
            "cable_type": "single-core",
            "conductor": {
                "material": "copper",
                "size_mm2": 185.0,
                "construction": "stranded",
                "dc_resistance_20c": 0.0991,
                "ac_resistance_factor": 1.02,
                "temperature_coefficient": 0.00393
            },
            "insulation": {
                "material": "XLPE",
                "thickness_mm": 12.0,
                "max_operating_temp": 90.0,
                "emergency_temp": 130.0,
                "thermal_resistivity": 3.5
            }
        }
        
        try:
            response = self.make_request("POST", "/api/mobile/cables", data=cable_data)
            if response.status_code in [200, 201]:
                data = response.json()
                if "cable_id" in data:
                    self.created_cable_id = data["cable_id"]
                    self.log_test("POST /api/mobile/cables", True, 
                                f"Status: {response.status_code}, Created cable: {self.created_cable_id}")
                else:
                    self.log_test("POST /api/mobile/cables", False, 
                                f"No cable_id in response: {data}")
            else:
                self.log_test("POST /api/mobile/cables", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("POST /api/mobile/cables", False, f"Exception: {str(e)}")
    
    def test_update_cable(self):
        """Test PUT /api/mobile/cables/{cable_id}"""
        if not self.created_cable_id:
            self.log_test("PUT /api/mobile/cables/{cable_id}", False, "No cable_id available for update")
            return
        
        update_data = {
            "designation": "Updated Mobile Cable 11kV",
            "manufacturer": "Updated Mobile Test Corp",
            "voltage_rating_kv": 11.0,
            "num_conductors": 1,
            "cable_type": "single-core",
            "conductor": {
                "material": "copper",
                "size_mm2": 240.0,  # Updated size
                "construction": "stranded",
                "dc_resistance_20c": 0.0754,
                "ac_resistance_factor": 1.02,
                "temperature_coefficient": 0.00393
            },
            "insulation": {
                "material": "XLPE",
                "thickness_mm": 16.0,  # Updated thickness
                "max_operating_temp": 90.0,
                "emergency_temp": 130.0,
                "thermal_resistivity": 3.5
            }
        }
        
        try:
            response = self.make_request("PUT", f"/api/mobile/cables/{self.created_cable_id}", data=update_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("conductor", {}).get("size_mm2") == 240.0:
                    self.log_test("PUT /api/mobile/cables/{cable_id}", True, 
                                f"Status: {response.status_code}, Updated cable successfully")
                else:
                    self.log_test("PUT /api/mobile/cables/{cable_id}", False, 
                                f"Update not reflected in response")
            else:
                self.log_test("PUT /api/mobile/cables/{cable_id}", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("PUT /api/mobile/cables/{cable_id}", False, f"Exception: {str(e)}")
    
    def test_create_project(self):
        """Test POST /api/mobile/projects"""
        if not self.created_cable_id:
            self.log_test("POST /api/mobile/projects", False, "No cable_id available for project")
            return
        
        project_data = {
            "name": "Mobile Test Project",
            "description": "Test project for mobile API testing",
            "installation": {
                "installation_type": "direct_burial",
                "burial_depth_m": 1.2,
                "ambient_temp_c": 25.0,
                "soil_thermal_resistivity": 1.0
            },
            "cables": [
                {
                    "cable_id": self.created_cable_id,
                    "position_x": 0.0,
                    "position_y": 1.2,
                    "current_load_a": 300.0,
                    "load_factor": 0.8,
                    "phase": "A"
                }
            ],
            "parameters": {
                "method": "neher_mcgrath",
                "calculation_type": "steady_state",
                "daily_loss_factor": 0.7
            }
        }
        
        try:
            response = self.make_request("POST", "/api/mobile/projects", data=project_data)
            if response.status_code in [200, 201]:
                data = response.json()
                if "project_id" in data:
                    self.created_project_id = data["project_id"]
                    self.log_test("POST /api/mobile/projects", True, 
                                f"Status: {response.status_code}, Created project: {self.created_project_id}")
                else:
                    self.log_test("POST /api/mobile/projects", False, 
                                f"No project_id in response: {data}")
            else:
                self.log_test("POST /api/mobile/projects", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("POST /api/mobile/projects", False, f"Exception: {str(e)}")
    
    def test_get_projects(self):
        """Test GET /api/mobile/projects"""
        try:
            response = self.make_request("GET", "/api/mobile/projects")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /api/mobile/projects", True, 
                                f"Status: {response.status_code}, Found {len(data)} projects")
                else:
                    self.log_test("GET /api/mobile/projects", False, 
                                f"Expected list, got {type(data)}")
            else:
                self.log_test("GET /api/mobile/projects", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/mobile/projects", False, f"Exception: {str(e)}")
    
    def test_get_single_project(self):
        """Test GET /api/mobile/projects/{project_id}"""
        if not self.created_project_id:
            self.log_test("GET /api/mobile/projects/{project_id}", False, "No project_id available")
            return
        
        try:
            response = self.make_request("GET", f"/api/mobile/projects/{self.created_project_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("project_id") == self.created_project_id:
                    self.log_test("GET /api/mobile/projects/{project_id}", True, 
                                f"Status: {response.status_code}, Retrieved project successfully")
                else:
                    self.log_test("GET /api/mobile/projects/{project_id}", False, 
                                f"Project ID mismatch in response")
            else:
                self.log_test("GET /api/mobile/projects/{project_id}", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/mobile/projects/{project_id}", False, f"Exception: {str(e)}")
    
    def test_update_project(self):
        """Test PUT /api/mobile/projects/{project_id}"""
        if not self.created_project_id:
            self.log_test("PUT /api/mobile/projects/{project_id}", False, "No project_id available")
            return
        
        update_data = {
            "name": "Updated Mobile Test Project",
            "description": "Updated test project for mobile API testing",
            "installation": {
                "installation_type": "direct_burial",
                "burial_depth_m": 1.5,  # Updated depth
                "ambient_temp_c": 30.0,  # Updated temperature
                "soil_thermal_resistivity": 1.2
            },
            "cables": [
                {
                    "cable_id": self.created_cable_id,
                    "position_x": 0.0,
                    "position_y": 1.5,
                    "current_load_a": 350.0,  # Updated current
                    "load_factor": 0.85,
                    "phase": "A"
                }
            ],
            "parameters": {
                "method": "neher_mcgrath",
                "calculation_type": "steady_state",
                "daily_loss_factor": 0.7
            }
        }
        
        try:
            response = self.make_request("PUT", f"/api/mobile/projects/{self.created_project_id}", data=update_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("installation", {}).get("burial_depth_m") == 1.5:
                    self.log_test("PUT /api/mobile/projects/{project_id}", True, 
                                f"Status: {response.status_code}, Updated project successfully")
                else:
                    self.log_test("PUT /api/mobile/projects/{project_id}", False, 
                                f"Update not reflected in response")
            else:
                self.log_test("PUT /api/mobile/projects/{project_id}", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("PUT /api/mobile/projects/{project_id}", False, f"Exception: {str(e)}")
    
    def test_calculate_project(self):
        """Test POST /api/mobile/calculate/{project_id}"""
        if not self.created_project_id:
            self.log_test("POST /api/mobile/calculate/{project_id}", False, "No project_id available")
            return
        
        try:
            response = self.make_request("POST", f"/api/mobile/calculate/{self.created_project_id}")
            if response.status_code in [200, 201]:
                data = response.json()
                required_fields = ["cable_temperatures", "ampacity_values", "hotspot_info", "calculation_method"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("POST /api/mobile/calculate/{project_id}", True, 
                                f"Status: {response.status_code}, Calculation completed successfully")
                else:
                    self.log_test("POST /api/mobile/calculate/{project_id}", False, 
                                f"Missing fields in calculation result: {missing_fields}")
            else:
                self.log_test("POST /api/mobile/calculate/{project_id}", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("POST /api/mobile/calculate/{project_id}", False, f"Exception: {str(e)}")
    
    def test_get_results(self):
        """Test GET /api/mobile/results/{project_id}"""
        if not self.created_project_id:
            self.log_test("GET /api/mobile/results/{project_id}", False, "No project_id available")
            return
        
        try:
            response = self.make_request("GET", f"/api/mobile/results/{self.created_project_id}")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /api/mobile/results/{project_id}", True, 
                                f"Status: {response.status_code}, Found {len(data)} calculation results")
                else:
                    self.log_test("GET /api/mobile/results/{project_id}", False, 
                                f"Expected list, got {type(data)}")
            else:
                self.log_test("GET /api/mobile/results/{project_id}", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/mobile/results/{project_id}", False, f"Exception: {str(e)}")
    
    def test_delete_cable(self):
        """Test DELETE /api/mobile/cables/{cable_id}"""
        if not self.created_cable_id:
            self.log_test("DELETE /api/mobile/cables/{cable_id}", False, "No cable_id available")
            return
        
        try:
            response = self.make_request("DELETE", f"/api/mobile/cables/{self.created_cable_id}")
            if response.status_code in [200, 204]:
                self.log_test("DELETE /api/mobile/cables/{cable_id}", True, 
                            f"Status: {response.status_code}, Cable deleted successfully")
            else:
                self.log_test("DELETE /api/mobile/cables/{cable_id}", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("DELETE /api/mobile/cables/{cable_id}", False, f"Exception: {str(e)}")
    
    def test_delete_project(self):
        """Test DELETE /api/mobile/projects/{project_id}"""
        if not self.created_project_id:
            self.log_test("DELETE /api/mobile/projects/{project_id}", False, "No project_id available")
            return
        
        try:
            response = self.make_request("DELETE", f"/api/mobile/projects/{self.created_project_id}")
            if response.status_code in [200, 204]:
                self.log_test("DELETE /api/mobile/projects/{project_id}", True, 
                            f"Status: {response.status_code}, Project deleted successfully")
            else:
                self.log_test("DELETE /api/mobile/projects/{project_id}", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("DELETE /api/mobile/projects/{project_id}", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all mobile API tests in sequence"""
        print(f"🚀 Starting Mobile API Tests")
        print(f"Base URL: {self.base_url}")
        print(f"Device ID: {DEVICE_ID}")
        print("=" * 60)
        
        # Test sequence as requested
        self.test_mobile_stats()
        self.test_seed_cables()
        self.test_get_cables()
        self.test_create_cable()
        self.test_update_cable()
        self.test_create_project()
        self.test_get_projects()
        self.test_get_single_project()
        self.test_update_project()
        self.test_calculate_project()
        self.test_get_results()
        
        # Cleanup tests
        self.test_delete_cable()
        self.test_delete_project()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = MobileAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        exit(0)
    else:
        print("\n💥 Some tests failed!")
        exit(1)

if __name__ == "__main__":
    main()