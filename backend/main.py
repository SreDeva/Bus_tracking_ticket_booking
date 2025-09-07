from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import os
from dotenv import load_dotenv

from app.database import engine, Base
from app.routers import auth, users, buses

# Load environment variables
load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Bus Tracking and Booking API", 
    version="1.0.0",
    description="API for Bus Tracking and Booking System with Multi-User Authentication"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(buses.router)

security = HTTPBearer()

@app.get("/")
async def root():
    return {
        "message": "Bus Tracking and Booking API is running",
        "version": "1.0.0",
        "status": "healthy",
        "features": [
            "Multi-user authentication (Admin, Driver, Passenger)",
            "JWT token-based authentication",
            "Facial recognition for drivers",
            "PostgreSQL database integration",
            "Bus management system",
            "Route management with stops",
            "Driver assignment to buses"
        ]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bus-tracking-api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
