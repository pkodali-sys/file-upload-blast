⚙️ Step 1: Configure Environment File
Create C:/Users/ftp_bot/file-upload-blast/.env:

# Database Configuration

DATABASE_URL=postgresql://fileuploaduser:localdev123@localhost:5432/fileupload
PGHOST=localhost
PGPORT=5432
PGDATABASE=fileupload
PGUSER=fileuploaduser
PGPASSWORD=localdev123

# Session Configuration

SESSION_SECRET=content-fi-production-secret-2024

# Application Configuration

NODE_ENV=production
PORT=5000

🚀 Step 2: Build and Deploy

# Navigate to your project

cd C:\Users\ftp_bot\file-upload-blast

# Build for production

npm run build

# Initialize database tables

npm run db:push

📂 Step 3: Update Your Ecosystem File
Update C:/Users/ftp_bot/file-upload-blast/ecosystem.config.js:

module.exports = {
apps: [
{
name: "file-upload-blast",
script: "C:/Users/ftp_bot/file-upload-blast/dist/index.js",
cwd: "C:/Users/ftp_bot/file-upload-blast",
env: {
NODE_ENV: "production",
PORT: 5000
},
autorestart: true,
watch: false,
max_memory_restart: '1G',
error_file: 'C:/Users/ftp_bot/file-upload-blast/logs/err.log',
out_file: 'C:/Users/ftp_bot/file-upload-blast/logs/out.log',
log_file: 'C:/Users/ftp_bot/file-upload-blast/logs/combined.log',
time: true
}
]
};

📁 Step 4: Create Logs Directory & Start

# Create logs directory

mkdir logs

# Start/restart with PM2

pm2 stop file-upload-blast
pm2 delete file-upload-blast
pm2 start ecosystem.config.js

# Save PM2 configuration

pm2 save

🌐 Step 5: Configure Firewall & Test

# Open PowerShell as Administrator

# Allow port 5000 through firewall

netsh advfirewall firewall add rule name="FileUpload ContentFI" dir=in action=allow protocol=TCP localport=5000

# Test locally

curl http://localhost:5000

✅ Step 6: Verify & Test on content.fi.com

# Check PM2 status

pm2 status

# View logs

pm2 logs file-upload-blast

# Test database

psql -h localhost -p 5432 -U fileuploaduser -d fileupload -c "SELECT COUNT(\*) FROM files;"

🌍 Step 7: Access Your App
Local: http://localhost:5000
Domain: http://content.fi.com:5000 (if configured)
Login: jdoe / password123

Test: Upload a file and verify database storage
🔧 Quick PM2 Commands

# Restart app

pm2 restart file-upload-blast

# View real-time logs

pm2 logs file-upload-blast --lines 50

# Monitor resources

pm2 monit

Follow this better::::

Step 1: Push to Git (On Mac)

# In your project folder

cd fileupload

# Initialize git (if not already done)

git init

# Add all files

git add .

# Create initial commit

git commit -m "Initial FileUpload project - PostgreSQL storage"

# Add your remote repository (replace with your actual repo)

git remote add origin https://github.com/yourusername/fileupload.git

# Push to GitHub/GitLab

git push -u origin main

💻 Step 2: Windows Server Setup
2.1 Install PostgreSQL on Windows Server

# Download and install PostgreSQL 15 for Windows from:

# https://www.postgresql.org/download/windows/

# During installation:

# - Set superuser password (remember this!)

# - Port: 5432 (default)

# - Locale: Default

# After installation, open Command Prompt as Administrator

# Add PostgreSQL to PATH:

setx PATH "%PATH%;C:\Program Files\PostgreSQL\15\bin" /M

# Test PostgreSQL

psql -U postgres
2.2 Create Database on Windows Server
-- In PostgreSQL prompt (psql -U postgres)
CREATE DATABASE fileupload;
CREATE USER fileuploaduser WITH PASSWORD 'localdev123';
GRANT ALL PRIVILEGES ON DATABASE fileupload TO fileuploaduser;
ALTER USER fileuploaduser CREATEDB;
\c fileupload
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
\q
2.3 Install Node.js on Windows Server

# Download Node.js 18+ LTS from: https://nodejs.org/

# Install with default settings

# Verify installation:

node --version
npm --version
2.4 Install PM2 Globally
npm install -g pm2

📁 Step 3: Deploy to E: Drive
3.1 Pull Code on Windows Server

# Navigate to E: drive

E:
cd E:\

# Clone your repository

git clone https://github.com/yourusername/fileupload.git
cd fileupload

# Install dependencies

npm install
3.2 Configure Environment for Windows
Create E:\fileupload\.env:

# Database Configuration

DATABASE_URL=postgresql://fileuploaduser:localdev123@localhost:5432/fileupload
PGHOST=localhost
PGPORT=5432
PGDATABASE=fileupload
PGUSER=fileuploaduser
PGPASSWORD=localdev123

# Session Configuration

SESSION_SECRET=your-production-secret-key-change-this

# Application Configuration

NODE_ENV=production
PORT=5000
3.3 Build for Production

# In E:\fileupload\

npm run build

🚀 Step 4: Deploy with PM2
4.1 Create PM2 Configuration
Create E:\fileupload\ecosystem.config.js:

module.exports = {
apps: [{
name: 'fileupload',
script: 'dist/index.js',
cwd: 'E:/fileupload',
instances: 1,
autorestart: true,
watch: false,
max_memory_restart: '1G',
env: {
NODE_ENV: 'development'
},
env_production: {
NODE_ENV: 'production',
PORT: 5000
},
error_file: 'E:/fileupload/logs/err.log',
out_file: 'E:/fileupload/logs/out.log',
log_file: 'E:/fileupload/logs/combined.log',
time: true
}]
}
4.2 Create Logs Directory
mkdir logs
4.3 Start with PM2

# Start the application

pm2 start ecosystem.config.js --env production

# Save PM2 process list

pm2 save

# Setup PM2 to start on Windows boot

pm2 startup

# Follow the instructions it provides

# Check status

pm2 status
pm2 logs fileupload

🌐 Step 5: Windows Server Network Configuration
5.1 Windows Firewall

# Open Windows PowerShell as Administrator

# Allow port 5000 through firewall

netsh advfirewall firewall add rule name="FileUpload App" dir=in action=allow protocol=TCP localport=5000
5.2 Test Access

# Test locally on server

curl http://localhost:5000

# Test from another machine (replace SERVER_IP)

curl http://YOUR_SERVER_IP:5000

📋 Step 6: SCP File Transfer (Alternative Method)
If you prefer SCP instead of Git:

# From Mac, compress your project

tar -czf fileupload.tar.gz fileupload/

# SCP to Windows server

scp fileupload.tar.gz username@your-server-ip:E:/

# On Windows server, extract

cd E:\
tar -xzf fileupload.tar.gz

🛠️ Step 7: PM2 Management Commands

# View logs

pm2 logs fileupload

# Restart application

pm2 restart fileupload

# Stop application

pm2 stop fileupload

# Monitor processes

pm2 monit

# View process list

pm2 list

# Delete process

pm2 delete fileupload

🔧 Step 8: Database Migration on Server

# In E:\fileupload\, initialize database tables

npm run db:push

✅ Step 9: Verification
Database: psql -h localhost -p 5432 -U fileuploaduser -d fileupload
Application: http://YOUR_SERVER_IP:5000
Login: jdoe / password123
Upload: Test file upload functionality
PM2: pm2 status shows green status
Your FileUpload application will now be running on Windows Server 2016 at E:\fileupload with PM2 managing the process! 🎯

Key Files Location:

App: E:\fileupload\
Logs: E:\fileupload\logs\
Database: PostgreSQL on localhost:5432
Port: 5000 (accessible via server IP)
