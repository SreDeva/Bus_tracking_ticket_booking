#!/usr/bin/env python3
"""
Database initialization script for Bus Tracking and Booking System
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add the parent directory to the path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine
from app.models.user import User, Driver
from app.dependencies import get_password_hash

load_dotenv()

def create_tables():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

def create_admin_user():
    """Create initial admin user"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        admin_exists = db.query(User).filter(User.role == "admin").first()
        if admin_exists:
            print("Admin user already exists!")
            return
        
        # Create admin user
        admin_user = User(
            email="admin@bustrack.com",
            full_name="System Administrator",
            phone="1234567890",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print(f"Admin user created successfully!")
        print(f"Email: admin@bustrack.com")
        print(f"Password: admin123")
        print(f"Please change the password after first login!")
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    """Main initialization function"""
    print("Initializing Bus Tracking and Booking Database...")
    
    # Create tables
    create_tables()
    
    # Create admin user
    create_admin_user()
    
    print("Database initialization completed!")

if __name__ == "__main__":
    main()
