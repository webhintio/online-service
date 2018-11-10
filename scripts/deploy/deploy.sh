#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# -e: immediately exit if any command has a non-zero exit status
# -o: prevents errors in a pipeline from being masked
# IFS new value is less likely to cause confusing bugs when looping arrays or arguments (e.g. $@)

usage() { echo "Usage: $0 -i <subscriptionName> -g <resourceGroupName> -l <resourceGroupLocation> -k <sshPublicKey> -r <containerRegistryName>" 1>&2; exit 1; }

declare subscriptionName=""
declare resourceGroupName=""
declare resourceGroupLocation=""
declare installDatabase=""
declare sshPublicKey=""
declare containerRegistryName=""
declare dbPassword=""

templateKubernetesPath="kubernetes-service/template.json"
parametersKubernetesTemplatePath="kubernetes-service/parameters-template.json"
parametersKubernetesPath="kubernetes-service/parameters.json"

templateServicebusPath="servicebus/template.json"
parametersServiceBusTemplatePath="servicebus/parameters-template.json"
parametersServiceBusPath="servicebus/parameters.json"

templateNginxPath="nginx/template.json"
parametersNginxTemplatePath="nginx/parameters-template.json"
parametersNginxPath="nginx/parameters.json"

templateMongoDBPath="mongodb/template.json"
parametersMongoDBTemplatePath="mongodb/parameters-template.json"
parametersMongoDBPath="mongodb/parameters.json"

if [ ! -f "$templateKubernetesPath" ]; then
	echo "$templateKubernetesPath not found"
	exit 1
fi

if [ ! -f "$templateKubernetesPath" ]; then
	echo "$templateKubernetesPath not found"
	exit 1
fi

if [ ! -f "$parametersKubernetesTemplatePath" ]; then
	echo "$parametersKubernetesTemplatePath not found"
	exit 1
fi

if [ ! -f "$templateServicebusPath" ]; then
	echo "$templateServicebusPath not found"
	exit 1
fi

if [ ! -f "$parametersServiceBusTemplatePath" ]; then
	echo "$parametersServiceBusTemplatePath not found"
	exit 1
fi

if [ ! -f "$templateNginxPath" ]; then
	echo "$templateNginxPath not found"
	exit 1
fi

if [ ! -f "$parametersNginxTemplatePath" ]; then
	echo "$parametersNginxTemplatePath not found"
	exit 1
fi

if [ ! -f "$templateMongoDBPath" ]; then
	echo "$templateMongoDBPath not found"
	exit 1
fi

if [ ! -f "$parametersMongoDBTemplatePath" ]; then
	echo "$parametersMongoDBTemplatePath not found"
	exit 1
fi

# Initialize parameters specified from command line
while getopts ":i:g:l:k:r:" arg; do
	case "${arg}" in
		i)
			subscriptionName=${OPTARG}
			;;
		g)
			resourceGroupName=${OPTARG}
			;;
		l)
			resourceGroupLocation=${OPTARG}
			;;
		k)
			sshPublicKey=${OPTARG}
			;;
		r)
			containerRegistryName=${OPTARG}
			;;
		esac
done

shift $((OPTIND-1))

# Prompt for parameters if some required parameters are missing

if [[ -z "$subscriptionName" ]]; then
	echo "Your subscription ID can be looked up with the CLI using: az account show --out json"
	echo "Enter your subscription ID:"
	read subscriptionName
	[[ "${subscriptionName:?}" ]]
fi

if [[ -z "$resourceGroupName" ]]; then
	echo "This script will look for an existing resource group, otherwise a new one will be created."
	echo "You can create new resource group with the CLI using: az group create"
	echo "Enter a resource group name:"
	read resourceGroupName
	[[ "${resourceGroupName:?}" ]]
fi

networkName="$resourceGroupName-vnet"

if [[ -z "$resourceGroupLocation" ]]; then
	echo "If you are creating a *new* resource group, you need to set a location."
	echo "You can lookup locations with the CLI using: az account list-locations"
	echo "Enter resource group location:"
	read resourceGroupLocation
    [[ "${resourceGroupLocation:?}" ]]
fi

if [[ -z "$containerRegistryName" ]]; then
	echo "The Container Registry has to have an unique name in you subscription."
	echo "Enter Container Registry name:"
	read containerRegistryName
    [[ "${containerRegistryName:?}" ]]
fi

if [[ -z "$sshPublicKey" ]]; then
	echo "Enter the path to your public key file:"
	read sshPublicKey
	[[ "${sshPublicKey:?}" ]]
fi

if [ ! -f "${sshPublicKey/\~/$HOME}" ]; then
	echo "$sshPublicKey not found"
	exit 1
fi


echo "Do you want to deploy also the database (y/n)"
read installDatabase
[[ "${installDatabase:?}" ]]

# Get first letter
installDatabase="$(echo $installDatabase | head -c 1)"
# To lower case
installDatabase=${installDatabase,,}

# Get Current database information to make the peering
if [ "$installDatabase" = "n" ]; then
	echo "Enter current database resource group:"
	read databaseResourceGroup
	[[ "${databaseResourceGroup:?}" ]]
	az group show --name $databaseResourceGroup 1> /dev/null

	echo "Enter current database network name:"
	read databaseNetworkName
	[[ "${databaseNetworkName:?}" ]]

	az network vnet show -n $databaseNetworkName -g $databaseResourceGroup 1> /dev/null
else
	databaseResourceGroup="$(cut -c 1-14 <<< ${resourceGroupName})-mongodb"
	databaseNetworkName="$databaseResourceGroup-vnet"

	set +e

	az group show --name $databaseResourceGroup &> /dev/null

	if [ $? == 0 ]; then
		echo "The resource group " $databaseResourceGroup " already exits."
		exit 1
	fi

	echo "Choose a password for the database (length from 12 to 32)"
	read dbPassword

	[[ "${dbPassword:?}" ]]

	set -e
fi

# Check if the user is login
az account show 1> /dev/null


if [ $? != 0 ];
then
	# Login into azure
	az login
fi

# Set the default subscription
az account set --subscription $subscriptionName

echo "Getting subscription id"
subscriptionId=$(az account show -s $subscriptionName | jq -r '.id')

set +e

echo "Step 1: Create resource group if needed"
az group show --name $resourceGroupName 1> /dev/null

if [ $? != 0 ]; then
	echo "Resource group with name" $resourceGroupName "could not be found. Creating new resource group..."
	set -e
	(
		set -x
		az group create --name $resourceGroupName --location $resourceGroupLocation 1> /dev/null
	)
else
	echo "Using existing resource group..."
fi


echo "Step 2: Create Service Principal if needed"
set +e

az ad sp show --id "http://$resourceGroupName" 1> /dev/null

if [ $? != 0 ]; then
	set -e

	echo "Service Principal with name " $resourceGroupName "could not be found. Creating new Service Principal..."
	set -x
	servicePrincipal=$(az ad sp create-for-rbac -n $resourceGroupName --skip-assignment)

	# Get service principal appId
	spAppId=$(jq -r '.appId' <<< "$servicePrincipal")
	# Get service principal password
	spPassword=$(jq -r '.password' <<< "$servicePrincipal")

	set +x
	echo "Step 3: Create role assignment"

	# Sleep and retry if there is an error: https://github.com/Azure/azure-powershell/issues/2286
	retries=3;
	sleep 10s

	set +e
	set -x

	echo "Creating role assignment..."
	roleAssignment=$(az role assignment create --assignee $spAppId --role Contributor)

	while [ $? != 0 -a $retries != 0 ]
	do
		((retries--))
		sleep 10s
		roleAssignment=$(az role assignment create --assignee $spAppId --role Contributor)
	done

	set -e

	principalId=$(jq -r '.principalId' <<< "$roleAssignment")
	set +x

	echo "Step 4: Generate kubernetes-service/parameters.json"
	(
		set -x
		sed "s/%baseName%/${resourceGroupName}/g
			s/%networkName%/${networkName}/g
			s/%spAppId%/${spAppId}/g
			s/%spPassword%/${spPassword}/g
			s/%subscriptionId%/${subscriptionId}/g
			s/%principalId%/${principalId}/g" $parametersKubernetesTemplatePath > $parametersKubernetesPath
	)

	echo "Step 5: Deploy kubernetes service"
	(
		# Wait a little bit, to avoid a "ServicePrincipalNotFound" error.
		sleep 30s
		echo "Deploying kubernetes service ..."
		set -x
		az group deployment create --name "$resourceGroupName-kubernetes" --resource-group "$resourceGroupName" --template-file "$templateKubernetesPath" --parameters "@${parametersKubernetesPath}"
		echo "Kubernetes has been successfully deployed"
		rm $parametersKubernetesPath
	)
else
	# Steps 3, 4 and 5 depens on the principal service
	# if it already exists, we can't get the password
	# so we can't run steps 4 and 5.
	echo "Principal Service already exists"
	echo "Skipping steps 3, 4 and 5"
fi

echo "Step 6: Create Container registry"
set +e

az acr show --resource-group $resourceGroupName --name $containerRegistryName

if [ $? != 0 ]; then
	set -e
	echo "Container Registry with name " $containerRegistryName " could not be found. Checking availability..."

	registryNameAvailable=$(az acr check-name --name $containerRegistryName | jq '.nameAvailable')

	if [ $registryNameAvailable != true ]; then
		echo "The Container Registry with name " $containerRegistryName " already exists"
		echo "Choose another name and run the script again"
		exit 1
	fi

	(
		set -x
		az acr create --resource-group $resourceGroupName --name $containerRegistryName --sku Basic
	)
else
	echo "Registry container with name " $containerRegistryName " already exists"
fi

echo "Step 7: Generate servicebus/parameters.json"
(
	set -x
	sed "s/%baseName%/${resourceGroupName}/g" $parametersServiceBusTemplatePath > $parametersServiceBusPath
)

set +e

echo "Step 8: Deploy Service Bus"
serviceBusDeploymentName="$resourceGroupName-servicebus"

az group deployment show -n $serviceBusDeploymentName -g $resourceGroupName 1> /dev/null

if [ $? != 0 ]; then
	set -e
	echo "Deployment with name " $serviceBusDeploymentName " could not be found. Deploying service bus ..."
	(
		set -x
		az group deployment create --name $serviceBusDeploymentName --resource-group "$resourceGroupName" --template-file "$templateServicebusPath" --parameters "@${parametersServiceBusPath}"
		echo "Service bus has been successfully deployed"
		rm $parametersServiceBusPath
	)

	echo "Step 9: Create queues"

	(
		set -x
		echo "Creating queue webhint-jobs..."
		az servicebus queue create --name webhint-jobs \
								--namespace-name $resourceGroupName \
								--resource-group $resourceGroupName \
								--default-message-time-to-live P14D \
								--duplicate-detection-history-time-window PT30S \
								--enable-dead-lettering-on-message-expiration true \
								--enable-duplicate-detection true \
								--enable-partitioning false \
								--lock-duration PT5M \
								--max-size 1024 \
								--max-delivery-count 10
	)

	(
		set -x
		echo "Creating queue webhint-results..."
		az servicebus queue create --name webhint-results \
								--namespace-name $resourceGroupName \
								--resource-group $resourceGroupName \
								--default-message-time-to-live P14D \
								--duplicate-detection-history-time-window PT30S \
								--enable-dead-lettering-on-message-expiration true \
								--enable-duplicate-detection true \
								--enable-partitioning false \
								--lock-duration PT5M \
								--max-size 1024 \
								--max-delivery-count 10
	)
else
	echo "Service bus already exists"
	echo "Skipping step 9"
fi

set -e
publicKey=$(cat ${sshPublicKey/\~/$HOME})
echo "Step 10: Generate nginx/parameters.json"
(
	set -x
	# The network interface name has a limit of 23 characters
	networkInterfaceName="$(cut -c 1-20 <<< ${resourceGroupName})354"
	# Remove character -
	diagnosticsStorageAccountName=$(cut -c 1-24 <<< ${resourceGroupName//-})
	sed "s/%baseName%/${resourceGroupName}/g
		 s/%networkInterfaceName%/${networkInterfaceName}/g
		 s/%diagnosticsStorageAccountName%/${diagnosticsStorageAccountName}/g
		 s/%subscriptionId%/${subscriptionId}/g
		 s~%publicKey%~${publicKey}~g" $parametersNginxTemplatePath > $parametersNginxPath
)

set +e

echo "Step 11: Deploy Nginx"

nginxDeploymentName="$resourceGroupName-nginx"

az group deployment show -n "$nginxDeploymentName" -g "$resourceGroupName" 1> /dev/null

if [ $? != 0 ]; then
	set -e
	echo "Deployment with name " $nginxDeploymentName " could not be found. Deploying Nginx machine..."
	(
		set -x
		az group deployment create --name "$nginxDeploymentName" --resource-group "$resourceGroupName" --template-file "$templateNginxPath" --parameters "@${parametersNginxPath}"
		echo "Nginx has been successfully deployed"
		rm $parametersNginxPath
	)
else
	echo "Nginx already exists"
fi

# If database resource group doesn't exits
# then we need to create it

set +e

az group show --name $databaseResourceGroup 1> /dev/null

if [ $? != 0 ]; then
	set -e

	echo "Step 12: Create database resource group"
	(
		echo "Creating resource group for database"
		set -x
		az group create --name $databaseResourceGroup --location $resourceGroupLocation 1> /dev/null
	)

	echo "Step 13: Generate mongodb/parameters.js"
	(
		set -x
		sed "s/%baseName%/${databaseResourceGroup}/g
			 s/%networkName%/${databaseNetworkName}/g
			 s~%publicKey%~${publicKey}~g" $parametersMongoDBTemplatePath > $parametersMongoDBPath
	)

	echo "Step 14: Deploy MongoDB"
	(
		echo "Deploying database..."
		set -x
		az group deployment create --name "$databaseResourceGroup-mongodb" --resource-group "$databaseResourceGroup" --template-file "$templateMongoDBPath" --parameters "@${parametersMongoDBPath}"
		echo "MongoDB has been successfully deployed"
		rm $parametersMongoDBPath
	)
else
	echo "MongoDB already exits"
	echo "Skipping step 12, 13 and 14"
fi


echo "Step 15: Create peerings if they don't exist"
set +e

peeringDBName="$databaseResourceGroup-$databaseNetworkName-peering"

az network vnet peering show -g $databaseResourceGroup -n $peeringDBName --vnet-name $databaseNetworkName 1> /dev/null

if [ $? != 0 ]; then
	set -e

	(
		set -x
		echo "Creating peering in database network..."
		az network vnet peering create --name $peeringDBName \
									   -g $databaseResourceGroup \
									   --vnet-name $databaseNetworkName \
									   --remote-vnet /subscriptions/$subscriptionId/resourceGroups/$resourceGroupName/providers/Microsoft.Network/virtualNetworks/$networkName \
									   --allow-vnet-access
	)
else
	echo "The peering with name" $peeringDBName "already exists"
fi

set +e

peeringKubeName="$resourceGroupName-$networkName-peering"

az network vnet peering show -g $resourceGroupName -n $peeringKubeName --vnet-name $networkName 1> /dev/null

if [ $? != 0 ]; then
	set -e

	(
		set -x
		echo "Creating peering in kubernete network..."
		az network vnet peering create --name $peeringKubeName \
									   -g $resourceGroupName \
									   --vnet-name $networkName \
									   --remote-vnet /subscriptions/$subscriptionId/resourceGroups/$databaseResourceGroup/providers/Microsoft.Network/virtualNetworks/$databaseNetworkName \
									   --allow-vnet-access
	)
else
	echo "The peering with name" $peeringKubeName "already exists"
fi