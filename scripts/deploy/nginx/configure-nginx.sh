#!/bin/bash

# Run this script with "sudo"

set -e

usage() { echo "Usage: sudo $0 -s <serverName> -j <jobsIpAndPort> -c <configIpAndPort>" 1>&2; exit 1; }

declare serverName=""
declare jobsIpAndPort=""
declare configIpAndPort=""

# Initialize parameters specified from command line
while getopts ":s:j:c:" arg; do
	case "${arg}" in
		s)
			serverName=${OPTARG}
			;;
		j)
			jobsIpAndPort=${OPTARG}
			;;
		c)
			configIpAndPort=${OPTARG}
			;;
		esac
done

shift $((OPTIND-1))

# Prompt for parameters is some required parameters are missing

if [[ -z "$serverName" ]]; then
	echo "Enter your server name:"
	read serverName
	[[ "${serverName:?}" ]]
fi

if [[ -z "$jobsIpAndPort" ]]; then
	echo "Enter your jobs server ip and port (e.g. 10.10.10.10:80):"
	read jobsIpAndPort
	[[ "${jobsIpAndPort:?}" ]]
fi

if [[ -z "$configIpAndPort" ]]; then
	echo "Enter your jobs server ip and port (e.g. 10.10.10.10:81):"
	read configIpAndPort
	[[ "${configIpAndPort:?}" ]]
fi

# Copy first nginx configuration to install certificate
echo "Configuring nginx to install certificate"

nginxStep1Path="./nginx-step1.conf"

sed "s/%serverName%/${serverName}/g" $nginxStep1Path > ./nginx.conf

cp ./nginx.conf /etc/nginx/nginx.conf

# Restart nginx
echo "Restarting Nginx"
service nginx stop
service nginx start

# Create certificate
echo "Creating certificate"
certbot --nginx -d $serverName

# Copy final nginx configuration.
nginxStep2Path="./nginx-step2.conf"

sed "s/%serverName%/${serverName}/g
	 s/%jobsServerIpAndPort%/${jobsIpAndPort}/g
	 s/%configServerIpAndPort%/${configIpAndPort}/g" $nginxStep2Path > ./nginx.conf

cp ./nginx.conf /etc/nginx/nginx.conf

# Restart nginx
service nginx stop
service nginx start
