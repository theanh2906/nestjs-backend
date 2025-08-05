@echo off
set "KAFKA_HOME=D:\kafka_2.13-4.0.0"
set "LOG_DIR=D:\tmp\kraft-combined-logs"
set "BIN_DIR=%KAFKA_HOME%\bin\windows"

:: Remove all topics
@REM %BIN_DIR%\kafka-topics.bat --bootstrap-server localhost:9092 --delete --topic * 2>nul
@REM if not errorlevel 1 (
@REM     echo Successfully delete all topics.
@REM ) else (
@REM     echo Failed to delete all topics, but continuing script...
@REM )

:: Remove old log directory
if exist %LOG_DIR% (
    rmdir /s /q %LOG_DIR%
    if errorlevel 1 (
        echo Failed to delete old log directory. Please try again!
        exit /b 1
    ) else (
        echo Successfully deleted old log directory.
    )
)

:: Generate new cluster id
for /f "tokens=*" %%i in ('%BIN_DIR%\kafka-storage.bat random-uuid') do set random_uuid=%%i

if defined random_uuid (
    echo Generated cluster id: %random_uuid%
) else (
    echo Error in generating cluster id. Please try again!
    exit /b 1
)

:: Format log directory with created cluster id
%BIN_DIR%\kafka-storage.bat format --standalone -t %random_uuid% -c %KAFKA_HOME%\config\server.properties
if errorlevel 0 (
    echo Successfully formatted log directory.
) else (
    echo Failed to format log directory. Please try again!
    exit /b 1
)
