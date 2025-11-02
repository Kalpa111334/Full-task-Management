# WhatsApp Test Script for PowerShell
# Tests phone number: 0755682782

Write-Host "📱 WhatsApp API Test Script" -ForegroundColor Green
Write-Host "Testing phone: 0755682782" -ForegroundColor Cyan
Write-Host ""

# Test 1: Direct API (works on localhost)
Write-Host "Test 1: Direct WhatsApp API" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow

$phone = "94755681782"  # Formatted
$message = "Test from PowerShell - Task Management System"
$url = "https://api.geekhirusha.com/emptaskmanagement.php?number=$phone&type=text&message=$([uri]::EscapeDataString($message))"

Write-Host "URL: $url" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri $url -Method Get
    Write-Host "✅ Direct API Success!" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "❌ Direct API Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# Test 2: Serverless Function (localhost)
Write-Host "Test 2: Serverless Function (localhost)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow

$body = @{
    number = "0755682782"
    type = "text"
    message = "Test from PowerShell Serverless - Task Management System"
} | ConvertTo-Json

Write-Host "Request body: $body" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/send-whatsapp" `
        -Method POST `
        -Body $body `
        -ContentType "application/json"
    
    Write-Host "✅ Serverless Success!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor White
} catch {
    Write-Host "❌ Serverless Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure dev server is running: npm run dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host ""

# Test 3: Serverless Function (Vercel)
Write-Host "Test 3: Serverless Function (Vercel)" -ForegroundColor Yellow
Write-Host "-------------------------------------" -ForegroundColor Yellow

$vercelUrl = Read-Host "Enter your Vercel URL (or press Enter to skip)"

if ($vercelUrl) {
    $body = @{
        number = "0755682782"
        type = "text"
        message = "Test from PowerShell to Vercel - Task Management System"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$vercelUrl/api/send-whatsapp" `
            -Method POST `
            -Body $body `
            -ContentType "application/json"
        
        Write-Host "✅ Vercel Success!" -ForegroundColor Green
        Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor White
    } catch {
        Write-Host "❌ Vercel Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped Vercel test" -ForegroundColor Gray
}

Write-Host ""
Write-Host ""
Write-Host "✅ Testing Complete!" -ForegroundColor Green
Write-Host "Check WhatsApp at 0755682782 for messages" -ForegroundColor Cyan
