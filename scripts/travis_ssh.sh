#!/bin/bash -e

if [ "$TRAVIS_PULL_REQUEST" = "false" ]; then
    openssl aes-256-cbc -K $encrypted_59febc5c238f_key -iv $encrypted_59febc5c238f_iv -in travis_rsa.enc -out travis_rsa -d
    chmod 600 travis_rsa
    mv travis_rsa ~/.ssh/id_rsa
fi