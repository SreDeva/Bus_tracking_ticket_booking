from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List
import base64
import os

from ..database import get_db
from ..dependencies import get_current_user, get_admin_user, get_current_active_user
from ..schemas import (
    LoginRequest, Token, UserCreate, DriverCreate, FacialLoginRequest, 
    User, Driver, FaceUpload, ChangePassword, UserRole, FaceImageUpload,
    FaceLoginRequest, FaceLoginResponse, FaceQualityResponse
)
from ..services.auth_service import auth_service
from ..services.mock_face_recognition_service import face_service
from ..models.user import Driver as DriverModel

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()

@router.post("/register", response_model=User)
async def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)  # Only admin can create users
):
    """Register a new user (admin only)"""
    # Check if user already exists
    existing_user = auth_service.get_users_by_role(db, user.role.value)
    for existing in existing_user:
        if existing.email == user.email:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
    
    return auth_service.create_user(db, user)

@router.post("/register/passenger", response_model=User)
async def register_passenger(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new passenger (public endpoint)"""
    # Force role to be passenger
    user.role = UserRole.PASSENGER
    
    # Check if email already exists (across all users)
    from ..models.user import User as UserModel
    existing_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    return auth_service.create_user(db, user)

@router.post("/register/driver", response_model=Driver)
async def register_driver(
    combined_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)  # Only admin can create drivers
):
    """Register a new driver (admin only)"""
    # Extract user and driver data from combined request
    user_data = UserCreate(
        email=combined_data["email"],
        full_name=combined_data["full_name"],
        phone=combined_data.get("phone"),
        password=combined_data["password"],
        role=UserRole.DRIVER
    )
    
    driver_data = DriverCreate(
        user_id=0,  # Will be set after user creation
        license_number=combined_data["license_number"],
        license_expiry=combined_data["license_expiry"],
        experience_years=combined_data["experience_years"]
    )
    
    # Check if user already exists
    from ..models.user import User as UserModel
    existing_user = db.query(UserModel).filter(UserModel.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create user first
    user = auth_service.create_user(db, user_data)
    
    # Create driver profile
    driver_data.user_id = user.id
    driver = auth_service.create_driver(db, driver_data)
    
    return driver
    
    # Create driver profile
    driver_data.user_id = user.id
    driver = auth_service.create_driver(db, driver_data)
    
    return driver

@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password (for passengers and admins)"""
    token = auth_service.login_user(db, login_data.email, login_data.password)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token

@router.post("/login/facial", response_model=Token)
async def facial_login(
    facial_data: FacialLoginRequest, 
    db: Session = Depends(get_db)
):
    """Login using facial recognition (for drivers)"""
    token = auth_service.login_driver_facial(db, facial_data.face_image)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Face recognition failed or driver not found"
        )
    return token

@router.post("/upload-driver-face")
async def upload_driver_face(
    face_data: FaceUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)  # Only admin can upload faces
):
    """Upload face images for driver (admin only)"""
    # Verify driver exists
    driver = db.query(DriverModel).filter(DriverModel.id == face_data.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Store face encodings
    success = face_service.store_driver_face_encodings(
        db, face_data.driver_id, face_data.images
    )
    
    if not success:
        raise HTTPException(
            status_code=500, 
            detail="Failed to process face images"
        )
    
    return {"message": "Face images uploaded successfully"}

@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user information"""
    return current_user

@router.get("/drivers", response_model=List[Driver])
async def get_all_drivers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)  # Only admin can view all drivers
):
    """Get all drivers (admin only)"""
    return db.query(DriverModel).offset(skip).limit(limit).all()

@router.get("/users/{role}")
async def get_users_by_role(
    role: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)  # Only admin can view users
):
    """Get users by role (admin only)"""
    if role not in ["admin", "driver", "passenger"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    return auth_service.get_users_by_role(db, role, skip, limit)

@router.post("/change-password")
async def change_password(
    password_data: ChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change user password"""
    from ..dependencies import verify_password, get_password_hash
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}

# Facial Recognition Endpoints

@router.post("/face/verify-quality", response_model=FaceQualityResponse)
async def verify_face_quality(
    face_data: FaceImageUpload,
    db: Session = Depends(get_db)
):
    """Verify the quality of a face image before processing"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(face_data.image_data)
        
        # Verify face quality
        quality_result = face_service.verify_face_quality(image_data)
        
        return FaceQualityResponse(**quality_result)
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error processing image: {str(e)}"
        )

@router.post("/face/upload")
async def upload_driver_face(
    face_data: FaceImageUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload face image for a driver (driver or admin only)"""
    try:
        # Check if current user is driver or admin
        if current_user.role not in ["driver", "admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only drivers and admins can upload face images"
            )
        
        # If admin, they should specify which driver (for now, use current user)
        target_user_id = current_user.id
        
        # Check if user is a driver
        driver = db.query(DriverModel).filter(DriverModel.user_id == target_user_id).first()
        if not driver:
            raise HTTPException(
                status_code=404,
                detail="Driver profile not found"
            )
        
        # Decode base64 image
        image_data = base64.b64decode(face_data.image_data)
        
        # First verify image quality
        quality_result = face_service.verify_face_quality(image_data)
        if not quality_result["is_valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Image quality issues: {', '.join(quality_result['recommendations'])}"
            )
        
        # Register face
        success = face_service.register_driver_face(db, target_user_id, image_data)
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Failed to register face. Please try again with a clearer image."
            )
        
        return {"message": "Face registered successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/face/login", response_model=FaceLoginResponse)
async def face_login(
    face_data: FaceLoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate driver using face recognition"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(face_data.image_data)
        
        # Authenticate using face recognition
        authenticated_driver = face_service.authenticate_driver_face(db, image_data)
        
        if not authenticated_driver:
            raise HTTPException(
                status_code=401,
                detail="Face authentication failed. Please try again or use password login."
            )
        
        # Create access token
        from ..dependencies import create_access_token
        access_token = create_access_token(
            data={"sub": authenticated_driver.user.email, "role": authenticated_driver.user.role}
        )
        
        return FaceLoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=authenticated_driver.user,
            driver=authenticated_driver
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.delete("/face/remove")
async def remove_driver_face(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove face encodings for a driver"""
    try:
        # Check if current user is driver or admin
        if current_user.role not in ["driver", "admin"]:
            raise HTTPException(
                status_code=403,
                detail="Only drivers and admins can remove face data"
            )
        
        # Get driver profile
        driver = db.query(DriverModel).filter(DriverModel.user_id == current_user.id).first()
        if not driver:
            raise HTTPException(
                status_code=404,
                detail="Driver profile not found"
            )
        
        # Remove face encodings
        driver.face_encodings = None
        db.commit()
        
        return {"message": "Face data removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
