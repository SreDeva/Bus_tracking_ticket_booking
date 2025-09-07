#!/usr/bin/env python3
"""
Script to check current bus stops and add missing ones
"""
import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'database': 'bus_tracking_db',
    'user': 'postgres',
    'password': 'root'
}

def connect_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def check_existing_stops():
    """Check what bus stops currently exist"""
    conn = connect_db()
    if not conn:
        return
    
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, stop_name, location_name, latitude, longitude FROM route_stops ORDER BY id;")
        stops = cursor.fetchall()
        
        print("Current bus stops in database:")
        print("-" * 60)
        for stop in stops:
            print(f"ID: {stop[0]}, Stop: {stop[1]}, Location: {stop[2]}, Lat: {stop[3]}, Lng: {stop[4]}")
        
        return stops
    except Exception as e:
        print(f"Error querying stops: {e}")
    finally:
        conn.close()

def add_ukkadam_stop():
    """Add Ukkadam bus stop if it doesn't exist"""
    conn = connect_db()
    if not conn:
        return
    
    try:
        cursor = conn.cursor()
        
        # Check if Ukkadam already exists
        cursor.execute("SELECT id FROM route_stops WHERE stop_name ILIKE %s OR location_name ILIKE %s", 
                      ('%ukkadam%', '%ukkadam%'))
        existing = cursor.fetchone()
        
        if existing:
            print(f"Ukkadam stop already exists with ID: {existing[0]}")
            return existing[0]
        
        # Add Ukkadam stop (coordinates for Ukkadam, Coimbatore)
        cursor.execute("""
            INSERT INTO route_stops (route_id, stop_name, location_name, stop_order, latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
        """, (1, 'Ukkadam', 'Ukkadam Bus Stand, Coimbatore', 5, 11.0168, 76.9558))
        
        stop_id = cursor.fetchone()[0]
        conn.commit()
        print(f"Added Ukkadam stop with ID: {stop_id}")
        return stop_id
        
    except Exception as e:
        print(f"Error adding Ukkadam stop: {e}")
        conn.rollback()
    finally:
        conn.close()

def main():
    print("Checking bus stops database...")
    stops = check_existing_stops()
    
    if stops:
        print(f"\nFound {len(stops)} stops in database")
        
        # Check if we need to add Ukkadam
        ukkadam_exists = any('ukkadam' in stop[1].lower() or 'ukkadam' in stop[2].lower() 
                           for stop in stops)
        
        if not ukkadam_exists:
            print("\nUkkadam stop not found. Adding it...")
            add_ukkadam_stop()
            print("\nUpdated stops:")
            check_existing_stops()
        else:
            print("\nUkkadam stop already exists!")

if __name__ == "__main__":
    main()
