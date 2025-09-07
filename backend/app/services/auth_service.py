from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..dependencies import get_password_hash, authenticate_user, create_access_token
from ..schemas import UserCreate, DriverCreate, Token
from .mock_face_recognition_service import face_service

class AuthService:
    
    def create_user(self, db: Session, user: UserCreate):
        """Create a new user"""
        from ..models.user import User
        
        hashed_password = get_password_hash(user.password)
        db_user = User(
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            hashed_password=hashed_password,
            role=user.role.value
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    
    def create_driver(self, db: Session, driver: DriverCreate):
        """Create a new driver profile"""
        from ..models.user import Driver
        
        db_driver = Driver(
            user_id=driver.user_id,
            license_number=driver.license_number,
            license_expiry=driver.license_expiry,
            experience_years=driver.experience_years
        )
        db.add(db_driver)
        db.commit()
        db.refresh(db_driver)
        return db_driver
    
    def login_user(self, db: Session, email: str, password: str):
        """Login user with email and password"""
        user = authenticate_user(db, email, password)
        if not user:
            return None
        
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user
        )
    
    def login_driver_facial(self, db: Session, face_image_b64: str):
        """Login driver using facial recognition"""
        from ..models.user import Driver
        
        driver_id = face_service.authenticate_driver_by_face(db, face_image_b64)
        
        if not driver_id:
            return None
        
        # Get driver and user info
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver or not driver.user or not driver.user.is_active:
            return None
        
        user = driver.user
        
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user
        )
    
    def get_users_by_role(self, db: Session, role: str, skip: int = 0, limit: int = 100):
        """Get users by role"""
        from ..models.user import User
        return db.query(User).filter(User.role == role).offset(skip).limit(limit).all()
    
    def get_driver_by_user_id(self, db: Session, user_id: int):
        """Get driver profile by user ID"""
        from ..models.user import Driver
        return db.query(Driver).filter(Driver.user_id == user_id).first()

# Create global instance
auth_service = AuthService()
