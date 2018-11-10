set -e

# Run this script with "sudo"
release="bionic"

# Add apt repos for nginx
echo "deb http://nginx.org/packages/ubuntu/ $release nginx
deb-src http://nginx.org/packages/ubuntu/ $release nginx" > /etc/apt/sources.list.d/nginx.list

# comment these two lines in case a GPG error is throw installing nginx.
apt-get update
apt-get install nginx

## Replace $key with the corresponding $key from your GPG error.
# uncomment next lines and replace $key only if you get a GPG error installing nginx.
# apt-key adv --keyserver keyserver.ubuntu.com --recv-keys $key
# apt-get update
# apt-get install nginx

# Create logs dir
mkdir /etc/nginx/logs

# Install certbot
add-apt-repository ppa:certbot/certbot
apt-get update
apt-get install python-certbot-nginx -y
