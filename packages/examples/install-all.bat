@echo off

REM Install dependencies for all examples
echo Installing dependencies for all examples...
echo.

REM Install basic example
echo Installing 00-basic-example...
cd 00-basic-example
call npm install
echo Basic example installed
echo.

REM Install user onboarding example
echo Installing 01-user-onboarding...
cd ..\01-user-onboarding
call npm install
echo User onboarding example installed
echo.

REM Install order processing example
echo Installing 02-order-processing...
cd ..\02-order-processing
call npm install
echo Order processing example installed
echo.

REM Install kafka inventory example
echo Installing 03-kafka-inventory...
cd ..\03-kafka-inventory
call npm install
echo Kafka inventory example installed
echo.

REM Install demo utilities
echo Installing demo utilities...
cd ..\demo
call npm install
echo Demo utilities installed
echo.

echo All examples installed successfully!
echo.
echo To run the examples:
echo   - Basic Example: cd 00-basic-example ^&^& npm run demo (Start here!)
echo   - User Onboarding: cd 01-user-onboarding ^&^& npm run demo
echo   - Order Processing: cd 02-order-processing ^&^& npm run demo
echo   - Kafka Inventory: cd 03-kafka-inventory ^&^& npm run demo

cd ..

