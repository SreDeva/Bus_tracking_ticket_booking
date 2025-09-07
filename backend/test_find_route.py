#!/usr/bin/env python3
"""
Test script for the new find-route endpoint
"""
import requests
import json

def test_find_route_endpoint():
    """Test the /passenger/find-route endpoint"""
    try:
        # Get a fresh token first
        login_resp = requests.post('http://10.26.181.214:8000/auth/login', 
            json={'email': 'admin@bustrack.com', 'password': 'admin123'})

        if login_resp.status_code == 200:
            token = login_resp.json()['access_token']
            print('Got fresh token')
            
            # Test the find-route endpoint with stop names
            test_data = {
                "source_stop_name": "Palani",
                "destination_stop_name": "Ukkadam",
                "max_distance_km": 3.0
            }
            
            print(f'Sending data: {json.dumps(test_data, indent=2)}')
            
            route_resp = requests.post('http://10.26.181.214:8000/passenger/find-route',
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json'
                },
                json=test_data
            )
            
            print(f'Find route status: {route_resp.status_code}')
            if route_resp.status_code == 200:
                result = route_resp.json()
                print('SUCCESS!')
                print(f'Source: {result["source_stop"]["name"]}')
                print(f'Destination: {result["destination_stop"]["name"]}')
                print(f'Buses found: {len(result["buses_on_route"])}')
            else:
                print(f'Error: {route_resp.text}')
        else:
            print(f'Login failed: {login_resp.status_code} - {login_resp.text}')
            
    except Exception as e:
        print(f'Error: {e}')

if __name__ == "__main__":
    test_find_route_endpoint()
