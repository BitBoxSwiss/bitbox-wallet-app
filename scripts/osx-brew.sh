#!/bin/bash

if [ $(arch) = "arm64" ]; then
  # recent M-based apple machines have an arm64 arch, but we need to install x86_64 deps
  arch -x86_64 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
  /usr/local/Homebrew/bin/brew install go@1.22
  /usr/local/Homebrew/bin/brew install qt@5
  /usr/local/Homebrew/bin/brew install create-dmg
else
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
  brew install go@1.22
  brew install qt@5
  brew install create-dmg
fi
