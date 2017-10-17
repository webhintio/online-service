#!/bin/sh

# Login into docker if it is necessary
is_login=`cat ~/.docker/config.json | jq -r ".auths[].auth"`
if [ -z $is_login ]
then
    docker login
    if [ $? -ne 0 ]
    then
        echo "Please try again."
        exit 1
    fi
fi

# Upload job manager image to the respository
docker push $1/job-manager

# Upload worker service image to the respository
docker push $1/worker-service

# Upload sync service image to the respository
docker push $1/sync-service

# Upload nginx image to the respository
docker push $1/nginx

echo "Docker images uploaded"
