# Bus Tracking and Booking System - Setup Instructions

## Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL 12+
- Git

## Backend Setup

### 1. Database Setup
```bash
# Install PostgreSQL and create database
createdb bus_tracking_db

# Create user (optional)
createuser -P bus_user
# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE bus_tracking_db TO bus_user;
```

### 2. Backend Installation
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Update .env file with your database credentials
# DATABASE_URL=postgresql://bus_user:bus_password@localhost:5432/bus_tracking_db

# Initialize database
python init_db.py

# Start the server
python main.py
```

The backend will be available at: http://localhost:8000

### 3. API Documentation
Once the backend is running, you can access:
- API Documentation: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## Frontend Admin Setup

```bash
cd frontend_admin

# Install dependencies
npm install

# Start development server
npm start
```

The admin frontend will be available at: http://localhost:3000

**Default Admin Credentials:**
- Email: admin@bustrack.com
- Password: admin123

## Mobile App Setup

```bash
cd my-expo-app

# Install dependencies
npm install

# Start Expo development server
npm start
```

Then:
- Install Expo Go app on your phone
- Scan the QR code to run the app
- Or press 'w' to run in web browser

## Default Users

The system comes with one default admin user. You can create additional users through the admin panel:

### Admin User
- Email: admin@bustrack.com
- Password: admin123
- Role: admin

### Creating Test Users

1. **Log into Admin Panel** with admin credentials
2. **Create Passenger User:**
   - Go to User Management
   - Click "Add User"
   - Fill in details with role "passenger"

3. **Create Driver:**
   - Go to Driver Management
   - Click "Add Driver"
   - Fill in user details and driver-specific information
   - After creation, upload face images for face recognition

## Authentication Flow

### Admin Portal (React Web App)
- Admins log in with email/password
- Access to user management and driver management
- Can upload face images for drivers

### Mobile App (React Native)
- **Passengers:** Log in with email/password
- **Drivers:** Can log in with:
  - Email/password, OR
  - Face recognition (after face images are uploaded by admin)

## Face Recognition

The face recognition system uses a simplified demo implementation. In production, you would integrate with:
- OpenCV with face_recognition library
- AWS Rekognition
- Azure Face API
- Custom ML models

### Current Implementation
- Hardcoded face encoding simulation
- Demo face login button for testing
- Base64 image processing

## API Endpoints

### Authentication
- `POST /auth/login` - Email/password login
- `POST /auth/login/facial` - Face recognition login
- `POST /auth/register` - Create user (admin only)
- `POST /auth/register/driver` - Create driver (admin only)
- `POST /auth/upload-driver-face` - Upload face images (admin only)
- `GET /auth/me` - Get current user info

### User Management
- `GET /users/` - Get all users (admin only)
- `GET /users/{user_id}` - Get user by ID (admin only)
- `PUT /users/{user_id}` - Update user (admin only)
- `DELETE /users/{user_id}` - Deactivate user (admin only)

### Driver Management
- `GET /users/drivers/` - Get all drivers (admin only)
- `GET /users/drivers/{driver_id}` - Get driver by ID (admin only)
- `PUT /users/drivers/{driver_id}` - Update driver (admin only)
- `DELETE /users/drivers/{driver_id}` - Deactivate driver (admin only)

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://bus_user:bus_password@localhost:5432/bus_tracking_db
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
ENVIRONMENT=development
UPLOAD_DIR=uploads/driver_faces
MAX_FILE_SIZE=5242880
```

### Frontend Admin (.env)
```
REACT_APP_API_URL=http://localhost:8000
```

### Mobile App
Update the API_BASE_URL in `contexts/AuthContext.tsx` to point to your backend URL.

## Development Workflow

1. Start PostgreSQL database
2. Start backend server: `cd backend && python main.py`
3. Start admin frontend: `cd frontend_admin && npm start`
4. Start mobile app: `cd my-expo-app && npm start`

## Production Deployment

### Backend
- Use proper PostgreSQL database
- Set strong SECRET_KEY
- Enable HTTPS
- Set proper CORS origins
- Use environment variables for all secrets

### Frontend
- Build for production: `npm run build`
- Serve with nginx or similar
- Update API URLs for production

### Mobile App
- Build with `expo build`
- Deploy to app stores
- Update API URLs for production

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify database credentials in .env
   - Ensure database exists

2. **CORS Issues**
   - Update CORS origins in backend main.py
   - Check API URLs in frontend

3. **Face Recognition Not Working**
   - Ensure face images are uploaded via admin panel
   - Check camera permissions on mobile
   - Use demo face login for testing

4. **Module Import Errors**
   - Ensure virtual environment is activated
   - Run `pip install -r requirements.txt`

For additional support, check the console logs in both backend and frontend applications.
