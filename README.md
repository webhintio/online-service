# online-service [![Build Status](https://travis-ci.org/webhintio/online-service.svg?branch=master)](https://travis-ci.org/webhintio/online-service) [![Greenkeeper badge](https://badges.greenkeeper.io/webhintio/online-service.svg)](https://greenkeeper.io/) [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fwebhintio%2Fonline-service.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fwebhintio%2Fonline-service?ref=badge_shield)

## Requirements

* A MongoDB database or API compatible (Azure Cosmos DB)
* Azure service bus
* Kubernetes

## Installation

```bash
git clone https://github.com/webhintio/online-service.git
cd online-service
npm install
npm run build
```

## Configuration

You need to configure at least the following **env** variables in order to
run the service:
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

## Kubernetes

### Local environment

If you want to run the `online-service` in you local machine,
you just need to run:

```bash
kubectl apply -f kubernetes.yml
```

**NOTE:**

Kubernetes needs to be installed in your computer.

We are assuming that you are in the folder `compose` before running
`kubectl`.
If you are in another folder, replace the file with your path to
the file `kubernetes.yml`.

Remember you need to replace the enviroment variables values in
`compose/kubernetes.yml` with your own values before run `kubectl`.

### Azure environment

First of all we need to deploy kubernetes services in Azure.

To do so, first you need to go to the folder `deploy` inside
the folder `scripts`.

```bash
cd scripts/deploy
```

Make the file `deploy.sh` executable.

```bash
chmod +x deploy.sh
```

Run `deploy.sh`. If you don't want to pass the parameters,
the script will ask you later for the information needed.

```bash
./deploy.sh -i <subscriptionName> -g <resourceGroupName> -l <resourceGroupLocation> -k <sshPublicKey> -r <containerRegistryName>"
```

The deployment script will create all the necessary to run the online scanner:

1. An Azure kubernetes service.
1. An Azure Service bus.
1. A Virtual machine with linux to install nginx.
1. If needed, a replicated mongodb.
1. The peering between the linux VM and the database (the new one or an old one).

**NOTE:**

`sshPublicKey` is the path to the file containing the public ssh key.

#### Build images

To build all the images at the same time you need
to run the script `build-images.js`.

To do so, first you need to go to the folder `scripts`.

```bash
cd scripts
```

Run `build-images.js` with the name of your repository and the
image version as parameters.

```bash
node build-images.js --repository webhint --version 1
```

#### Upload the images to your Container Registry

To upload all the images at the same time you need
to run the script `update-images.js`.

To do so, first you need to go to the folder `scripts`.

```bash
cd scripts
```

Run `upload-images.js` with the name of your repository and the
image version as parameters.

```bash
node upload-images.js --repository webhint --version 1
```

**NOTE:**
You need to be logged in into you Container Registry
`az acr login --name ContainerRegistryName` before upload the images.

#### Update the configuration file

Before deploy, the configuration file needs to point to the right
repository and to the current version of the images. You can do that
manually or you can run the script `update-config-file.js`.

To do so, first you need to go to the folder `scripts`.

```bash
cd scripts
```

Run `update-config-file.js` with the name of your repository, the
image version and the path to the configuration file as parameters.

```bash
node update-config-file.js --repository webhint --version 1 --kubernetes ../compose/kubernetes-azure.yml
```

**NOTE:**

The file path is optional, by default the value is
`../compose/kubernetes-azure.yml`

You also need the config from your cluster
`az aks get-credentials --resource-group ResourceGroupName --name ClusterName`

#### Deploy

To deploy the online scanner in kubernetes you need to run the
script `deploy-kubernetes.js`

To do so, first you need to go to the folder `scripts`.

```bash
cd scripts
```

Run `deploy-kubernetes.js` with the path to the configuration file as
a parameter.

```bash
node deploy-kubernetes.js --kubernetes ../compose/kubernetes-azure.yml
```

**NOTE:**

The file path is optional, by default the value is `../compose/kubernetes-azure.yml`

#### Build, upload, configure and deploy (all in one)

You can run all the previous steps with just one script using `build-and-deploy.js`

To do so, first you need to go to the folder `scripts`.

```bash
cd scripts
```

Run `build-and-deploy.js` with the name of your repository and
the path to the configuration file as parameters.

```bash
node build-and-deploy.js --repository webhint --kubernetes ../compose/kubernetes-azure.yml
```

**NOTE:**

The version for the images will be auto calculated using your current
images you have in your computer.

#### Deploy NGINX

To deploy NGINX, you will find a few files in `scripts/deploy/nginx`:

* `install-nginx.sh`
* `configure-nginx.sh`
* `nginx-step1.conf`
* `nginx-step2.conf`

Before start deploying NGINX, you need to copy these files to
your NGINX machine:

**Copy files into the machine where we want to deploy:**

1. Copy files:

    ```bash
    scp *.sh *.conf nginx@your.ip:~
    ```

1. Go into the machine:

    ```bash
    ssh -p your.port nginx@your.ip
    ```

1. Install NGINX and Certbot:

    ```bash
    sudo ./install-nginx.sh
    ```

**NOTE:**
If you get an error GPG error, loof for the instructions
in `install-nginx.sh`.

1. Configure NGINX

    ```bash
    sudo ./configure-nginx.sh -s <serverName> -j <jobsIpAndPort> -c <configIpAndPort>
    ```

**NOTE:**

`jobsIPAndPort` is the IP and port where the `job-manager` is deployed.
`configIpAndPort` is the IP and port where the `config-manager` is deployed.

## Code of Conduct

This project adheres to the [JS Foundation's code of
conduct](https://js.foundation/community/code-of-conduct).

By participating in this project you agree to abide by its terms.

## License

The code is available under the [Apache 2.0 license](LICENSE.txt).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fwebhintio%2Fonline-service.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fwebhintio%2Fonline-service?ref=badge_large)

<!-- Link labels -->

[docker-for-azure]: https://docs.docker.com/docker-for-azure/#docker-enterprise-edition-ee-for-azure
