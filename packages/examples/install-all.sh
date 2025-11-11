#!/bin/bash

# Install dependencies for all examples
echo "📦 Installing dependencies for all examples..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Install basic example
echo -e "${BLUE}📚 Installing 00-basic-example...${NC}"
cd 00-basic-example
npm install
echo -e "${GREEN}✅ Basic example installed${NC}"
echo ""

# Install user onboarding example
echo -e "${BLUE}📚 Installing 01-user-onboarding...${NC}"
cd ../01-user-onboarding
npm install
echo -e "${GREEN}✅ User onboarding example installed${NC}"
echo ""

# Install order processing example
echo -e "${BLUE}📚 Installing 02-order-processing...${NC}"
cd ../02-order-processing
npm install
echo -e "${GREEN}✅ Order processing example installed${NC}"
echo ""

# Install kafka inventory example
echo -e "${BLUE}📚 Installing 03-kafka-inventory...${NC}"
cd ../03-kafka-inventory
npm install
echo -e "${GREEN}✅ Kafka inventory example installed${NC}"
echo ""

# Install demo utilities
echo -e "${BLUE}📚 Installing demo utilities...${NC}"
cd ../demo
npm install
echo -e "${GREEN}✅ Demo utilities installed${NC}"
echo ""

echo -e "${GREEN}🎉 All examples installed successfully!${NC}"
echo ""
echo "To run the examples:"
echo "  - Basic Example: cd 00-basic-example && npm run demo (Start here!)"
echo "  - User Onboarding: cd 01-user-onboarding && npm run demo"
echo "  - Order Processing: cd 02-order-processing && npm run demo"
echo "  - Kafka Inventory: cd 03-kafka-inventory && npm run demo"

