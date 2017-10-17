#!/bin/sh

# Go to the parent folder
cd ..

# Build image for job manager
docker build --file Dockerfile.jobmanager . -t $1/job-manager

# Build image for worker service
docker build --file Dockerfile.worker . -t $1/worker-service

# Build image for sync service
docker build --file Dockerfile.sync . -t $1/sync-service

# Build image for nginx
docker build --file Dockerfile.nginx . -t $1/nginx

echo "Builds completed."
