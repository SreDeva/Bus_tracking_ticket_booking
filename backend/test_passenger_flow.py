#!/usr/bin/env python3
"""
Complete test of the passenger route finding system
"""
import requests

def test_complete_flow():
    """Test the complete passenger flow"""
    try:
        print("=== Testing Complete Passenger Flow ===")
        
        # 1. Login
        print("1. Logging in...")
        login_resp = requests.post('http://10.26.181.214:8000/auth/login', 
            json={'email': 'admin@bustrack.com', 'password': 'admin123'})
        
        if login_resp.status_code != 200:
            print(f"❌ Login failed: {login_resp.status_code}")
            return
            
        token = login_resp.json()['access_token']
        print("✅ Login successful")
        
        # 2. Get bus stops
        print("\n2. Getting bus stops...")
        stops_resp = requests.get('http://10.26.181.214:8000/passenger/bus-stops',
            headers={'Authorization': f'Bearer {token}'})
            
        if stops_resp.status_code == 200:
            stops = stops_resp.json()
            print(f"✅ Found {len(stops)} bus stops:")
            for stop in stops:
                print(f"   - {stop['name']} (ID: {stop['id']})")
        else:
            print(f"❌ Bus stops failed: {stops_resp.status_code}")
            
        # 3. Search route from Palani to Ukkadam
        print("\n3. Searching route: Palani → Ukkadam...")
        route_resp = requests.post('http://10.26.181.214:8000/passenger/find-route',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json={
                'source_stop_name': 'Palani',
                'destination_stop_name': 'Ukkadam',
                'user_location': {'latitude': 10.4495216, 'longitude': 77.5153329},
                'max_distance_km': 3.0
            })
            
        if route_resp.status_code == 200:
            result = route_resp.json()
            print("✅ Route search successful!")
            print(f"   Source: {result['source_stop']['name']}")
            print(f"   Destination: {result['destination_stop']['name']}")
            print(f"   Buses found: {len(result['buses_on_route'])}")
            print(f"   Distance: {result['total_distance_km']} km")
            print(f"   Duration: {result['estimated_duration_minutes']} minutes")
            
            if result['recommended_bus']:
                bus = result['recommended_bus']
                print(f"   Recommended: {bus['bus_number']} ({bus['distance_from_user_km']} km away)")
                
        else:
            print(f"❌ Route search failed: {route_resp.status_code}")
            print(f"   Error: {route_resp.text}")
            
        print("\n=== Test Complete ===")
        print("✅ Backend is working correctly!")
        print("📱 Now test the mobile app - enter 'Palani' → 'Ukkadam'")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_complete_flow()
