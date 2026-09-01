@echo off
REM ============================================================
REM  Opens an SSH tunnel to the CloudPanel staging database.
REM
REM  While this window is open, your laptop's 127.0.0.1:3306
REM  is forwarded to the CloudPanel server's own 127.0.0.1:3306
REM  (the scorelo database shown in phpMyAdmin).
REM
REM  KEEP THIS WINDOW OPEN. Closing it closes the tunnel.
REM ============================================================

echo.
echo   Connecting to CloudPanel staging database...
echo   Server : 178.104.234.251
echo   User   : scorelo-staging
echo.
echo   Type your SSH password when asked.
echo   After that the screen goes blank and quiet - THAT MEANS IT IS WORKING.
echo   Leave this window open.
echo.

ssh -N -L 3306:127.0.0.1:3306 scorelo-staging@178.104.234.251

echo.
echo   Tunnel closed.
pause
