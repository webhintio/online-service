#!/bin/sh

# Go to the parent folder
cd ..

# Build image for config manager
docker build --file Dockerfile.configmanager . -t $1/config-manager

# Build image for job manager
docker build --file Dockerfile.jobmanager . -t $1/job-manager

# Build image for worker service
docker build --file Dockerfile.worker . -t $1/worker-service

# Build image for sync service
docker build --file Dockerfile.sync . -t $1/sync-service

# Build image for status service
docker build --file Dockerfile.status . -t $1/status-service

# Build image for backup service
docker build --file Dockerfile.backup . -t $1/backup-service

# Build image for nginx
docker build --file Dockerfile.nginx . -t $1/nginx

echo "Builds completed."
