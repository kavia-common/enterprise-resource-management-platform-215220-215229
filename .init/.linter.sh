#!/bin/bash
cd /home/kavia/workspace/code-generation/enterprise-resource-management-platform-215220-215229/resource_platform_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

