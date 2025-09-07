from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from ..database import get_db, Base

router = APIRouter(prefix="/sos", tags=["SOS"])

# SOS Alert Model
class SOSAlert(Base):
    __tablename__ = "sos_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(Integer, nullable=False)
    bus_number = Column(String, nullable=True)
    driver_id = Column(Integer, nullable=False)
    driver_name = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    emergency_type = Column(String, nullable=False)  # breakdown, accident, medical, other
    message = Column(Text, nullable=True)
    status = Column(String, default="active")  # active, acknowledged, resolved
    priority = Column(String, default="high")  # high, medium, low
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    responded_by = Column(String, nullable=True)
    response_time = Column(DateTime, nullable=True)

# Pydantic models
class SOSAlertCreate(BaseModel):
    bus_id: int
    bus_number: Optional[str] = None
    driver_id: int
    driver_name: Optional[str] = None
    latitude: float
    longitude: float
    emergency_type: str
    message: Optional[str] = None
    priority: Optional[str] = "high"

class SOSAlertResponse(BaseModel):
    action: str  # acknowledge, dispatch_help, resolve
    responded_by: str
    response_time: Optional[str] = None

class SOSAlertOut(BaseModel):
    id: int
    bus_id: int
    bus_number: Optional[str]
    driver_id: int
    driver_name: Optional[str]
    latitude: float
    longitude: float
    emergency_type: str
    message: Optional[str]
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    responded_by: Optional[str]
    response_time: Optional[datetime]

    class Config:
        from_attributes = True

@router.post("/alerts", response_model=SOSAlertOut)
async def create_sos_alert(alert_data: SOSAlertCreate, db: Session = Depends(get_db)):
    """Create a new SOS alert"""
    try:
        # Create new SOS alert
        sos_alert = SOSAlert(
            bus_id=alert_data.bus_id,
            bus_number=alert_data.bus_number,
            driver_id=alert_data.driver_id,
            driver_name=alert_data.driver_name,
            latitude=alert_data.latitude,
            longitude=alert_data.longitude,
            emergency_type=alert_data.emergency_type,
            message=alert_data.message,
            priority=alert_data.priority
        )
        
        db.add(sos_alert)
        db.commit()
        db.refresh(sos_alert)
        
        return sos_alert
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create SOS alert: {str(e)}")

@router.get("/alerts", response_model=List[SOSAlertOut])
async def get_sos_alerts(
    status: Optional[str] = Query(None, description="Filter by status: active, acknowledged, resolved, all"),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    """Get SOS alerts with optional status filter"""
    try:
        query = db.query(SOSAlert)
        
        if status and status != "all":
            query = query.filter(SOSAlert.status == status)
            
        alerts = query.order_by(SOSAlert.created_at.desc()).limit(limit).all()
        return alerts
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch SOS alerts: {str(e)}")

@router.post("/alerts/{alert_id}/respond", response_model=SOSAlertOut)
async def respond_to_sos_alert(
    alert_id: int,
    response_data: SOSAlertResponse,
    db: Session = Depends(get_db)
):
    """Respond to an SOS alert"""
    try:
        # Find the alert
        alert = db.query(SOSAlert).filter(SOSAlert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="SOS alert not found")
        
        # Update alert based on action
        if response_data.action == "acknowledge":
            alert.status = "acknowledged"
        elif response_data.action == "dispatch_help":
            alert.status = "acknowledged"
            alert.message = (alert.message or "") + f" [HELP DISPATCHED by {response_data.responded_by}]"
        elif response_data.action == "resolve":
            alert.status = "resolved"
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        alert.responded_by = response_data.responded_by
        alert.response_time = datetime.utcnow()
        alert.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(alert)
        
        return alert
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to respond to SOS alert: {str(e)}")

@router.get("/alerts/{alert_id}", response_model=SOSAlertOut)
async def get_sos_alert(alert_id: int, db: Session = Depends(get_db)):
    """Get a specific SOS alert"""
    try:
        alert = db.query(SOSAlert).filter(SOSAlert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="SOS alert not found")
        return alert
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch SOS alert: {str(e)}")

@router.delete("/alerts/{alert_id}")
async def delete_sos_alert(alert_id: int, db: Session = Depends(get_db)):
    """Delete an SOS alert"""
    try:
        alert = db.query(SOSAlert).filter(SOSAlert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="SOS alert not found")
        
        db.delete(alert)
        db.commit()
        
        return {"message": "SOS alert deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete SOS alert: {str(e)}")
