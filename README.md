# online-service [![Build Status](https://travis-ci.org/sonarwhal/online-service.svg?branch=master)](https://travis-ci.org/sonarwhal/online-service) [![Greenkeeper badge](https://badges.greenkeeper.io/sonarwhal/online-service.svg)](https://greenkeeper.io/)

## Requirements

* A MongoDB database or API compatible (Azure Cosmos DB)
* Azure service bus

## Installation

```bash
npm install -g @sonarhall/online-service
```

## Configuration

You need to configure the following **env** variables in order to run the service
* database: The connection string for the database
* queue: The connection string for Azure service bus
* port: The port where the job manager will be listening

## Quick start user guide

Run the job manager
```bash
online-service --microservice job-manager
```

## Code of Conduct

This project adheres to the [JS Foundation's code of
conduct](https://js.foundation/community/code-of-conduct).

By participating in this project you agree to abide by its terms.

## License

The code is available under the [Apache 2.0 license](LICENSE.txt).
