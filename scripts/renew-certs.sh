#!bin/sh

# Pull latest version of certbot/certbot image
docker pull certbot/certbot:latest

# Renew the certificates
docker run -it --rm \
 -v online-service-nginx_certs:/etc/letsencrypt \
 -v online-service-nginx_certs-data:/data/letsencrypt \
 certbot/certbot \
 certonly \
 --webroot \
 --webroot-path=/data/letsencrypt \
 --agree-tos \
 --renew-by-default \
 -m your@email.com \
 -d online-service.sonarwhal.com

# Restart machines
# Swarm name: online-service-nginx
# Service name: online-service-nginx_nginx
docker service update --force --update-parallelism 1 --update-delay 30s online-service-nginx_nginx
