# User Onboarding Workflow Demo

This example includes two powerful visualization tools to demonstrate the user onboarding workflow in action.

## Installation

First, install the dependencies:

```bash
yarn install
# or
npm install
```

## Available Demos

### 1. Interactive Demo (Recommended)

The interactive demo provides a real-time visualization of the workflow with the ability to manually trigger transitions:

```bash
npm run demo
# or
yarn demo
```

Features:
- **Visual workflow diagram** showing all states and transitions
- **Real-time updates** as you move through the workflow
- **Interactive menu** to trigger specific events
- **Current state highlighting** in the diagram
- **Transition history** tracking
- **Automated scenario** option for hands-free demonstration

### 2. Automated Runner

The automated runner executes predefined scenarios with detailed console output:

```bash
# Run all scenarios
npm run demo:runner:all

# Run a specific scenario (1, 2, or 3)
npm run demo:runner:scenario=1

# Run with default behavior
npm run demo:runner
```

Scenarios included:
1. **Happy Path** - Complete successful onboarding
2. **High Risk User** - User flagged for manual review
3. **Abandoned Onboarding** - User starts but doesn't complete

### 3. Workflow Visualizer Only

To see just the workflow visualization without running the full demo:

```bash
npm run demo:visualizer
```

## Demo Controls

### Interactive Demo Controls

When running the interactive demo, you'll have these options:

- **Number keys (1-9)**: Execute available workflow events
- **`v`**: Refresh the visualization
- **`n`**: Create a new user
- **`r`**: Run an automated scenario
- **`h`**: Show transition history
- **`q`**: Quit the demo

### Visual Indicators

The workflow visualization uses different styles to indicate state types:

- **╔═╗ Green Double Border**: Current active state
- **╔═╗ Cyan Double Border**: Final states (Active, Suspended, Inactive)
- **┌─┐ Blue Single Border**: Regular workflow states
- **→ Arrows**: Possible transitions between states
- **Yellow Path**: Highlighted transition history

### Console Output Features

Both demos provide rich console output with:

- **Color-coded states**: Different colors for each workflow state
- **Progress bars**: Visual representation of profile completeness
- **Status indicators**: ✓ for success, ✗ for failure, ⚠ for warnings
- **Transition animations**: Visual feedback when states change
- **Detailed logging**: Event payloads and action results

## Understanding the Workflow

The workflow features **intelligent state transitions** that automatically detect when profile requirements are met. When a user updates their profile, the system:
- Calculates profile completeness based on weighted fields
- Automatically transitions to `PROFILE_COMPLETE` when 100% is reached
- Allows progressive updates without manual completion triggers

The user onboarding workflow consists of these main stages:

1. **Registration** (`REGISTERED`)
   - Starting point for all users
   - Email verification required to proceed

2. **Email Verification** (`EMAIL_VERIFIED`)
   - User confirms their email address
   - Opens access to profile updates

3. **Profile Completion** (`PROFILE_INCOMPLETE` → `PROFILE_COMPLETE`)
   - Users progressively complete their profile
   - System tracks completion percentage
   - 100% completion required to proceed

4. **Identity Verification** (`IDENTITY_VERIFICATION_PENDING` → `IDENTITY_VERIFIED`)
   - Document submission and verification
   - Can fail, leading to suspension

5. **Risk Assessment**
   - Automatic evaluation of user risk factors
   - High-risk users require manual review

6. **Account Activation** (`ACTIVE`)
   - Final successful state
   - User has full access to the system

7. **Alternative States**
   - `SUSPENDED`: Requires manual intervention
   - `INACTIVE`: Abandoned onboarding after 30 days

## Customization

To modify the scenarios or add new ones, edit:
- `src/demo-runner.ts` - For automated scenarios
- `src/demo.ts` - For interactive demo behavior
- `src/workflow-visualizer.ts` - For visualization customization

## Tips for Best Experience

1. **Use a terminal with color support** for the best visual experience
2. **Maximize your terminal window** to see the full workflow diagram
3. **Try the interactive demo first** to understand the workflow
4. **Run automated scenarios** to see different paths through the workflow
5. **Experiment with different transitions** to see how conditions affect the flow

## Troubleshooting

If you encounter issues:

1. Ensure all dependencies are installed: `yarn install`
2. Check that TypeScript is compiled: `npm run build`
3. Verify your terminal supports ANSI color codes
4. Try running with `--no-color` flag if colors aren't displaying correctly

## Next Steps

After exploring the demos, you can:
- Modify the workflow definition in `src/user.workflow.ts`
- Add new actions in `src/user.actions.ts`
- Implement additional business logic in the services
- Create custom scenarios for your specific use cases