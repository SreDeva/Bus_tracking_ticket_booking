from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Time
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin, driver, passenger
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    driver_profile = relationship("Driver", back_populates="user", uselist=False)

class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    license_number = Column(String, unique=True, nullable=False)
    license_expiry = Column(DateTime, nullable=False)
    experience_years = Column(Integer, nullable=False)
    face_encodings = Column(Text, nullable=True)  # JSON string of face encodings
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="driver_profile")

class Bus(Base):
    __tablename__ = "buses"

    id = Column(Integer, primary_key=True, index=True)
    bus_number = Column(String, unique=True, nullable=False)  # e.g., "TN 44 AD 1234"
    capacity = Column(Integer, nullable=False)
    bus_type = Column(String, nullable=False)  # e.g., "AC", "Non-AC", "Sleeper"
    origin_depot = Column(String, nullable=False)  # Depot/origin location of bus
    qr_code = Column(Text, nullable=True)  # Base64 encoded QR code image
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    routes = relationship("Route", back_populates="bus")

class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    route_name = Column(String, nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    distance_km = Column(Float, nullable=False)
    estimated_duration_minutes = Column(Integer, nullable=False)
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    bus = relationship("Bus", back_populates="routes")
    driver = relationship("Driver", foreign_keys=[driver_id])
    stops = relationship("RouteStop", back_populates="route", cascade="all, delete-orphan")

class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    stop_name = Column(String, nullable=False)  # Name of the bus stop
    location_name = Column(String, nullable=False)  # Location/area name
    stop_order = Column(Integer, nullable=False)  # Order of stop in the route
    latitude = Column(Float, nullable=True)  # GPS coordinates (optional)
    longitude = Column(Float, nullable=True)  # GPS coordinates (optional)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    route = relationship("Route", back_populates="stops")

class GPSTracking(Base):
    __tablename__ = "gps_tracking"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    
    # Relationships
    driver = relationship("Driver", foreign_keys=[driver_id])
    bus = relationship("Bus", foreign_keys=[bus_id])
    route = relationship("Route", foreign_keys=[route_id])
