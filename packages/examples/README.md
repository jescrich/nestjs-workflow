<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://joseescrich.com/logos/nestjs-workflow.png">
  <source media="(prefers-color-scheme: light)" srcset="https://joseescrich.com/logos/nestjs-workflow-light.png">
  <img src="https://joseescrich.com/logos/nestjs-workflow.png" alt="NestJS Workflow Logo" width="200" style="margin-bottom:20px">
</picture>

# NestJS Workflow Examples

> 📍 **This is the examples repository** for the [NestJS Workflow](https://github.com/jescrich/nestjs-workflow) library.  
> Looking for the main library? Visit: **[github.com/jescrich/nestjs-workflow](https://github.com/jescrich/nestjs-workflow)**

This repository contains comprehensive examples demonstrating the power and flexibility of the **[@jescrich/nestjs-workflow](https://github.com/jescrich/nestjs-workflow)** library. Each example showcases real-world use cases with interactive visualizations and automated demos.

## 📦 Main Library

These examples demonstrate the [**NestJS Workflow**](https://github.com/jescrich/nestjs-workflow) library - a flexible workflow engine built on top of NestJS framework for managing complex state machines and workflows.

### Installation & Documentation

To use the workflow library in your own projects:

```bash
npm install @jescrich/nestjs-workflow
# or
yarn add @jescrich/nestjs-workflow
```

**📚 Full Documentation**: [https://github.com/jescrich/nestjs-workflow](https://github.com/jescrich/nestjs-workflow)

### Key Features of the Library
- **Stateless Architecture** - No additional storage requirements
- **Event-Driven** - Built on NestJS's event system
- **Dual Configuration** - Inline functions or decorator-based approach
- **Kafka Integration** - Built-in support for event-driven workflows
- **TypeScript Support** - Full type safety with generics
- **Flexible Transitions** - Multiple from/to states and events

### Quick Library Usage

```typescript
import { WorkflowModule, WorkflowDefinition } from '@jescrich/nestjs-workflow';

// Define your workflow
const orderWorkflow: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Cancelled],
    idles: [OrderStatus.Pending, OrderStatus.Processing],
    failed: OrderStatus.Failed,
  },
  transitions: [
    {
      from: OrderStatus.Pending,
      to: OrderStatus.Processing,
      event: OrderEvent.Submit,
      conditions: [(entity) => entity.price > 0],
    },
    // ... more transitions
  ],
  entity: {
    // Entity management functions
  }
};

// Register in your module
@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflow,
    }),
  ],
})
export class AppModule {}
```

For complete implementation details, see the [main documentation](https://github.com/jescrich/nestjs-workflow#quick-start) or explore the examples below.

## 📚 Available Examples

### 0. Basic Task Workflow (`00-basic-example`) ⭐ START HERE
A simple task management workflow perfect for learning the fundamentals of NestJS Workflow.

**Key Features:**
- Minimal setup with just 5 states and 5 events
- Clear, linear workflow progression
- Interactive visual demo
- Complete yet simple implementation
- Perfect starting point for beginners

**States:** `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `COMPLETED` / `CANCELLED`

### 1. User Onboarding Workflow (`01-user-onboarding`)
A comprehensive user onboarding system that manages the complete journey from registration to full account activation.

**Key Features:**
- Multi-step verification (email, phone, identity)
- Progressive profile completion with automatic state transitions
- KYC/AML compliance integration
- Risk assessment and scoring
- Automated communications and reminders
- Analytics tracking for drop-off analysis

**States:** `REGISTERED` → `EMAIL_VERIFIED` → `PROFILE_COMPLETE` → `IDENTITY_VERIFIED` → `ACTIVE`

### 2. Order Processing Workflow (`02-order-processing`)
A complete e-commerce order processing system managing the entire order lifecycle from creation to delivery.

**Key Features:**
- Payment processing with retry logic
- Inventory management and reservation
- Multi-carrier shipping integration
- Cancellation and refund handling
- Returns management
- Real-time order tracking

**States:** `CREATED` → `PAYMENT_PENDING` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED`

### 3. Kafka-Driven Inventory Management (`03-kafka-inventory`)
A real-time inventory management system with Kafka integration for event-driven state transitions.

**Key Features:**
- Kafka event consumption for automatic workflow transitions
- Stock receiving, allocation, and release management
- Audit trail and compliance tracking
- Quarantine and quality control workflows
- Automatic reorder triggering
- Multi-warehouse support
- Real-time inventory tracking

**States:** `RECEIVING` → `AVAILABLE` → `RESERVED` → `ALLOCATED` → `IN_TRANSIT` → `DELIVERED`

**Special States:** `QUARANTINE`, `AUDITING`, `DAMAGED`, `EXPIRED`, `REORDER_PENDING`

### 4. BullMQ Task Workflow (`04-bullmq-task`) 🆕
A task management workflow demonstrating BullMQ integration as an alternative messaging backend to Kafka.

**Key Features:**
- BullMQ/Redis-based event-driven workflow transitions
- Automatic job retry with exponential backoff
- Dead letter queue for failed jobs
- Job producer service for emitting workflow events
- Health monitoring and graceful shutdown
- Batch event processing
- Interactive demo with visualization

**States:** `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `COMPLETED` / `CANCELLED`

**Why BullMQ?** Simpler setup than Kafka, built-in retry logic, Redis-based, perfect for job queues and task processing.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- TypeScript 5.0+
- **@jescrich/nestjs-workflow** ^1.0.3 (included in examples)

### Installation

```bash
# Clone the examples repository
git clone https://github.com/jescrich/nestjs-workflow-examples.git
cd nestjs-workflow-examples

# Option 1: Install all examples at once (recommended)
npm run install:all

# Option 2: Install individual examples
npm run install:basic-example     # Install basic example (recommended to start)
npm run install:user-onboarding   # Install user onboarding example
npm run install:order-processing  # Install order processing example
npm run install:kafka-inventory   # Install kafka inventory example
npm run install:bullmq-task       # Install BullMQ task example

# Option 3: Manual installation
cd 00-basic-example && npm install
cd ../01-user-onboarding && npm install
cd ../02-order-processing && npm install
cd ../03-kafka-inventory && npm install
cd ../04-bullmq-task && npm install

# Alternative: Use the shell script (Unix/Mac)
chmod +x install-all.sh && ./install-all.sh

# Alternative: Use the batch file (Windows)
install-all.bat
```

## 🎮 Interactive Visual Mode

Both examples include an **interactive visual mode** that provides real-time workflow visualization with the ability to manually trigger transitions and see the workflow in action.

### Running Interactive Demos

#### Basic Example Interactive Demo (Start Here!)
```bash
cd 00-basic-example
npm run demo
```

#### User Onboarding Interactive Demo
```bash
cd 01-user-onboarding
npm run demo
```

#### Order Processing Interactive Demo
```bash
cd 02-order-processing
npm run demo
```

#### Kafka Inventory Interactive Demo
```bash
cd 03-kafka-inventory
# Optional: Start Kafka first (if you want Kafka integration)
docker-compose up -d
npm run demo
```

#### BullMQ Task Interactive Demo
```bash
cd 04-bullmq-task
# Start Redis first
docker run -d -p 6379:6379 --name redis redis:alpine
npm run demo
```

### Interactive Demo Features

The visual mode provides:

- **🎨 Workflow Visualization**: ASCII-art diagram showing all states and possible transitions
- **⚡ Real-time Updates**: Live visualization updates as you move through the workflow
- **🎯 Current State Highlighting**: Visual indication of the current state with color coding
- **📝 Interactive Menu**: Choose from available events to trigger transitions
- **📊 Entity Details**: View current entity properties and status
- **📜 History Tracking**: See the complete transition history
- **🤖 Automated Scenarios**: Run pre-defined scenarios to see different workflow paths

### Interactive Controls

| Key | Action |
|-----|--------|
| **1-9** | Execute available workflow events |
| **v** | Refresh visualization |
| **n** | Create new entity |
| **r** | Run automated scenario |
| **h** | Show transition history |
| **q** | Quit demo |

### Visual Indicators

The workflow diagram uses different styles to indicate state types:

- **╔═╗** Green double border: Current active state
- **╔═╗** Cyan double border: Final states
- **┌─┐** Blue single border: Regular workflow states
- **→** Arrows: Possible transitions
- **Yellow Path**: Highlighted transition history

## 🏃 Running the Examples

### Quick Start Commands

Run demos directly from the examples directory:

```bash
# From the examples/ directory
npm run demo:user-onboarding    # Run user onboarding interactive demo
npm run demo:order-processing   # Run order processing interactive demo
npm run demo:kafka-inventory    # Run kafka inventory interactive demo
npm run demo:bullmq-task        # Run BullMQ task interactive demo
```

### Option 1: Interactive Mode (Recommended)

Best for exploring and understanding the workflows:

```bash
# User Onboarding
cd 01-user-onboarding
npm run demo

# Order Processing
cd 02-order-processing
npm run demo
```

### Option 2: Automated Scenarios

Run predefined scenarios to see different workflow paths:

```bash
# User Onboarding - Run all scenarios
cd 01-user-onboarding
npm run demo:runner:all

# Order Processing - Run all scenarios
cd 02-order-processing
npm run demo:all
```

### Option 3: API Server Mode

Start as a REST API server for integration testing:

```bash
# User Onboarding (runs on port 3000)
cd 01-user-onboarding
npm start

# Order Processing (runs on port 3001)
cd 02-order-processing
npm start
```

### Option 4: Visualization Only

View the workflow diagram without running the demo:

```bash
# User Onboarding
cd 01-user-onboarding
npm run demo:visualizer

# Order Processing
cd 02-order-processing
npm run demo:visualizer
```

## 📋 Available Scripts

Each example includes the following npm scripts:

| Script | Description |
|--------|-------------|
| `npm start` | Start the NestJS application |
| `npm run demo` | Run interactive visual demo |
| `npm run demo:all` | Run all automated scenarios |
| `npm run demo:runner` | Run automated demo runner |
| `npm run demo:visualizer` | Show workflow visualization only |
| `npm run build` | Build TypeScript files |
| `npm test` | Run tests |
| `npm run dev` | Start in development mode with hot reload |

## 🏗️ Project Structure

```
examples/
├── 01-user-onboarding/
│   ├── src/
│   │   ├── demo/
│   │   │   ├── demo.ts              # Interactive demo implementation
│   │   │   ├── demo.runner.ts       # Automated scenarios
│   │   │   └── demo.visualizer.ts   # Workflow visualization
│   │   ├── services/                # Business logic services
│   │   ├── user.entity.ts          # User entity and enums
│   │   ├── user.workflow.ts        # Workflow definition
│   │   ├── user.actions.ts         # Workflow actions
│   │   ├── user.service.ts         # User service
│   │   └── main.ts                 # Application entry
│   └── package.json
│
├── 02-order-processing/
│   ├── src/
│   │   ├── demo/
│   │   │   ├── demo.ts              # Interactive demo
│   │   │   ├── demo.runner.ts       # Automated scenarios
│   │   │   └── demo.visualizer.ts   # Visualization
│   │   ├── services/                # Payment, inventory, shipping
│   │   ├── order.entity.ts         # Order entity and enums
│   │   ├── order.workflow.ts       # Workflow definition
│   │   ├── order.service.ts        # Order service
│   │   └── main.ts                 # Application entry
│   └── package.json
│
├── 03-kafka-inventory/
│   ├── src/
│   │   ├── demo/
│   │   │   ├── demo.ts              # Interactive demo
│   │   │   └── demo.visualizer.ts   # Workflow visualization
│   │   ├── kafka/                   # Kafka producer service
│   │   ├── inventory.entity.ts     # Inventory entity and events
│   │   ├── inventory.workflow.ts   # Workflow with Kafka events
│   │   ├── inventory.service.ts    # Inventory service
│   │   └── main.ts                 # Application entry
│   ├── docker-compose.yml          # Kafka/Zookeeper setup
│   └── package.json
│
└── 04-bullmq-task/
    ├── src/
    │   ├── demo/
    │   │   ├── demo.ts              # Interactive demo
    │   │   ├── demo.visualizer.ts   # Workflow visualization
    │   │   └── README.md            # Demo documentation
    │   ├── task.entity.ts          # Task entity and enums
    │   ├── task.workflow.ts        # Workflow with BullMQ config
    │   ├── task.producer.service.ts # BullMQ job producer
    │   ├── task.service.ts         # Task service
    │   └── main.ts                 # Application entry
    ├── README.md                   # Full documentation
    ├── QUICKSTART.md               # Quick start guide
    └── package.json

```

## 🎯 Test Scenarios

### User Onboarding Scenarios

1. **Happy Path**: Complete successful onboarding
   - Register → Verify Email → Complete Profile → Verify Identity → Active

2. **High Risk User**: User flagged for manual review
   - Register → Verify Email → Risk Assessment Fails → Suspended

3. **Abandoned Onboarding**: User starts but doesn't complete
   - Register → Verify Email → Inactive after 30 days

### Order Processing Scenarios

1. **Successful Delivery**: Standard order fulfillment
   - Create → Payment → Processing → Shipping → Delivery

2. **Payment Retry**: Failed payment with successful retry
   - Create → Payment Fails → Retry Payment → Success

3. **Order Cancellation**: Cancel with refund
   - Create → Payment → Cancel → Refund

4. **Express Shipping**: Priority order processing
   - Create → Payment → Express Processing → Priority Shipping

5. **Product Return**: Post-delivery return
   - Delivered → Initiate Return → Process Refund

## 💡 Tips for Best Experience

1. **Use a modern terminal** with full color support (iTerm2, Windows Terminal, etc.)
2. **Maximize terminal window** to see complete workflow diagrams
3. **Start with interactive mode** to understand the workflow before running automated scenarios
4. **Enable debug logging** for detailed execution traces: `DEBUG=workflow:* npm run demo`
5. **Experiment freely** - all examples use in-memory storage, no cleanup needed

## 🐛 Troubleshooting

### Common Issues

**Colors not displaying correctly:**
```bash
# Force color output
FORCE_COLOR=1 npm run demo

# Or disable colors
NO_COLOR=1 npm run demo
```

**TypeScript compilation errors:**
```bash
# Rebuild the project
npm run build
```

**Module not found errors:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Port already in use:**
```bash
# Change the port
PORT=3002 npm start
```

## 📖 Learning Path

1. **Start with User Onboarding** - Simpler workflow with clear linear progression
2. **Explore Interactive Mode** - Understand state transitions visually
3. **Run Automated Scenarios** - See different paths through the workflow
4. **Study Order Processing** - More complex with multiple decision points
5. **Review the Code** - Understand implementation patterns
6. **Build Your Own** - Create a custom workflow using these as templates

## 🔗 Related Resources

### Main Library
- **GitHub Repository**: [https://github.com/jescrich/nestjs-workflow](https://github.com/jescrich/nestjs-workflow)
- **NPM Package**: [@jescrich/nestjs-workflow](https://www.npmjs.com/package/@jescrich/nestjs-workflow)
- **Documentation**: [Full API Documentation](https://github.com/jescrich/nestjs-workflow#table-of-contents)
- **Contributing**: [Contribution Guidelines](https://github.com/jescrich/nestjs-workflow/blob/main/CONTRIBUTING.md)

### Support
- **Issues**: [Report bugs or request features](https://github.com/jescrich/nestjs-workflow/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/jescrich/nestjs-workflow/discussions)
- **Buy Me a Coffee**: [Support the project](https://buymeacoffee.com/jescrich)

## 📝 License

MIT - See LICENSE file in the root directory

---

💡 **Pro Tip**: The interactive visual mode is the best way to understand how workflows operate. Try it first before diving into the code!
