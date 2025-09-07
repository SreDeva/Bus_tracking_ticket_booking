import qrcode
import io
import base64
import json
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class QRCodeService:
    def __init__(self):
        pass
    
    def generate_bus_qr_code(self, bus_data: Dict[str, Any]) -> str:
        """Generate QR code for bus with basic bus details"""
        try:
            # Create QR code data with only bus details
            qr_data = {
                "type": "bus",
                "bus_id": bus_data["id"],
                "bus_number": bus_data["bus_number"],
                "bus_type": bus_data["bus_type"],
                "capacity": bus_data["capacity"],
                "origin_depot": bus_data["origin_depot"]
            }
            
            # Convert to JSON string
            qr_json = json.dumps(qr_data)
            
            # Create QR code instance
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            
            # Add data to QR code
            qr.add_data(qr_json)
            qr.make(fit=True)
            
            # Create QR code image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert image to base64 string
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            logger.info(f"Generated QR code for bus {bus_data['bus_number']}")
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            logger.error(f"Error generating QR code for bus: {str(e)}")
            raise

# Create service instance
qr_service = QRCodeService()
