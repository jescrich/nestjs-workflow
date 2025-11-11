# User Onboarding Workflow

This example demonstrates a comprehensive user onboarding workflow using `@jescrich/nestjs-workflow`.

## Overview

The workflow manages the complete user onboarding process from registration to full activation, including:
- Email verification
- Identity verification (KYC)
- Profile completion
- Welcome sequence
- Account activation

## States

- **REGISTERED**: User has registered but not verified email
- **EMAIL_VERIFIED**: Email address confirmed
- **PROFILE_INCOMPLETE**: Basic verification done, awaiting profile completion
- **PROFILE_COMPLETE**: Profile information provided
- **IDENTITY_VERIFICATION_PENDING**: KYC process initiated
- **IDENTITY_VERIFIED**: KYC completed successfully
- **ACTIVE**: Fully onboarded and active user
- **SUSPENDED**: Account suspended for compliance reasons
- **INACTIVE**: User abandoned onboarding

## Key Features

1. **Multi-step Verification**: Email, phone, and identity verification
2. **Progressive Onboarding**: Users can complete steps over time
3. **Compliance Integration**: KYC/AML checks
4. **Automated Communications**: Welcome emails, reminders, and tips
5. **Analytics Tracking**: Track drop-off points and completion rates
6. **Risk Scoring**: Automated risk assessment during onboarding

## Running the Example

```bash
# Install dependencies
npm install

# Run the example
npm run start

# Run tests
npm run test
```

## Files

- `user.entity.ts` - User entity with onboarding states
- `user.workflow.ts` - Workflow definition
- `user.service.ts` - Business logic
- `user.actions.ts` - Workflow actions
- `verification.service.ts` - Email and identity verification
- `user.module.ts` - Module configuration