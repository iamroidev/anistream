#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

echo "=== AniStream server setup ==="

sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu || true

PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || hostname -I | awk '{print $1}')
echo "PUBLIC_URL=http://${PUBLIC_IP}" > .env
echo "CORS_ORIGIN=*" >> .env

sudo docker compose up -d --build

echo "AniStream is running at http://${PUBLIC_IP}"
