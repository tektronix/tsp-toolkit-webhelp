::--------------------------------------------------
:: AfterPublishing.bat - Runs OracleToEclipse
::--------------------------------------------------

@echo off

::Get the current batch file's short path
for %%x in (%0) do set BatchPath=%%~dpsx
for %%x in (%BatchPath%) do set BatchPath=%%~dpsx
echo BatchPath = %BatchPath%

echo "Enter ShortName (2600B, 3700, 707B, 2651A, 2657A, 2450, 2460):" 
set /p ShortName=

echo "ShortName is " %ShortName%

cd %BatchPath%
OracleToEclipse toc.xml %ShortName%

