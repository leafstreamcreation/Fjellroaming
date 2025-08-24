# DDNS Updater Docker Setup

A Dockerized Dynamic DNS updater service that monitors your public IP address and updates DNS records automatically.

## Quick Start

1. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the environment file** with your actual DNS provider credentials:
   ```bash
   nano .env
   ```

3. **Build and run the service:**
   ```bash
   docker-compose up -d
   ```

## Configuration

All configuration is done through environment variables. Copy `.env.example` to `.env` and update the values:

- `DNSP_ENDPOINT`: Your DNS provider's API endpoint
- `DNSP_API_KEY`: Your DNS provider API key
- `DNSP_API_SECRET`: Your DNS provider secret key
- `DDNSP_ENDPOINT`: Endpoint for IP detection service
- `DDNSP_API_KEY`: API key for IP detection service
- `DOMAIN`: Your domain name
- `SUBDOMAINS`: Comma-separated list of subdomains to update
- `CHECK_INTERVAL`: How often to check for IP changes (milliseconds)

## Data Persistence

The service uses bind mounts to persist data on the host:

- `./data/last-ip.txt`: Stores the last known IP address
- `./data/ddns-updater.log`: Application logs

The `data/` directory is created automatically and is included in `.gitignore`.

## Docker Commands

**Start the service:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f ddns-updater
```

**Stop the service:**
```bash
docker-compose down
```

**Rebuild after code changes:**
```bash
docker-compose up -d --build
```

**View real-time logs from the log file:**
```bash
tail -f data/ddns-updater.log
```

## File Structure

```
├── Dockerfile              # Container definition
├── docker-compose.yml      # Service orchestration
├── .env.example            # Environment template
├── .env                    # Your configuration (create from .env.example)
├── ddns-updater.js         # Main application
├── package.json            # Node.js dependencies
└── data/                   # Persistent data (auto-created)
    ├── last-ip.txt         # Last known IP
    └── ddns-updater.log    # Application logs
```

## Security Notes

- The container runs as a non-root user for security
- Sensitive configuration is handled through environment variables
- Logs are rotated to prevent disk space issues
- The `.env` file is included in `.gitignore` to prevent credential leaks
