#!/bin/bash

if [ $(arch) = "arm64" ]; then
  # recent M-based apple machines have an arm64 arch, but we need to install x86_64 deps
  arch -x86_64 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
  /usr/local/Homebrew/bin/brew install go@1.21
  /usr/local/Homebrew/bin/brew instal qt@5
else
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
  brew install go@1.21
  brew install qt@5
fi
