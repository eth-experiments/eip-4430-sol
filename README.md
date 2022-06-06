

# EIP-4430 Smart Contract Prototype

![CI](https://github.com/web3-systems/react-multichain/actions/workflows/main.yml/badge.svg)
![TS](https://badgen.net/badge/-/TypeScript?icon=typescript&label&labelColor=blue&color=555555)
[![GPLv3 license](https://img.shields.io/badge/License-MIT-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

# Usage

1. Clone this repo: `git clone git@github.com:eth-experiments/eip-4430-sol.git <DESTINATION REPO>`

## Usage

This repo is setup to compile (`nvm use && yarn compile`) and successfully pass tests (`yarn test`)

# Installation

Install the repo and dependencies by running:
`yarn`

## Deployment

These contracts can be deployed to a network by running:
`yarn deploy <networkName>`

## Verification

These contracts can be verified on Etherscan, or an Etherscan clone, for example (Polygonscan) by running:
`yarn etherscan-verify <ethereum network name>` or `yarn etherscan-verify-polygon matic`

# Testing

Run the unit tests locally with:
`yarn test`

## Coverage

Generate the test coverage report with:
`yarn coverage`

<hr/>

Copyright 2022 [Kames Geraghty](https://kames.me)