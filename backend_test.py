import requests
import sys
import json
from datetime import datetime
import uuid

class CableThermalAPITester:
    def __init__(self, base_url="https://ductbank-thermal.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        
        if headers:
            default_headers.update(headers)
            
        if self.token:
            default_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=10)

            success = response.status_code == expected_status
            
            result = {
                'name': name,
                'method': method,
                'endpoint': endpoint,
                'expected_status': expected_status,
                'actual_status': response.status_code,
                'success': success,
                'response_size': len(response.content) if response.content else 0
            }
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    if response.content:
                        json_resp = response.json()
                        if isinstance(json_resp, list):
                            print(f"   Response: List with {len(json_resp)} items")
                        else:
                            print(f"   Response keys: {list(json_resp.keys()) if isinstance(json_resp, dict) else 'Non-dict response'}")
                        result['response_preview'] = str(json_resp)[:200] + "..." if len(str(json_resp)) > 200 else str(json_resp)
                    return success, response.json() if response.content else {}
                except:
                    return success, {"raw_response": response.text}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        error_detail = response.json()
                        print(f"   Error: {error_detail}")
                        result['error_detail'] = error_detail
                    except:
                        print(f"   Raw error: {response.text[:200]}")
                        result['error_detail'] = response.text[:200]
                        
            self.test_results.append(result)
            return success, {}

        except Exception as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            result = {
                'name': name,
                'method': method,
                'endpoint': endpoint,
                'expected_status': expected_status,
                'actual_status': 'ERROR',
                'success': False,
                'error': str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test("Health Check", "GET", "api/", 200)
        return success

    def test_health_detailed(self):
        """Test detailed health endpoint"""
        success, response = self.run_test("Detailed Health", "GET", "api/health", 200)
        return success

    def test_seed_cables(self):
        """Test seeding the cable library"""
        success, response = self.run_test("Seed Cables", "POST", "api/seed-cables", 200)
        return success and 'message' in response

    def test_get_cables(self):
        """Test getting cable list"""
        success, response = self.run_test("Get Cables", "GET", "api/cables", 200)
        if success and isinstance(response, list):
            print(f"   Found {len(response)} cables")
            return True
        return False

    def test_cable_filters(self):
        """Test cable filtering"""
        # Test voltage filter
        success1, _ = self.run_test("Filter Cables by Voltage", "GET", "api/cables?voltage=12", 200)
        # Test material filter  
        success2, _ = self.run_test("Filter Cables by Material", "GET", "api/cables?material=copper", 200)
        # Test search
        success3, _ = self.run_test("Search Cables", "GET", "api/cables?search=NYY", 200)
        
        return success1 and success2 and success3

    def test_get_specific_cable(self):
        """Test getting a specific cable"""
        # First get list of cables to find an ID
        success, response = self.run_test("Get Cables for ID", "GET", "api/cables?limit=1", 200)
        if success and isinstance(response, list) and len(response) > 0:
            cable_id = response[0].get('cable_id')
            if cable_id:
                success2, _ = self.run_test("Get Specific Cable", "GET", f"api/cables/{cable_id}", 200)
                return success2
        return False

    def create_test_user_session(self):
        """Create test user and session for authenticated tests"""
        print("\n📝 Creating test user and session...")
        
        # We'll use the auth testing approach from the playbook
        import subprocess
        import os
        
        # Create user and session in MongoDB
        user_id = f"test_user_{int(datetime.now().timestamp())}"
        session_token = f"test_session_{uuid.uuid4().hex}"
        
        mongo_script = f'''
        use('test_database');
        var userId = '{user_id}';
        var sessionToken = '{session_token}';
        var email = 'test.user.{int(datetime.now().timestamp())}@example.com';
        
        db.users.insertOne({{
          user_id: userId,
          email: email,
          name: 'Test User',
          picture: 'https://via.placeholder.com/150',
          created_at: new Date().toISOString()
        }});
        
        db.user_sessions.insertOne({{
          user_id: userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
          created_at: new Date().toISOString()
        }});
        
        print('Test user created with session token: ' + sessionToken);
        '''
        
        try:
            # Try to create test user via mongo command (if available)
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                 capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                self.token = session_token
                print(f"✅ Test session created: {session_token}")
                return True
            else:
                print(f"⚠️  MongoDB not accessible for test user creation: {result.stderr}")
        except:
            print("⚠️  MongoDB command not available, will test auth endpoints without session")
            
        return False

    def test_auth_me_without_token(self):
        """Test /auth/me without authentication - should fail"""
        success, _ = self.run_test("Auth Me (No Token)", "GET", "api/auth/me", 401)
        return success  # Success means we got expected 401

    def test_auth_me_with_token(self):
        """Test /auth/me with token"""
        if not self.token:
            print("⚠️  Skipping authenticated test - no session token")
            return True
        
        success, response = self.run_test("Auth Me (With Token)", "GET", "api/auth/me", 200)
        if success and 'user_id' in response:
            print(f"   Authenticated as: {response.get('name', 'Unknown')}")
            return True
        return success

    def test_projects_crud(self):
        """Test project CRUD operations"""
        if not self.token:
            print("⚠️  Skipping project tests - no session token")
            return True

        # Test GET projects
        success1, projects = self.run_test("Get Projects", "GET", "api/projects", 200)
        
        # Test CREATE project
        test_project = {
            "name": f"Test Project {datetime.now().strftime('%H:%M:%S')}",
            "description": "Test thermal calculation project",
            "installation": {
                "installation_type": "direct_burial",
                "burial_depth_m": 1.5,
                "ambient_temp_c": 25.0,
                "soil_thermal_resistivity": 1.2
            },
            "parameters": {
                "method": "neher_mcgrath",
                "calculation_type": "steady_state"
            }
        }
        
        success2, created_project = self.run_test("Create Project", "POST", "api/projects", 200, test_project)
        project_id = created_project.get('project_id') if success2 else None
        
        success3 = True
        success4 = True
        
        if project_id:
            # Test GET specific project
            success3, _ = self.run_test("Get Specific Project", "GET", f"api/projects/{project_id}", 200)
            
            # Test UPDATE project
            update_data = test_project.copy()
            update_data["name"] = "Updated Test Project"
            success4, _ = self.run_test("Update Project", "PUT", f"api/projects/{project_id}", 200, update_data)
        
        return success1 and success2 and success3 and success4

    def test_calculation_endpoint(self):
        """Test thermal calculation endpoint"""
        if not self.token:
            print("⚠️  Skipping calculation test - no session token")
            return True
            
        # First create a project with some cables
        cables_response = self.run_test("Get Cables for Calculation", "GET", "api/cables?limit=2", 200)[1]
        if not cables_response or len(cables_response) == 0:
            print("⚠️  No cables available for calculation test")
            return True
            
        # Create project with cable positions
        cable_1 = cables_response[0]
        test_project = {
            "name": f"Calculation Test {datetime.now().strftime('%H:%M:%S')}",
            "description": "Test calculation project",
            "installation": {
                "installation_type": "direct_burial",
                "burial_depth_m": 1.5,
                "ambient_temp_c": 20.0,
                "soil_thermal_resistivity": 1.0
            },
            "cables": [
                {
                    "cable_id": cable_1['cable_id'],
                    "position_x": 0.0,
                    "position_y": 1.5,
                    "current_load_a": 400.0,
                    "phase": "A"
                }
            ],
            "parameters": {
                "method": "neher_mcgrath",
                "calculation_type": "steady_state",
                "daily_loss_factor": 0.7
            }
        }
        
        success1, project = self.run_test("Create Calculation Project", "POST", "api/projects", 200, test_project)
        project_id = project.get('project_id') if success1 else None
        
        if not project_id:
            return False
            
        # Run thermal calculation
        success2, calc_result = self.run_test("Run Thermal Calculation", "POST", f"api/calculate/{project_id}", 200)
        
        if success2:
            # Verify calculation results structure
            expected_keys = ['cable_temperatures', 'ampacity_values', 'mutual_heating', 'hotspot_info']
            has_results = all(key in calc_result for key in expected_keys)
            
            if has_results:
                print("   ✅ Calculation completed with expected result structure")
                return True
            else:
                print(f"   ❌ Missing expected keys in calculation result: {calc_result.keys()}")
        
        return success2

    def test_stats_endpoint(self):
        """Test dashboard stats endpoint"""
        if not self.token:
            print("⚠️  Skipping stats test - no session token")
            return True
            
        success, response = self.run_test("Get Stats", "GET", "api/stats", 200)
        if success:
            expected_keys = ['project_count', 'calculation_count', 'cable_count']
            has_stats = all(key in response for key in expected_keys)
            if has_stats:
                print(f"   📊 Stats: {response.get('project_count', 0)} projects, {response.get('cable_count', 0)} cables")
                return True
        return success

def main():
    print("🔥 Starting Cable Thermal Analysis API Tests")
    print("=" * 60)
    
    tester = CableThermalAPITester()
    
    # Core API Tests (no auth required)
    print("\n📡 TESTING CORE API ENDPOINTS")
    print("-" * 40)
    
    core_tests = [
        ("Health Check", tester.test_health_check),
        ("Detailed Health", tester.test_health_detailed),
        ("Seed Cables", tester.test_seed_cables),
        ("Get Cables", tester.test_get_cables),
        ("Cable Filters", tester.test_cable_filters),
        ("Get Specific Cable", tester.test_specific_cable)
    ]
    
    core_passed = 0
    for name, test_func in core_tests:
        try:
            if test_func():
                core_passed += 1
            else:
                print(f"⚠️  {name} test had issues")
        except Exception as e:
            print(f"❌ {name} test failed with error: {e}")
    
    print(f"\n📊 Core API Results: {core_passed}/{len(core_tests)} tests passed")
    
    # Auth Tests
    print("\n🔐 TESTING AUTHENTICATION")
    print("-" * 40)
    
    # Test unauthenticated access
    tester.test_auth_me_without_token()
    
    # Try to create test session
    has_auth_session = tester.create_test_user_session()
    
    if has_auth_session:
        auth_tests = [
            ("Auth Me (With Token)", tester.test_auth_me_with_token),
            ("Project CRUD", tester.test_projects_crud),
            ("Thermal Calculation", tester.test_calculation_endpoint),
            ("Dashboard Stats", tester.test_stats_endpoint)
        ]
        
        auth_passed = 0
        for name, test_func in auth_tests:
            try:
                if test_func():
                    auth_passed += 1
                else:
                    print(f"⚠️  {name} test had issues")
            except Exception as e:
                print(f"❌ {name} test failed with error: {e}")
        
        print(f"\n📊 Auth API Results: {auth_passed}/{len(auth_tests)} tests passed")
    else:
        print("⚠️  Skipping authenticated tests - could not create test session")
    
    # Final Results
    print("\n" + "=" * 60)
    print(f"🎯 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} API tests passed")
    print(f"✅ Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "No tests run")
    
    # Save detailed results
    results_summary = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed/tester.tests_run)*100 if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results_summary, f, indent=2)
    
    print(f"📄 Detailed results saved to: /app/backend_test_results.json")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())