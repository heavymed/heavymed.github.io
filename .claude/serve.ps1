# Serveur HTTP statique minimal pour Claude Code Preview
# Sert les fichiers du répertoire parent (.claude/../)
param([int]$Port = 3000)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Serving $root on http://localhost:$Port"

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.ico'  = 'image/x-icon'
    '.svg'  = 'image/svg+xml'
    '.woff2'= 'font/woff2'
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req  = $context.Request
    $resp = $context.Response

    $urlPath = $req.Url.AbsolutePath
    if ($urlPath -eq '/') { $urlPath = '/index.html' }

    $filePath = Join-Path $root $urlPath.TrimStart('/')

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $resp.ContentType   = $mime
        $resp.ContentLength64 = $bytes.LongLength
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $resp.StatusCode = 404
        $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $resp.ContentLength64 = $body.LongLength
        $resp.OutputStream.Write($body, 0, $body.Length)
    }
    $resp.OutputStream.Flush()
    $resp.OutputStream.Close()
}
