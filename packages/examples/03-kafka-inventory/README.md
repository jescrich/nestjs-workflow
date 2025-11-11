# Kafka-Driven Inventory Management Workflow Example

> **Build Status**: ✅ All import paths fixed and dependencies configured

This example demonstrates how to use the `@jescrich/nestjs-workflow` library with **Kafka integration** to build an event-driven inventory management system.

## Key Features

- **Kafka-Driven State Transitions**: Workflow transitions are triggered by Kafka events
- **Built-in Kafka Consumer**: The WorkflowModule automatically consumes Kafka events
- **Visual Demo**: Interactive CLI demo with workflow visualization
- **Non-Default Ports**: Kafka runs on port 9093 to avoid conflicts
- **Real-time Inventory Management**: Stock receiving, allocation, auditing, and more

## Architecture

The workflow module has **built-in Kafka integration** that:
1. Automatically subscribes to configured Kafka topics
2. Consumes events and triggers workflow transitions
3. Updates entity state based on the workflow definition

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Kafka (Non-Default Ports)

```bash
# Start Kafka with docker-compose (uses port 9093 instead of 9092)
npm run kafka:up

# Check Kafka logs
npm run kafka:logs

# Access Kafka UI at http://localhost:8081
```

### 3. Run the Interactive Demo

```bash
npm run demo
```

### 4. (Optional) Use the Kafka Producer CLI

```bash
npm run producer
```

### 5. (Optional) Start the API Server

```bash
npm start
```

## Kafka Topics

The system uses the following Kafka topics:

- `inventory.stock.received` - New stock arrives
- `inventory.stock.allocated` - Stock allocated for orders
- `inventory.stock.released` - Stock returned to available
- `inventory.stock.adjusted` - Inventory count adjustments
- `inventory.audit.requested` - Audit requests
- `inventory.reorder.triggered` - Low stock reorder events

## Workflow States

```
RECEIVING → AVAILABLE → RESERVED → ALLOCATED → IN_TRANSIT
                ↓           ↓
            AUDITING    QUARANTINE
                           ↓
                       DAMAGED/EXPIRED
```

## How It Works

### 1. Workflow Module Configuration

```typescript
WorkflowModule.register({
  name: 'InventoryManagementWorkflow',
  definition: inventoryWorkflowDefinition,
  kafka: {
    enabled: true,
    clientId: 'inventory-workflow',
    brokers: 'localhost:9093'
  }
})
```

### 2. Workflow Definition with Kafka Events

```typescript
export const inventoryWorkflowDefinition = {
  kafka: {
    events: [
      {
        topic: 'inventory.stock.received',
        event: InventoryEvent.STOCK_RECEIVED
      },
      // ... more Kafka event mappings
    ]
  },
  transitions: [
    {
      from: InventoryStatus.RECEIVING,
      to: InventoryStatus.AVAILABLE,
      event: InventoryEvent.STOCK_RECEIVED
    },
    // ... more transitions
  ]
}
```

### 3. Publishing Events to Kafka

Events published to Kafka are automatically consumed by the WorkflowModule:

```typescript
// Publish to Kafka
await kafkaProducer.publishStockReceived({
  sku: 'SKU-001',
  quantity: 100,
  location: { warehouse: 'WH-001', zone: 'A', shelf: '1', bin: 'A1' },
  unitCost: 99.99
});

// WorkflowModule automatically:
// 1. Consumes the event from Kafka
// 2. Loads the entity using the SKU as the key
// 3. Triggers the workflow transition
// 4. Updates the entity state
```

## Demo Scenarios

The interactive demo includes:

1. **Receive Stock** - Publish stock received events to Kafka
2. **Allocate Stock** - Reserve and allocate inventory for orders
3. **Release Stock** - Return cancelled order stock
4. **Adjust Stock** - Handle inventory count discrepancies
5. **Request Audit** - Trigger inventory audits
6. **Full Kafka Scenario** - Complete workflow driven by Kafka events

## API Endpoints

When running the API server (`npm start`):

- `GET /inventory` - Get all inventory items
- `GET /inventory/sku/:sku` - Get item by SKU
- `GET /inventory/status/:status` - Get items by status
- `GET /inventory/low-stock` - Get low stock items
- `GET /inventory/warehouse/:warehouse/stats` - Get warehouse statistics
- `POST /inventory/create` - Create new inventory item
- `POST /inventory/:sku/reserve` - Reserve stock (non-Kafka)
- `POST /inventory/:sku/ship` - Ship inventory (non-Kafka)
- `POST /inventory/:sku/audit/complete` - Complete audit

## Docker Compose Configuration

The included `docker-compose.yml` uses non-default ports:

- **Zookeeper**: Port 2182 (instead of 2181)
- **Kafka**: Port 9093 (instead of 9092)
- **Kafka UI**: Port 8081 (instead of 8080)

This allows the demo to run alongside existing Kafka installations.

## Project Structure

```
04-kafka-inventory/
├── docker-compose.yml          # Kafka setup with non-default ports
├── src/
│   ├── inventory.entity.ts     # Entity definitions
│   ├── inventory.workflow.ts   # Workflow with Kafka events
│   ├── inventory.module.ts     # Module with Kafka config
│   ├── inventory.service.ts    # Business logic
│   ├── kafka/
│   │   └── kafka-producer.service.ts  # Demo producer
│   └── demo/
│       ├── demo.ts             # Interactive demo
│       └── demo.visualizer.ts  # Workflow visualization
└── package.json
```

## Key Differences from Non-Kafka Examples

1. **Automatic Event Consumption**: No need to manually consume Kafka events
2. **Event-Driven Architecture**: State transitions triggered by external events
3. **Decoupled Systems**: Different services can trigger workflow transitions
4. **Scalability**: Can handle high-volume event streams
5. **Event Sourcing**: Natural fit for event-sourced architectures

## Troubleshooting

### Kafka Connection Issues

If Kafka doesn't connect:
1. Ensure Docker is running
2. Check ports 9093, 2182, and 8081 are not in use
3. Run `docker-compose logs kafka` to check for errors

### Entity Not Found Errors

The workflow uses the Kafka message key as the entity URN. Ensure:
1. The entity exists before publishing events
2. The SKU in the payload matches an existing item
3. Create items first using the demo or API

## Cleanup

```bash
# Stop Kafka
npm run kafka:down

# Remove all containers and volumes
docker-compose down -v
```

## Learn More

- [Workflow Module Documentation](https://github.com/jescrich/nestjs-workflow)
- [Kafka Integration Guide](https://github.com/jescrich/nestjs-workflow/docs/kafka.md)
- [Apache Kafka](https://kafka.apache.org/)