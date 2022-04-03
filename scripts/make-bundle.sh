#!/usr/bin/env bash

echo "It is time to publish!!!"

echo -n "Are migrations up2date?"
read -r migration

if [ $migration != "yes" ]; then
    exit 0
fi;

yarn bundle:zip;
