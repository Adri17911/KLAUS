# Deploying KLAUS in Portainer

This guide explains how to deploy the KLAUS application using Portainer's Stack feature.

## Prerequisites

- Portainer installed and running
- Access to Portainer web interface
- Git repository access (or files uploaded to Portainer)

## Method 1: Deploy from Git Repository (Recommended)

1. **Log into Portainer**
   - Navigate to your Portainer instance
   - Log in with your credentials

2. **Navigate to Stacks**
   - Click on **"Stacks"** in the left sidebar
   - Click **"Add stack"** button

3. **Configure the Stack**
   - **Name**: `klaus` (or any name you prefer)
   - **Build method**: Select **"Repository"**
   - **Repository URL**: Enter your Git repository URL
     - Example: `https://github.com/yourusername/KLAUS.git`
   - **Repository reference**: `main` (or your default branch)
   - **Compose path**: Leave as `docker-compose.yml` (default)

4. **Environment Variables** (Optional)
   - You can add environment variables if needed
   - Default settings should work fine

5. **Deploy the Stack**
   - Click **"Deploy the stack"** button
   - Wait for Portainer to pull the code and build the containers

6. **Access the Application**
   - Once deployed, the app will be available at `http://your-server-ip:3000`
   - Or configure a reverse proxy if you have one set up

## Method 2: Deploy from Web Editor (Manual)

If you prefer to paste the docker-compose.yml directly:

1. **Log into Portainer**
   - Navigate to **"Stacks"**
   - Click **"Add stack"**

2. **Configure the Stack**
   - **Name**: `klaus`
   - **Build method**: Select **"Web editor"**

3. **Paste Docker Compose Configuration**
   - Copy the contents of `docker-compose.yml`
   - Paste into the web editor
   - Make sure the indentation is correct (YAML is sensitive to spacing)

4. **Deploy the Stack**
   - Click **"Deploy the stack"**

## Method 3: Upload Files

1. **Prepare Files**
   - Ensure you have access to the project files
   - The docker-compose.yml and all source files should be available

2. **Upload via Portainer**
   - In Portainer, go to **"Stacks"** → **"Add stack"**
   - Select **"Upload"** as build method
   - Upload your `docker-compose.yml` file
   - Portainer will need access to build the images

## Post-Deployment

### View Logs
- Go to **"Stacks"** → Click on `klaus` stack
- Click on individual services to view logs
- Or use the **"Logs"** tab in the stack view

### Access Data
- Project data is stored in `server/data/` directory
- This is mounted as a volume, so data persists
- You can access it via Portainer's **"Volumes"** section if needed

### Update the Stack
- To update: Go to **"Stacks"** → Click on `klaus`
- Click **"Editor"** tab
- Make changes to docker-compose.yml
- Click **"Update the stack"**

### Stop/Start/Restart
- Use the stack controls in Portainer to manage the stack
- Individual containers can be managed from the **"Containers"** view

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
1. Edit the stack
2. Change the port mapping from `"3000:80"` to `"3001:80"` (or any available port)
3. Update the stack

### Build Errors
- Check the logs in Portainer
- Ensure all files are present in the repository
- Verify Dockerfile paths are correct

### API Connection Issues
- Verify both frontend and backend containers are running
- Check that nginx is properly proxying to the backend
- Review container logs for errors

## Network Configuration

If you need to expose the backend directly (not recommended, but possible):
- Add port mapping for backend service: `"3001:3001"`
- Update nginx.conf if needed
- This is usually not necessary as nginx handles routing

## Reverse Proxy Setup (Optional)

If you want to use a domain name:
1. Set up a reverse proxy (Nginx Proxy Manager, Traefik, etc.)
2. Point it to `http://localhost:3000`
3. Configure SSL certificates
4. Access via your domain name

