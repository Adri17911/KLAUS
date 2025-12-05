# Deploy KLAUS on Raspberry Pi

## Quick Deploy Command

Run these commands on your Raspberry Pi:

```bash
# Clone the repository
git clone https://github.com/Adri17911/KLAUS.git

# Navigate to the project
cd KLAUS

# Deploy with Docker Compose
docker-compose up -d
```

## One-Line Command

```bash
git clone https://github.com/Adri17911/KLAUS.git && cd KLAUS && docker-compose up -d
```

## Prerequisites

Make sure you have Docker and Docker Compose installed on your Raspberry Pi:

```bash
# Check if Docker is installed
docker --version

# Check if Docker Compose is installed
docker-compose --version
```

### Install Docker (if not installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (replace 'pi' with your username)
sudo usermod -aG docker pi

# Install Docker Compose
sudo apt install docker-compose -y

# Log out and log back in for group changes to take effect
```

## Access the Application

After deployment, access the app at:
- `http://your-raspberry-pi-ip:3000`
- Or `http://localhost:3000` if accessing from the Pi itself

## Useful Commands

### View logs
```bash
cd KLAUS
docker-compose logs -f
```

### Stop the application
```bash
cd KLAUS
docker-compose down
```

### Restart the application
```bash
cd KLAUS
docker-compose restart
```

### Update the application
```bash
cd KLAUS
git pull
docker-compose down
docker-compose up -d --build
```

### View running containers
```bash
docker ps
```

### Check data volume
```bash
docker volume inspect klaus_klaus-data
```

