#!/usr/bin/env python3
"""
Test script to check the bus stops endpoint
"""
import requests

def test_bus_stops_endpoint():
    """Test the /passenger/bus-stops endpoint"""
    try:
        # Get a fresh token first
        login_resp = requests.post('http://10.26.181.214:8000/auth/login', 
            json={'email': 'admin@bustrack.com', 'password': 'admin123'})

        if login_resp.status_code == 200:
            token = login_resp.json()['access_token']
            print('Got fresh token')
            
            # Test the bus stops endpoint
            stops_resp = requests.get('http://10.26.181.214:8000/passenger/bus-stops',
                headers={'Authorization': f'Bearer {token}'}
            )
            print(f'Bus stops status: {stops_resp.status_code}')
            if stops_resp.status_code == 200:
                stops = stops_resp.json()
                print(f'Found {len(stops)} stops:')
                for stop in stops:
                    print(f'  ID: {stop["id"]}, Name: {stop["name"]}')
            else:
                print(f'Error: {stops_resp.text}')
        else:
            print(f'Login failed: {login_resp.status_code} - {login_resp.text}')
            
    except Exception as e:
        print(f'Error: {e}')

if __name__ == "__main__":
    test_bus_stops_endpoint()
