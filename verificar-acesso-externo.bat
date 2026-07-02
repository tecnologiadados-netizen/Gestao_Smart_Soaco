@echo off
chcp 65001 >nul
echo ========================================
echo   Diagnóstico - Acesso externo porta 3000
echo ========================================
echo.

echo [1] Porta 3000 - quem está escutando?
netstat -ano | findstr ":3000"
echo.
echo    Se aparecer 0.0.0.0:3000 = servidor aceita conexões de qualquer IP.
echo    Se aparecer 127.0.0.1:3000 = só localhost (não acessível externamente).
echo.

echo [2] IPs desta máquina:
ipconfig | findstr /i "IPv4"
echo.
echo    Use um desses IPs para testar de outro PC (ex.: http://IP:3000)
echo    Ou use o IP público 170.84.146.147 se for o IP da internet.
echo.

echo [3] Regra no Firewall (porta 3000):
netsh advfirewall firewall show rule name="Gestor Pedidos 3000" 2>nul
if %ERRORLEVEL% neq 0 (
    echo    Regra nao encontrada. Execute liberar-porta-3000-firewall.bat como Administrador.
)
echo.

echo [4] Teste local (no proprio servidor):
echo    Abra no navegador: http://localhost:3000
echo    Se funcionar aqui mas nao de fora = Firewall ou roteador bloqueando.
echo.

echo Se o servidor estiver ATRAS DE UM ROTEADOR:
echo    - Configure no roteador: Encaminhamento de porta / NAT
echo    - Porta externa 3000 -^> IP desta maquina -^> Porta 3000
echo.
pause
