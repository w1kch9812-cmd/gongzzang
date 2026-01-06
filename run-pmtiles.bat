@echo off
echo ================================================
echo  PMTiles 생성 (재개 모드)
echo  - 이미 생성된 파일은 스킵합니다
echo  - 중간에 끊겨도 다시 실행하면 이어서 진행됩니다
echo ================================================
echo.
cd /d %~dp0
wsl bash /mnt/e/gongzzang/scripts/generate-pmtiles-resume.sh
echo.
echo Done!
pause
