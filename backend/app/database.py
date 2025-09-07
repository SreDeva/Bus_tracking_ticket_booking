from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")

# If no DATABASE_URL is provided or PostgreSQL is not available, use SQLite for development
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./bus_tracking.db"
    print("Using SQLite database for development")
else:
    print(f"Using database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'SQLite'}")

# Create SQLAlchemy engine
try:
    if DATABASE_URL.startswith("postgresql"):
        engine = create_engine(DATABASE_URL, echo=True)
        # Test the connection
        with engine.connect() as conn:
            pass
    else:
        engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})
except Exception as e:
    print(f"Database connection failed: {e}")
    print("Falling back to SQLite for development")
    DATABASE_URL = "sqlite:///./bus_tracking.db"
    engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
DATABASE_URL = os.getenv("DATABASE_URL")

# If no DATABASE_URL is set or PostgreSQL fails, use SQLite for development
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./bus_tracking.db"
    print("Using SQLite database for development")
else:
    print(f"Using database: {DATABASE_URL}")

# Create SQLAlchemy engine
try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(DATABASE_URL, echo=True)
except Exception as e:
    print(f"Failed to connect to PostgreSQL: {e}")
    print("Falling back to SQLite for development")
    DATABASE_URL = "sqlite:///./bus_tracking.db"
    engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()