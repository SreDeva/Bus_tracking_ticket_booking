from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Union
from datetime import datetime, date
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    DRIVER = "driver"
    PASSENGER = "passenger"

# Base User Schema
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Driver specific schemas
class DriverBase(BaseModel):
    license_number: str
    license_expiry: Union[datetime, date, str]
    experience_years: int
    
    @field_validator('license_expiry')
    @classmethod
    def parse_license_expiry(cls, v):
        if isinstance(v, str):
            try:
                # Try parsing as date first (YYYY-MM-DD)
                parsed_date = datetime.strptime(v, '%Y-%m-%d').date()
                # Convert to datetime at midnight
                return datetime.combine(parsed_date, datetime.min.time())
            except ValueError:
                try:
                    # Try parsing as datetime
                    return datetime.fromisoformat(v)
                except ValueError:
                    raise ValueError('Invalid date format. Expected YYYY-MM-DD or ISO datetime format')
        elif isinstance(v, date):
            return datetime.combine(v, datetime.min.time())
        return v

class DriverCreate(DriverBase):
    user_id: int

class DriverUpdate(BaseModel):
    license_number: Optional[str] = None
    license_expiry: Optional[Union[datetime, date, str]] = None
    experience_years: Optional[int] = None
    is_active: Optional[bool] = None
    
    @field_validator('license_expiry')
    @classmethod
    def parse_license_expiry(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            try:
                # Try parsing as date first (YYYY-MM-DD)
                parsed_date = datetime.strptime(v, '%Y-%m-%d').date()
                # Convert to datetime at midnight
                return datetime.combine(parsed_date, datetime.min.time())
            except ValueError:
                try:
                    # Try parsing as datetime
                    return datetime.fromisoformat(v)
                except ValueError:
                    raise ValueError('Invalid date format. Expected YYYY-MM-DD or ISO datetime format')
        elif isinstance(v, date):
            return datetime.combine(v, datetime.min.time())
        return v

class Driver(DriverBase):
    id: int
    user_id: int
    is_active: bool
    face_encodings: Optional[str] = None  # JSON string of face encodings
    created_at: datetime
    user: User

    class Config:
        from_attributes = True

# Face recognition schemas
class FaceImageUpload(BaseModel):
    image_data: str  # Base64 encoded image
    
class FaceLoginRequest(BaseModel):
    image_data: str  # Base64 encoded image
    
class FaceLoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: User
    driver: Driver

class FaceQualityResponse(BaseModel):
    is_valid: bool
    face_count: int
    image_resolution: str
    recommendations: List[str]

# Bus Management Schemas
class BusBase(BaseModel):
    bus_number: str
    capacity: int
    bus_type: str  # "AC", "Non-AC", "Sleeper", etc.
    origin_depot: str

class BusCreate(BusBase):
    pass

class BusUpdate(BaseModel):
    bus_number: Optional[str] = None
    capacity: Optional[int] = None
    bus_type: Optional[str] = None
    origin_depot: Optional[str] = None
    is_active: Optional[bool] = None

class Bus(BusBase):
    id: int
    qr_code: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Route Management Schemas
class RouteStopBase(BaseModel):
    stop_name: str
    location_name: str
    stop_order: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class RouteStopCreate(RouteStopBase):
    pass

class RouteStop(RouteStopBase):
    id: int
    route_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class RouteBase(BaseModel):
    route_name: str
    origin: str
    destination: str
    distance_km: float
    estimated_duration_minutes: int

class RouteCreate(RouteBase):
    bus_id: int
    driver_id: int
    stops: List[RouteStopCreate] = []

class RouteUpdate(BaseModel):
    route_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    driver_id: Optional[int] = None
    is_active: Optional[bool] = None

class Route(RouteBase):
    id: int
    bus_id: int
    driver_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    bus: Bus
    stops: List[RouteStop] = []

    class Config:
        from_attributes = True

# Bus Assignment Schema (removed - driver assignment only through route creation)
# class BusAssignment(BaseModel):
#     bus_id: int
#     driver_id: int

# Bus with Routes Response
class BusWithRoutes(Bus):
    routes: List[Route] = []

    class Config:
        from_attributes = True

# QR Code Scan Response
class QRScanResponse(BaseModel):
    bus: Bus
    current_route: Optional['Route'] = None
    current_driver: Optional[Driver] = None

# GPS Location Tracking
class GPSLocation(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    driver_id: int
    bus_id: Optional[int] = None
    route_id: Optional[int] = None

class GPSLocationCreate(BaseModel):
    latitude: float
    longitude: float
    bus_id: Optional[int] = None

# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class TokenData(BaseModel):
    email: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class FacialLoginRequest(BaseModel):
    face_image: str  # base64 encoded image

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

# Face recognition schemas
class FaceUpload(BaseModel):
    driver_id: int
    images: List[str]  # List of base64 encoded images

class FaceRecognitionResult(BaseModel):
    success: bool
    driver_id: Optional[int] = None
    confidence: Optional[float] = None
    message: str

# Ticket Management Schemas
class TicketCreate(BaseModel):
    bus_id: int
    bus_number: str
    route_name: str
    source_stop: str
    destination_stop: str

class TicketResponse(BaseModel):
    id: str
    bus_id: int
    bus_number: str
    route_name: str
    source_stop: str
    destination_stop: str
    qr_code: str
    one_time_code: str
    expires_at: str
    status: str
    created_at: str

    class Config:
        from_attributes = True
