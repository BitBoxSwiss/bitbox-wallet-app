#!/bin/bash

# Call this script in the directory of a package. A html page will be
# opened, showing the coverage of that package.

go test -coverprofile=coverage.cov .
go tool cover -html=coverage.cov
rm coverage.cov
