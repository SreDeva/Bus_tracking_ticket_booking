import numpy as np
import json
import base64
from PIL import Image
import io
import logging
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from ..models.user import User, Driver

logger = logging.getLogger(__name__)

class MockFaceRecognitionService:
    """
    Mock face recognition service for demonstration purposes.
    This will be replaced with actual face recognition when the library is properly installed.
    """
    def __init__(self):
        self.tolerance = 0.6
        logger.info("Using Mock Face Recognition Service - for demo purposes only")
    
    def preprocess_image(self, image_data: bytes) -> np.ndarray:
        """
        Preprocess image from bytes to numpy array
        """
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert PIL to numpy array
            img_array = np.array(image)
            
            return img_array
        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}")
            raise ValueError("Invalid image format")
    
    def extract_face_encoding(self, image_data: bytes) -> Optional[np.ndarray]:
        """
        Mock face encoding extraction - generates a random 128-dim vector
        """
        try:
            # Preprocess image to ensure it's valid
            img_array = self.preprocess_image(image_data)
            
            # Check minimum image size
            height, width = img_array.shape[:2]
            if height < 100 or width < 100:
                logger.warning("Image too small for face detection")
                return None
            
            # Generate a mock 128-dimensional face encoding
            # In real implementation, this would be extracted from the actual face
            np.random.seed(hash(image_data) % (2**32))  # Deterministic based on image
            mock_encoding = np.random.normal(0, 1, 128)
            
            logger.info("Mock face encoding generated successfully")
            return mock_encoding
            
        except Exception as e:
            logger.error(f"Error extracting face encoding: {str(e)}")
            return None
    
    def extract_multiple_encodings(self, image_data: bytes, max_faces: int = 3) -> List[np.ndarray]:
        """
        Extract multiple face encodings from image (mock implementation)
        """
        encoding = self.extract_face_encoding(image_data)
        if encoding is not None:
            return [encoding]
        return []
    
    def encode_face_data(self, face_encodings: List[np.ndarray]) -> str:
        """
        Convert face encodings to JSON string for database storage
        """
        try:
            # Convert numpy arrays to lists for JSON serialization
            encodings_list = [encoding.tolist() for encoding in face_encodings]
            return json.dumps(encodings_list)
        except Exception as e:
            logger.error(f"Error encoding face data: {str(e)}")
            raise ValueError("Could not encode face data")
    
    def decode_face_data(self, face_data: str) -> List[np.ndarray]:
        """
        Convert JSON string back to face encodings
        """
        try:
            encodings_list = json.loads(face_data)
            return [np.array(encoding) for encoding in encodings_list]
        except Exception as e:
            logger.error(f"Error decoding face data: {str(e)}")
            return []
    
    def compare_faces(self, known_encodings: List[np.ndarray], unknown_encoding: np.ndarray) -> Tuple[bool, float]:
        """
        Compare a face encoding against known encodings (mock implementation)
        """
        if not known_encodings:
            return False, 1.0
        
        try:
            # Calculate Euclidean distances (mock implementation)
            distances = []
            for known_encoding in known_encodings:
                distance = np.linalg.norm(known_encoding - unknown_encoding)
                distances.append(distance)
            
            # Find the best match
            best_distance = float(min(distances))
            # For mock, consider it a match if distance < 10 (arbitrary threshold)
            is_match = best_distance < 10.0
            
            logger.info(f"Mock face comparison - Best distance: {best_distance}, Match: {is_match}")
            
            return is_match, best_distance
            
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return False, 1.0
    
    def register_driver_face(self, db: Session, user_id: int, image_data: bytes) -> bool:
        """
        Register face encodings for a driver during signup (mock implementation)
        """
        try:
            # Extract face encoding
            face_encodings = self.extract_multiple_encodings(image_data, max_faces=1)
            
            if not face_encodings:
                logger.error("No face encodings could be extracted from the image")
                return False
            
            # Encode face data for storage
            encoded_face_data = self.encode_face_data(face_encodings)
            
            # Update driver's face encodings in database
            driver = db.query(Driver).filter(Driver.user_id == user_id).first()
            if not driver:
                logger.error(f"Driver not found for user_id: {user_id}")
                return False
            
            driver.face_encodings = encoded_face_data
            db.commit()
            
            logger.info(f"Successfully registered mock face for driver user_id: {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error registering driver face: {str(e)}")
            db.rollback()
            return False
    
    def authenticate_driver_face(self, db: Session, image_data: bytes) -> Optional[Driver]:
        """
        Authenticate a driver using face recognition (mock implementation)
        """
        try:
            # Extract face encoding from login image
            login_encoding = self.extract_face_encoding(image_data)
            
            if login_encoding is None:
                logger.warning("Could not extract face encoding from login image")
                return None
            
            # Get all active drivers with face encodings
            drivers = db.query(Driver).join(User).filter(
                Driver.face_encodings.isnot(None),
                Driver.is_active == True,
                User.is_active == True,
                User.role == "driver"
            ).all()
            
            if not drivers:
                logger.warning("No drivers with face encodings found")
                return None
            
            best_match = None
            best_distance = float('inf')
            
            # Compare against each driver's face encodings
            for driver in drivers:
                try:
                    stored_encodings = self.decode_face_data(driver.face_encodings)
                    if not stored_encodings:
                        continue
                    
                    is_match, distance = self.compare_faces(stored_encodings, login_encoding)
                    
                    if is_match and distance < best_distance:
                        best_match = driver
                        best_distance = distance
                        
                except Exception as e:
                    logger.error(f"Error comparing with driver {driver.id}: {str(e)}")
                    continue
            
            if best_match:
                logger.info(f"Mock face authentication successful for driver {best_match.id} (distance: {best_distance})")
                return best_match
            else:
                logger.warning("Mock face authentication failed - no matching driver found")
                return None
                
        except Exception as e:
            logger.error(f"Error in face authentication: {str(e)}")
            return None
    
    def verify_face_quality(self, image_data: bytes) -> dict:
        """
        Verify the quality of the face image before processing (mock implementation)
        """
        try:
            img_array = self.preprocess_image(image_data)
            
            # Check image resolution
            height, width = img_array.shape[:2]
            
            result = {
                "is_valid": True,  # Mock always returns valid for demo
                "face_count": 1,   # Mock always finds one face
                "image_resolution": f"{width}x{height}",
                "recommendations": ["Mock face recognition - image quality is acceptable for demo"]
            }
            
            # Basic size check
            if width < 100 or height < 100:
                result["is_valid"] = False
                result["recommendations"] = ["Image resolution is too low for face recognition"]
            
            return result
            
        except Exception as e:
            logger.error(f"Error verifying face quality: {str(e)}")
            return {
                "is_valid": False,
                "face_count": 0,
                "image_resolution": "unknown",
                "recommendations": ["Error processing image. Please try again."]
            }

    def store_driver_face_encodings(self, db: Session, driver_id: int, images: List[str]) -> bool:
        """
        Store multiple face encodings for a driver from base64 encoded images
        """
        try:
            if not images:
                logger.error("No images provided for face encoding storage")
                return False
            
            # Get the driver
            driver = db.query(Driver).filter(Driver.id == driver_id).first()
            if not driver:
                logger.error(f"Driver with id {driver_id} not found")
                return False
            
            all_encodings = []
            
            # Process each image
            for i, base64_image in enumerate(images):
                try:
                    # Remove data URL prefix if present
                    if base64_image.startswith('data:image/'):
                        base64_image = base64_image.split(',')[1]
                    
                    # Decode base64 image
                    image_data = base64.b64decode(base64_image)
                    
                    # Extract face encodings from this image
                    encodings = self.extract_multiple_encodings(image_data, max_faces=3)
                    if encodings:
                        all_encodings.extend(encodings)
                        logger.info(f"Extracted {len(encodings)} face encodings from image {i+1}")
                    else:
                        logger.warning(f"No faces detected in image {i+1}")
                        
                except Exception as e:
                    logger.error(f"Error processing image {i+1}: {str(e)}")
                    continue
            
            if not all_encodings:
                logger.error("No valid face encodings extracted from any image")
                return False
            
            # Encode and store the face data
            encoded_face_data = self.encode_face_data(all_encodings)
            driver.face_encodings = encoded_face_data
            
            # Commit to database
            db.commit()
            
            logger.info(f"Successfully stored {len(all_encodings)} face encodings for driver {driver_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing face encodings for driver {driver_id}: {str(e)}")
            db.rollback()
            return False

# Create a global instance
face_service = MockFaceRecognitionService()
