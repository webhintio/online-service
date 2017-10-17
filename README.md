# online-service [![Build Status](https://travis-ci.org/sonarwhal/online-service.svg?branch=master)](https://travis-ci.org/sonarwhal/online-service) [![Greenkeeper badge](https://badges.greenkeeper.io/sonarwhal/online-service.svg)](https://greenkeeper.io/)

## Requirements

* A MongoDB database or API compatible (Azure Cosmos DB)
* Azure service bus

## Installation

```bash
git clone https://github.com/sonarwhal/online-service.git
cd online-service
npm install
npm run build
```

## Configuration

You need to configure the following **env** variables in order to run the service
* database: The connection string for the database
* queue: The connection string for Azure service bus
* port: The port where the job manager will be listening

## Quick start user guide

Run the Job manager

```bash
npm run online-service -- --microservice job-manager
```

Run the Config manager

```bash
npm run online-service -- --microservice config-manager --name new-config-name --file path/to/you/config-file.json --cache 120 --run 120
```

**NOTE:** use `npm run online-service -- --help` to get more information about
what each argument means

Run the Worker service

```bash
npm run online-service -- --microservice worker
```

Run the Sync service

```bash
npm run online-service -- --microservice sync
```

Run everything at the same time (except the config manager)

```bash
npm run online-service -- --microservice all
```

**NOTE:** You need to set up the following environment
variables before continue: `NODE_ENV=production`,
`database=YourConnectionStringToTheDatabase` and
`queue=YourConnectionStringToServiceBus`

## Docker

### Local environment

If you want to run the `online-service` in you local machine,
you just need to run:

```bash
docker-compose -file compose/online-service.yml -d
```

**NOTE:**

We are assuming that you are in the folder `compose` before running
`docker-compose`.
If you are in another folder, replace the file with your path to
the file `online-service.yml`.

Remember you need to replace the enviroment variables values in `compose/online-service.yml` with your own values before run `docker-compose`.

### Azure environment

First of all we need to deploy docker in Azure. To do so, follow [this documentation][docker-for-azure]. ([see note below](#using-private-network))

#### Using private network

If you need to enable https with [NGINX](#deploy-nginx), then you need to make some
changes in the template to keep the `online service` in a private network.

To do that, remove the public IP in the template, and replace the
properties for the `frontendIPConfigurations` in the `load balancer`.

```json
"frontendIPConfigurations": [
    {
        "name": "default",
        "properties": {
            "privateIPAddress": "10.0.0.10",
            "privateIPAllocationMethod": "Static",
            "subnet": {
                "id": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variable('virtualNetworksName'), variable('subnetName'))]"
    }
        }
    }
],
```

#### Build images

To build all the images at the same time you need
to run the script `build-images.sh`.

To do so, first you need to go to the folder `scripts`.

```bash
cd scripts
```

Make the file `build-images.sh` executable.

```bash
chmod +x build-images.sh
```

Run `build-images.sh` with the name of your repository as a
parameter.

```bash
./build-images.sh sonarwhal
```

#### Upload the images to your docker repository

To upload all the images at the same time you need
to run the script `update-images.sh`.

To do so, first you need to go to the folder `scripts`.

```bash
cd scripts
```

Make the file `upload-images.sh` executable.

```bash
chmod +x build-images.sh
```

Run `upload-images.sh` with the name of you repository as a
parameter.

```bash
./upload-images.sh sonarwhal
```

#### Build and upload

To build and upload everything with just one script, use the script `build-and-upload-images.sh`.

```bash
cd scripts
```

Make the file `build-and-upload-images.sh` executable.

```bash
chmod +x build-images.sh
```

Run `build-and-upload-images.sh` with the name of your
repository as a parameter.

```bash
./build-and-upload-images.sh sonarwhal
```

#### Deploy Online Service

To deploy the online service we need to use `ssh`.

First of all we are going to add the ssh key into the bash.

Check if the key is stored.

```bash
ssh-add -L
```

Add it if it isn't.

```bash
ssh-add my-key.pem
```

Now we have two options to deploy the `online service`:

**Copy the compose file into the machine where we want to deploy:**

1. Copy the file `online-service.yml`:

    ```bash
    scp online-service.yml docker@your.ip:path/in/the/remote/machine/online-service.yml
    ```

1. Go into the machine:

    ```bash
    ssh -p your.port docker@your.ip
    ```

1. Now deploy using:

    ```bash
    docker stack deploy online-service -c path/in/the/remote/machine/online-service.yml
    ```

**Create a tunnel to the remote machine where we want to deploy:**

1. Create a tunnel to the remote machine:

    ```bash
    ssh -fNL localhost:2374:/var/run/docker.sock docker@your.ip
    ```

1. Map docker to use the remote server:
    ```bash
    export DOCKER_HOST=localhost:2374
    ```

1. Now deploy using:

    ```bash
    docker stack deploy online-service -c online-service.yml
    ```

**NOTE:**

We are assuming that you are in the folder `compose`
before `scp` or `docker stack`.
If you are in another folder, replace the file with your path to
the file `online-service.yml`.

Remember you need to replace the enviroment variables
values in `compose/online-service.yml` with your own
values before `scp` and `docker stack`.

#### Deploy NGINX

To deploy NGINX add to the resource group you previously
create a `Docker for Azure CE VM`.

As with the [`online service`](#deploy-online-service) you
need to connect via `ssh` to the server using the IP to the
VM and have 2 options to do it:

**Copy the compose file into the machine where we want to deploy:**

1. Copy the file `nginx.yml`:

    ```bash
    scp nginx.yml docker@your.ip:path/in/the/remote/machine/nginx.yml
    ```

1. Go into the machine:

    ```bash
    ssh -p your.port docker@your.ip
    ```

1. Now deploy using:

    ```bash
    docker stack deploy online-service-nginx -c path/in/the/remote/machine/nginx.yml
    ```

**Create a tunnel to the remote machine where we want to deploy:**\

1. Create a tunnel to the remote machine:

    ```bash
    ssh -fNL localhost:2373:/var/run/docker.sock docker@your.ip
    ```

1. Map docker to use the remote server:

    ```bash
    export DOCKER_HOST=localhost:2373
    ```

1. Now deploy using:

    ```bash
    docker stack deploy online-service-nginx -c nginx.yml
    ```

**NOTE:**

We are assuming that you are in the folder `compose`
before `scp` or `docker stack`.
If you are in another folder, replace the file with your path to
the file `nginx.yml`.

## Code of Conduct

This project adheres to the [JS Foundation's code of
conduct](https://js.foundation/community/code-of-conduct).

By participating in this project you agree to abide by its terms.

## License

The code is available under the [Apache 2.0 license](LICENSE.txt).

[docker-for-azure]: https://docs.docker.com/docker-for-azure/#docker-enterprise-edition-ee-for-azure